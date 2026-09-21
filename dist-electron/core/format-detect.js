"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFromRawText = extractFromRawText;
exports.extractFromPngChunks = extractFromPngChunks;
const a1111_js_1 = require("./parsers/a1111.js");
const comfyui_js_1 = require("./parsers/comfyui.js");
const KNOWN_A1111_KEYS = [
    'parameters',
    'Description',
    'description',
    'Comment',
    'comment',
    'sd-metadata',
    'userComment',
    'UserComment',
    'ImageDescription',
    'Software',
];
const KNOWN_COMFY_KEYS = [
    'prompt',
    'workflow',
    'comfy',
    'invokeai_graph',
    'invokeai_metadata',
];
/**
 * Extracts metadata from arbitrary text (EXIF user comment, JSON string, or A1111 text block).
 */
function extractFromRawText(rawText, imageDimensions) {
    if (!rawText || typeof rawText !== 'string')
        return null;
    const cleaned = rawText.replace(/^ASCII\0{0,3}/i, '').replace(/^UNICODE\0{0,3}/i, '').trim();
    if (!cleaned)
        return null;
    // 1. Check if it's JSON (ComfyUI / SwarmUI / InvokeAI)
    if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
        try {
            const parsed = JSON.parse(cleaned);
            if (parsed.prompt || parsed.nodes || parsed.extra_pnginfo || parsed.class_type || Object.values(parsed).some((v) => v?.class_type)) {
                const result = (0, comfyui_js_1.parseComfyUI)(parsed.prompt || parsed, imageDimensions);
                if (result.prompt || result.loras.length > 0 || result.sampler)
                    return result;
            }
        }
        catch {
            // Not valid JSON, fall through
        }
    }
    // 2. Check if it contains A1111 parameters
    if (cleaned.includes('Steps:') || cleaned.includes('Sampler:') || cleaned.includes('Negative prompt:')) {
        const result = (0, a1111_js_1.parseA1111)(cleaned, imageDimensions);
        if (result.prompt || result.loras.length > 0 || result.sampler || result.steps) {
            return result;
        }
    }
    return null;
}
/**
 * Routes parsed PNG text chunks to the appropriate generator parser.
 */
function extractFromPngChunks(pngData) {
    const { textChunks, width, height } = pngData;
    // 1. Direct standard checks
    if (textChunks['parameters']) {
        return (0, a1111_js_1.parseA1111)(textChunks['parameters'], { width, height });
    }
    if (textChunks['prompt']) {
        return (0, comfyui_js_1.parseComfyUI)(textChunks['prompt'], { width, height });
    }
    // 2. Known Comfy / Graph chunk keys
    for (const key of KNOWN_COMFY_KEYS) {
        if (textChunks[key]) {
            const parsed = extractFromRawText(textChunks[key], { width, height });
            if (parsed)
                return parsed;
        }
    }
    // 3. Known A1111 / Fork chunk keys
    for (const key of KNOWN_A1111_KEYS) {
        if (textChunks[key]) {
            const parsed = extractFromRawText(textChunks[key], { width, height });
            if (parsed)
                return parsed;
        }
    }
    // 4. Any chunk with A1111-like or ComfyUI-like content
    for (const [, value] of Object.entries(textChunks)) {
        const parsed = extractFromRawText(value, { width, height });
        if (parsed)
            return parsed;
    }
    return null;
}
