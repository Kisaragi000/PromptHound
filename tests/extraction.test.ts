import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blockNetwork, makePng, readSample } from './helpers.ts';

blockNetwork();
const { extractFromImageBuffer } = await import('../core/link-fetch.ts');
const { isExtractionError } = await import('../core/types.ts');

async function extract(bytes: Uint8Array, label = 'test.png') {
  const result = await extractFromImageBuffer(bytes, { kind: 'file', label });
  if (isExtractionError(result)) assert.fail(`${label}: ${result.code} ${result.message}`);
  return result.metadata;
}

const loraSummary = (loras: Array<{ rawName: string; strength?: number }>) => loras.map((l) => [l.rawName, l.strength]);

describe('example images shipped with the app', () => {
  it('reads the Civitai on-site JPEG (nordic-fjord-boathouse.jpg)', async () => {
    const meta = await extract(readSample('nordic-fjord-boathouse.jpg'), 'nordic-fjord-boathouse.jpg');
    assert.equal(meta.detectedFormat, 'a1111');
    assert.match(meta.prompt, /^score_9, score_8, score_7, highres/);
    assert.match(meta.negativePrompt ?? '', /^worst quality, low quality/);
    assert.equal(meta.sampler, 'DPM++ 2M');
    assert.equal(meta.steps, 25);
    assert.equal(meta.cfgScale, 7);
    assert.equal(String(meta.seed), '866389369');
    assert.equal(meta.width, 1216);
    assert.equal(meta.height, 832);
    assert.equal(meta.modelVersionId, 3301424);
    assert.equal(meta.modelResolved?.name, 'One obsession_Anima');
    assert.deepEqual(loraSummary(meta.loras), [
      ['【Anima】Landscape specialization lora', 0.9],
      ['Anima Lighting Atmosphere Enhancer', 0.3],
    ]);
    assert.deepEqual(
      meta.loras.map((l) => l.civitaiVersionId),
      [2947634, 3082260]
    );
  });

  it('reads watercolor-hound.jpg with its LoRA and checkpoint', async () => {
    const meta = await extract(readSample('watercolor-hound.jpg'), 'watercolor-hound.jpg');
    assert.match(meta.prompt, /^masterpiece, best quality, very aesthetic, absurdres, chalk pastel/);
    assert.equal(meta.sampler, 'Heun');
    assert.equal(meta.steps, 30);
    assert.equal(String(meta.seed), '1541505910');
    assert.equal(meta.modelResolved?.name, 'Hyphoria');
    assert.deepEqual(loraSummary(meta.loras), [['Watercolor/saturated | Illustrious Style Lora', 0.6]]);
  });

  it('reads coastal-research-station.jpg with three LoRAs', async () => {
    const meta = await extract(readSample('coastal-research-station.jpg'), 'coastal-research-station.jpg');
    assert.match(meta.prompt, /^A photorealistic architectural photograph of a coastal research station/);
    assert.equal(meta.sampler, 'Euler');
    assert.equal(meta.steps, 30);
    assert.equal(meta.cfgScale, 3.5);
    assert.equal(String(meta.seed), '725812185');
    assert.deepEqual(
      meta.loras.map((l) => l.civitaiVersionId),
      [3234278, 3077110, 3098382]
    );
  });

  it('reports an image without metadata as such (reze-rainy-street.jpg)', async () => {
    const result = await extractFromImageBuffer(readSample('reze-rainy-street.jpg'), { kind: 'file', label: 'reze' });
    assert.ok(isExtractionError(result));
    assert.equal(result.code, 'no-metadata-found');
  });
});

describe('A1111 / Forge PNG', () => {
  const parameters = [
    'masterpiece, 1girl, <lora:add_detail:0.6>, city street',
    'Negative prompt: lowres, bad hands',
    'Steps: 28, Sampler: DPM++ 2M Karras, CFG scale: 6.5, Seed: 1234567890, Size: 832x1216, Model hash: 6ce0161689, Model: v1-5-pruned-emaonly, Lora hashes: "add_detail: 7c6bad76eb54", Version: v1.9.4',
  ].join('\n');

  it('reads prompt, settings and LoRA, and drops the LoRA tag from the prompt', async () => {
    const meta = await extract(makePng({ parameters }));
    assert.equal(meta.detectedFormat, 'a1111');
    assert.equal(meta.prompt, 'masterpiece, 1girl, city street');
    assert.equal(meta.negativePrompt, 'lowres, bad hands');
    assert.equal(meta.sampler, 'DPM++ 2M Karras');
    assert.equal(meta.steps, 28);
    assert.equal(meta.cfgScale, 6.5);
    assert.equal(String(meta.seed), '1234567890');
    assert.equal(meta.width, 832);
    assert.equal(meta.height, 1216);
    assert.equal(meta.model, 'v1-5-pruned-emaonly');
    assert.equal(meta.modelHash, '6ce0161689');
    assert.deepEqual(loraSummary(meta.loras), [['add_detail', 0.6]]);
    assert.equal(meta.loras[0].hash, '7c6bad76eb54');
  });

  it('identifies the LoRA by hash from the offline catalog', async () => {
    const meta = await extract(makePng({ parameters }));
    assert.equal(meta.loras[0].resolved?.name, 'Detail Tweaker LoRA (细节调整LoRA)');
    assert.equal(meta.loras[0].resolved?.matchedBy, 'hash');
  });

  it('keeps the scheduler written as "Schedule type" (A1111 1.9+)', async () => {
    const meta = await extract(
      makePng({ parameters: 'a red fox\nSteps: 20, Sampler: DPM++ 2M, Schedule type: Karras, CFG scale: 7, Seed: 1, Size: 512x512' })
    );
    assert.equal(meta.sampler, 'DPM++ 2M Karras');
  });

  it('leaves out the automatic scheduler', async () => {
    const meta = await extract(
      makePng({ parameters: 'a red fox\nSteps: 20, Sampler: Euler a, Schedule type: Automatic, CFG scale: 7, Seed: 1, Size: 512x512' })
    );
    assert.equal(meta.sampler, 'Euler a');
  });
});

describe('ComfyUI PNG', () => {
  const graph = {
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
    '10': {
      class_type: 'LoraLoader',
      inputs: { lora_name: 'add-detail-xl.safetensors', strength_model: 0.8, strength_clip: 0.8, model: ['4', 0], clip: ['4', 1] },
    },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: 'a lighthouse on a cliff, golden hour', clip: ['10', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: 'blurry, watermark', clip: ['10', 1] } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: 42, steps: 20, cfg: 7, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1,
        model: ['10', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0],
      },
    },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'ComfyUI', images: ['8', 0] } },
  };

  it('traces the graph from the sampler that feeds the saved image', async () => {
    const meta = await extract(makePng({ prompt: JSON.stringify(graph) }, 1024, 1024));
    assert.equal(meta.detectedFormat, 'comfyui');
    assert.equal(meta.prompt, 'a lighthouse on a cliff, golden hour');
    assert.equal(meta.negativePrompt, 'blurry, watermark');
    assert.equal(meta.sampler, 'DPM++ 2M Karras');
    assert.equal(meta.steps, 20);
    assert.equal(meta.cfgScale, 7);
    assert.equal(String(meta.seed), '42');
    assert.equal(meta.model, 'sd_xl_base_1.0');
    assert.deepEqual(loraSummary(meta.loras), [['add-detail-xl', 0.8]]);
  });
});

describe('NovelAI PNG', () => {
  it('reads the Comment JSON and labels the sampler', async () => {
    const comment = { prompt: 'a cat, {masterpiece}', uc: 'lowres', steps: 28, scale: 5, seed: 7, sampler: 'k_euler_ancestral', width: 832, height: 1216 };
    const meta = await extract(makePng({ Software: 'NovelAI', Comment: JSON.stringify(comment) }));
    assert.equal(meta.detectedFormat, 'novelai');
    assert.equal(meta.prompt, 'a cat, {masterpiece}');
    assert.equal(meta.negativePrompt, 'lowres');
    assert.equal(meta.sampler, 'Euler a');
    assert.equal(meta.steps, 28);
    assert.equal(meta.cfgScale, 5);
  });
});

describe('images without generation data', () => {
  it('reports no metadata for a PNG with unrelated text', async () => {
    const result = await extractFromImageBuffer(makePng({ Software: 'Paint' }), { kind: 'file', label: 'paint.png' });
    assert.ok(isExtractionError(result));
    assert.equal(result.code, 'no-metadata-found');
  });

  it('does not throw on bytes that are not an image', async () => {
    const result = await extractFromImageBuffer(new Uint8Array([1, 2, 3, 4]), { kind: 'file', label: 'junk' });
    assert.ok(isExtractionError(result));
  });
});
