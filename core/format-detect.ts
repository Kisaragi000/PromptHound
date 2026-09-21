import type { PngParseResult } from './png.js';
import type { ExtractedMetadata, LoraReference } from './types.js';
import { parseA1111, extractInlineLoras } from './parsers/a1111.js';
import { parseComfyUI } from './parsers/comfyui.js';

export type DetectedFormatType =
  | 'a1111'
  | 'comfyui'
  | 'novelai'
  | 'invokeai'
  | 'swarmui'
  | 'fooocus'
  | 'page-json'
  | 'unknown';

const KNOWN_A1111_PATTERNS = [
  /^parameters$/i,
  /^description$/i,
  /^comment$/i,
  /^sd-metadata$/i,
  /^usercomment$/i,
  /^imagedescription$/i,
  /^software$/i,
  /^exif$/i,
];

const KNOWN_COMFY_PATTERNS = [
  /^prompt$/i,
  /^workflow$/i,
  /^comfy$/i,
  /^invokeai_graph$/i,
  /^invokeai_metadata$/i,
];

/**
 * Finds a chunk value by case-insensitive key regex.
 */
function findChunkValue(chunks: Record<string, string>, pattern: RegExp): string | undefined {
  const matchKey = Object.keys(chunks).find((k) => pattern.test(k));
  return matchKey ? chunks[matchKey] : undefined;
}

/**
 * Parses NovelAI metadata JSON (which uses `uc` for undesired content / negative prompt, `scale` for CFG).
 */
function parseNovelAI(obj: any, imageDimensions?: { width?: number; height?: number }): ExtractedMetadata | null {
  if (!obj || typeof obj !== 'object') return null;
  const prompt = typeof obj.prompt === 'string' ? obj.prompt : '';
  const uc = typeof obj.uc === 'string' ? obj.uc : typeof obj.negative_prompt === 'string' ? obj.negative_prompt : undefined;

  if (!prompt && !uc) return null;

  const { cleanPrompt, loras } = extractInlineLoras(prompt);

  return {
    prompt: cleanPrompt,
    negativePrompt: uc,
    sampler: obj.sampler || obj.sampler_name || undefined,
    steps: typeof obj.steps === 'number' ? obj.steps : undefined,
    cfgScale: typeof obj.scale === 'number' ? obj.scale : typeof obj.cfg === 'number' ? obj.cfg : undefined,
    seed: obj.seed !== undefined ? String(obj.seed) : undefined,
    model: obj.model || 'NovelAI Diffusion',
    width: obj.width || imageDimensions?.width,
    height: obj.height || imageDimensions?.height,
    loras,
    detectedFormat: 'novelai',
    extraFields: obj,
  };
}

/**
 * Parses SwarmUI / InvokeAI / Fooocus metadata JSON payloads.
 */
function parseGenericJson(obj: any, imageDimensions?: { width?: number; height?: number }): ExtractedMetadata | null {
  if (!obj || typeof obj !== 'object') return null;

  // SwarmUI
  if (obj.sui_image_params) {
    const p = obj.sui_image_params;
    const prompt = p.prompt || '';
    const { cleanPrompt, loras } = extractInlineLoras(prompt);
    return {
      prompt: cleanPrompt,
      negativePrompt: p.negativeprompt || p.negative_prompt || undefined,
      sampler: p.sampler || undefined,
      steps: p.steps ? Number(p.steps) : undefined,
      cfgScale: p.cfgscale || p.cfg_scale ? Number(p.cfgscale || p.cfg_scale) : undefined,
      seed: p.seed ? String(p.seed) : undefined,
      model: p.model || undefined,
      width: p.width || imageDimensions?.width,
      height: p.height || imageDimensions?.height,
      loras,
      detectedFormat: 'swarmui',
      extraFields: p,
    };
  }

  // Fooocus
  if (obj.prompt && (obj.base_model_name || obj.guidance_scale || obj.sampler_name)) {
    const prompt = obj.prompt || '';
    const { cleanPrompt, loras } = extractInlineLoras(prompt);
    return {
      prompt: cleanPrompt,
      negativePrompt: obj.negative_prompt || undefined,
      sampler: obj.sampler_name || undefined,
      steps: obj.steps ? Number(obj.steps) : undefined,
      cfgScale: obj.guidance_scale ? Number(obj.guidance_scale) : undefined,
      seed: obj.seed ? String(obj.seed) : undefined,
      model: obj.base_model_name || undefined,
      width: obj.width || imageDimensions?.width,
      height: obj.height || imageDimensions?.height,
      loras,
      detectedFormat: 'fooocus',
      extraFields: obj,
    };
  }

  // InvokeAI
  if (obj.positive_prompt || obj.positive_style_prompt || obj.generation_mode) {
    const prompt = obj.positive_prompt || obj.prompt || '';
    const { cleanPrompt, loras } = extractInlineLoras(prompt);
    return {
      prompt: cleanPrompt,
      negativePrompt: obj.negative_prompt || obj.negative_style_prompt || undefined,
      sampler: obj.scheduler || obj.sampler || undefined,
      steps: obj.steps ? Number(obj.steps) : undefined,
      cfgScale: obj.cfg_scale ? Number(obj.cfg_scale) : undefined,
      seed: obj.seed ? String(obj.seed) : undefined,
      model: obj.model?.model_name || obj.model || undefined,
      width: obj.width || imageDimensions?.width,
      height: obj.height || imageDimensions?.height,
      loras,
      detectedFormat: 'invokeai',
      extraFields: obj,
    };
  }

  return null;
}

/**
 * Extracts metadata from arbitrary text (EXIF user comment, JSON string, or A1111 text block).
 */
export function extractFromRawText(
  rawText: string,
  imageDimensions?: { width?: number; height?: number }
): ExtractedMetadata | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const cleaned = rawText.replace(/^ASCII\0{0,3}/i, '').replace(/^UNICODE\0{0,3}/i, '').trim();
  if (!cleaned) return null;

  // 1. Check if it's JSON (ComfyUI / NovelAI / SwarmUI / InvokeAI)
  if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
    try {
      const parsed = JSON.parse(cleaned);

      // Check NovelAI
      if (parsed.prompt !== undefined && (parsed.uc !== undefined || parsed.sampler !== undefined || parsed.scale !== undefined)) {
        const novelResult = parseNovelAI(parsed, imageDimensions);
        if (novelResult) return novelResult;
      }

      // Check Swarm / Fooocus / Invoke
      const genericResult = parseGenericJson(parsed, imageDimensions);
      if (genericResult) return genericResult;

      // Check ComfyUI
      if (
        parsed.prompt ||
        parsed.workflow ||
        parsed.nodes ||
        parsed.extra_pnginfo ||
        parsed.class_type ||
        Object.values(parsed).some((v: any) => v?.class_type)
      ) {
        const result = parseComfyUI(parsed, imageDimensions);
        if (result.prompt || result.loras.length > 0 || result.sampler) return result;
      }
    } catch {
      // Not valid JSON, fall through
    }
  }

  // 2. Check if it contains A1111 / WebUI / Forge parameters
  if (
    cleaned.includes('Steps:') ||
    cleaned.includes('Sampler:') ||
    cleaned.includes('Negative prompt:') ||
    cleaned.includes('CFG scale:') ||
    cleaned.includes('Size:') ||
    cleaned.includes('Model:')
  ) {
    const result = parseA1111(cleaned, imageDimensions);
    if (result.prompt || result.loras.length > 0 || result.sampler || result.steps) {
      return result;
    }
  }

  return null;
}

/**
 * Routes parsed PNG text chunks to the appropriate generator parser with case-insensitive matching.
 */
export function extractFromPngChunks(pngData: PngParseResult): ExtractedMetadata | null {
  const { textChunks, width, height } = pngData;

  // 1. A1111 `parameters` (case-insensitive)
  const a1111Params = findChunkValue(textChunks, /^parameters$/i);
  if (a1111Params) {
    return parseA1111(a1111Params, { width, height });
  }

  // 2. ComfyUI `prompt` / `workflow` (case-insensitive)
  const comfyPrompt = findChunkValue(textChunks, /^prompt$/i);
  const comfyWorkflow = findChunkValue(textChunks, /^workflow$/i);

  if (comfyPrompt || comfyWorkflow) {
    let combinedInput: any = {};
    if (comfyPrompt) {
      try {
        combinedInput.prompt = JSON.parse(comfyPrompt);
      } catch {
        combinedInput.prompt = comfyPrompt;
      }
    }
    if (comfyWorkflow) {
      try {
        combinedInput.workflow = JSON.parse(comfyWorkflow);
        if (!combinedInput.nodes && combinedInput.workflow.nodes) {
          combinedInput.nodes = combinedInput.workflow.nodes;
        }
      } catch {
        combinedInput.workflow = comfyWorkflow;
      }
    }

    const comfy = parseComfyUI(combinedInput, { width, height });
    if (comfy.prompt || comfy.loras.length > 0 || comfy.sampler) return comfy;
  }

  // 3. Known A1111 / Fork chunk keys
  for (const pattern of KNOWN_A1111_PATTERNS) {
    const val = findChunkValue(textChunks, pattern);
    if (val) {
      const parsed = extractFromRawText(val, { width, height });
      if (parsed) return parsed;
    }
  }

  // 4. Known Comfy / Graph chunk keys
  for (const pattern of KNOWN_COMFY_PATTERNS) {
    const val = findChunkValue(textChunks, pattern);
    if (val) {
      const parsed = extractFromRawText(val, { width, height });
      if (parsed) return parsed;
    }
  }

  // 5. Any chunk with A1111-like or ComfyUI-like content
  for (const [, value] of Object.entries(textChunks)) {
    const parsed = extractFromRawText(value, { width, height });
    if (parsed) return parsed;
  }

  return null;
}
