import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTag, groupPromptTags, readablePrompt, splitPromptTags } from '../core/prompt-readable.ts';

describe('Readable prompt layout', () => {
  it('splits at top-level commas only', () => {
    assert.deepEqual(splitPromptTags('a, (b, c:1.2), shu_\\(arknights\\),, <lora:x:0.8>\nd'), [
      'a',
      '(b, c:1.2)',
      'shu_\\(arknights\\)',
      '<lora:x:0.8>',
      'd',
    ]);
  });

  it('sorts a scrambled prompt into the five groups', () => {
    const prompt =
      'masterpiece, pija, pija \\(pianiishimo\\),, pija_(pianiishimo), 1girl, solo, ppk_(girls\'_frontline), hairband, ' +
      'blonde hair, looking at viewer, steam, indoors, ear piercing, blush, smiling, bedroom, very Dark room, ' +
      'best quality, Score_9, Score_8_up, maid headdress, black gloves, feet, legs, skindentation, dynamic pose, ' +
      'sitting, absurdres, newest';
    assert.deepEqual(groupPromptTags(prompt), {
      style: ['pija', 'pija \\(pianiishimo\\)', 'pija_(pianiishimo)'],
      character: ['1girl', 'solo', "ppk_(girls'_frontline)", 'hairband', 'blonde hair', 'ear piercing', 'maid headdress', 'black gloves'],
      action: ['looking at viewer', 'steam', 'blush', 'smiling', 'feet', 'legs', 'skindentation', 'dynamic pose', 'sitting'],
      scene: ['indoors', 'bedroom', 'very Dark room'],
      quality: ['masterpiece', 'best quality', 'Score_9', 'Score_8_up', 'absurdres', 'newest'],
    });
  });

  it('puts a blank line between groups and keeps weights as written', () => {
    assert.equal(
      readablePrompt('(masterpiece:1.2), 1girl, (smile:1.1), outdoors, <lora:add_detail:0.5>, detail_trigger', ['detail trigger']),
      '<lora:add_detail:0.5>, detail_trigger,\n\n1girl,\n\n(smile:1.1),\n\noutdoors,\n\n(masterpiece:1.2)'
    );
  });

  it('tells pose words from look words', () => {
    assert.equal(classifyTag('closed eyes'), 'action');
    assert.equal(classifyTag('red eyes'), 'character');
    assert.equal(classifyTag('solo focus'), 'character');
    assert.equal(classifyTag('light brown hair'), 'character');
    assert.equal(classifyTag('cinematic lighting'), 'style');
    assert.equal(classifyTag('high detailed 8k resolution'), 'quality');
    assert.equal(classifyTag('night sky'), 'scene');
    assert.equal(classifyTag('some_artist'), null);
  });

  it('drops BREAK and keeps unknown names after quality tags out of the quality group', () => {
    const groups = groupPromptTags('masterpiece, best quality, some_artist, BREAK, 1girl');
    assert.deepEqual(groups.style, ['some_artist']);
    assert.deepEqual(groups.quality, ['masterpiece', 'best quality']);
  });
});
