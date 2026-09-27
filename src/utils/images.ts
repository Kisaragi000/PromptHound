/**
 * Helpers for turning image URLs the app shows (blob:, file:, relative sample paths,
 * Civitai CDN) into self-contained data URLs, for exports and for thumbnails that must
 * outlive the session (blob: URLs die when the app restarts).
 */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Reads any displayable image URL as a data URL, or undefined when it cannot be read. */
export async function imageToDataUrl(url: string | undefined | null): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;

  const absolute = new URL(url, window.location.href).href;
  try {
    const response = await fetch(absolute);
    if (response.ok) return await blobToDataUrl(await response.blob());
  } catch {
    // Fall through: file: URLs may be refused by fetch
  }

  // Desktop app: local files are read by the main process (image files only)
  if (absolute.startsWith('file:') && window.promptHound?.extraction?.readImageAsDataUrl) {
    try {
      return (await window.promptHound.extraction.readImageAsDataUrl(absolute)) ?? undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** A downscaled JPEG data URL (longest side maxSize) suitable for storing with a library item. */
export async function makeThumbnail(url: string | undefined | null, maxSize = 640, quality = 0.8): Promise<string | undefined> {
  const dataUrl = await imageToDataUrl(url);
  if (!dataUrl) return undefined;
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return undefined;
  }
}

/** URLs that stop working after a restart and must not be stored. */
export const isSessionOnlyUrl = (url: string | undefined | null) => Boolean(url && url.startsWith('blob:'));
