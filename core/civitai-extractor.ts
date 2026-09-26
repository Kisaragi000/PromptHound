import { readCivitaiMetadata, normalizeCivitaiGeneration } from '@civitai/generation-metadata/civitai';
import { normalizeGeneration } from '@civitai/generation-metadata';
import type { ExtractedMetadata, ExtractionResult, ExtractionError, LoraReference, SourceInfo } from './types.js';
import { resolveLoras } from './lora-resolution.js';
import { extractFromRawText } from './format-detect.js';

/**
 * Extracts inline <lora:name:strength> tags from prompt string.
 */
function extractInlineLoras(prompt: string): { cleanPrompt: string; inlineLoras: LoraReference[] } {
  const inlineLoras: LoraReference[] = [];
  const regex = /<lora:([^:>]+)(?::([^>]+))?>/gi;

  const cleanPrompt = prompt.replace(regex, (_m, name, strength) => {
    inlineLoras.push({
      rawName: name.trim(),
      strength: strength ? parseFloat(strength) : 1.0,
    });
    return '';
  }).trim();

  return { cleanPrompt, inlineLoras };
}

/**
 * Reads generation metadata with Civitai's generation-metadata engine, without
 * resolving LoRAs. Returns null when the image carries no generation metadata.
 * Supports PNG (tEXt/zTXt/iTXt), WebP (RIFF EXIF/XMP), JPEG (APP1 EXIF UserComment/XMP),
 * ComfyUI graphs, Automatic1111, SwarmUI, Fooocus, and Civitai on-site posts.
 */
export async function readCivitaiLibraryMetadata(input: any): Promise<ExtractedMetadata | null> {
  const md = await readCivitaiMetadata(input);

  const raw = md.raw || {};
  const civitaiData: any = (md as any).civitai || {};
  const normalized: any = normalizeCivitaiGeneration(raw, md.generator);

  let prompt =
    normalized?.prompt ||
    raw.prompt ||
    civitaiData?.generation?.prompt ||
    '';

  let negativePrompt =
    normalized?.negativePrompt ||
    raw.negativePrompt ||
    civitaiData?.generation?.negativePrompt ||
    undefined;

  let sampler = normalized?.sampler || raw.sampler || civitaiData?.generation?.sampler;
  let steps = normalized?.steps ?? (raw.steps ? Number(raw.steps) : undefined);
  let cfgScale = normalized?.cfgScale ?? (raw.cfgScale ? Number(raw.cfgScale) : undefined);
  let seed = normalized?.seed ?? raw.seed ?? civitaiData?.generation?.seed;
  let model =
    normalized?.model?.name ||
    raw.model ||
    raw.baseModel ||
    civitaiData?.generation?.model ||
    civitaiData?.generation?.baseModel;
  let modelHash = normalized?.model?.hash || (raw as any)?.['Model hash'];

  let width =
    normalized?.width ||
    (raw as any).width ||
    civitaiData?.generation?.width ||
    (md.exif as any)?.ImageWidth?.value;
  let height =
    normalized?.height ||
    (raw as any).height ||
    civitaiData?.generation?.height ||
    (md.exif as any)?.ImageHeight?.value;

  let detectedFormat: ExtractedMetadata['detectedFormat'] =
    md.generator === 'automatic1111'
      ? 'a1111'
      : md.generator === 'comfyui'
        ? 'comfyui'
        : md.generator
          ? 'a1111'
          : 'unknown';

  // Check EXIF candidate fields if generator was null or prompt was empty
  const exifCandidates: string[] = [];
  if (md.exif && typeof md.exif === 'object') {
    const exifObj = md.exif as Record<string, any>;
    for (const [key, val] of Object.entries(exifObj)) {
      if (typeof val === 'string') {
        exifCandidates.push(val);
      } else if (val && typeof val === 'object' && typeof val.value === 'string') {
        exifCandidates.push(val.value);
      } else if (val && typeof val === 'object' && typeof val.description === 'string') {
        exifCandidates.push(val.description);
      }
    }
  }

  if (!prompt && exifCandidates.length > 0) {
    for (const candidate of exifCandidates) {
      const fallback = extractFromRawText(candidate, { width, height });
      if (fallback && (fallback.prompt || fallback.loras.length > 0 || fallback.sampler)) {
        prompt = fallback.prompt || prompt;
        negativePrompt = fallback.negativePrompt || negativePrompt;
        sampler = fallback.sampler || sampler;
        steps = fallback.steps ?? steps;
        cfgScale = fallback.cfgScale ?? cfgScale;
        seed = fallback.seed ?? seed;
        model = fallback.model || model;
        modelHash = fallback.modelHash || modelHash;
        width = fallback.width || width;
        height = fallback.height || height;
        detectedFormat = fallback.detectedFormat || detectedFormat;
        break;
      }
    }
  }

  // Ensure prompt is a string
  if (typeof prompt !== 'string') {
    prompt = String(prompt || '');
  }

  if (negativePrompt && typeof negativePrompt !== 'string') {
    negativePrompt = String(negativePrompt);
  }

  const { cleanPrompt, inlineLoras } = extractInlineLoras(prompt);
  prompt = cleanPrompt;

  const loras: LoraReference[] = [...inlineLoras];

  // Resources from normalized resource list
  const normalizedResources = Array.isArray(normalized?.resources) ? normalized.resources : [];
  for (const res of normalizedResources) {
    if (res.kind === 'lora' || res.kind === 'other') {
      const versionId = typeof res.modelVersionId === 'number' ? res.modelVersionId : undefined;
      const rawName = res.name || (versionId ? `Civitai model version ${versionId}` : 'Unknown LoRA');
      const existing = loras.find(
        (l) =>
          (versionId !== undefined && l.civitaiVersionId === versionId) ||
          l.rawName.toLowerCase() === rawName.toLowerCase()
      );
      const strength = typeof res.weight === 'number' ? res.weight : 1.0;
      const hash = res.hash;

      // The version id is resolved against /model-versions/{id} in resolveLoras;
      // it is not a model id, so no model URL is built from it here.
      if (existing) {
        if (hash && !existing.hash) existing.hash = hash;
        if (strength !== undefined) existing.strength = strength;
        if (versionId !== undefined && existing.civitaiVersionId === undefined) {
          existing.civitaiVersionId = versionId;
        }
      } else {
        loras.push({ rawName, strength, hash, civitaiVersionId: versionId });
      }
    }
  }

  // Hashes dictionary (A1111 convention: Hashes: {"lora:name": "hash"})
  if (raw.hashes && typeof raw.hashes === 'object') {
    for (const [key, hashVal] of Object.entries(raw.hashes)) {
      if (typeof hashVal === 'string') {
        if (key.startsWith('lora:')) {
          const loraName = key.replace(/^lora:/, '');
          const existing = loras.find((l) => l.rawName.toLowerCase() === loraName.toLowerCase());
          if (existing) {
            existing.hash = hashVal;
          } else {
            loras.push({ rawName: loraName, hash: hashVal });
          }
        }
      }
    }
  }

  // If no prompt was found and no loras, then no AI generation metadata was present
  if (!prompt && loras.length === 0 && !sampler && !steps) {
    return null;
  }

  return {
    prompt,
    negativePrompt,
    sampler: typeof sampler === 'string' ? sampler : undefined,
    steps: typeof steps === 'number' && Number.isFinite(steps) ? steps : undefined,
    cfgScale: typeof cfgScale === 'number' && Number.isFinite(cfgScale) ? cfgScale : undefined,
    seed: seed !== undefined ? String(seed) : undefined,
    model: typeof model === 'string' ? model : undefined,
    modelHash: typeof modelHash === 'string' ? modelHash : undefined,
    width: typeof width === 'number' ? width : undefined,
    height: typeof height === 'number' ? height : undefined,
    loras,
    detectedFormat,
    extraFields: raw as Record<string, string>,
  };
}

export const NO_METADATA_ERROR: ExtractionError = {
  code: 'no-metadata-found',
  message: 'No AI generation metadata could be found in this image. The image file may have had its metadata stripped by Discord, Reddit, or social media.',
};

/**
 * Civitai-engine extraction with LoRA resolution, as a complete extraction result.
 */
export async function extractWithCivitaiPipeline(
  input: any,
  source: SourceInfo,
  previewUrl?: string
): Promise<ExtractionResult | ExtractionError> {
  try {
    const metadata = await readCivitaiLibraryMetadata(input);
    if (!metadata) return NO_METADATA_ERROR;
    metadata.loras = await resolveLoras(metadata.loras);
    return { source, metadata, previewUrl };
  } catch (err) {
    return {
      code: 'parse-error',
      message: err instanceof Error ? err.message : 'Failed to parse image metadata.',
    };
  }
}
