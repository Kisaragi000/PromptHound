/**
 * PromptHound Normalized Extraction Contracts
 */

export interface ModelCatalogRecord {
  civitaiModelId?: number;
  civitaiVersionId?: number;
  name: string;
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
