import fs from 'node:fs';
import path from 'node:path';
import { zlibSync, strToU8 } from 'fflate';

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
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...Object.entries(text).map(([key, value]) => {
      // Latin-1 keyword, NUL, then the text (generators write UTF-8 here in practice)
      const body = new Uint8Array([...strToU8(key), 0, ...strToU8(value)]);
      return chunk('tEXt', body);
    }),
    chunk('IDAT', zlibSync(new Uint8Array([0, 0, 0, 0]))),
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
