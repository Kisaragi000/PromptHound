/**
 * Zero-dependency isomorphic parser for .safetensors file headers and embedded LoRA training metadata.
 * Inspired by ComfyUI-Lora-Auto-Trigger-Words and lora-metadata-viewer.
 */

export interface SafetensorsMetadata {
  format?: string;
  ss_sd_model_name?: string;
  ss_output_name?: string;
  ss_tag_frequency?: string | Record<string, Record<string, number>>;
  ss_network_module?: string;
  ss_base_model_version?: string;
  ss_v2?: string;
  ss_clip_skip?: string;
  [key: string]: any;
}

export interface InferredLoraInfo {
  baseModel?: string;
  triggerWords: string[];
  metadata: Record<string, string>;
}

/**
 * Parses the __metadata__ header block from a raw Safetensors Uint8Array or Buffer.
 */
export function parseSafetensorsHeader(bytes: Uint8Array): Record<string, any> | null {
  if (!bytes || bytes.length < 9) return null;

  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Read 64-bit unsigned integer (header length in bytes, little-endian)
    const headerLenLow = view.getUint32(0, true);
    const headerLenHigh = view.getUint32(4, true);

    // Guard against unreasonably large headers (max 50MB) or 32-bit overflow
    if (headerLenHigh > 0 || headerLenLow > 50 * 1024 * 1024) {
      return null;
    }

    const headerLength = headerLenLow;
    if (bytes.length < 8 + headerLength) {
      return null;
    }

    const headerSlice = bytes.subarray(8, 8 + headerLength);
    const decoder = new TextDecoder('utf-8');
    const jsonStr = decoder.decode(headerSlice);
    const parsed = JSON.parse(jsonStr);

    return parsed.__metadata__ ?? {};
  } catch {
    return null;
  }
}

/**
 * Extracts and sorts inferred trigger words from ss_tag_frequency in __metadata__.
 * ss_tag_frequency is typically formatted as:
 * { "dataset_folder": { "trigger_tag": 450, "second_tag": 120, ... } }
 */
export function extractTriggerWordsFromMetadata(metadata: Record<string, any>, topN: number = 10): string[] {
  if (!metadata) return [];

  // 1. Direct explicit trigger tag if present
  if (typeof metadata.ss_trigger_word === 'string' && metadata.ss_trigger_word.trim()) {
    return [metadata.ss_trigger_word.trim()];
  }

  // 2. Parse ss_tag_frequency
  let tagMap: Record<string, number> = {};

  if (metadata.ss_tag_frequency) {
    let raw = metadata.ss_tag_frequency;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }

    if (raw && typeof raw === 'object') {
      for (const bucketKey of Object.keys(raw)) {
        const bucket = raw[bucketKey];
        if (bucket && typeof bucket === 'object') {
          for (const [tag, count] of Object.entries(bucket)) {
            const cleanTag = tag.trim();
            if (cleanTag) {
              tagMap[cleanTag] = (tagMap[cleanTag] || 0) + (typeof count === 'number' ? count : 1);
            }
          }
        }
      }
    }
  }

  // Sort tags by frequency count descending
  const sorted = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  return sorted.slice(0, topN);
}

/**
 * Analyzes metadata to infer full LoRA metadata details (base model, trigger tags, etc.)
 */
export function analyzeSafetensorsMetadata(metadata: Record<string, any>): InferredLoraInfo {
  const triggerWords = extractTriggerWordsFromMetadata(metadata);
  let baseModel: string | undefined = undefined;

  const rawBase = metadata.ss_base_model_version || metadata.ss_sd_model_name || '';
  if (/flux/i.test(rawBase)) {
    baseModel = 'Flux.1 D';
  } else if (/pony/i.test(rawBase)) {
    baseModel = 'Pony';
  } else if (/sdxl|xl/i.test(rawBase)) {
    baseModel = 'SDXL 1.0';
  } else if (/v2|2\.1|768/i.test(rawBase) || metadata.ss_v2 === 'True') {
    baseModel = 'SD 2.1';
  } else if (/1\.5|v1-5/i.test(rawBase)) {
    baseModel = 'SD 1.5';
  }

  return {
    baseModel,
    triggerWords,
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
    ),
  };
}
