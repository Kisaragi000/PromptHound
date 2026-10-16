import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bareFileName, defaultEntryName } from '../src/utils/recipeTitle.ts';
import { snapWeight } from '../src/utils/loraWeights.ts';
import { needsOwnCopy } from '../src/utils/images.ts';

describe('Saving entries', () => {
  it('names an unnamed entry after its base model, else its file', () => {
    assert.equal(defaultEntryName({ model: 'ponyDiffusionV6XL_v6.safetensors' }, 'x.png'), 'ponyDiffusionV6XL_v6');
    assert.equal(
      defaultEntryName({ model: 'ponyDiffusionV6XL', modelResolved: { name: 'Pony Diffusion V6 XL' } }),
      'Pony Diffusion V6 XL'
    );
    assert.equal(defaultEntryName({ model: 'SDXL 1.0' }), 'SDXL 1.0');
    assert.equal(defaultEntryName({}, '00029-1201710852.png'), '00029-1201710852');
    assert.equal(defaultEntryName(null), '');
    assert.equal(bareFileName('C:\\models\\Stable-diffusion\\animagine.ckpt'), 'animagine');
  });

  it('snaps a dragged weight to the nearby set weights only', () => {
    assert.equal(snapWeight(0.75), 0.8);
    assert.equal(snapWeight(1.04), 1);
    assert.equal(snapWeight(1.85), 1.8);
    assert.equal(snapWeight(3.95), 4);
    assert.equal(snapWeight(1.25), 1.25);
    assert.equal(snapWeight(0.333), 0.33);
  });

  // Entries keep their own copy, so the original can be moved or deleted
  it('copies every image that lives outside the app into its folder', () => {
    for (const url of [
      'blob:http://localhost/abc',
      'file:///C:/Users/me/Pictures/00029.png',
      'data:image/png;base64,AAAA',
      'https://image.civitai.com/x/original=true/1.jpeg',
    ]) {
      assert.equal(needsOwnCopy(url), true, url);
    }
    assert.equal(needsOwnCopy('ph-image://item/1.png'), false);
    assert.equal(needsOwnCopy('samples/sample-1.png'), false);
  });
});
