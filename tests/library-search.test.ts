import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SavedPromptItem } from '../core/types.ts';
import { filterLibraryItems, libraryFacets, parseQuery } from '../src/utils/librarySearch.ts';

const item = (id: string, prompt: string, model: string, loras: string[] = [], extra: Partial<SavedPromptItem> = {}): SavedPromptItem => ({
  id,
  title: id,
  folder: 'Portraits',
  source: 'Local File',
  date: '',
  model,
  dimensions: '',
  isFavorite: false,
  thumbnailUrl: '',
  metadata: { prompt, loras: loras.map((name) => ({ rawName: name.toLowerCase(), resolved: { name } })) },
  ...extra,
});

const items = [
  item('fox', 'a red fox in the snow, watercolor', 'Hyphoria', ['Watercolor Style']),
  item('city', 'neon city street at night, rain', 'Pony Diffusion', ['Detail Tweaker']),
  item('cafe', 'Café interior, warm light', 'Hyphoria', ['Detail Tweaker', 'Watercolor Style']),
];
const ids = (list: SavedPromptItem[]) => list.map((i) => i.id);
const search = (query: string, model = '', lora = '') => ids(filterLibraryItems(items, { query, model, lora }));

describe('library search', () => {
  it('needs every word to match, in any field', () => {
    assert.deepEqual(search('fox snow'), ['fox']);
    assert.deepEqual(search('hyphoria'), ['fox', 'cafe']);
    assert.deepEqual(search('detail tweaker'), ['city', 'cafe']);
  });

  it('matches quoted phrases as a whole and leaves out -words', () => {
    assert.deepEqual(search('"city street"'), ['city']);
    assert.deepEqual(search('"street city"'), []);
    assert.deepEqual(search('hyphoria -watercolor'), []);
    assert.deepEqual(search('-fox'), ['city', 'cafe']);
  });

  it('ignores case and accents', () => {
    assert.deepEqual(search('CAFE'), ['cafe']);
  });

  it('filters by model and LoRA', () => {
    assert.deepEqual(search('', 'Hyphoria'), ['fox', 'cafe']);
    assert.deepEqual(search('', '', 'Detail Tweaker'), ['city', 'cafe']);
    assert.deepEqual(search('warm', 'Hyphoria', 'Watercolor Style'), ['cafe']);
  });

  it('lists models and LoRAs by how often they are used', () => {
    const facets = libraryFacets(items);
    assert.deepEqual(facets.models, [['Hyphoria', 2], ['Pony Diffusion', 1]]);
    assert.deepEqual(facets.loras, [['Detail Tweaker', 2], ['Watercolor Style', 2]]);
  });

  it('parses an empty or dash-only query as no terms', () => {
    assert.deepEqual(parseQuery('  - '), { include: [], exclude: [] });
  });
});
