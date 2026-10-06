import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { civitaiOriginal, civitaiThumbnail } from '../core/civitai-images.ts';
import { isDirectImageUrl } from '../core/link-fetch.ts';
import { copiedImagePath, isHttpUrl } from '../src/utils/pasteSources.ts';

const CDN = 'https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/3144e0a7-a26b-4eef-93c1-2975285197f4';

describe('Civitai image URLs', () => {
  it('swaps a resized copy for the original upload', () => {
    assert.equal(civitaiOriginal(`${CDN}/width=450/141998270.jpeg`), `${CDN}/original=true/141998270.jpeg`);
    assert.equal(civitaiOriginal(`${CDN}/anim=false,width=256/141998270.jpeg`), `${CDN}/original=true/141998270.jpeg`);
  });

  it('adds the original segment when the URL has none', () => {
    assert.equal(civitaiOriginal(`${CDN}/141998270.jpeg`), `${CDN}/original=true/141998270.jpeg`);
  });

  it('leaves other hosts alone', () => {
    const url = 'https://example.com/a/width=450/b.png';
    assert.equal(civitaiOriginal(url), url);
  });

  it('builds thumbnails from any Civitai image URL', () => {
    assert.equal(civitaiThumbnail(`${CDN}/original=true/1.jpeg`, 128), `${CDN}/anim=false,width=128/1.jpeg`);
  });
});

describe('direct image links', () => {
  it('recognises image file URLs, with or without a query', () => {
    assert.ok(isDirectImageUrl('https://x.test/a.png'));
    assert.ok(isDirectImageUrl('https://x.test/a.JPEG?token=1'));
    assert.ok(!isDirectImageUrl('https://civitai.com/images/123'));
  });
});

describe('paste sources', () => {
  it('accepts http(s) links only', () => {
    assert.ok(isHttpUrl('https://civitai.com/images/123'));
    assert.ok(!isHttpUrl('ftp://x.test/a.png'));
    assert.ok(!isHttpUrl('see https://x.test'));
  });

  it('reads Explorer "Copy as path" image paths', () => {
    assert.equal(copiedImagePath('"C:\\Users\\me\\Pictures\\00012-123.png"'), 'C:\\Users\\me\\Pictures\\00012-123.png');
    assert.equal(copiedImagePath('D:\\out\\img.webp'), 'D:\\out\\img.webp');
    assert.equal(copiedImagePath('\\\\nas\\share\\img.jpg'), '\\\\nas\\share\\img.jpg');
  });

  it('ignores text that is not an image path', () => {
    assert.equal(copiedImagePath('C:\\Users\\me\\notes.txt'), null);
    assert.equal(copiedImagePath('a cat.png'), null);
    assert.equal(copiedImagePath('C:\\a.png\nC:\\b.png'), null);
  });
});
