import type { ExtractedMetadata } from './types.js';
import { extractFromRawText } from './format-detect.js';

/**
 * Checks if the buffer starts with the standard RIFF/WEBP signature.
 */
export function isWebp(buffer: Uint8Array | Buffer): boolean {
  if (buffer.length < 12) return false;
  const dec = new TextDecoder('latin1');
  const riff = dec.decode(buffer.subarray(0, 4));
  const webp = dec.decode(buffer.subarray(8, 12));
  return riff === 'RIFF' && webp === 'WEBP';
}

export interface WebpChunk {
  id: string;
  data: Uint8Array;
}

/**
 * Dependency-free, isomorphic RIFF/WebP chunk reader.
 * Walks through chunks (EXIF, XMP , VP8X, etc.) without external dependencies.
 */
export function readWebpChunks(buffer: Uint8Array | Buffer): string[] {
  if (!isWebp(buffer)) return [];

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const results: string[] = [];
  let offset = 12; // Skip 'RIFF' + 4-byte size + 'WEBP'
  const decLatin1 = new TextDecoder('latin1');
  const decUtf8 = new TextDecoder('utf-8', { fatal: false });

  while (offset + 8 <= buffer.length) {
    const chunkId = decLatin1.decode(buffer.subarray(offset, offset + 4));
    const chunkSize = view.getUint32(offset + 4, true); // Little-endian
    offset += 8;

    if (offset + chunkSize > buffer.length) {
      break;
    }

    const chunkData = buffer.subarray(offset, offset + chunkSize);

    if (chunkId === 'EXIF') {
      // EXIF data may start with 'Exif\0\0' (6 bytes)
      let exifPayload = chunkData;
      if (chunkData.length >= 6) {
        const header = decLatin1.decode(chunkData.subarray(0, 4));
        if (header === 'Exif') {
          exifPayload = chunkData.subarray(6);
        }
      }

      // 1. Full text decoded string
      const textUtf8 = decUtf8.decode(exifPayload);
      if (textUtf8) results.push(textUtf8);

      // 2. Scan for zero-terminated ASCII string blocks inside the EXIF binary
      let strStart = -1;
      for (let i = 0; i < exifPayload.length; i++) {
        const byte = exifPayload[i];
        // Printable ASCII (32-126) plus tabs/newlines (9, 10, 13)
        if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
          if (strStart === -1) strStart = i;
        } else {
          if (strStart !== -1 && i - strStart >= 16) {
            const foundStr = decLatin1.decode(exifPayload.subarray(strStart, i)).trim();
            if (
              foundStr.includes('Steps:') ||
              foundStr.includes('Sampler:') ||
              foundStr.includes('prompt') ||
              foundStr.includes('class_type') ||
              foundStr.includes('Negative prompt:')
            ) {
              results.push(foundStr);
            }
          }
          strStart = -1;
        }
      }
      if (strStart !== -1 && exifPayload.length - strStart >= 16) {
        const foundStr = decLatin1.decode(exifPayload.subarray(strStart)).trim();
        if (foundStr) results.push(foundStr);
      }
    } else if (chunkId === 'XMP ') {
      const xmpText = decUtf8.decode(chunkData);
      if (xmpText) {
        results.push(xmpText);

        // Check for XML tags like <exif:UserComment> or <dc:description>
        const userCommentMatch = xmpText.match(/<exif:UserComment>(.*?)<\/exif:UserComment>/s);
        if (userCommentMatch && userCommentMatch[1]) {
          results.push(userCommentMatch[1]);
        }
        const descMatch = xmpText.match(/<dc:description>(.*?)<\/dc:description>/s);
        if (descMatch && descMatch[1]) {
          results.push(descMatch[1]);
        }
      }
    }

    // RIFF chunks are padded to even byte offsets
    offset += chunkSize + (chunkSize % 2 !== 0 ? 1 : 0);
  }

  return results;
}

/**
 * Extracts metadata from WebP image buffer via RIFF chunks fallback.
 */
export function extractFromWebpBuffer(buffer: Uint8Array | Buffer): ExtractedMetadata | null {
  const strings = readWebpChunks(buffer);
  for (const raw of strings) {
    const meta = extractFromRawText(raw);
    if (meta && (meta.prompt || meta.loras.length > 0 || meta.sampler)) {
      return meta;
    }
  }
  return null;
}
