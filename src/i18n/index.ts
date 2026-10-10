import { useSyncExternalStore } from 'react';
import { en, type StringKey } from './en.js';
import { ru } from './ru.js';
import { zh } from './zh.js';

export type { StringKey };
export type Language = 'en' | 'ru' | 'zh';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'zh', label: '简体中文' },
];

const STORAGE_KEY = 'prompthound_language';
const dictionaries: Record<Language, Partial<Record<StringKey, string>>> = { en, ru, zh };

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ru' || stored === 'zh') return stored;
  } catch {
    // storage unavailable
  }
  return 'en';
}

let current: Language = readStoredLanguage();
const listeners = new Set<() => void>();

/** BCP 47 tag for dates, numbers and the page's lang attribute (which picks Chinese fonts) */
export function localeTag(language: Language = current): string {
  return language === 'zh' ? 'zh-CN' : language;
}

function applyDocumentLanguage(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = localeTag();
}
applyDocumentLanguage();

export function getLanguage(): Language {
  return current;
}

/** Switches the whole interface at once and remembers the choice */
export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // storage unavailable: the choice lasts until the app closes
  }
  applyDocumentLanguage();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type TranslateVars = Record<string, string | number>;

/**
 * Text for a key in the current language, falling back to English.
 * `{name}` is replaced by vars.name. A text with `|` holds plural forms chosen by
 * vars.count: English "one|other", Russian "one|few|many"; Chinese has a single form.
 */
export function t(key: StringKey, vars?: TranslateVars): string {
  let text = dictionaries[current][key] ?? en[key];
  if (text.includes('|') && vars && typeof vars.count === 'number') {
    const forms = text.split('|');
    const category = new Intl.PluralRules(localeTag()).select(vars.count);
    const order = current === 'ru' ? ['one', 'few', 'many'] : current === 'zh' ? ['other'] : ['one', 'other'];
    const index = order.indexOf(category);
    text = forms[index >= 0 ? index : forms.length - 1] ?? forms[forms.length - 1];
  }
  if (vars) {
    // Numbers get thousands separators ("1,234" / "1 234" / "1,234"); other values are used as given
    text = text.replace(/\{(\w+)\}/g, (match, name: string) => {
      if (!(name in vars)) return match;
      const value = vars[name];
      return typeof value === 'number' ? value.toLocaleString(localeTag()) : String(value);
    });
  }
  return text;
}

/** Re-renders the component when the language changes; returns the translate function */
export function useT(): typeof t {
  useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return t;
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}
