import { unzlibSync, gunzipSync } from 'fflate';
import { isPng } from './png.js';

/**
 * Reads "stealth" PNG info: generation parameters hidden in the least significant bits
 * of the pixels instead of in text chunks. NovelAI writes it into every image, and the
 * A1111 / Forge stealth-pnginfo extension can too. It survives sites and tools that strip
 * text chunks but keep the pixels.
 *
 * Layout (sd-webui-stealth-pnginfo): pixels are walked column by column; in alpha mode
 * each pixel gives the LSB of its alpha, in RGB mode the LSBs of R, G and B. The bit
 * stream starts with a 15-byte signature ("stealth_pnginfo" / "stealth_pngcomp" for
 * alpha, "stealth_rgbinfo" / "stealth_rgbcomp" for RGB; "comp" means gzip), then a
 * 32-bit length in bits, then the UTF-8 payload.
 */

const SIGNATURE_BITS = 15 * 8;
// Large enough for any generator output, small enough not to stall on huge photos
const MAX_PIXELS = 64 * 1024 * 1024;

interface DecodedImage {
  width: number;
  height: number;
  channels: 3 | 4;
  pixels: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decodes 8-bit, non-interlaced RGB / RGBA PNGs, the only kinds stealth info is written to */
function decodePixels(buffer: Uint8Array): DecodedImage | null {
  if (!isPng(buffer)) return null;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let width = 0;
  let height = 0;
  let channels: 3 | 4 | 0 = 0;
  const idat: Uint8Array[] = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...buffer.subarray(offset + 4, offset + 8));
    if (offset + 8 + length > buffer.length) break;
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      if (data.length < 13) return null;
      const ihdr = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = ihdr.getUint32(0);
      height = ihdr.getUint32(4);
      const [bitDepth, colorType, , , interlace] = data.subarray(8, 13);
      if (bitDepth !== 8 || interlace !== 0) return null;
      channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
      if (!channels) return null;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (!channels || !width || !height || width * height > MAX_PIXELS || idat.length === 0) return null;

  const total = idat.reduce((n, c) => n + c.length, 0);
  const compressed = new Uint8Array(total);
  let pos = 0;
  for (const c of idat) {
    compressed.set(c, pos);
    pos += c.length;
  }
  const raw = unzlibSync(compressed);

  const stride = width * channels;
  if (raw.length < height * (stride + 1)) return null;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const prev = dst - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const a = i >= channels ? pixels[dst + i - channels] : 0;
      const b = y > 0 ? pixels[prev + i] : 0;
      const c = y > 0 && i >= channels ? pixels[prev + i - channels] : 0;
      let value: number;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: value = x + paeth(a, b, c); break;
        default: return null;
      }
      pixels[dst + i] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

/** LSB bit stream over the pixels, column by column, from the given channels */
function* lsbBits(img: DecodedImage, channelIndexes: number[]): Generator<number> {
  for (let x = 0; x < img.width; x++) {
    for (let y = 0; y < img.height; y++) {
      const base = (y * img.width + x) * img.channels;
      for (const ch of channelIndexes) yield img.pixels[base + ch] & 1;
    }
  }
}

function readBytes(bits: Generator<number>, count: number): Uint8Array | null {
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      const next = bits.next();
      if (next.done) return null;
      byte = (byte << 1) | next.value;
    }
    out[i] = byte;
  }
  return out;
}

function readPayload(img: DecodedImage, channelIndexes: number[], plain: string, gzip: string): string | null {
  const bits = lsbBits(img, channelIndexes);
  const sig = readBytes(bits, SIGNATURE_BITS / 8);
  if (!sig) return null;
  const signature = String.fromCharCode(...sig);
  if (signature !== plain && signature !== gzip) return null;

  const lengthBytes = readBytes(bits, 4);
  if (!lengthBytes) return null;
  const bitLength = new DataView(lengthBytes.buffer).getUint32(0);
  const available = img.width * img.height * channelIndexes.length - SIGNATURE_BITS - 32;
  if (bitLength === 0 || bitLength > available) return null;

  const data = readBytes(bits, Math.floor(bitLength / 8));
  if (!data) return null;
  const bytes = signature === gzip ? gunzipSync(data) : data;
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Returns the hidden text (A1111 parameters, or NovelAI's JSON with a Comment field),
 * or null when the image carries none.
 */
export function readStealthPngInfo(buffer: Uint8Array): string | null {
  try {
    const img = decodePixels(buffer);
    if (!img) return null;
    if (img.channels === 4) {
      const text = readPayload(img, [3], 'stealth_pnginfo', 'stealth_pngcomp');
      if (text) return text;
    }
    return readPayload(img, [0, 1, 2], 'stealth_rgbinfo', 'stealth_rgbcomp');
  } catch {
    return null;
  }
}
