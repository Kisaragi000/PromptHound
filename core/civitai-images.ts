/**
 * Civitai image URLs carry a transform segment before the file name
 * (".../<uuid>/original=true/<id>.jpeg"). Covers are shown as small thumbnails, so ask
 * the CDN for a resized still frame instead of the full-size original (often several
 * MB, or a video for video models).
 */
export function civitaiThumbnail(url: string | undefined, width = 256): string | undefined {
  if (!url || !/^https:\/\/image\.civitai\.com\//.test(url)) return url;
  const parts = url.split('/');
  if (parts.length < 3) return url;
  const transform = `anim=false,width=${width}`;
  const segment = parts[parts.length - 2];
  // Replace an existing transform segment, or insert one before the file name
  if (/=/.test(segment)) parts[parts.length - 2] = transform;
  else parts.splice(parts.length - 1, 0, transform);
  return parts.join('/');
}
