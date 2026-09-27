import { readCivitaiLibraryMetadata, NO_METADATA_ERROR } from './civitai-extractor.js';
import { readContentCredentials } from './content-credentials.js';
import { readPngChunks, isPng } from './png.js';
import { extractFromPngChunks } from './format-detect.js';
import { isWebp, extractFromWebpBuffer } from './webp.js';
import { isJpeg, extractFromJpegBuffer } from './jpeg.js';
import { scrapePageMetadata } from './page-json.js';
import { resolveLoras, resolveBaseModel } from './lora-resolution.js';
import { mergeExtractedMetadata } from './metadata-merge.js';
import { isExtractionError } from './types.js';
import type { ExtractedMetadata, ExtractionResult, ExtractionError, SourceInfo } from './types.js';

export function isDirectImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|jfif|avif)($|\?)/i.test(url.trim());
}

/**
 * PromptHound's own chunk readers (PNG text chunks, WebP RIFF, JPEG segments).
 */
function readNativeMetadata(uint8: Uint8Array): ExtractedMetadata | null {
  try {
    if (isPng(uint8)) return extractFromPngChunks(readPngChunks(uint8));
    if (isWebp(uint8)) return extractFromWebpBuffer(uint8);
    if (isJpeg(uint8)) return extractFromJpegBuffer(uint8);
  } catch {
    // A malformed file must not hide what the Civitai engine found
  }
  return null;
}

function hasGenerationData(meta: ExtractedMetadata): boolean {
  return Boolean(meta.prompt || meta.loras.length > 0 || meta.sampler || meta.steps);
}

/** Identifies the LoRAs and the checkpoint on Civitai / in the catalog, in parallel. */
async function resolveAll(meta: ExtractedMetadata): Promise<void> {
  const [loras, model] = await Promise.all([resolveLoras(meta.loras), resolveBaseModel(meta).catch(() => undefined)]);
  meta.loras = loras;
  if (model) meta.modelResolved = model;
}

/**
 * Extracts metadata from an image byte buffer. Both the Civitai generation-metadata
 * engine and PromptHound's native chunk readers run, and their results are merged
 * field by field, so a field one of them misses (e.g. a ComfyUI prompt fed from a
 * separate text node) can still come from the other. LoRAs are resolved once, after merging.
 */
export async function extractFromImageBuffer(
  buffer: Buffer | Uint8Array,
  source: SourceInfo,
  previewUrl?: string
): Promise<ExtractionResult | ExtractionError> {
  // Ensure buffer is Uint8Array
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let libraryMeta: ExtractedMetadata | null = null;
  let libraryError: ExtractionError | null = null;
  try {
    libraryMeta = await readCivitaiLibraryMetadata(uint8);
  } catch (err) {
    libraryError = {
      code: 'parse-error',
      message: err instanceof Error ? err.message : 'Failed to parse image metadata.',
    };
  }

  const nativeMeta = readNativeMetadata(uint8);

  // For ComfyUI, the native parser traces the graph from the sampler that feeds the
  // saved image, so its prompt is preferred whenever it found one.
  const merged = mergeExtractedMetadata([libraryMeta, nativeMeta], (candidates) =>
    candidates.findIndex((c) => c === nativeMeta && c.detectedFormat === 'comfyui' && Boolean(c.prompt))
  );

  if (!merged || !hasGenerationData(merged)) {
    // No prompt, but the image may still say where it came from (ChatGPT, Gemini, ...)
    const contentCredentials = readContentCredentials(uint8);
    if (contentCredentials) {
      return {
        code: 'no-metadata-found',
        message: contentCredentials.aiGenerated
          ? 'This image is labeled as AI-generated, but it contains no prompt or generation settings.'
          : 'This image has Content Credentials, but no AI generation metadata.',
        contentCredentials,
      };
    }
    return libraryError ?? NO_METADATA_ERROR;
  }

  await resolveAll(merged);
  return { source, metadata: merged, previewUrl };
}

/**
 * Fetches a URL (direct image or hosting webpage) and extracts generation metadata.
 */
export async function extractFromUrl(url: string): Promise<ExtractionResult | ExtractionError> {
  const cleanUrl = url.trim();

  try {
    if (isDirectImageUrl(cleanUrl)) {
      const response = await fetch(cleanUrl);
      if (!response.ok) {
        return {
          code: 'fetch-failed',
          message: `Failed to fetch image: HTTP ${response.status} ${response.statusText}`,
        };
      }
      const arrayBuffer = await response.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      return extractFromImageBuffer(uint8, {
        kind: 'direct-image-url',
        label: cleanUrl,
      }, cleanUrl);
    }

    // Page URL (e.g. Civitai post, SeaArt post)
    const pageResponse = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!pageResponse.ok) {
      return {
        code: 'fetch-failed',
        message: `Failed to fetch page: HTTP ${pageResponse.status} ${pageResponse.statusText}`,
      };
    }

    const html = await pageResponse.text();
    const { metadata, primaryImageUrl } = scrapePageMetadata(html);

    if (metadata && metadata.prompt) {
      await resolveAll(metadata);
      return {
        source: { kind: 'page-url', label: cleanUrl },
        metadata,
        previewUrl: primaryImageUrl,
      };
    }

    // If page didn't have embedded script JSON, fetch its primary image
    if (primaryImageUrl) {
      const imgResponse = await fetch(primaryImageUrl);
      if (imgResponse.ok) {
        const arrayBuf = await imgResponse.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuf);
        const result = await extractFromImageBuffer(uint8, {
          kind: 'page-url',
          label: cleanUrl,
        }, primaryImageUrl);
        if (!isExtractionError(result)) {
          return result;
        }
      }
    }

    return {
      code: 'no-metadata-found',
      message: 'Could not extract generation metadata from this page. Try pasting the direct image URL instead.',
    };
  } catch (error) {
    return {
      code: 'fetch-failed',
      message: error instanceof Error ? error.message : 'Network error occurred while fetching link.',
    };
  }
}
