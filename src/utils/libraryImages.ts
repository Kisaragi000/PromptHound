import type { LibraryImage } from '../../core/types.js';
import { civitaiOriginal } from '../../core/civitai-images.js';
import { imageToDataUrl, isSessionOnlyUrl, makeThumbnail, needsOwnCopy } from './images.js';

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

function extensionOf(file: Blob, name?: string): string {
  const fromName = name?.match(/\.(png|jpe?g|jfif|webp|avif|gif)$/i)?.[1]?.toLowerCase();
  return fromName ?? EXTENSION_BY_TYPE[file.type] ?? 'png';
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Keeps an image for a library item. The desktop app writes the original file and a
 * thumbnail to its data folder; the web preview (no file access) keeps small embedded
 * copies instead.
 */
export async function storeLibraryImage(itemId: string, file: Blob, name?: string): Promise<LibraryImage | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const thumbnail = await makeThumbnail(objectUrl, 480);
    if (!thumbnail) return null; // not a decodable image
    const store = window.promptHound?.library?.storeImage;
    if (store) {
      const original = new Uint8Array(await file.arrayBuffer());
      return await store(itemId, original, extensionOf(file, name), dataUrlToBytes(thumbnail), name);
    }
    const large = (await makeThumbnail(objectUrl, 1600, 0.85)) ?? thumbnail;
    return { url: large, thumbUrl: thumbnail, name };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** The image behind a URL as a Blob: blob:/data: URLs directly, files and web images via the app */
async function imageBlob(url: string): Promise<Blob | null> {
  // Civitai shows resized copies; keep the original upload
  const source = civitaiOriginal(url);
  try {
    const response = await fetch(source);
    if (response.ok) return await response.blob();
  } catch {
    // file: URLs and web images without CORS are read by the main process below
  }
  const dataUrl = await imageToDataUrl(source);
  if (!dataUrl) return null;
  try {
    return await (await fetch(dataUrl)).blob();
  } catch {
    return null;
  }
}

/** Stores a copy of an image the app shows by URL (a dropped file's preview, a file on disk, a web image) */
export async function storeLibraryImageFromUrl(itemId: string, url: string, name?: string): Promise<LibraryImage | null> {
  try {
    const blob = await imageBlob(url);
    return blob ? await storeLibraryImage(itemId, blob, name ?? fileNameFromUrl(url)) : null;
  } catch {
    return null;
  }
}

/** File name in a file: or web URL ("00029-1201710852.png"), so the stored copy keeps its extension */
function fileNameFromUrl(url: string): string | undefined {
  if (!/^(file|https?):/i.test(url)) return undefined;
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    return /\.(png|jpe?g|jfif|webp|avif|gif)$/i.test(last) ? last : undefined;
  } catch {
    return undefined;
  }
}

/** Deletes stored image files that are no longer used (no-op in the web preview) */
export function deleteLibraryImages(images: LibraryImage[]): void {
  const urls = images.flatMap((img) => [img.url, img.thumbUrl]).filter((u) => u.startsWith('ph-image:'));
  if (urls.length) void window.promptHound?.library?.deleteImage?.(urls);
}

/** Images of an item for display, cover first; older items only have thumbnailUrl */
export function itemImages(item: { images?: LibraryImage[]; thumbnailUrl?: string }): LibraryImage[] {
  if (item.images && item.images.length > 0) return item.images;
  return item.thumbnailUrl ? [{ url: item.thumbnailUrl, thumbUrl: item.thumbnailUrl }] : [];
}

export const isImageFile = (file: File) =>
  file.type.startsWith('image/') || /\.(png|jpe?g|jfif|webp|avif|gif)$/i.test(file.name);

/**
 * Copies an entry's images that live outside the app (files elsewhere on disk, web images,
 * images embedded in the library data, session previews) into the app's own folder, so the
 * entry keeps them when the original is moved, deleted or taken offline. Returns the new
 * images, or null when nothing was copied; an image that cannot be read is left as it is.
 */
export async function keepItemImages(item: {
  id: string;
  images?: LibraryImage[];
  thumbnailUrl?: string;
}): Promise<{ images: LibraryImage[]; thumbnailUrl: string } | null> {
  // The web preview cannot write files: only session previews must be turned into data there
  const desktop = Boolean(window.promptHound?.library?.storeImage);
  const mustCopy = (url: string) => (desktop ? needsOwnCopy(url) : isSessionOnlyUrl(url));
  const images = itemImages(item);
  if (!images.some((img) => mustCopy(img.url))) return null;

  let copied = false;
  const kept: LibraryImage[] = [];
  for (const image of images) {
    const stored = mustCopy(image.url) ? await storeLibraryImageFromUrl(item.id, image.url, image.name) : null;
    if (stored) copied = true;
    kept.push(stored ?? image);
  }
  return copied ? { images: kept, thumbnailUrl: kept[0].thumbUrl } : null;
}
