"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLoras = resolveLoras;
const resolutionCache = new Map();
/**
 * Resolves LoRA references against Civitai's public model-versions by-hash endpoint.
 * Non-blocking & fault-tolerant: a single failed or missing lookup never fails the extraction.
 */
async function resolveLoras(loras) {
    if (!loras || loras.length === 0)
        return [];
    const results = await Promise.allSettled(loras.map(async (lora) => {
        // If already resolved or lacks a hash, return as is
        if (lora.resolved || !lora.hash) {
            return lora;
        }
        const cleanHash = lora.hash.trim().toLowerCase();
        if (resolutionCache.has(cleanHash)) {
            return {
                ...lora,
                resolved: resolutionCache.get(cleanHash),
            };
        }
        try {
            const response = await fetch(`https://civitai.com/api/v1/model-versions/by-hash/${encodeURIComponent(cleanHash)}`, { headers: { 'User-Agent': 'PromptHound/0.1.0' } });
            if (!response.ok) {
                return lora;
            }
            const data = (await response.json());
            if (data && data.modelId) {
                const resolvedInfo = {
                    name: data.model?.name || data.name || lora.rawName,
                    source: 'civitai',
                    modelUrl: `https://civitai.com/models/${data.modelId}?modelVersionId=${data.id}`,
                };
                resolutionCache.set(cleanHash, resolvedInfo);
                return {
                    ...lora,
                    resolved: resolvedInfo,
                };
            }
        }
        catch {
            // Network offline or failed - degrade gracefully
        }
        return lora;
    }));
    return results.map((r, i) => (r.status === 'fulfilled' ? r.value : loras[i]));
}
