"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseComfyUI = parseComfyUI;
/**
 * Normalizes ComfyUI sampler + scheduler names into conventional notation.
 * e.g. sampler: 'euler_ancestral', scheduler: 'karras' -> 'Euler a Karras'
 */
function normalizeSampler(samplerName, scheduler) {
    if (!samplerName)
        return undefined;
    let formattedSampler = samplerName
        .replace(/_ancestral$/i, ' a')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    if (scheduler && scheduler.toLowerCase() !== 'normal') {
        const formattedScheduler = scheduler.charAt(0).toUpperCase() + scheduler.slice(1);
        return `${formattedSampler} ${formattedScheduler}`;
    }
    return formattedSampler;
}
/**
 * Traces text from a CLIPTextEncode node or chained conditioning nodes.
 */
function traceConditioningText(graph, targetRef) {
    if (!targetRef)
        return '';
    const nodeId = Array.isArray(targetRef) ? String(targetRef[0]) : String(targetRef);
    const node = graph[nodeId];
    if (!node)
        return '';
    if (node.class_type === 'CLIPTextEncode' || node.class_type === 'CLIPTextEncodeSDXL') {
        const text = node.inputs?.text || node.inputs?.text_g || '';
        if (typeof text === 'string')
            return text.trim();
    }
    // Chained node (e.g. ConditioningCombine, ConditioningAverage)
    if (node.inputs?.conditioning_1) {
        const text1 = traceConditioningText(graph, node.inputs.conditioning_1);
        const text2 = traceConditioningText(graph, node.inputs.conditioning_2);
        return [text1, text2].filter(Boolean).join(', ');
    }
    return '';
}
/**
 * Parses ComfyUI execution graph (`prompt` chunk).
 */
function parseComfyUI(rawJson, imageDimensions) {
    let graph = {};
    try {
        graph = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    }
    catch {
        return {
            prompt: '',
            loras: [],
            detectedFormat: 'comfyui',
        };
    }
    const nodes = Object.values(graph);
    // 1. Locate primary KSampler / KSamplerAdvanced node
    const ksampler = nodes.find((n) => n.class_type === 'KSampler' ||
        n.class_type === 'KSamplerAdvanced' ||
        n.class_type?.includes('Sampler'));
    let seed;
    let steps;
    let cfgScale;
    let sampler;
    let positivePrompt = '';
    let negativePrompt = '';
    if (ksampler && ksampler.inputs) {
        seed = ksampler.inputs.seed ?? ksampler.inputs.noise_seed;
        steps = typeof ksampler.inputs.steps === 'number' ? ksampler.inputs.steps : undefined;
        cfgScale = typeof ksampler.inputs.cfg === 'number' ? ksampler.inputs.cfg : undefined;
        sampler = normalizeSampler(ksampler.inputs.sampler_name, ksampler.inputs.scheduler);
        if (ksampler.inputs.positive) {
            positivePrompt = traceConditioningText(graph, ksampler.inputs.positive);
        }
        if (ksampler.inputs.negative) {
            negativePrompt = traceConditioningText(graph, ksampler.inputs.negative);
        }
    }
    // Fallback text search if KSampler links couldn't be resolved
    if (!positivePrompt) {
        const clipNodes = nodes.filter((n) => n.class_type === 'CLIPTextEncode' || n.class_type === 'CLIPTextEncodeSDXL');
        if (clipNodes.length > 0 && typeof clipNodes[0].inputs?.text === 'string') {
            positivePrompt = clipNodes[0].inputs.text;
        }
        if (clipNodes.length > 1 && typeof clipNodes[1].inputs?.text === 'string') {
            negativePrompt = clipNodes[1].inputs.text;
        }
    }
    // 2. Locate CheckpointLoader
    let model;
    const ckptNode = nodes.find((n) => n.class_type === 'CheckpointLoaderSimple' ||
        n.class_type === 'CheckpointLoader' ||
        n.class_type === 'UNETLoader');
    if (ckptNode && ckptNode.inputs) {
        model = ckptNode.inputs.ckpt_name || ckptNode.inputs.unet_name;
    }
    // 3. Locate LoRAs
    const loras = [];
    const loraNodes = nodes.filter((n) => n.class_type === 'LoraLoader' ||
        n.class_type === 'LoraLoaderModelOnly' ||
        n.class_type?.includes('LoraLoader'));
    for (const lNode of loraNodes) {
        const rawName = lNode.inputs?.lora_name;
        if (rawName && typeof rawName === 'string') {
            const strength = typeof lNode.inputs.strength_model === 'number'
                ? lNode.inputs.strength_model
                : 1.0;
            loras.push({
                rawName: rawName.replace(/\.(safetensors|pt|ckpt)$/i, ''),
                strength,
            });
        }
    }
    // 4. Locate Dimensions
    let width = imageDimensions?.width;
    let height = imageDimensions?.height;
    const latentNode = nodes.find((n) => n.class_type === 'EmptyLatentImage' || n.class_type === 'EmptySD3LatentImage');
    if (latentNode && latentNode.inputs) {
        if (typeof latentNode.inputs.width === 'number')
            width = latentNode.inputs.width;
        if (typeof latentNode.inputs.height === 'number')
            height = latentNode.inputs.height;
    }
    return {
        prompt: positivePrompt,
        negativePrompt: negativePrompt || undefined,
        sampler,
        steps,
        cfgScale,
        seed,
        model,
        width,
        height,
        loras,
        detectedFormat: 'comfyui',
    };
}
