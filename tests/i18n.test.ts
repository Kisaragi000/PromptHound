import test from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../src/i18n/en.js';
import { ru } from '../src/i18n/ru.js';
import { setLanguage, t } from '../src/i18n/index.js';
import { translateMessage } from '../src/i18n/labels.js';

const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');

test('every English text has a Russian one with the same placeholders', () => {
  for (const key of Object.keys(en) as Array<keyof typeof en>) {
    assert.ok(ru[key], `missing Russian text for ${key}`);
    assert.equal(placeholders(ru[key]), placeholders(en[key]), `placeholders differ for ${key}`);
  }
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
});

test('plural texts have the right number of forms', () => {
  for (const key of Object.keys(en) as Array<keyof typeof en>) {
    const enForms = en[key].split('|').length;
    const ruForms = ru[key].split('|').length;
    if (enForms > 1) {
      assert.equal(enForms, 2, `${key}: English needs 2 forms`);
      assert.equal(ruForms, 3, `${key}: Russian needs 3 forms`);
    } else {
      assert.equal(ruForms, 1, `${key}: Russian has plural forms but English does not`);
    }
  }
});

test('English and Russian plurals', () => {
  setLanguage('en');
  assert.equal(t('home.recentLoras', { count: 1 }), '+1 LoRA');
  assert.equal(t('home.recentLoras', { count: 3 }), '+3 LoRAs');
  setLanguage('ru');
  assert.equal(t('backup.promptCount', { count: 1 }), '1 промпт');
  assert.equal(t('backup.promptCount', { count: 2 }), '2 промпта');
  assert.equal(t('backup.promptCount', { count: 5 }), '5 промптов');
  assert.equal(t('backup.promptCount', { count: 11 }), '11 промптов');
  assert.equal(t('backup.promptCount', { count: 21 }), '21 промпт');
  assert.equal(t('backup.promptCount', { count: 22 }), '22 промпта');
  setLanguage('en');
});

test('engine messages are translated and unknown ones pass through', () => {
  setLanguage('ru');
  assert.equal(translateMessage('Failed to fetch image: HTTP 404 Not Found'), 'Не удалось загрузить изображение: HTTP 404 Not Found');
  assert.equal(translateMessage('Token similarity (72%)'), 'Сходство по словам (72%)');
  assert.equal(translateMessage('Some message nobody planned for'), 'Some message nobody planned for');
  setLanguage('en');
  assert.equal(translateMessage('Failed to fetch image: HTTP 404'), 'Failed to fetch image: HTTP 404');
});
