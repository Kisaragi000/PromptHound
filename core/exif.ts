/**
 * Dependency-free, isomorphic EXIF (TIFF) reader for the text tags that AI tools
 * use to embed generation metadata in JPEG and WebP files.
 *
 * A1111 / Forge / SwarmUI write parameters into EXIF UserComment (0x9286) with an
 * 8-byte charset prefix, usually `UNICODE\0` followed by UTF-16 text. Scanning the
 * raw bytes as UTF-8 / ASCII cannot recover that text, so tags are decoded here
 * according to their declared type and charset.
 */

const TAG_IMAGE_DESCRIPTION = 0x010e;
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_SOFTWARE = 0x0131;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_USER_COMMENT = 0x9286;
const TAG_XP_COMMENT = 0x9c9c;

const TEXT_TAGS = new Set([
  TAG_IMAGE_DESCRIPTION,
  TAG_MAKE,
  TAG_MODEL,
  TAG_SOFTWARE,
  TAG_USER_COMMENT,
  TAG_XP_COMMENT,
]);

// Byte size of one value for each TIFF field type
const TYPE_SIZES: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8,
};

export interface ExifTextEntry {
  tag: number;
  text: string;
}

function decodeText(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

function stripNulls(text: string): string {
  return text.replace(/\0+$/g, '').replace(/^﻿/, '').trim();
}

/**
 * Picks UTF-16 byte order. A BOM wins; otherwise ASCII-range text puts its zero
 * bytes on even offsets for big-endian and odd offsets for little-endian.
 */
function detectUtf16Encoding(bytes: Uint8Array, fallbackLittleEndian: boolean): 'utf-16le' | 'utf-16be' {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  }

  let evenZeros = 0;
  let oddZeros = 0;
  const sample = Math.min(bytes.length, 512);
  for (let i = 0; i < sample; i++) {
    if (bytes[i] === 0) {
      if (i % 2 === 0) evenZeros++;
      else oddZeros++;
    }
  }

  if (evenZeros > oddZeros) return 'utf-16be';
  if (oddZeros > evenZeros) return 'utf-16le';
  return fallbackLittleEndian ? 'utf-16le' : 'utf-16be';
}

/**
 * Decodes an EXIF UserComment value: 8-byte charset prefix + payload.
 */
export function decodeUserComment(bytes: Uint8Array, littleEndian = false): string {
  if (bytes.length === 0) return '';
  if (bytes.length < 8) return stripNulls(decodeText(bytes, 'utf-8'));

  const prefix = new TextDecoder('latin1').decode(bytes.subarray(0, 8));
  const body = bytes.subarray(8);

  if (prefix.startsWith('UNICODE')) {
    return stripNulls(decodeText(body, detectUtf16Encoding(body, littleEndian)));
  }
  if (prefix.startsWith('ASCII')) {
    return stripNulls(decodeText(body, 'utf-8'));
  }
  if (prefix.startsWith('JIS')) {
    return stripNulls(decodeText(body, 'shift_jis'));
  }
  if (/^\0{8}$/.test(prefix)) {
    // Undefined charset: most writers use UTF-8 here
    return stripNulls(decodeText(body, 'utf-8'));
  }

  // No valid prefix: some tools write the text directly
  return stripNulls(decodeText(bytes, 'utf-8'));
}

/**
 * Walks a TIFF structure (as found after the `Exif\0\0` header) and returns the
 * decoded text of every known text tag in IFD0 and the Exif sub-IFD.
 */
export function readExifTextTags(tiff: Uint8Array): ExifTextEntry[] {
  const entries: ExifTextEntry[] = [];
  if (tiff.length < 8) return entries;

  const byteOrder = String.fromCharCode(tiff[0], tiff[1]);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return entries;
  const littleEndian = byteOrder === 'II';

  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if (view.getUint16(2, littleEndian) !== 42) return entries;

  const visited = new Set<number>();
  const pending: number[] = [view.getUint32(4, littleEndian)];

  while (pending.length > 0) {
    const ifdOffset = pending.shift()!;
    if (visited.has(ifdOffset) || ifdOffset < 8 || ifdOffset + 2 > tiff.length) continue;
    visited.add(ifdOffset);

    const count = view.getUint16(ifdOffset, littleEndian);
    for (let i = 0; i < count; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > tiff.length) break;

      const tag = view.getUint16(entryOffset, littleEndian);
      const type = view.getUint16(entryOffset + 2, littleEndian);
      const valueCount = view.getUint32(entryOffset + 4, littleEndian);

      if (tag === TAG_EXIF_IFD_POINTER) {
        pending.push(view.getUint32(entryOffset + 8, littleEndian));
        continue;
      }
      if (!TEXT_TAGS.has(tag)) continue;

      const byteLength = valueCount * (TYPE_SIZES[type] || 1);
      const dataOffset = byteLength <= 4 ? entryOffset + 8 : view.getUint32(entryOffset + 8, littleEndian);
      if (dataOffset + byteLength > tiff.length) continue;
      const value = tiff.subarray(dataOffset, dataOffset + byteLength);

      let text: string;
      if (tag === TAG_USER_COMMENT) {
        text = decodeUserComment(value, littleEndian);
      } else if (tag === TAG_XP_COMMENT) {
        // Windows XP* tags are always UTF-16LE
        text = stripNulls(decodeText(value, 'utf-16le'));
      } else {
        text = stripNulls(decodeText(value, 'utf-8'));
      }

      if (text) entries.push({ tag, text });
    }
  }

  // Generation metadata lives in UserComment far more often than elsewhere
  return entries.sort((a, b) => Number(b.tag === TAG_USER_COMMENT) - Number(a.tag === TAG_USER_COMMENT));
}

/**
 * Accepts an EXIF payload with or without the `Exif\0\0` header.
 */
export function readExifTextFromPayload(payload: Uint8Array): string[] {
  let tiff = payload;
  if (
    payload.length >= 6 &&
    payload[0] === 0x45 && payload[1] === 0x78 && payload[2] === 0x69 && payload[3] === 0x66
  ) {
    tiff = payload.subarray(6);
  }
  return readExifTextTags(tiff).map((e) => e.text);
}
