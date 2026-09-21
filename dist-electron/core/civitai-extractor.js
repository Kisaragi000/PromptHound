"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWithCivitaiPipeline = extractWithCivitaiPipeline;
const civitai_1 = require("@civitai/generation-metadata/civitai");
const lora_resolution_js_1 = require("./lora-resolution.js");
const format_detect_js_1 = require("./format-detect.js");
/**
 * Extracts inline <lora:name:strength> tags from prompt string.
 */
function extractInlineLoras(prompt) {
    const inlineLoras = [];
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
 * Universal metadata extractor using Civitai's official generation-metadata engine.
 * Supports PNG (tEXt/zTXt/iTXt), WebP (RIFF EXIF/XMP), JPEG (APP1 EXIF UserComment/XMP),
 * ComfyUI graphs, Automatic1111, SwarmUI, Fooocus, and Civitai on-site posts.
 */
async function extractWithCivitaiPipeline(input, source, previewUrl) {
    try {
        const md = await (0, civitai_1.readCivitaiMetadata)(input);
        const raw = md.raw || {};
        const civitaiData = md.civitai || {};
        const normalized = (0, civitai_1.normalizeCivitaiGeneration)(raw, md.generator);
        let prompt = normalized?.prompt ||
            raw.prompt ||
            civitaiData?.generation?.prompt ||
            '';
        let negativePrompt = normalized?.negativePrompt ||
            raw.negativePrompt ||
            civitaiData?.generation?.negativePrompt ||
            undefined;
        let sampler = normalized?.sampler || raw.sampler || civitaiData?.generation?.sampler;
        let steps = normalized?.steps ?? (raw.steps ? Number(raw.steps) : undefined);
        let cfgScale = normalized?.cfgScale ?? (raw.cfgScale ? Number(raw.cfgScale) : undefined);
        let seed = normalized?.seed ?? raw.seed ?? civitaiData?.generation?.seed;
        let model = normalized?.model?.name ||
            raw.model ||
            raw.baseModel ||
            civitaiData?.generation?.model ||
            civitaiData?.generation?.baseModel;
        let modelHash = normalized?.model?.hash || raw?.['Model hash'];
        let width = normalized?.width ||
            raw.width ||
            civitaiData?.generation?.width ||
            md.exif?.ImageWidth?.value;
        let height = normalized?.height ||
            raw.height ||
            civitaiData?.generation?.height ||
            md.exif?.ImageHeight?.value;
        let detectedFormat = md.generator === 'automatic1111'
            ? 'a1111'
            : md.generator === 'comfyui'
                ? 'comfyui'
                : md.generator
                    ? 'a1111'
                    : 'unknown';
        // Check EXIF candidate fields if generator was null or prompt was empty
        const exifCandidates = [];
        if (md.exif && typeof md.exif === 'object') {
            const exifObj = md.exif;
            for (const [key, val] of Object.entries(exifObj)) {
                if (typeof val === 'string') {
                    exifCandidates.push(val);
                }
                else if (val && typeof val === 'object' && typeof val.value === 'string') {
                    exifCandidates.push(val.value);
                }
                else if (val && typeof val === 'object' && typeof val.description === 'string') {
                    exifCandidates.push(val.description);
                }
            }
        }
        if (!prompt && exifCandidates.length > 0) {
            for (const candidate of exifCandidates) {
                const fallback = (0, format_detect_js_1.extractFromRawText)(candidate, { width, height });
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
        const loras = [...inlineLoras];
        // Resources from normalized resource list
        const normalizedResources = Array.isArray(normalized?.resources) ? normalized.resources : [];
        for (const res of normalizedResources) {
            if (res.kind === 'lora' || res.kind === 'other') {
                const rawName = res.name || 'Unknown LoRA';
                const existing = loras.find((l) => l.rawName.toLowerCase() === rawName.toLowerCase());
                const strength = typeof res.weight === 'number' ? res.weight : 1.0;
                const hash = res.hash;
                if (existing) {
                    if (hash && !existing.hash)
                        existing.hash = hash;
                    if (strength !== undefined)
                        existing.strength = strength;
                    if (res.modelVersionId && !existing.resolved) {
                        existing.resolved = {
                            name: rawName,
                            source: 'civitai',
                            modelUrl: `https://civitai.com/models/${res.modelVersionId}`,
                        };
                    }
                }
                else {
                    loras.push({
                        rawName,
                        strength,
                        hash,
                        resolved: res.modelVersionId
                            ? {
                                name: rawName,
                                source: 'civitai',
                                modelUrl: `https://civitai.com/models/${res.modelVersionId}`,
                            }
                            : undefined,
                    });
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
                        }
                        else {
                            loras.push({ rawName: loraName, hash: hashVal });
                        }
                    }
                }
            }
        }
        // Resolve any remaining LoRAs against Civitai API if they have hashes
        const resolvedLoras = await (0, lora_resolution_js_1.resolveLoras)(loras);
        // If no prompt was found and no loras, then no AI generation metadata was present
        if (!prompt && resolvedLoras.length === 0 && !sampler && !steps) {
            return {
                code: 'no-metadata-found',
                message: 'No AI generation metadata could be found in this image. The image file may have had its metadata stripped by Discord, Reddit, or social media.',
            };
        }
        const metadata = {
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
            loras: resolvedLoras,
            detectedFormat,
            extraFields: raw,
        };
        return {
            source,
            metadata,
            previewUrl,
        };
    }
    catch (err) {
        return {
            code: 'parse-error',
            message: err instanceof Error ? err.message : 'Failed to parse image metadata.',
        };
    }
}
