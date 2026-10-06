import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { blockNetwork } from './helpers.ts';
import type { SavedPromptItem } from '../core/types.ts';

blockNetwork();
const { buildLibraryBackup, readLibraryBackup, backupFileName } = await import('../src/utils/libraryBackup.ts');

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const item = (id: string, extra: Partial<SavedPromptItem> = {}): SavedPromptItem => ({
  id,
  title: `Prompt ${id}`,
  folder: 'Portraits',
  source: 'Local File',
  date: 'Oct 6, 2026',
  model: 'SDXL',
  dimensions: '1024 × 1024',
  isFavorite: false,
  thumbnailUrl: '',
  metadata: { prompt: 'a red fox' },
  ...extra,
});

describe('library backup', () => {
  it('stores kept images in the zip and links as links', async () => {
    const items = [
      item('prompt_1', { images: [{ url: PNG_DATA_URL, thumbUrl: PNG_DATA_URL, name: 'fox.png' }], thumbnailUrl: PNG_DATA_URL }),
      item('sample-1', { thumbnailUrl: 'samples/watercolor-hound.jpg' }),
    ];
    const backup = await buildLibraryBackup(items, ['All Prompts', 'Portraits'], ['prompt_1'], '1.0.17');
    assert.equal(backup.itemCount, 2);
    assert.equal(backup.imageCount, 1);
    assert.equal(backup.missingImages, 0);

    const files = unzipSync(backup.bytes);
    assert.ok(files['images/prompt_1/1.png']);
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    assert.equal(manifest.format, 'prompthound-library');
    assert.equal(manifest.appVersion, '1.0.17');
    assert.deepEqual(manifest.items[0].images, [{ file: 'images/prompt_1/1.png', name: 'fox.png' }]);
    assert.equal(manifest.items[0].thumbnailUrl, undefined);
    assert.deepEqual(manifest.items[1].images, [{ url: 'samples/watercolor-hound.jpg' }]);

    const opened = readLibraryBackup(backup.bytes);
    assert.deepEqual(opened.manifest.favorites, ['prompt_1']);
    assert.equal(opened.manifest.items.length, 2);
  });

  it('rejects files that are not backups', () => {
    assert.throws(() => readLibraryBackup(new Uint8Array([1, 2, 3])), /not a PromptHound library backup/);
    const otherZip = zipSync({ 'readme.txt': strToU8('hi') });
    assert.throws(() => readLibraryBackup(otherZip), /no manifest\.json/);
    const wrongFormat = zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'other', items: [] })) });
    assert.throws(() => readLibraryBackup(wrongFormat), /not a PromptHound library backup/);
  });

  it('refuses backups from a newer format version', () => {
    const newer = zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: 'prompthound-library', version: 99, items: [] })),
    });
    assert.throws(() => readLibraryBackup(newer), /newer version/);
  });

  it('drops malformed items instead of failing the import', () => {
    const zip = zipSync({
      'manifest.json': strToU8(
        JSON.stringify({ format: 'prompthound-library', version: 1, items: [item('ok'), { title: 'no id' }, null], folders: 'x' })
      ),
    });
    const opened = readLibraryBackup(zip);
    assert.deepEqual(opened.manifest.items.map((i) => i.id), ['ok']);
    assert.deepEqual(opened.manifest.folders, []);
  });

  it('names backups by date', () => {
    assert.equal(backupFileName(new Date('2026-10-06T12:00:00Z')), 'PromptHound-Library-2026-10-06.zip');
  });
});
