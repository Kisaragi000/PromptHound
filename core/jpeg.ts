import type { ExtractedMetadata } from './types.js';
import { extractFromRawText } from './format-detect.js';
import { readExifTextFromPayload } from './exif.js';
import { readXmpTextFields } from './xmp.js';

/**
 * Checks if the buffer starts with the standard JPEG/JFIF SOI signature (0xFF, 0xD8).
 */
export function isJpeg(buffer: Uint8Array | Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0xff && buffer[1] === 0xd8;
}

export interface JpegParseResult {
  width?: number;
  height?: number;
  textEntries: string[];
}

/**
 * Dependency-free, isomorphic JPEG/JFIF segment scanner.
 * Extracts EXIF UserComments, ImageDescription, Adobe XMP, and COM comment markers.
 */
export function readJpegSegments(buffer: Uint8Array | Buffer): JpegParseResult {
  const result: JpegParseResult = {
    textEntries: [],
  };

  if (!isJpeg(buffer)) return result;

  const len = buffer.length;
  let offset = 2; // skip SOI (0xFF, 0xD8)
  const decLatin1 = new TextDecoder('latin1');
  const decUtf8 = new TextDecoder('utf-8', { fatal: false });

  while (offset + 4 <= len) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    // Standalone markers without payload
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }

    if (offset + 2 > len) break;
    const segmentLength = (buffer[offset] << 8) | buffer[offset + 1];
    const payloadStart = offset + 2;
    const payloadEnd = offset + segmentLength;

    if (payloadEnd > len) break;
    const payload = buffer.subarray(payloadStart, payloadEnd);

    // 1. APP1 (0xE1): EXIF or XMP
    if (marker === 0xe1) {
      if (payload.length >= 6) {
        const header6 = decLatin1.decode(payload.subarray(0, 6));
        if (header6.startsWith('Exif\0\0') || header6.startsWith('Exif')) {
          const exifData = payload.subarray(header6.startsWith('Exif\0\0') ? 6 : 4);

          // Structured EXIF text tags (UserComment is often UTF-16)
          result.textEntries.push(...readExifTextFromPayload(exifData));

          // Full UTF-8 decode
          const fullText = decUtf8.decode(exifData);
          if (fullText) result.textEntries.push(fullText);

          // Scan for printable string chunks in the EXIF binary
          let strStart = -1;
          for (let i = 0; i < exifData.length; i++) {
            const b = exifData[i];
            if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
              if (strStart === -1) strStart = i;
            } else {
              if (strStart !== -1 && i - strStart >= 12) {
                const s = decLatin1.decode(exifData.subarray(strStart, i)).trim();
                if (
                  s.includes('Steps:') ||
                  s.includes('Sampler:') ||
                  s.includes('prompt') ||
                  s.includes('Negative prompt:') ||
                  s.includes('class_type') ||
                  s.includes('cfgScale') ||
                  s.includes('Seed:')
                ) {
                  result.textEntries.push(s);
                }
              }
              strStart = -1;
            }
          }
          if (strStart !== -1 && exifData.length - strStart >= 12) {
            const s = decLatin1.decode(exifData.subarray(strStart)).trim();
            if (s) result.textEntries.push(s);
          }
        } else if (header6.startsWith('http:/') || decLatin1.decode(payload.subarray(0, 28)).includes('http://ns.adobe.com/xap/1.0/')) {
          // XMP data
          const xmpText = decUtf8.decode(payload);
          // Only the fields that can hold parameters: the packet itself would parse as
          // A1111 text and come back as the prompt
          if (xmpText) result.textEntries.push(...readXmpTextFields(xmpText));
        }
      }
    }

    // 2. COM (0xFE): Comment marker
    if (marker === 0xfe) {
      const comText = decUtf8.decode(payload).trim();
      if (comText) {
        result.textEntries.push(comText);
      }
    }

    // 3. SOF0 (0xC0) or SOF2 (0xC2): Baseline/Progressive DCT dimensions
    if (marker === 0xc0 || marker === 0xc2) {
      if (payload.length >= 5) {
        result.height = (payload[1] << 8) | payload[2];
        result.width = (payload[3] << 8) | payload[4];
      }
    }

    offset += segmentLength;
  }

  return result;
}

/**
 * Extracts AI generation metadata from JPEG/JFIF image buffers.
 */
export function extractFromJpegBuffer(buffer: Uint8Array | Buffer): ExtractedMetadata | null {
  const parsed = readJpegSegments(buffer);
  const dims = { width: parsed.width, height: parsed.height };

  for (const raw of parsed.textEntries) {
    const meta = extractFromRawText(raw, dims);
    if (meta && (meta.prompt || meta.loras.length > 0 || meta.sampler || meta.steps || meta.seed)) {
      return meta;
    }
  }

  return null;
}
