/** What a paste points at, besides pixels: an image address or a local image path */

const IMAGE_PATH = /\.(png|webp|jpe?g|jfif|avif)$/i;

export function isHttpUrl(text: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(text)) return false;
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

/** Address of the image a browser copied ("Copy image" adds <img src> as HTML) */
export function copiedImageUrl(html: string): string | null {
  if (!html) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const src = doc.querySelector('img')?.getAttribute('src')?.trim();
  return src && isHttpUrl(src) ? src : null;
}

/** A local image path, as Explorer's "Copy as path" writes it (in quotes) */
export function copiedImagePath(text: string): string | null {
  const unquoted = text.replace(/^"(.*)"$/, '$1');
  return /^(?:[a-z]:\\|\\\\)[^\r\n"*?<>|]+$/i.test(unquoted) && IMAGE_PATH.test(unquoted) ? unquoted : null;
}
