import type { LibraryImage } from '../../core/types.js';
import { makeThumbnail } from './images.js';

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

/** Stores an image the app currently shows by URL (e.g. a blob: preview of a dropped file) */
export async function storeLibraryImageFromUrl(itemId: string, url: string, name?: string): Promise<LibraryImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await storeLibraryImage(itemId, await response.blob(), name);
  } catch {
    return null;
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
