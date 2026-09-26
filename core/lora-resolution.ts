import type { LoraReference, ModelCatalogRecord } from './types.js';
import { applyAirIdentifier } from './metadata-merge.js';
import {
  findLoraByHash,
  findLoraByAlias,
  findLoraByVersionId,
  normalizeHash,
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
 *  - "Cyberpunk Interior (Architecture) (Buildings) (Krea2) (AD)" -> "Cyberpunk Interior"
 *  - "Echidna_ReZero_SDXL_v1.0.safetensors" -> "Echidna Re Zero"
 *  - "anime_style_xl" -> "anime style" (not "anime")
 *  - "add_detail" -> "add detail" (words are never cut apart)
 */
// Network-type words that never identify a specific LoRA
const NETWORK_TYPE_TOKENS = new Set(['lora', 'loras', 'lycoris', 'locon', 'loha', 'lokr', 'dora', 'lyco']);

// Base-model markers dropped only from the ends of a name ("Echidna_ReZero_SDXL"),
// never from the middle, and never when they are all that is left
const TRAILING_ARCH_TOKENS = new Set([
  'sdxl', 'sd15', 'sd1.5', 'sd21', 'sd2.1', 'sd3', 'sd35', 'sd', 'xl', 'il', 'ill', 'illu',
  'pdxl', 'ponyxl', 'pony', 'flux', 'flux1', 'illustrious', 'noobai', 'nai', 'animagine', 'krea', 'krea2', 'pd',
]);
// Leading markers are a narrower set: "flux_realism" and "pony_score" start with a real word
const LEADING_ARCH_TOKENS = new Set(['sdxl', 'sd15', 'sd1.5', 'sd21', 'sd2.1', 'sd3', 'sd', 'xl', 'il', 'pdxl']);

function isVersionToken(token: string): boolean {
  return (
    /^v?\d+(\.\d+)*[a-z]?$/i.test(token) ||
    /^(epoch|ep|e|step|steps|s)\d+$/i.test(token) ||
    /^\d+(ep|epoch|epochs|step|steps)$/i.test(token)
  );
}

/**
 * Turns a raw LoRA filename or prompt tag into a search / alias string.
 * Works on whole tokens so words are never cut apart ("add_detail" stays "add detail").
 */
export function normalizeLoraName(rawName: string): string {
  if (!rawName) return '';

  let name = rawName.trim();

  // Strip '<lora:' / '<lyco:' prefixes and trailing ':weight>'
  name = name.replace(/^<?(lora|lyco|lycoris):/i, '');
  name = name.replace(/(:[\d.]+)+>?$/, '');
  name = name.replace(/>$/, '');

  // Drop folder paths (ComfyUI "characters\\name.safetensors") and file extensions.
  // Only for things that look like file paths: model titles such as
  // "Art Style / [Illustrious/NoobAI]" contain slashes too.
  if (/\.(safetensors|ckpt|pt|bin)$/i.test(name) || !/\s/.test(name)) {
    name = name.split(/[\\/]/).pop() || name;
  }
  name = name.replace(/\.(safetensors|ckpt|pt|bin)$/i, '');

  // Keep the contents of Asian / full-width brackets: 【Anima】Landscape -> Anima Landscape
  name = name.replace(/[【】《》（）［］]/g, ' ');

  // Strip ASCII parenthetical / bracketed descriptors: (Architecture) [Illustrious]
  name = name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');

  // Isolate network-type words so camelCase splitting cannot turn "LoRA" into "Lo RA"
  name = name.replace(/(LoRA|LyCORIS|LoCon|LoHa|LoKr|DoRA)/g, ' $1 ');

  // Split camelCase and acronym boundaries (CSMMovieStyleIL -> CSM Movie Style IL)
  const splitCamel = (token: string): string[] => {
    if (NETWORK_TYPE_TOKENS.has(token.toLowerCase())) return [token];
    return token
      .replace(/([a-z])([A-Z])(?=[a-z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z])([A-Z]{2,})$/g, '$1 $2')
      .split(' ');
  };

  // Any character other than letters, digits and dots separates words ("|", ":", "/", emoji)
  const allTokens = name
    .split(/[^\p{L}\p{N}.]+/u)
    .flatMap(splitCamel)
    .map((t) => t.trim())
    .filter(Boolean);

  let tokens = allTokens.filter((t) => !NETWORK_TYPE_TOKENS.has(t.toLowerCase()) && !isVersionToken(t));

  const meaningful = tokens.filter((t) => !TRAILING_ARCH_TOKENS.has(t.toLowerCase()));
  if (meaningful.length > 0) {
    while (tokens.length > 1 && TRAILING_ARCH_TOKENS.has(tokens[tokens.length - 1].toLowerCase())) {
      tokens.pop();
    }
    while (tokens.length > 1 && LEADING_ARCH_TOKENS.has(tokens[0].toLowerCase())) {
      tokens.shift();
    }
  }

  // Remaining dotted tokens (e.g. "detail.tweaker") become separate words
  const result = tokens
    .flatMap((t) => (/^\d+(\.\d+)+$/.test(t) ? [t] : t.split('.')))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (result) return result;

  // Everything was noise: fall back to whatever non-network tokens exist
  const fallback = allTokens.filter((t) => !NETWORK_TYPE_TOKENS.has(t.toLowerCase())).join(' ').trim();
  return fallback || rawName.trim();
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
const USER_AGENT = 'PromptHound/1.0.8 (Metadata-Extractor)';

// Civitai lists LyCORIS as "LoCon" and DoRA separately from "LORA"; all load as LoRAs
const LORA_MODEL_TYPES = ['LORA', 'LoCon', 'DoRA'];

export async function searchCivitaiCandidates(
  query: string,
  targetHash?: string,
  modelType: 'LORA' | 'Checkpoint' | 'all' = 'LORA',
  options: { skipHashLookup?: boolean } = {}
): Promise<CandidateMatchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery && !targetHash) return [];

  const apiKey = getCivitaiApiKey();
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
  };

  const results: CandidateModelItem[] = [];

  // 1. Search by hash if provided (callers that already queried by-hash skip this)
  if (targetHash && !options.skipHashLookup) {
    const cleanHash = normalizeHash(targetHash);
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
      const types = modelType === 'all' ? [] : modelType === 'LORA' ? LORA_MODEL_TYPES : [modelType];
      const typeParam = types.map((t) => `&types=${encodeURIComponent(t)}`).join('');
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
    .map((c) => scoreModelCandidate(cleanQuery, normalized, c, targetHash ? normalizeHash(targetHash) : undefined))
    .sort((a, b) => b.score - a.score);

  return scored;
}

const CIVITAI_VERSION_PLACEHOLDER = /^Civitai model version \d+$/;

/**
 * Builds a catalog record from a Civitai model-version payload, as returned by both
 * /model-versions/{id} and /model-versions/by-hash/{hash}.
 */
function recordFromVersionData(
  data: any,
  lora: LoraReference,
  normalizedAlias: string,
  hash?: string
): Omit<ModelCatalogRecord, 'cachedAt'> | null {
  if (!data || !data.modelId) return null;

  const modelId = Number(data.modelId);
  const versionId = Number(data.id);
  const coverImage = data.images?.[0];
  const triggerWords = Array.isArray(data.trainedWords) ? data.trainedWords : [];
  const isNsfw = Boolean(data.model?.nsfw ?? data.nsfw ?? (data.nsfwLevel && data.nsfwLevel > 1));
  const name = data.model?.name || data.name || lora.rawName;

  return {
    civitaiModelId: modelId,
    civitaiVersionId: Number.isFinite(versionId) ? versionId : undefined,
    name,
    versionName: typeof data.name === 'string' ? data.name : undefined,
    normalizedAlias: normalizedAlias || normalizeLoraName(name),
    hashSha256: hash ? normalizeHash(hash) : undefined,
    coverImageId: coverImage?.id ? String(coverImage.id) : undefined,
    coverImageUrl: coverImage?.url || undefined,
    triggerWords,
    baseModel: data.baseModel || undefined,
    nsfw: isNsfw,
    source: 'civitai',
    modelUrl: buildCivitaiModelUrl(modelId, Number.isFinite(versionId) ? versionId : undefined, isNsfw),
  };
}

async function fetchVersionRecord(
  url: string,
  lora: LoraReference,
  normalizedAlias: string,
  headers: Record<string, string>,
  matchedBy: 'hash' | 'civitai-version',
  hash?: string
): Promise<LoraReference | null> {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const record = recordFromVersionData(await response.json(), lora, normalizedAlias, hash);
    if (!record) return null;
    upsertLoraRecord(record);
    return { ...lora, resolved: toResolvedLora({ ...record, cachedAt: Date.now() }, matchedBy) };
  } catch {
    return null;
  }
}

/**
 * Resolves a single LoRA reference, most reliable identifier first:
 * 1. Cache hit by hash, then by Civitai model-version id
 * 2. Civitai /model-versions/by-hash/{hash}, then /model-versions/{id}
 * 3. Cache hit by normalized alias
 * 4. Multi-candidate Civitai name search with strict similarity threshold (score >= 0.45)
 * Exact identifiers are checked before names so a similar-looking cached alias
 * can never override what the image itself states.
 */
async function resolveSingleLora(input: LoraReference): Promise<LoraReference> {
  const lora = applyAirIdentifier(input);
  // Placeholder names ("Civitai model version 123") carry no searchable information
  const hasRealName = !CIVITAI_VERSION_PLACEHOLDER.test(lora.rawName);
  const normalizedAlias = hasRealName ? normalizeLoraName(lora.rawName) : '';

  const hash = lora.hash ? normalizeHash(lora.hash) : undefined;

  // 1. Tier 1: exact identifiers in the local cache (memory, then SQLite)
  if (hash) {
    const cachedByHash = await findLoraByHash(hash);
    if (cachedByHash) {
      return { ...lora, resolved: toResolvedLora(cachedByHash, 'hash') };
    }
  }

  if (lora.civitaiVersionId !== undefined) {
    const cachedByVersion = await findLoraByVersionId(lora.civitaiVersionId);
    if (cachedByVersion) {
      return { ...lora, resolved: toResolvedLora(cachedByVersion, 'civitai-version') };
    }
  }

  const apiKey = getCivitaiApiKey();
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
  };

  // 2. Tier 2: exact identifiers online
  if (hash) {
    const byHash = await fetchVersionRecord(
      `https://civitai.com/api/v1/model-versions/by-hash/${encodeURIComponent(hash)}`,
      lora,
      normalizedAlias,
      headers,
      'hash',
      hash
    );
    if (byHash) return byHash;
  }

  if (lora.civitaiVersionId !== undefined) {
    const byVersion = await fetchVersionRecord(
      `https://civitai.com/api/v1/model-versions/${lora.civitaiVersionId}`,
      lora,
      normalizedAlias,
      headers,
      'civitai-version'
    );
    if (byVersion) return byVersion;
  }

  // Without a real name there is nothing safe to match on
  if (!hasRealName) return lora;

  // 3. Tier 1: cached alias
  if (normalizedAlias) {
    const cachedByAlias = await findLoraByAlias(normalizedAlias);
    // The bundled catalog holds the hash of every version of its models. When the image
    // gives a hash that none of them has, a same-name catalog model is a different file.
    const hashContradicts = Boolean(hash && hash.length >= 10) && cachedByAlias?.cachedAt === 0;
    if (cachedByAlias && !hashContradicts) {
      return { ...lora, resolved: toResolvedLora(cachedByAlias, 'name-match') };
    }
  }

  // 4. Tier 2: Multi-Candidate Search with Strict Match Validation
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
        // by-hash was already queried in tier 2; the hash is still used to score file hashes
        const res = await searchCivitaiCandidates(q, hash, 'LORA', { skipHashLookup: true });
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
        // Only a file-hash hit proves the hash; a name guess must not be cached under it,
        // or later images with that hash would get the guess back as a "hash match"
        const hashVerified = Boolean(hash) && topValid.matchReason.startsWith('Exact hash match');

        const catalogRecord: Omit<ModelCatalogRecord, 'cachedAt'> = {
          civitaiModelId: modelId,
          civitaiVersionId: versionId,
          name: model.name || lora.rawName,
          normalizedAlias: normalizedAlias || normalizeLoraName(model.name),
          hashSha256: hashVerified ? hash : undefined,
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

        return {
          ...lora,
          resolved: toResolvedLora(
            { ...catalogRecord, cachedAt: Date.now() },
            hashVerified ? 'hash' : 'name-match',
            hashVerified ? undefined : topValid.score
          ),
        };
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
    const cachedByHash = await findLoraByHash(modelHash);
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
    const cachedByAlias = await findLoraByAlias(normalized);
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
