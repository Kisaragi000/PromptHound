import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zlibSync } from 'fflate';
import { blockNetwork, makePngWithChunks, makeStealthPng } from './helpers.ts';

blockNetwork();
const { extractFromImageBuffer } = await import('../core/link-fetch.ts');
const { isExtractionError } = await import('../core/types.ts');
const { repairMojibake } = await import('../core/text-decode.ts');

async function extract(bytes: Uint8Array) {
  const result = await extractFromImageBuffer(bytes, { kind: 'file', label: 'test.png' });
  if (isExtractionError(result)) assert.fail(`${result.code} ${result.message}`);
  return result.metadata;
}

const parameters = [
  'masterpiece, 少女, café ☕, <lora:add_detail:0.6>',
  'Negative prompt: lowres, “bad” hands',
  'Steps: 28, Sampler: Euler a, CFG scale: 7, Seed: 1, Size: 832x1216',
].join('\n');
const expectedPrompt = 'masterpiece, 少女, café ☕';

const bytes = (...parts: Array<number[] | Uint8Array>) => new Uint8Array(parts.flatMap((p) => [...p]));
const keyword = (k: string) => [...strToU8(k), 0];

/** EXIF block with UserComment as A1111 / piexif write it: "UNICODE\0" + UTF-16BE */
function exifUserComment(text: string): Uint8Array {
  const comment = [...strToU8('UNICODE'), 0];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    comment.push(code >> 8, code & 255);
  }
  const tiff = new Uint8Array(44 + comment.length);
  const v = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49]);
  v.setUint16(2, 42, true);
  v.setUint32(4, 8, true);
  // IFD0: one entry, the Exif sub-IFD pointer
  v.setUint16(8, 1, true);
  v.setUint16(10, 0x8769, true);
  v.setUint16(12, 4, true);
  v.setUint32(14, 1, true);
  v.setUint32(18, 26, true);
  // Exif IFD: UserComment (UNDEFINED)
  v.setUint16(26, 1, true);
  v.setUint16(28, 0x9286, true);
  v.setUint16(30, 7, true);
  v.setUint32(32, comment.length, true);
  v.setUint32(36, 44, true);
  tiff.set(comment, 44);
  return tiff;
}

describe('PNG text encodings', () => {
  it('reads UTF-8 written into a tEXt chunk without garbling it', async () => {
    const meta = await extract(makePngWithChunks([['tEXt', bytes(keyword('parameters'), strToU8(parameters))]]));
    assert.equal(meta.prompt, expectedPrompt);
    assert.equal(meta.negativePrompt, 'lowres, “bad” hands');
  });

  it('still reads Latin-1 tEXt as Pillow writes it', async () => {
    const latin1 = new Uint8Array([...'a café at night\nSteps: 20, Sampler: Euler, Seed: 1'].map((c) => c.charCodeAt(0)));
    const meta = await extract(makePngWithChunks([['tEXt', bytes(keyword('parameters'), latin1)]]));
    assert.equal(meta.prompt, 'a café at night');
  });

  it('reads compressed zTXt and iTXt chunks', async () => {
    for (const chunk of [
      ['zTXt', bytes(keyword('parameters'), [0], zlibSync(strToU8(parameters)))],
      ['iTXt', bytes(keyword('parameters'), [1, 0, 0, 0], zlibSync(strToU8(parameters)))],
    ] as Array<[string, Uint8Array]>) {
      const meta = await extract(makePngWithChunks([chunk]));
      assert.equal(meta.prompt, expectedPrompt, chunk[0]);
      assert.deepEqual(meta.loras.map((l) => l.rawName), ['add_detail'], chunk[0]);
    }
  });
});

describe('PNG metadata outside the usual text chunks', () => {
  it('reads an eXIf chunk with a UTF-16 UserComment', async () => {
    const meta = await extract(makePngWithChunks([['eXIf', exifUserComment(parameters)]]));
    assert.equal(meta.prompt, expectedPrompt);
    assert.equal(meta.steps, 28);
  });

  it('reads parameters from an XMP packet instead of returning the XML', async () => {
    const escaped = parameters.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const xmp =
      '<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      `<rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/"><exif:UserComment><rdf:Alt><rdf:li xml:lang="x-default">${escaped}</rdf:li></rdf:Alt></exif:UserComment>` +
      '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
    const meta = await extract(makePngWithChunks([['iTXt', bytes(keyword('XML:com.adobe.xmp'), [0, 0, 0, 0], strToU8(xmp))]]));
    assert.equal(meta.prompt, expectedPrompt);
    assert.deepEqual(meta.loras.map((l) => l.rawName), ['add_detail']);
  });

  it('reads A1111 stealth info hidden in the alpha channel', async () => {
    const meta = await extract(makeStealthPng(parameters));
    assert.equal(meta.prompt, expectedPrompt);
    assert.equal(meta.sampler, 'Euler a');
  });

  it('reads NovelAI compressed stealth info', async () => {
    const comment = { prompt: 'a cat in a garden', uc: 'lowres', steps: 28, scale: 5, seed: 7, sampler: 'k_euler', width: 832, height: 1216 };
    const hidden = JSON.stringify({ Software: 'NovelAI', Comment: JSON.stringify(comment) });
    const meta = await extract(makeStealthPng(hidden, { compressed: true }));
    assert.equal(meta.detectedFormat, 'novelai');
    assert.equal(meta.prompt, 'a cat in a garden');
    assert.equal(meta.negativePrompt, 'lowres');
  });
});

describe('ComfyUI graphs with NaN', () => {
  it('traces a graph that Python wrote with NaN values', async () => {
    const graph =
      '{"3": {"class_type": "KSampler", "inputs": {"seed": 1, "steps": 20, "cfg": 7, "sampler_name": "euler", "scheduler": "normal", "denoise": NaN,' +
      ' "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},' +
      ' "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "x.safetensors"}},' +
      ' "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "a red fox, NaN in a string stays", "clip": ["4", 1]}},' +
      ' "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "blurry", "clip": ["4", 1]}},' +
      ' "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},' +
      ' "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},' +
      ' "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0]}}}';
    const meta = await extract(makePngWithChunks([['tEXt', bytes(keyword('prompt'), strToU8(graph))]], 512, 512));
    assert.equal(meta.detectedFormat, 'comfyui');
    assert.equal(meta.prompt, 'a red fox, NaN in a string stays');
    assert.equal(meta.negativePrompt, 'blurry');
  });
});

describe('repairMojibake', () => {
  it('restores UTF-8 read as Latin-1 / Windows-1252 and leaves real Latin-1 alone', () => {
    const garbled = new TextDecoder('latin1').decode(strToU8('少女 “quoted” ☕'));
    assert.equal(repairMojibake(garbled), '少女 “quoted” ☕');
    assert.equal(repairMojibake('a café'), 'a café');
    assert.equal(repairMojibake('plain ascii'), 'plain ascii');
  });
});
