/**
 * PromptHound Normalized Extraction Contracts
 */

export interface ModelCatalogRecord {
  civitaiModelId?: number;
  civitaiVersionId?: number;
  name: string;
  versionName?: string;
  normalizedAlias: string;
  hashSha256?: string;
  coverImageId?: string;
  coverImageUrl?: string;
  triggerWords: string[];
  baseModel?: string;
  nsfw?: boolean;
  source: 'civitai' | 'local';
  modelUrl: string;
  cachedAt: number;
}

/**
 * How a LoRA reference was tied to a catalog entry, most reliable first:
 * - hash: the file hash in the image metadata matched
 * - civitai-version: the image named the exact Civitai model version
 * - name-match: fuzzy name match (cached or live search); may be wrong
 * - manual: the user linked it by hand
 * - local: read from a local .safetensors file
 */
export type LoraMatchMethod = 'hash' | 'civitai-version' | 'name-match' | 'manual' | 'local';

export interface LoraReference {
  rawName: string;
  strength?: number;
  hash?: string;
  /** Civitai model-version id when the metadata names one (on-site / "Civitai resources") */
  civitaiVersionId?: number;
  resolved?: {
    name: string;
    source: 'civitai' | 'local';
    modelUrl: string;
    coverImageId?: string;
    coverImageUrl?: string;
    triggerWords?: string[];
    versionName?: string;
    baseModel?: string;
    nsfw?: boolean;
    matchedBy?: LoraMatchMethod;
    /** Similarity score (0-1) when matchedBy is 'name-match' via live search */
    matchScore?: number;
  };
}

export interface ExtractedMetadata {
  prompt: string;
  negativePrompt?: string;
  sampler?: string;
  steps?: number;
  cfgScale?: number;
  seed?: number | string;
  model?: string;
  modelHash?: string;
  width?: number;
  height?: number;
  loras: LoraReference[];
  detectedFormat: 'a1111' | 'comfyui' | 'novelai' | 'invokeai' | 'swarmui' | 'fooocus' | 'page-json' | 'unknown';
  extraFields?: Record<string, any>;
}

export interface SourceInfo {
  kind: 'file' | 'clipboard' | 'page-url' | 'direct-image-url';
  label: string;
}

export interface ExtractionResult {
  source: SourceInfo;
  metadata: ExtractedMetadata;
  previewUrl?: string;
}

export interface ExtractionError {
  code: 'no-metadata-found' | 'fetch-failed' | 'unsupported-format' | 'parse-error';
  message: string;
}

export function isExtractionError(
  result: ExtractionResult | ExtractionError
): result is ExtractionError {
  return typeof result === 'object' && result !== null && 'code' in result;
}

// Backwards compatibility for Library & Archive views
export interface SavedPromptItem {
  id: string;
  title: string;
  folder: string;
  source: 'Civitai' | 'SeaArt' | 'Local File' | 'Clipboard' | 'Web';
  date: string;
  model: string;
  dimensions: string;
  isFavorite: boolean;
  thumbnailUrl: string;
  metadata: any;
}

export type SupportedPlatform = 'Civitai' | 'SeaArt' | 'A1111' | 'ComfyUI' | 'Unknown';
