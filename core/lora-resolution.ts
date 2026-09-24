import type { LoraReference, ModelCatalogRecord } from './types.js';
import {
  getCachedLoraByHash,
  getCachedLoraByAlias,
  findMatchingSeedLorasInText,
  upsertLoraRecord,
  toResolvedLora,
} from './lora-cache.js';
import {
  scoreModelCandidate,
  extractMeaningfulTokens,
  type CandidateModelItem,
  type CandidateMatchResult,
} from './similarity.js';

/**
 * Normalizes raw LoRA filenames or prompt tags into clean search queries.
 * Examples:
 *  - "【Anima】Landscape specialization lora" -> "Anima Landscape specialization"
 *  - "CyberpunkInterior, YFG-Aarchy" -> "Cyberpunk Interior"
 *  - "Cyberpunk Interior (Architecture) (Buildings) (Krea2) (AD)" -> "Cyberpunk Interior"
 *  - "Echidna_ReZero_SDXL_v1.0.safetensors" -> "Echidna ReZero"
 *  - "<lora:epiCRealism_v5:0.8>" -> "epiCRealism"
 */
export function normalizeLoraName(rawName: string): string {
  if (!rawName) return '';

  let name = rawName.trim();

  // Strip leading '<lora:' or 'lora:' and trailing ':weight>'
  name = name.replace(/^<lora:/i, '').replace(/^lora:/i, '');
  name = name.replace(/:[\d.]+(>)?$/, '');
  name = name.replace(/>$/, '');

  // Strip Asian / Unicode brackets: 【 】 《 》 （ ） ［ ］
  name = name.replace(/[【】《》（）［］]/g, ' ');

  // Strip parenthetical descriptors: (Architecture) (Buildings) (Krea2) (AD)
  name = name.replace(/\([^)]*\)/g, ' ');

  // Strip file extensions
  name = name.replace(/\.(safetensors|ckpt|pt|bin)$/i, '');

  // Split camelCase and acronym boundaries (e.g. CSMMovieStyleIL -> CSM Movie Style IL)
  name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  // Strip common training/model suffixes
  name = name.replace(/_?(sdxl|sd15|sd1\.5|sd2\.1|pony|flux|illustrious|animagine|krea2|krea|il|xl|pd)\b/gi, ' ');
  name = name.replace(/_?(v\d+(\.\d+)?|epoch\d+|step\d+|offset|lora|style|lora_v\d+)\b/gi, ' ');

  // Replace underscores, dashes, dots, commas with spaces
  name = name.replace(/[_\-.,]+/g, ' ');

  // Collapse multiple spaces and trim
  name = name.replace(/\s+/g, ' ').trim();

  return name || rawName.trim();
}

/**
 * Scans prompt text for known LoRA trigger words and aliases
 */
export function scanPromptForKnownLoras(promptText: string): LoraReference[] {
  if (!promptText) return [];
  const matched = findMatchingSeedLorasInText(promptText);
  return matched.map((item) => ({
    rawName: item.name,
    strength: 1.0,
    resolved: {
      name: item.name,
      source: 'civitai' as const,
      modelUrl: item.modelUrl,
      coverImageUrl: item.coverImageUrl,
      triggerWords: item.triggerWords,
      baseModel: item.baseModel,
      versionName: 'v1.0',
    },
  }));
}

let cachedAsyncApiKey: string | null = null;
if (typeof window !== 'undefined' && window.promptHound?.settings?.getCivitaiKey) {
  window.promptHound.settings.getCivitaiKey().then((k) => {
    cachedAsyncApiKey = k;
  }).catch(() => {});
}

export function setRuntimeCivitaiApiKey(key: string | null): void {
  cachedAsyncApiKey = key;
}

export type CivitaiDomainPreference = 'civitai.red' | 'civitai.com' | 'auto';

export function getPreferredCivitaiDomain(): CivitaiDomainPreference {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('prompthound_civitai_domain');
      if (stored === 'civitai.com' || stored === 'civitai.red' || stored === 'auto') {
        return stored;
      }
    }
  } catch {
    // fallback
  }
  // civitai.red is the default since it hosts the full catalog (both SFW and NSFW) without filtering
  return 'civitai.red';
}

export function setPreferredCivitaiDomain(domain: CivitaiDomainPreference): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('prompthound_civitai_domain', domain);
    }
  } catch {
    // ignore
  }
}

/**
 * Builds the appropriate Civitai web URL based on model ID, optional version ID,
 * NSFW classification, and user domain preference.
 * Defaults to civitai.red as it contains both SFW and NSFW content seamlessly.
 */
export function buildCivitaiModelUrl(
  modelId: number,
  versionId?: number,
  nsfw?: boolean
): string {
  const domainPref = getPreferredCivitaiDomain();
  let host = 'civitai.red';
  if (domainPref === 'civitai.com') {
    host = 'civitai.com';
  } else if (domainPref === 'auto') {
    host = nsfw ? 'civitai.red' : 'civitai.com';
  } else {
    // 'civitai.red' default
    host = 'civitai.red';
  }

  return `https://${host}/models/${modelId}${versionId ? `?modelVersionId=${versionId}` : ''}`;
}

/**
 * Helper to get optional Civitai API key from in-memory cache or localStorage
 */
function getCivitaiApiKey(): string | null {
  if (cachedAsyncApiKey) return cachedAsyncApiKey;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('prompthound_civitai_key') || null;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Performs a live Civitai search and scores candidate models against query and target hash.
 */
export async function searchCivitaiCandidates(
  query: string,
  targetHash?: string,
  modelType: 'LORA' | 'Checkpoint' | 'all' = 'LORA'
): Promise<CandidateMatchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery && !targetHash) return [];

  const apiKey = getCivitaiApiKey();
  const headers: Record<string, string> = {
    'User-Agent': 'PromptHound/1.0.5 (Metadata-Extractor)',
    'Accept': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
  };

  const results: CandidateModelItem[] = [];

  // 1. Search by hash if provided
  if (targetHash) {
    const cleanHash = targetHash.trim().toLowerCase();
    try {
      const hashRes = await fetch(
        `https://civitai.com/api/v1/model-versions/by-hash/${encodeURIComponent(cleanHash)}`,
        { headers }
      );
      if (hashRes.ok) {
        const data = (await hashRes.json()) as any;
        if (data && data.modelId) {
          results.push({
            id: Number(data.modelId),
            name: data.model?.name || data.name || query,
            modelVersions: [data],
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Search by query text
  if (cleanQuery.length >= 2) {
    try {
      const typeParam = modelType === 'all' ? '' : `&types=${modelType}`;
      const searchRes = await fetch(
        `https://civitai.com/api/v1/models?query=${encodeURIComponent(cleanQuery)}${typeParam}&limit=10`,
        { headers }
      );
      if (searchRes.ok) {
        const data = (await searchRes.json()) as any;
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            if (!results.some((r) => r.id === item.id)) {
              results.push(item);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const normalized = normalizeLoraName(cleanQuery);

  // Score all candidates
  const scored = results
    .map((c) => scoreModelCandidate(cleanQuery, normalized, c, targetHash))
    .sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Resolves a single LoRA reference with multi-strategy waterfall & strict similarity guardrails:
 * 1. Tier 1 Cache Hit (by exact/prefix SHA256 or alias)
 * 2. Tier 2 Exact Hash Lookup via Civitai /model-versions/by-hash/:hash -> Auto-Upsert
 * 3. Tier 2 Multi-Candidate Civitai Search with strict similarity threshold (score >= 0.45) -> Auto-Upsert
 */
async function resolveSingleLora(lora: LoraReference): Promise<LoraReference> {
  const normalizedAlias = normalizeLoraName(lora.rawName);

  // 1. Tier 1: Check Local Cache (exact SHA256, short hash, or alias)
  if (lora.hash) {
    const cachedByHash = getCachedLoraByHash(lora.hash);
    if (cachedByHash) {
      return { ...lora, resolved: toResolvedLora(cachedByHash) };
    }
  }

  if (normalizedAlias) {
    const cachedByAlias = getCachedLoraByAlias(normalizedAlias);
    if (cachedByAlias) {
      return { ...lora, resolved: toResolvedLora(cachedByAlias) };
    }
  }

  const apiKey = getCivitaiApiKey();
  const headers: Record<string, string> = {
    'User-Agent': 'PromptHound/1.0.4 (Metadata-Extractor)',
    'Accept': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
  };

  // 2. Tier 2: Exact Hash Lookup Waterfall Step
  if (lora.hash) {
    const cleanHash = lora.hash.trim().toLowerCase();
    try {
      const response = await fetch(
        `https://civitai.com/api/v1/model-versions/by-hash/${encodeURIComponent(cleanHash)}`,
        { headers }
      );

      if (response.ok) {
        const data = (await response.json()) as any;
        if (data && data.modelId) {
          const modelId = Number(data.modelId);
          const versionId = Number(data.id);
          const coverImage = data.images?.[0];
          const triggerWords = Array.isArray(data.trainedWords) ? data.trainedWords : [];
          const isNsfw = Boolean(data.model?.nsfw ?? data.nsfw ?? (data.nsfwLevel && data.nsfwLevel > 1));

          const catalogRecord: Omit<ModelCatalogRecord, 'cachedAt'> = {
            civitaiModelId: modelId,
            civitaiVersionId: versionId,
            name: data.model?.name || data.name || lora.rawName,
            normalizedAlias: normalizedAlias || normalizeLoraName(data.model?.name || lora.rawName),
            hashSha256: cleanHash,
            coverImageId: coverImage?.id ? String(coverImage.id) : undefined,
            coverImageUrl: coverImage?.url || undefined,
            triggerWords,
            baseModel: data.baseModel || undefined,
            nsfw: isNsfw,
            source: 'civitai',
            modelUrl: buildCivitaiModelUrl(modelId, versionId, isNsfw),
          };

          // Auto-upsert verified hash record
          upsertLoraRecord(catalogRecord);

          return { ...lora, resolved: toResolvedLora({ ...catalogRecord, cachedAt: Date.now() }) };
        }
      }
    } catch {
      // Degrade to candidate search
    }
  }

  // 3. Tier 2: Multi-Candidate Search with Strict Match Validation
  const queryTokens = extractMeaningfulTokens(normalizedAlias || lora.rawName);
  if (queryTokens.length > 0) {
    try {
      const searchQueries = [
        normalizedAlias,
        lora.rawName.replace(/\.(safetensors|pt|ckpt|bin)$/i, '').replace(/[_\-]+/g, ' ').trim(),
      ].filter(Boolean);

      const uniqueQueries = Array.from(new Set(searchQueries));
      let candidates: CandidateMatchResult[] = [];

      for (const q of uniqueQueries) {
        if (q.length < 2) continue;
        const res = await searchCivitaiCandidates(q, lora.hash);
        if (res.length > 0) {
          candidates = res;
          break;
        }
      }

      // Civitai's /api/v1/models?query=... does not return empty on no-match.
      // It returns a popularity-weighted fallback list. Without this filter,
      // ambiguous or custom LoRA names are silently attributed to unrelated
      // popular models (historically model #34586, "Unknownspy - Sploot").
      // This filter hard-rejects candidates with zero token overlap and
      // requires a Dice bigram score >= 0.45 before accepting a name match.
      const topValid = candidates.find((c) => c.score >= 0.45);

      if (topValid) {
        const model = topValid.candidate;
        const matchedVersion = topValid.matchedVersionId
          ? model.modelVersions?.find((v) => v.id === topValid.matchedVersionId)
          : model.modelVersions?.[0];

        const modelId = Number(model.id);
        const versionId = matchedVersion?.id ? Number(matchedVersion.id) : undefined;
        const coverImage = matchedVersion?.images?.[0];
        const triggerWords = Array.isArray(matchedVersion?.trainedWords)
          ? matchedVersion.trainedWords
          : [];
        const isNsfw = Boolean(model.nsfw ?? (model.nsfwLevel && model.nsfwLevel > 1));

        const catalogRecord: Omit<ModelCatalogRecord, 'cachedAt'> = {
          civitaiModelId: modelId,
          civitaiVersionId: versionId,
          name: model.name || lora.rawName,
          normalizedAlias: normalizedAlias || normalizeLoraName(model.name),
          hashSha256: lora.hash ? lora.hash.trim().toLowerCase() : undefined,
          coverImageId: coverImage?.id ? String(coverImage.id) : undefined,
          coverImageUrl: coverImage?.url || undefined,
          triggerWords,
          baseModel: matchedVersion?.baseModel || undefined,
          nsfw: isNsfw,
          source: 'civitai',
          modelUrl: buildCivitaiModelUrl(modelId, versionId, isNsfw),
        };

        // Auto-upsert verified candidate
        upsertLoraRecord(catalogRecord);

        return { ...lora, resolved: toResolvedLora({ ...catalogRecord, cachedAt: Date.now() }) };
      }
    } catch {
      // Network failure / offline
    }
  }

  // If no confident match found, return raw reference without false attribution
  return lora;
}

/**
 * Resolves all LoRAs concurrently with fault-tolerance and early cache-exit.
 */
export async function resolveLoras(loras: LoraReference[]): Promise<LoraReference[]> {
  if (!loras || loras.length === 0) return [];

  const settled = await Promise.allSettled(
    loras.map((lora) => resolveSingleLora(lora))
  );

  return settled.map((r, i) => (r.status === 'fulfilled' ? r.value : loras[i]));
}

/**
 * Resolves a base model checkpoint name or hash to its verified Civitai metadata
 */
export async function resolveModelCheckpoint(
  rawModelName?: string,
  modelHash?: string
): Promise<{
  name: string;
  source?: 'civitai';
  modelUrl?: string;
  coverImageUrl?: string;
  baseModel?: string;
  versionName?: string;
  civitaiModelId?: number;
  civitaiVersionId?: number;
} | null> {
  if (!rawModelName && !modelHash) return null;

  const normalized = rawModelName ? normalizeLoraName(rawModelName) : '';

  // 1. Check local seed & cache
  if (modelHash) {
    const cachedByHash = getCachedLoraByHash(modelHash);
    if (cachedByHash) {
      return {
        name: cachedByHash.name,
        source: 'civitai',
        modelUrl: cachedByHash.modelUrl,
        coverImageUrl: cachedByHash.coverImageUrl,
        baseModel: cachedByHash.baseModel,
        civitaiModelId: cachedByHash.civitaiModelId,
        civitaiVersionId: cachedByHash.civitaiVersionId,
      };
    }
  }

  if (normalized) {
    const cachedByAlias = getCachedLoraByAlias(normalized);
    if (cachedByAlias) {
      return {
        name: cachedByAlias.name,
        source: 'civitai',
        modelUrl: cachedByAlias.modelUrl,
        coverImageUrl: cachedByAlias.coverImageUrl,
        baseModel: cachedByAlias.baseModel,
        civitaiModelId: cachedByAlias.civitaiModelId,
        civitaiVersionId: cachedByAlias.civitaiVersionId,
      };
    }
  }

  // 2. Query Civitai Candidates (Checkpoint type)
  try {
    const candidates = await searchCivitaiCandidates(
      normalized || rawModelName || '',
      modelHash,
      'Checkpoint'
    );

    const topMatch = candidates.find((c) => c.score >= 0.4);
    if (topMatch) {
      const model = topMatch.candidate;
      const matchedVersion = topMatch.matchedVersionId
        ? model.modelVersions?.find((v) => v.id === topMatch.matchedVersionId)
        : model.modelVersions?.[0];

      const modelId = Number(model.id);
      const versionId = matchedVersion?.id ? Number(matchedVersion.id) : undefined;
      const coverImage = matchedVersion?.images?.[0];
      const isNsfw = Boolean(model.nsfw ?? (model.nsfwLevel && model.nsfwLevel > 1));

      return {
        name: model.name || rawModelName || '',
        source: 'civitai',
        modelUrl: buildCivitaiModelUrl(modelId, versionId, isNsfw),
        coverImageUrl: coverImage?.url,
        baseModel: matchedVersion?.baseModel,
        versionName: matchedVersion?.name,
        civitaiModelId: modelId,
        civitaiVersionId: versionId,
      };
    }
  } catch {
    // ignore
  }

  return null;
}
