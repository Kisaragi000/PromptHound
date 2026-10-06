import fs from 'node:fs';
import path from 'node:path';
import { zlibSync, gzipSync, strToU8 } from 'fflate';

export const repoPath = (...parts: string[]) => path.join(import.meta.dirname, '..', ...parts);
export const readSample = (name: string) => new Uint8Array(fs.readFileSync(repoPath('public', 'samples', name)));

/**
 * Keeps tests offline and deterministic: LoRA and checkpoint lookups fall back to the
 * bundled catalog instead of calling Civitai.
 */
export function blockNetwork(): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('data:')) return new Response(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    throw new Error(`Network is disabled in tests (${url})`);
  }) as typeof fetch;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(strToU8(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A 1×1 PNG of the given size header carrying tEXt chunks, like generators write them */
export function makePng(text: Record<string, string>, width = 832, height = 1216): Uint8Array {
  return makePngWithChunks(
    Object.entries(text).map(([key, value]) => {
      // Latin-1 keyword, NUL, then the text (generators write UTF-8 here in practice)
      return ['tEXt', new Uint8Array([...strToU8(key), 0, ...strToU8(value)])];
    }),
    width,
    height
  );
}

/** A PNG carrying the given ancillary chunks (type, body) between IHDR and IDAT */
export function makePngWithChunks(
  chunks: Array<[string, Uint8Array]>,
  width = 832,
  height = 1216,
  ihdrExtra: number[] = [8, 2, 0, 0, 0],
  idat: Uint8Array = new Uint8Array([0, 0, 0, 0])
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set(ihdrExtra, 8);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...chunks.map(([type, body]) => chunk(type, body)),
    chunk('IDAT', zlibSync(idat)),
    chunk('IEND', new Uint8Array()),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    png.set(p, offset);
    offset += p.length;
  }
  return png;
}

/**
 * An RGBA PNG with text hidden in the alpha LSBs, column by column, as NovelAI and the
 * A1111 stealth-pnginfo extension write it. Rows use every PNG filter type in turn.
 */
export function makeStealthPng(text: string, { compressed = false, width = 64, height = 72 } = {}): Uint8Array {
  const payload = compressed ? gzipSync(strToU8(text)) : strToU8(text);
  const signature = strToU8(compressed ? 'stealth_pngcomp' : 'stealth_pnginfo');
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, payload.length * 8);
  const bits: number[] = [];
  for (const byte of [...signature, ...length, ...payload]) {
    for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
  }
  if (bits.length > width * height) throw new Error('image too small for the payload');

  const stride = width * 4;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels.set([(x * 5) & 255, (y * 7) & 255, (x * y) & 255, 254 | (bits[x * height + y] ?? 0)], i);
    }
  }

  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const filter = y % 5;
    raw[y * (stride + 1)] = filter;
    for (let i = 0; i < stride; i++) {
      const x = pixels[y * stride + i];
      const a = i >= 4 ? pixels[y * stride + i - 4] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= 4 ? pixels[(y - 1) * stride + i - 4] : 0;
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
      raw[y * (stride + 1) + 1 + i] = (x - predictor) & 255;
    }
  }
  return makePngWithChunks([], width, height, [8, 6, 0, 0, 0], raw);
}
