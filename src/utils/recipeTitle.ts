/** A file name without its folder or extension ("C:\models\ponyV6.safetensors" -> "ponyV6") */
export function bareFileName(name: string | undefined): string {
  return (name || '').split(/[\\/]/).pop()!.replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|sft|png|jpe?g|jfif|webp|avif|gif)$/i, '').trim();
}

/**
 * Name for a library entry nobody named: the base model (its Civitai name when found),
 * else the image's file name.
 */
export function defaultEntryName(
  meta: { model?: string; modelResolved?: { name?: string } } | null | undefined,
  fileName?: string
): string {
  return (meta?.modelResolved?.name || '').trim() || bareFileName(meta?.model) || bareFileName(fileName);
}
