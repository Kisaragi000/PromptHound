import type { SavedPromptItem } from '../../core/types.js';

/**
 * Prompt Library search: every word must match somewhere in the item (title, prompts,
 * model, LoRAs, sampler, folder), "quoted phrases" match as a whole and -word leaves out
 * items containing it. Case and accents are ignored.
 */

const fold = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** The checkpoint name shown for an item, preferring the identified model */
export function itemModelName(item: SavedPromptItem): string {
  const meta = item.metadata ?? {};
  return String(meta.modelResolved?.name || item.model || meta.model || '').trim();
}

/** LoRA names of an item, preferring the identified names */
export function itemLoraNames(item: SavedPromptItem): string[] {
  const loras: any[] = Array.isArray(item.metadata?.loras) ? item.metadata.loras : [];
  const names = loras.map((l) => String(l?.resolved?.name || l?.rawName || l?.name || '').trim()).filter(Boolean);
  return [...new Set(names)];
}

function searchableText(item: SavedPromptItem): string {
  const meta = item.metadata ?? {};
  const loras: any[] = Array.isArray(meta.loras) ? meta.loras : [];
  return fold(
    [
      item.title,
      meta.prompt,
      meta.negativePrompt,
      item.model,
      meta.model,
      meta.modelResolved?.name,
      meta.sampler,
      item.folder,
      item.source,
      ...loras.flatMap((l) => [l?.rawName, l?.resolved?.name, ...(l?.resolved?.triggerWords ?? [])]),
    ]
      .filter((v) => typeof v === 'string' && v)
      .join('\n')
  );
}

interface ParsedQuery {
  include: string[];
  exclude: string[];
}

export function parseQuery(query: string): ParsedQuery {
  const include: string[] = [];
  const exclude: string[] = [];
  // Chinese and Russian keyboards type “curly” or «angle» quotes; treat them as plain ones
  const normalized = fold(query).replace(/[“”„«»]/g, '"');
  for (const match of normalized.matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)) {
    const negated = (match[1] ?? match[3]) === '-';
    const term = (match[2] ?? match[4] ?? '').trim();
    if (!term || term === '-') continue;
    (negated ? exclude : include).push(term);
  }
  return { include, exclude };
}

export interface LibraryFilters {
  query: string;
  /** Exact checkpoint name, or '' for any */
  model: string;
  /** Exact LoRA name, or '' for any */
  lora: string;
}

/** Items matching the search and filters, in the order given */
export function filterLibraryItems(items: SavedPromptItem[], filters: LibraryFilters): SavedPromptItem[] {
  const { include, exclude } = parseQuery(filters.query);
  return items.filter((item) => {
    if (filters.model && itemModelName(item) !== filters.model) return false;
    if (filters.lora && !itemLoraNames(item).includes(filters.lora)) return false;
    if (!include.length && !exclude.length) return true;
    const text = searchableText(item);
    return include.every((t) => text.includes(t)) && !exclude.some((t) => text.includes(t));
  });
}

/** Checkpoints and LoRAs used in the library, most used first, for the filter menus */
export function libraryFacets(items: SavedPromptItem[]): { models: Array<[string, number]>; loras: Array<[string, number]> } {
  const models = new Map<string, number>();
  const loras = new Map<string, number>();
  for (const item of items) {
    const model = itemModelName(item);
    if (model) models.set(model, (models.get(model) ?? 0) + 1);
    for (const lora of itemLoraNames(item)) loras.set(lora, (loras.get(lora) ?? 0) + 1);
  }
  const sorted = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { models: sorted(models), loras: sorted(loras) };
}
