import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seaartSearchTerm, seaartSearchUrl } from '../core/seaart.ts';

describe('SeaArt links', () => {
  it('searches for a readable LoRA name', () => {
    assert.equal(seaartSearchTerm('add_detail-v2.safetensors'), 'add detail-v2');
    assert.equal(seaartSearchTerm('【Anima】Landscape | Style'), 'Anima Landscape Style');
  });

  it('builds an encoded search URL', () => {
    assert.equal(seaartSearchUrl('Detail Tweaker'), 'https://www.seaart.ai/search?keyword=Detail%20Tweaker');
    assert.equal(seaartSearchUrl('   '), undefined);
  });
});
