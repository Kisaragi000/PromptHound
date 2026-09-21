"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapePageMetadata = scrapePageMetadata;
const cheerio = __importStar(require("cheerio"));
/**
 * Recursively inspects a JSON tree to find an object containing AI generation metadata.
 */
function findMetadataObject(obj) {
    if (!obj || typeof obj !== 'object')
        return null;
    // Check if current object looks like an image metadata or generation details block
    if (typeof obj.prompt === 'string' &&
        obj.prompt.length > 5 &&
        (obj.sampler || obj.steps || obj.cfgScale || obj.seed || obj.negativePrompt || obj.meta)) {
        return obj;
    }
    // Civitai specific structures: obj.meta with prompt
    if (obj.meta && typeof obj.meta.prompt === 'string') {
        return { ...obj.meta, url: obj.url };
    }
    for (const key of Object.keys(obj)) {
        // Avoid traversing huge raw arrays or cycles
        if (key === 'comments' || key === 'reactions')
            continue;
        const found = findMetadataObject(obj[key]);
        if (found)
            return found;
    }
    return null;
}
/**
 * Extracts AI generation metadata from HTML containing embedded Next.js or inline JSON.
 */
function scrapePageMetadata(html) {
    const $ = cheerio.load(html);
    // Extract primary image URL
    const ogImage = $('meta[property="og:image"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    const primaryImageUrl = ogImage || twitterImage || $('img').first().attr('src');
    // 1. Try Next.js __NEXT_DATA__
    const nextDataScript = $('#__NEXT_DATA__').html();
    let candidateJson = null;
    if (nextDataScript) {
        try {
            const parsed = JSON.parse(nextDataScript);
            candidateJson = findMetadataObject(parsed);
        }
        catch {
            // Continue to inline scripts
        }
    }
    // 2. If not found, scan inline <script> tags
    if (!candidateJson) {
        $('script').each((_i, elem) => {
            const scriptContent = $(elem).html() || '';
            if ((scriptContent.includes('"prompt"') || scriptContent.includes('Negative prompt')) &&
                (scriptContent.includes('Sampler') || scriptContent.includes('sampler'))) {
                try {
                    // Attempt parsing if pure JSON or json-ld
                    const parsed = JSON.parse(scriptContent);
                    const found = findMetadataObject(parsed);
                    if (found) {
                        candidateJson = found;
                        return false; // break each
                    }
                }
                catch {
                    // May be JS assignment, ignore
                }
            }
        });
    }
    if (!candidateJson) {
        return { primaryImageUrl };
    }
    const loras = [];
    if (Array.isArray(candidateJson.resources)) {
        for (const res of candidateJson.resources) {
            if (res.modelType === 'LORA' || res.modelType === 'LoCon' || res.type === 'lora') {
                loras.push({
                    rawName: res.name || res.modelName || 'Unknown LoRA',
                    strength: typeof res.strength === 'number' ? res.strength : 1.0,
                    hash: res.hash,
                });
            }
        }
    }
    const metadata = {
        prompt: candidateJson.prompt || '',
        negativePrompt: candidateJson.negativePrompt || candidateJson.negative_prompt,
        sampler: candidateJson.sampler || candidateJson.sampler_name,
        steps: candidateJson.steps ? Number(candidateJson.steps) : undefined,
        cfgScale: candidateJson.cfgScale || candidateJson.cfg_scale ? Number(candidateJson.cfgScale || candidateJson.cfg_scale) : undefined,
        seed: candidateJson.seed,
        model: candidateJson.model || candidateJson.baseModel,
        width: candidateJson.width ? Number(candidateJson.width) : undefined,
        height: candidateJson.height ? Number(candidateJson.height) : undefined,
        loras,
        detectedFormat: 'page-json',
    };
    return { metadata, primaryImageUrl };
}
