"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDirectImageUrl = isDirectImageUrl;
exports.extractFromImageBuffer = extractFromImageBuffer;
exports.extractFromUrl = extractFromUrl;
const civitai_extractor_js_1 = require("./civitai-extractor.js");
const png_js_1 = require("./png.js");
const format_detect_js_1 = require("./format-detect.js");
const webp_js_1 = require("./webp.js");
const page_json_js_1 = require("./page-json.js");
const lora_resolution_js_1 = require("./lora-resolution.js");
const types_js_1 = require("./types.js");
function isDirectImageUrl(url) {
    return /\.(png|jpe?g|webp|avif)($|\?)/i.test(url.trim());
}
/**
 * Extracts metadata from an image byte buffer using the Civitai pipeline
 * with fallback to custom PNG and WebP chunk readers.
 */
async function extractFromImageBuffer(buffer, source, previewUrl) {
    // Ensure buffer is Uint8Array
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    // 1. Primary extractor: Civitai generation-metadata pipeline (PNG, WebP, JPEG)
    const civitaiResult = await (0, civitai_extractor_js_1.extractWithCivitaiPipeline)(uint8, source, previewUrl);
    if (!(0, types_js_1.isExtractionError)(civitaiResult) && (civitaiResult.metadata.prompt || civitaiResult.metadata.loras.length > 0 || civitaiResult.metadata.sampler)) {
        return civitaiResult;
    }
    // 2. Secondary fallback for PNG: direct PNG chunk inspector (for non-standard chunk names)
    if ((0, png_js_1.isPng)(uint8)) {
        try {
            const pngResult = (0, png_js_1.readPngChunks)(uint8);
            if (pngResult.allChunks.length > 0 || Object.keys(pngResult.textChunks).length > 0) {
                const fallbackMeta = (0, format_detect_js_1.extractFromPngChunks)(pngResult);
                if (fallbackMeta && (fallbackMeta.prompt || fallbackMeta.loras.length > 0 || fallbackMeta.sampler)) {
                    if (fallbackMeta.loras.length > 0) {
                        fallbackMeta.loras = await (0, lora_resolution_js_1.resolveLoras)(fallbackMeta.loras);
                    }
                    return {
                        source,
                        metadata: fallbackMeta,
                        previewUrl,
                    };
                }
            }
        }
        catch {
            // Ignore PNG fallback failure
        }
    }
    // 3. Secondary fallback for WebP: direct RIFF chunk inspector
    if ((0, webp_js_1.isWebp)(uint8)) {
        try {
            const webpMeta = (0, webp_js_1.extractFromWebpBuffer)(uint8);
            if (webpMeta && (webpMeta.prompt || webpMeta.loras.length > 0 || webpMeta.sampler)) {
                if (webpMeta.loras.length > 0) {
                    webpMeta.loras = await (0, lora_resolution_js_1.resolveLoras)(webpMeta.loras);
                }
                return {
                    source,
                    metadata: webpMeta,
                    previewUrl,
                };
            }
        }
        catch {
            // Ignore WebP fallback failure
        }
    }
    return civitaiResult;
}
/**
 * Fetches a URL (direct image or hosting webpage) and extracts generation metadata.
 */
async function extractFromUrl(url) {
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
        const { metadata, primaryImageUrl } = (0, page_json_js_1.scrapePageMetadata)(html);
        if (metadata && metadata.prompt) {
            if (metadata.loras.length > 0) {
                metadata.loras = await (0, lora_resolution_js_1.resolveLoras)(metadata.loras);
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
                if (!(0, types_js_1.isExtractionError)(result)) {
                    return result;
                }
            }
        }
        return {
            code: 'no-metadata-found',
            message: 'Could not extract generation metadata from this page. Try pasting the direct image URL instead.',
        };
    }
    catch (error) {
        return {
            code: 'fetch-failed',
            message: error instanceof Error ? error.message : 'Network error occurred while fetching link.',
        };
    }
}
