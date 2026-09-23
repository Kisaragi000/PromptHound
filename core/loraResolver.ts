/**
 * LoRA resolver client for Civitai / SeaArt
 */
export async function resolveLoraHash(hashOrName: string) {
  try {
    // If running in an environment with fetch
    const endpoint = `https://civitai.com/api/v1/model-versions/by-hash/${encodeURIComponent(hashOrName)}`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      return { resolved: false, rawValue: hashOrName };
    }
    const data = (await res.json()) as any;
    return {
      resolved: true,
      rawValue: hashOrName,
      name: data?.model?.name || data?.name || hashOrName,
      source: {
        platform: 'Civitai' as const,
        url: `https://civitai.com/models/${data?.modelId || ''}`,
      },
    };
  } catch {
    return {
      resolved: false,
      rawValue: hashOrName,
    };
  }
}
