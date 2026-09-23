import { extractWithCivitaiPipeline } from './civitai-extractor.js';
import { readPngChunks, isPng } from './png.js';
import { extractFromPngChunks } from './format-detect.js';
import { isWebp, extractFromWebpBuffer } from './webp.js';
import { isJpeg, extractFromJpegBuffer } from './jpeg.js';
import { scrapePageMetadata } from './page-json.js';
import { resolveLoras } from './lora-resolution.js';
import { isExtractionError } from './types.js';
import type { ExtractionResult, ExtractionError, SourceInfo } from './types.js';

export function isDirectImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|jfif|avif)($|\?)/i.test(url.trim());
}

/**
 * Extracts metadata from an image byte buffer using the Civitai pipeline
 * with fallback to custom PNG, WebP, and JPEG/JFIF chunk readers.
 */
export async function extractFromImageBuffer(
  buffer: Buffer | Uint8Array,
  source: SourceInfo,
  previewUrl?: string
): Promise<ExtractionResult | ExtractionError> {
  // Ensure buffer is Uint8Array
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // 1. Primary extractor: Civitai generation-metadata pipeline (PNG, WebP, JPEG)
  const civitaiResult = await extractWithCivitaiPipeline(uint8, source, previewUrl);
  if (!isExtractionError(civitaiResult) && (civitaiResult.metadata.prompt || civitaiResult.metadata.loras.length > 0 || civitaiResult.metadata.sampler)) {
    return civitaiResult;
  }

  // 2. Secondary fallback for PNG: direct PNG chunk inspector (for non-standard chunk names)
  if (isPng(uint8)) {
    try {
      const pngResult = readPngChunks(uint8);
      if (pngResult.allChunks.length > 0 || Object.keys(pngResult.textChunks).length > 0) {
        const fallbackMeta = extractFromPngChunks(pngResult);
        if (fallbackMeta && (fallbackMeta.prompt || fallbackMeta.loras.length > 0 || fallbackMeta.sampler)) {
          if (fallbackMeta.loras.length > 0) {
            fallbackMeta.loras = await resolveLoras(fallbackMeta.loras);
          }
          return {
            source,
            metadata: fallbackMeta,
            previewUrl,
          };
        }
      }
    } catch {
      // Ignore PNG fallback failure
    }
  }

  // 3. Secondary fallback for WebP: direct RIFF chunk inspector
  if (isWebp(uint8)) {
    try {
      const webpMeta = extractFromWebpBuffer(uint8);
      if (webpMeta && (webpMeta.prompt || webpMeta.loras.length > 0 || webpMeta.sampler)) {
        if (webpMeta.loras.length > 0) {
          webpMeta.loras = await resolveLoras(webpMeta.loras);
        }
        return {
          source,
          metadata: webpMeta,
          previewUrl,
        };
      }
    } catch {
      // Ignore WebP fallback failure
    }
  }

  // 4. Secondary fallback for JPEG/JFIF: direct segment scanner
  if (isJpeg(uint8)) {
    try {
      const jpegMeta = extractFromJpegBuffer(uint8);
      if (jpegMeta && (jpegMeta.prompt || jpegMeta.loras.length > 0 || jpegMeta.sampler)) {
        if (jpegMeta.loras.length > 0) {
          jpegMeta.loras = await resolveLoras(jpegMeta.loras);
        }
        return {
          source,
          metadata: jpegMeta,
          previewUrl,
        };
      }
    } catch {
      // Ignore JPEG fallback failure
    }
  }

  return civitaiResult;
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
      if (metadata.loras.length > 0) {
        metadata.loras = await resolveLoras(metadata.loras);
      }
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
