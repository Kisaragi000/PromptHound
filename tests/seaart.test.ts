import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSeaArtLink, seaartSearchTerm, seaartSearchUrl } from '../core/seaart.ts';
import { scrapeModelPage } from '../core/page-json.ts';

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

describe('SeaArt model links', () => {
  it('knows a SeaArt link', () => {
    assert.equal(isSeaArtLink('https://www.seaart.ai/models/detail/abc123'), true);
    assert.equal(isSeaArtLink('https://seaart.me/models/detail/abc123'), true);
    assert.equal(isSeaArtLink('https://civitai.com/models/1'), false);
    assert.equal(isSeaArtLink('javascript:alert(1)'), false);
  });

  it('reads the model name and cover from the page preview tags', () => {
    const html = `<html><head><title>x</title>
      <meta property="og:title" content="Detail Tweaker | SeaArt AI Model">
      <meta property="og:image" content="https://image.cdn2.seaart.me/cover.webp"></head></html>`;
    assert.deepEqual(scrapeModelPage(html), { name: 'Detail Tweaker', coverImageUrl: 'https://image.cdn2.seaart.me/cover.webp' });
  });

  it('ignores a title that only names the site', () => {
    assert.deepEqual(scrapeModelPage('<title>SeaArt AI | Free AI Art Generator</title>'), { name: undefined, coverImageUrl: undefined });
  });
});
