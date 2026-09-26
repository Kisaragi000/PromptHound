import type { ExtractedMetadata, LoraReference } from './types.js';

/**
 * Inline network tags: <lora:name:weight>, <lyco:name:weight>, and Civitai AIR ids
 * (<lora:urn:air:sdxl:lora:civitai:341353@382152:0.8>), whose name contains colons.
 * Group 1 is the name, group 2 the parameters.
 */
export const INLINE_LORA_TAG = /<(?:lora|lyco|lycoris):(urn:air:(?:[^:>]+:){4}[^:>@]+@[^:>]+|[^:>]+)(?::([^>]+))?>/gi;

/** Civitai AIR id: urn:air:{ecosystem}:{type}:civitai:{modelId}@{versionId} */
export function parseCivitaiAir(name: string): { modelId: number; versionId: number } | undefined {
  const match = name.trim().match(/^urn:air:[^:]+:[^:]+:civitai:(\d+)@(\d+)/i);
  return match ? { modelId: Number(match[1]), versionId: Number(match[2]) } : undefined;
}

/**
 * An AIR id names the exact Civitai version; store it as such and give the LoRA the
 * same placeholder name other parsers use, so the entries merge and resolve by id.
 */
export function applyAirIdentifier(lora: LoraReference): LoraReference {
  const air = parseCivitaiAir(lora.rawName);
  if (!air) return lora;
  return { ...lora, rawName: `Civitai model version ${air.versionId}`, civitaiVersionId: lora.civitaiVersionId ?? air.versionId };
}

/**
 * Identity key for a LoRA across parsers: file name without folders, extension or case.
 * "characters\\Echidna_ReZero_SDXL.safetensors" and "Echidna_ReZero_SDXL" are the same LoRA.
 */
export function loraKey(rawName: string): string {
  const base = rawName.trim().split(/[\\/]/).pop() || rawName;
  return base.replace(/\.(safetensors|ckpt|pt|bin)$/i, '').trim().toLowerCase();
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * How many of the fields a user cares about a parse result filled in.
 * The prompt counts most: a result without it is rarely the better one.
 */
export function completenessScore(meta: ExtractedMetadata): number {
  let score = 0;
  if (!isEmpty(meta.prompt)) score += 3;
  if (!isEmpty(meta.negativePrompt)) score += 1;
  if (!isEmpty(meta.sampler)) score += 1;
  if (meta.steps !== undefined) score += 1;
  if (meta.cfgScale !== undefined) score += 1;
  if (!isEmpty(meta.seed)) score += 1;
  if (!isEmpty(meta.model)) score += 1;
  if (meta.width !== undefined && meta.height !== undefined) score += 1;
  if (meta.loras.length > 0) score += 2;
  return score;
}

/**
 * Unions two LoRA lists. Entries from `primary` win; matching entries from
 * `secondary` only fill in what the primary is missing (hash, version id, weight).
 */
export function mergeLoras(primary: LoraReference[], secondary: LoraReference[]): LoraReference[] {
  const merged: LoraReference[] = [];
  // Within one parser's list too: an AIR tag and a "Civitai resources" entry are one LoRA
  for (const l of primary.map(applyAirIdentifier)) {
    const same = merged.find((m) => m.civitaiVersionId !== undefined && m.civitaiVersionId === l.civitaiVersionId);
    if (!same) merged.push({ ...l });
    else if (/^Civitai model version \d+$/.test(same.rawName)) same.rawName = l.rawName;
  }

  for (const extra of secondary.map(applyAirIdentifier)) {
    const existing = merged.find(
      (l) =>
        loraKey(l.rawName) === loraKey(extra.rawName) ||
        (l.civitaiVersionId !== undefined && l.civitaiVersionId === extra.civitaiVersionId) ||
        (l.hash !== undefined && extra.hash !== undefined && l.hash.toLowerCase() === extra.hash.toLowerCase())
    );

    if (!existing) {
      merged.push({ ...extra });
      continue;
    }

    // "Civitai model version 123" is a stand-in; prefer a real name from the other parser
    if (/^Civitai model version \d+$/.test(existing.rawName) && !/^Civitai model version \d+$/.test(extra.rawName)) {
      existing.rawName = extra.rawName;
    }
    if (existing.hash === undefined && extra.hash !== undefined) existing.hash = extra.hash;
    if (existing.civitaiVersionId === undefined && extra.civitaiVersionId !== undefined) {
      existing.civitaiVersionId = extra.civitaiVersionId;
    }
    if (existing.strength === undefined && extra.strength !== undefined) existing.strength = extra.strength;
    if (existing.resolved === undefined && extra.resolved !== undefined) existing.resolved = extra.resolved;
  }

  return merged;
}

/**
 * Field-by-field merge: every field comes from `primary` when it has one,
 * otherwise from `secondary`. LoRA lists are unioned.
 */
export function fillMissingFields(primary: ExtractedMetadata, secondary: ExtractedMetadata): ExtractedMetadata {
  const pick = <K extends keyof ExtractedMetadata>(key: K): ExtractedMetadata[K] =>
    isEmpty(primary[key]) ? secondary[key] : primary[key];

  return {
    prompt: pick('prompt') || '',
    negativePrompt: pick('negativePrompt'),
    sampler: pick('sampler'),
    steps: pick('steps'),
    cfgScale: pick('cfgScale'),
    seed: pick('seed'),
    model: pick('model'),
    modelHash: pick('modelHash'),
    // Width and height belong together; never mix one parser's width with another's height
    width: primary.width !== undefined && primary.height !== undefined ? primary.width : secondary.width ?? primary.width,
    height: primary.width !== undefined && primary.height !== undefined ? primary.height : secondary.height ?? primary.height,
    loras: mergeLoras(primary.loras, secondary.loras),
    detectedFormat: primary.detectedFormat !== 'unknown' ? primary.detectedFormat : secondary.detectedFormat,
    extraFields: { ...(secondary.extraFields || {}), ...(primary.extraFields || {}) },
  };
}

/**
 * Combines results from several parsers of the same image. The most complete
 * result is the base (ties go to the earlier entry); the rest only fill gaps.
 */
export function mergeExtractedMetadata(
  results: Array<ExtractedMetadata | null | undefined>,
  preferIndex?: (candidates: ExtractedMetadata[]) => number | undefined
): ExtractedMetadata | null {
  const candidates = results.filter((r): r is ExtractedMetadata => Boolean(r));
  if (candidates.length === 0) return null;

  let baseIndex = preferIndex?.(candidates);
  if (baseIndex === undefined || baseIndex < 0 || baseIndex >= candidates.length) {
    baseIndex = 0;
    for (let i = 1; i < candidates.length; i++) {
      if (completenessScore(candidates[i]) > completenessScore(candidates[baseIndex])) baseIndex = i;
    }
  }

  let merged = candidates[baseIndex];
  candidates.forEach((c, i) => {
    if (i !== baseIndex) merged = fillMissingFields(merged, c);
  });
  return merged;
}
