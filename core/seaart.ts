/**
 * SeaArt model links. SeaArt has no public API to look a LoRA up by hash, so the app
 * links to a SeaArt search for the LoRA's name (the identified name when there is one).
 */

const SEAART_SEARCH = 'https://www.seaart.ai/search';

/** Readable search text from a LoRA name or file name ("add_detail-v2.safetensors" -> "add detail v2") */
export function seaartSearchTerm(name: string): string {
  return name
    .replace(/\.(safetensors|ckpt|pt|bin)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/[【】\[\]|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function seaartSearchUrl(name: string): string | undefined {
  const term = seaartSearchTerm(name);
  return term ? `${SEAART_SEARCH}?keyword=${encodeURIComponent(term)}` : undefined;
}
