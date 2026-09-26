import type { ModelCatalogRecord, LoraReference, LoraMatchMethod } from './types.js';
import seedData from './data/lora-seed.json';
import { diceCoefficient, extractMeaningfulTokens } from './similarity.js';

// In-memory catalog maps for fast synchronous lookups & browser preview
const hashIndex = new Map<string, ModelCatalogRecord>();
const aliasIndex = new Map<string, ModelCatalogRecord>();
const versionIndex = new Map<number, ModelCatalogRecord>();

/**
 * Durable storage behind the in-memory indexes (the SQLite `lora_cache` table).
 * The renderer reaches it over IPC; Electron's main process talks to SQLite directly.
 */
export interface LoraPersistence {
  getAll(): Promise<ModelCatalogRecord[]>;
  getByHash(hash: string): Promise<ModelCatalogRecord | null | undefined>;
  getByVersionId(versionId: number): Promise<ModelCatalogRecord | null | undefined>;
  getByAlias(alias: string): Promise<ModelCatalogRecord | null | undefined>;
  upsert(record: ModelCatalogRecord): Promise<void>;
  remove(hashOrAlias: string): Promise<void>;
  clearUserRecords(): Promise<void>;
}

// undefined = auto-detect the renderer's IPC bridge; null = memory only
let configuredPersistence: LoraPersistence | null | undefined;
let hydration: Promise<void> | null = null;

/**
 * Sets the storage backend explicitly (Electron main process, tests). Resets hydration.
 */
export function configureLoraPersistence(persistence: LoraPersistence | null): void {
  configuredPersistence = persistence;
  hydration = null;
}

function getPersistence(): LoraPersistence | null {
  if (configuredPersistence !== undefined) return configuredPersistence;
  if (typeof window === 'undefined' || !window.promptHound?.loraDb) return null;

  const ipc = window.promptHound.loraDb;
  return {
    getAll: () => (ipc.getAll ? ipc.getAll() : Promise.resolve([])),
    getByHash: (hash) => ipc.getByHash(hash),
    getByVersionId: (versionId) => (ipc.getByVersionId ? ipc.getByVersionId(versionId) : Promise.resolve(null)),
    getByAlias: (alias) => ipc.getByAlias(alias),
    upsert: (record) => ipc.upsert(record),
    remove: (hashOrAlias) => ipc.remove(hashOrAlias),
    clearUserRecords: () => ipc.clearUserCache(),
  };
}

/**
 * Canonical hash form: lowercase, no whitespace, no SwarmUI-style "0x" prefix.
 */
export function normalizeHash(hash: string): string {
  return hash.trim().toLowerCase().replace(/^0x/, '');
}

function indexRecord(record: ModelCatalogRecord): void {
  if (record.hashSha256) hashIndex.set(normalizeHash(record.hashSha256), record);
  if (record.normalizedAlias) aliasIndex.set(record.normalizedAlias.trim().toLowerCase(), record);
  if (record.civitaiVersionId) versionIndex.set(record.civitaiVersionId, record);
}

/**
 * Loads every persisted record into memory once per process. Records saved in
 * earlier sessions (lookups, manual re-links) are reused instead of re-fetched.
 */
export function ensureLoraCacheHydrated(): Promise<void> {
  const persistence = getPersistence();
  if (!persistence) return Promise.resolve();
  if (!hydration) {
    hydration = persistence
      .getAll()
      .then((records) => {
        // Oldest first, so the most recent record for a key wins
        [...(records || [])]
          .sort((a, b) => (a.cachedAt || 0) - (b.cachedAt || 0))
          .forEach(indexRecord);
      })
      .catch((err) => {
        console.warn('Failed to load persisted LoRA cache:', err);
      });
  }
  return hydration;
}

/**
 * Memory first, then durable storage (which another process may have written to).
 */
async function lookupWithFallback(
  fromMemory: () => ModelCatalogRecord | undefined,
  fromStorage: (persistence: LoraPersistence) => Promise<ModelCatalogRecord | null | undefined>
): Promise<ModelCatalogRecord | undefined> {
  await ensureLoraCacheHydrated();
  const cached = fromMemory();
  if (cached) return cached;

  const persistence = getPersistence();
  if (!persistence) return undefined;
  try {
    const stored = await fromStorage(persistence);
    if (stored) {
      indexRecord(stored);
      return stored;
    }
  } catch {
    // Storage unavailable: behave as a cache miss
  }
  return undefined;
}

export function findLoraByHash(hash: string): Promise<ModelCatalogRecord | undefined> {
  return lookupWithFallback(() => getCachedLoraByHash(hash), (p) => p.getByHash(normalizeHash(hash)));
}

export function findLoraByVersionId(versionId: number): Promise<ModelCatalogRecord | undefined> {
  return lookupWithFallback(() => getCachedLoraByVersionId(versionId), (p) => p.getByVersionId(versionId));
}

export function findLoraByAlias(alias: string): Promise<ModelCatalogRecord | undefined> {
  return lookupWithFallback(() => getCachedLoraByAlias(alias), (p) => p.getByAlias(alias.trim().toLowerCase()));
}

/**
 * Scans a text block (e.g. prompt or tags) for known LoRAs based on alias and trigger words
 */
export function findMatchingSeedLorasInText(text: string): ModelCatalogRecord[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched: ModelCatalogRecord[] = [];

  // Whole-word only: a substring test turns "highly detailed" into a "detail" LoRA hit
  const containsPhrase = (phrase: string): boolean => {
    const escaped = phrase.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.length > 0 && new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(lower);
  };

  for (const record of aliasIndex.values()) {
    const aliasHit = Boolean(record.normalizedAlias) && containsPhrase(record.normalizedAlias);
    const triggerHit = record.triggerWords?.some((tw) => tw.length > 3 && containsPhrase(tw));

    if (aliasHit || triggerHit) {
      if (!matched.some((m) => m.civitaiModelId === record.civitaiModelId || m.name === record.name)) {
        matched.push(record);
      }
    }
  }

  return matched;
}
function loadSeedCache(): void {
  hashIndex.clear();
  aliasIndex.clear();
  versionIndex.clear();

  // 1. Seed with offline bundled master dataset (0ms cold start)
  if (Array.isArray(seedData)) {
    seedData.forEach((entry: any) => {
      const rec: ModelCatalogRecord = {
        civitaiModelId: entry.civitaiModelId,
        civitaiVersionId: entry.civitaiVersionId,
        name: entry.name,
        versionName: entry.versionName,
        normalizedAlias: entry.normalizedAlias || '',
        hashSha256: entry.hashSha256 || undefined,
        coverImageId: entry.coverImageId,
        coverImageUrl: entry.coverImageUrl,
        triggerWords: entry.triggerWords || [],
        baseModel: entry.baseModel,
        nsfw: typeof entry.nsfw === 'boolean' ? entry.nsfw : undefined,
        source: entry.source === 'local' ? 'local' : 'civitai',
        modelUrl: entry.modelUrl,
        cachedAt: 0, // 0 = seed data
      };

      indexRecord(rec);
    });
  }
}

loadSeedCache();

/**
 * Lookup by exact SHA256 or short AutoV2 hash (Tier 1)
 */
export function getCachedLoraByHash(sha256OrShort: string): ModelCatalogRecord | undefined {
  if (!sha256OrShort) return undefined;
  const clean = normalizeHash(sha256OrShort);

  // Direct exact key match
  if (hashIndex.has(clean)) {
    return hashIndex.get(clean);
  }

  // Prefix match for short AutoV1/AutoV2 hashes (>= 8 chars)
  if (clean.length >= 8) {
    for (const [fullHash, record] of hashIndex.entries()) {
      if (fullHash.startsWith(clean) || clean.startsWith(fullHash)) {
        return record;
      }
    }
  }

  return undefined;
}

/**
 * Lookup by exact Civitai model-version id (Tier 1)
 */
export function getCachedLoraByVersionId(versionId: number): ModelCatalogRecord | undefined {
  return versionIndex.get(versionId);
}

/**
 * Lookup by normalized alias name (Tier 1) with strict token similarity
 */
export function getCachedLoraByAlias(normalizedAlias: string): ModelCatalogRecord | undefined {
  if (!normalizedAlias) return undefined;
  const clean = normalizedAlias.trim().toLowerCase();

  // 1. Direct exact alias match
  if (aliasIndex.has(clean)) {
    return aliasIndex.get(clean);
  }

  const queryTokens = extractMeaningfulTokens(clean);
  if (queryTokens.length === 0) return undefined;

  // 2. High-precision fuzzy alias lookup (Dice >= 0.82 or full token subset match)
  let bestMatch: { record: ModelCatalogRecord; score: number } | null = null;

  for (const [key, val] of aliasIndex.entries()) {
    const dice = diceCoefficient(clean, key);
    if (dice >= 0.82) {
      if (!bestMatch || dice > bestMatch.score) {
        bestMatch = { record: val, score: dice };
      }
    } else {
      // Check if all query tokens exist in target key
      const keyTokens = extractMeaningfulTokens(key);
      const isSubset = queryTokens.every((qt) => keyTokens.includes(qt));
      if (isSubset && Math.abs(keyTokens.length - queryTokens.length) <= 1) {
        const score = 0.85;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { record: val, score };
        }
      }
    }
  }

  return bestMatch?.record;
}

/**
 * Auto-upsert resolved model record into SQLite Database & Local Memory
 */
export function upsertLoraRecord(record: Omit<ModelCatalogRecord, 'cachedAt'> & { cachedAt?: number }): void {
  const fullRecord: ModelCatalogRecord = {
    ...record,
    cachedAt: record.cachedAt || Date.now(),
  };

  if (fullRecord.hashSha256) fullRecord.hashSha256 = normalizeHash(fullRecord.hashSha256);
  indexRecord(fullRecord);

  getPersistence()
    ?.upsert(fullRecord)
    .catch((err) => {
      console.warn('Failed to upsert LoRA record to SQLite:', err);
    });
}

/**
 * Removes a specific record by hash or alias
 */
export function removeLoraRecord(hashOrAlias: string): void {
  const clean = normalizeHash(hashOrAlias);
  const removed = [hashIndex.get(clean), aliasIndex.get(clean)].filter(Boolean);
  hashIndex.delete(clean);
  aliasIndex.delete(clean);
  for (const [versionId, record] of versionIndex.entries()) {
    if (removed.includes(record)) versionIndex.delete(versionId);
  }

  getPersistence()
    ?.remove(clean)
    .catch((err) => {
      console.warn('Failed to remove LoRA record from SQLite:', err);
    });
}

/**
 * Helper to convert ModelCatalogRecord to resolved LoraReference format
 */
export function toResolvedLora(
  record: ModelCatalogRecord,
  matchedBy?: LoraMatchMethod,
  matchScore?: number
): NonNullable<LoraReference['resolved']> {
  return {
    name: record.name,
    source: record.source || 'civitai',
    modelUrl: record.modelUrl,
    coverImageUrl: record.coverImageUrl,
    triggerWords: record.triggerWords,
    baseModel: record.baseModel,
    nsfw: record.nsfw,
    ...(record.versionName ? { versionName: record.versionName } : {}),
    ...(matchedBy ? { matchedBy } : {}),
    ...(matchScore !== undefined ? { matchScore } : {}),
  };
}

/**
 * Returns cache stats for Settings UI
 */
export function getLoraCacheStats(): { count: number; userCount: number; lastUpdated?: number } {
  const all = Array.from(new Set([...hashIndex.values(), ...aliasIndex.values(), ...versionIndex.values()]));
  const userRecords = all.filter((r) => (r.cachedAt || 0) > 0);
  const latest = userRecords.reduce((max, r) => Math.max(max, r.cachedAt || 0), 0);

  return {
    count: all.length,
    userCount: userRecords.length,
    lastUpdated: latest > 0 ? latest : undefined,
  };
}

/**
 * Clears user discovered LoRA cache (runs DELETE FROM lora_cache WHERE cachedAt > 0 in SQLite)
 */
export function clearLoraCache(): void {
  loadSeedCache();

  getPersistence()
    ?.clearUserRecords()
    .catch((err) => {
      console.warn('Failed to clear SQLite user records:', err);
    });
}
