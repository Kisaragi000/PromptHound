import { app, BrowserWindow, ipcMain, clipboard, dialog, shell, safeStorage, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  extractFromImageBuffer,
  extractFromUrl,
  isExtractionError,
  type ExtractionResult,
  type ExtractionError,
} from '../core/index.js';
import { analyzeSafetensorsMetadata } from '../core/safetensors.js';
import {
  configureLoraPersistence,
  upsertLoraRecord,
  removeLoraRecord,
  clearLoraCache,
  normalizeHash,
  type LoraPersistence,
} from '../core/lora-cache.js';
import { setRuntimeCivitaiApiKey } from '../core/lora-resolution.js';
import type { ModelCatalogRecord } from '../core/types.js';
import seedCatalog from '../core/data/lora-seed.json';
import { createHash } from 'node:crypto';
import { autoUpdater } from 'electron-updater';
import {
  isShellIntegrationSupported,
  registerContextMenu,
  unregisterContextMenu,
  imagePathsFromArgv,
  queueOpenedPaths,
  takeOpenedFiles,
} from './shell-integration.js';

// One window: images opened from Explorer while the app runs go to that window
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) app.quit();

/**
 * Library images live in <userData>/library-images/<item id>/ and reach the UI as
 * ph-image://library/<item id>/<file>. The scheme must be registered before app ready.
 */
const IMAGE_SCHEME = 'ph-image';
protocol.registerSchemesAsPrivileged([
  { scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const libraryImagesDir = () => path.join(app.getPath('userData'), 'library-images');
const SAFE_SEGMENT = /^[\w.-]{1,120}$/;
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'jfif', 'webp', 'avif', 'gif']);

/** Absolute path of a ph-image URL, or null when it points outside the images folder */
function libraryImagePath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${IMAGE_SCHEME}:` || parsed.hostname !== 'library') return null;
    const [itemId, file, ...rest] = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (rest.length || !itemId || !file || !SAFE_SEGMENT.test(itemId) || !SAFE_SEGMENT.test(file) || file.startsWith('.')) return null;
    return path.join(libraryImagesDir(), itemId, file);
  } catch {
    return null;
  }
}

let loraDbInstance: any = null;

function initLoraDatabase(): void {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = path.join(app.getPath('userData'), 'lora_catalog.sqlite');
    const db = new DatabaseSync(dbPath);

    // Create table and indexes for LoRA catalog, settings, and FTS5 search
    db.exec(`
      CREATE TABLE IF NOT EXISTS lora_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hashSha256 TEXT,
        civitaiModelId INTEGER,
        civitaiVersionId INTEGER,
        name TEXT NOT NULL,
        normalizedAlias TEXT,
        coverImageId TEXT,
        coverImageUrl TEXT,
        triggerWords TEXT,
        baseModel TEXT,
        source TEXT DEFAULT 'civitai',
        modelUrl TEXT,
        cachedAt INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_lora_hash ON lora_cache(hashSha256);
      CREATE INDEX IF NOT EXISTS idx_lora_alias ON lora_cache(normalizedAlias);
      CREATE INDEX IF NOT EXISTS idx_lora_cachedAt ON lora_cache(cachedAt);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS saved_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        title TEXT,
        prompt TEXT NOT NULL,
        negative_prompt TEXT,
        model TEXT,
        sampler TEXT,
        steps INTEGER,
        cfg_scale REAL,
        seed TEXT,
        width INTEGER,
        height INTEGER,
        loras TEXT,
        folder TEXT DEFAULT 'My Creations',
        is_favorite INTEGER DEFAULT 0,
        source_label TEXT,
        preview_url TEXT,
        raw_item TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS saved_prompts_fts USING fts5(
        title,
        prompt,
        negative_prompt,
        model,
        loras,
        content='saved_prompts',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS saved_prompts_ai AFTER INSERT ON saved_prompts BEGIN
        INSERT INTO saved_prompts_fts(rowid, title, prompt, negative_prompt, model, loras)
        VALUES (new.id, new.title, new.prompt, new.negative_prompt, new.model, new.loras);
      END;

      CREATE TRIGGER IF NOT EXISTS saved_prompts_ad AFTER DELETE ON saved_prompts BEGIN
        INSERT INTO saved_prompts_fts(saved_prompts_fts, rowid, title, prompt, negative_prompt, model, loras)
        VALUES ('delete', old.id, old.title, old.prompt, old.negative_prompt, old.model, old.loras);
      END;

      CREATE TRIGGER IF NOT EXISTS saved_prompts_au AFTER UPDATE ON saved_prompts BEGIN
        INSERT INTO saved_prompts_fts(saved_prompts_fts, rowid, title, prompt, negative_prompt, model, loras)
        VALUES ('delete', old.id, old.title, old.prompt, old.negative_prompt, old.model, old.loras);
        INSERT INTO saved_prompts_fts(rowid, title, prompt, negative_prompt, model, loras)
        VALUES (new.id, new.title, new.prompt, new.negative_prompt, new.model, new.loras);
      END;
    `);

    // Migrations for databases created by earlier versions
    const columns = db.prepare('PRAGMA table_info(lora_cache)').all() as Array<{ name: string }>;
    if (!columns.some((c) => c.name === 'nsfw')) {
      db.exec('ALTER TABLE lora_cache ADD COLUMN nsfw INTEGER');
    }
    if (!columns.some((c) => c.name === 'versionName')) {
      db.exec('ALTER TABLE lora_cache ADD COLUMN versionName TEXT');
    }
    if (!columns.some((c) => c.name === 'modelType')) {
      db.exec('ALTER TABLE lora_cache ADD COLUMN modelType TEXT');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_lora_version ON lora_cache(civitaiVersionId)');

    syncSeedCatalog(db);

    loraDbInstance = db;
  } catch (err) {
    console.error('Failed to initialize SQLite LoRA database:', err);
  }
}

/**
 * Keeps the bundled offline catalog (seed rows, cachedAt = 0) in step with the app
 * version. When the bundled catalog changes, old seed rows are replaced; records the
 * user discovered or linked (cachedAt > 0) are kept.
 */
function syncSeedCatalog(db: any): void {
  const entries: any[] = Array.isArray(seedCatalog) ? seedCatalog : [];
  const signature = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  const stored = db.prepare('SELECT value FROM settings WHERE key = ?').get('seed_catalog_signature') as
    | { value: string }
    | undefined;
  if (stored?.value === signature) return;

  const insert = db.prepare(`
    INSERT INTO lora_cache (
      hashSha256, civitaiModelId, civitaiVersionId, name, versionName, normalizedAlias,
      coverImageId, coverImageUrl, triggerWords, baseModel, source, modelUrl, nsfw, modelType, cachedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM lora_cache WHERE cachedAt = 0 OR cachedAt IS NULL').run();
    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string') continue;
      insert.run(
        entry.hashSha256 ? normalizeHash(entry.hashSha256) : null,
        entry.civitaiModelId || null,
        entry.civitaiVersionId || null,
        entry.name,
        entry.versionName || null,
        entry.normalizedAlias ? entry.normalizedAlias.toLowerCase() : null,
        entry.coverImageId || null,
        entry.coverImageUrl || null,
        JSON.stringify(entry.triggerWords || []),
        entry.baseModel || null,
        entry.source || 'civitai',
        entry.modelUrl || null,
        typeof entry.nsfw === 'boolean' ? (entry.nsfw ? 1 : 0) : null,
        entry.modelType || null
      );
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('seed_catalog_signature', signature);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.warn('Could not refresh the offline LoRA catalog in SQLite:', err);
  }
}

function rowToRecord(row: any): ModelCatalogRecord | null {
  if (!row) return null;
  let triggerWords: string[] = [];
  try {
    triggerWords = row.triggerWords ? JSON.parse(row.triggerWords) : [];
  } catch {
    // Keep an unreadable trigger list from hiding the rest of the record
  }
  return {
    civitaiModelId: row.civitaiModelId ?? undefined,
    civitaiVersionId: row.civitaiVersionId ?? undefined,
    name: row.name,
    versionName: row.versionName ?? undefined,
    normalizedAlias: row.normalizedAlias ?? '',
    hashSha256: row.hashSha256 ?? undefined,
    coverImageId: row.coverImageId ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    triggerWords,
    baseModel: row.baseModel ?? undefined,
    modelType: row.modelType ?? undefined,
    nsfw: row.nsfw === null || row.nsfw === undefined ? undefined : Boolean(row.nsfw),
    source: row.source === 'local' ? 'local' : 'civitai',
    modelUrl: row.modelUrl ?? '',
    cachedAt: row.cachedAt ?? 0,
  };
}

/**
 * SQLite storage for core/lora-cache in this (main) process. The renderer reaches the
 * same table over IPC, so records found by either process are shared and survive restarts.
 */
const sqliteLoraPersistence: LoraPersistence = {
  async getAll() {
    if (!loraDbInstance) return [];
    const rows = loraDbInstance.prepare('SELECT * FROM lora_cache ORDER BY cachedAt ASC').all();
    return rows.map(rowToRecord).filter(Boolean) as ModelCatalogRecord[];
  },
  async getByHash(rawHash) {
    if (!loraDbInstance || !rawHash) return null;
    const clean = normalizeHash(rawHash);
    let row = loraDbInstance.prepare('SELECT * FROM lora_cache WHERE hashSha256 = ? ORDER BY cachedAt DESC LIMIT 1').get(clean);
    // Prefix match for short AutoV1/AutoV2 hashes (>= 8 chars)
    if (!row && clean.length >= 8) {
      row = loraDbInstance
        .prepare('SELECT * FROM lora_cache WHERE hashSha256 LIKE ? ORDER BY cachedAt DESC LIMIT 1')
        .get(`${clean}%`);
    }
    return rowToRecord(row);
  },
  async getByVersionId(versionId) {
    if (!loraDbInstance || !Number.isFinite(versionId)) return null;
    const row = loraDbInstance
      .prepare('SELECT * FROM lora_cache WHERE civitaiVersionId = ? ORDER BY cachedAt DESC LIMIT 1')
      .get(versionId);
    return rowToRecord(row);
  },
  async getByAlias(rawAlias) {
    if (!loraDbInstance || !rawAlias) return null;
    const row = loraDbInstance
      .prepare('SELECT * FROM lora_cache WHERE normalizedAlias = ? ORDER BY cachedAt DESC LIMIT 1')
      .get(rawAlias.trim().toLowerCase());
    return rowToRecord(row);
  },
  async upsert(record) {
    if (!loraDbInstance || !record || !record.name) return;
    const hash = record.hashSha256 ? normalizeHash(record.hashSha256) : null;
    const alias = record.normalizedAlias ? record.normalizedAlias.trim().toLowerCase() : null;

    // Delete existing duplicate if hash or alias exists
    if (hash) {
      loraDbInstance.prepare('DELETE FROM lora_cache WHERE hashSha256 = ?').run(hash);
    }
    if (alias) {
      loraDbInstance.prepare('DELETE FROM lora_cache WHERE normalizedAlias = ? AND cachedAt > 0').run(alias);
    }

    loraDbInstance
      .prepare(`
        INSERT INTO lora_cache (
          hashSha256, civitaiModelId, civitaiVersionId, name, versionName, normalizedAlias,
          coverImageId, coverImageUrl, triggerWords, baseModel, source, modelUrl, cachedAt, nsfw, modelType
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        hash,
        record.civitaiModelId || null,
        record.civitaiVersionId || null,
        record.name,
        record.versionName || null,
        alias,
        record.coverImageId || null,
        record.coverImageUrl || null,
        JSON.stringify(record.triggerWords || []),
        record.baseModel || null,
        record.source || 'civitai',
        record.modelUrl || null,
        record.cachedAt || Date.now(),
        record.nsfw === undefined ? null : record.nsfw ? 1 : 0,
        record.modelType || null
      );
  },
  async remove(hashOrAlias) {
    if (!loraDbInstance || !hashOrAlias) return;
    const clean = normalizeHash(hashOrAlias);
    loraDbInstance.prepare('DELETE FROM lora_cache WHERE hashSha256 = ? OR normalizedAlias = ?').run(clean, clean);
  },
  async clearUserRecords() {
    if (!loraDbInstance) return;
    loraDbInstance.prepare('DELETE FROM lora_cache WHERE cachedAt > 0').run();
  },
};

function registerSettingsHandlers(): void {
  ipcMain.handle('settings:save-civitai-key', (_event, key: string) => {
    if (!loraDbInstance) return;
    const trimmed = (key || '').trim();
    if (!trimmed) {
      loraDbInstance.prepare('DELETE FROM settings WHERE key = ?').run('civitai_api_key');
      setRuntimeCivitaiApiKey(null);
      return;
    }
    const encrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(trimmed).toString('base64')
      : Buffer.from(trimmed).toString('base64');

    loraDbInstance.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('civitai_api_key', encrypted);
    setRuntimeCivitaiApiKey(trimmed);
  });

  ipcMain.handle('settings:get-civitai-key', () => readCivitaiKey());
}

function readCivitaiKey(): string | null {
  if (!loraDbInstance) return null;
  const row = loraDbInstance.prepare('SELECT value FROM settings WHERE key = ?').get('civitai_api_key') as { value: string } | undefined;
  if (!row || !row.value) return null;
  try {
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(row.value, 'base64'))
      : Buffer.from(row.value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function readSetting(key: string): string | null {
  if (!loraDbInstance) return null;
  const row = loraDbInstance.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string): void {
  loraDbInstance?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

const CONTEXT_MENU_SETTING = 'explorer_context_menu';

function registerShellIntegrationHandlers(): void {
  ipcMain.handle('shell-integration:get', () => ({
    supported: isShellIntegrationSupported(),
    enabled: readSetting(CONTEXT_MENU_SETTING) === 'true',
  }));

  ipcMain.handle('shell-integration:set', async (_event, enabled: boolean) => {
    if (!isShellIntegrationSupported()) return { supported: false, enabled: false };
    if (enabled) {
      await registerContextMenu();
    } else {
      await unregisterContextMenu();
    }
    writeSetting(CONTEXT_MENU_SETTING, String(Boolean(enabled)));
    return { supported: true, enabled: Boolean(enabled) };
  });

  ipcMain.handle('app:take-opened-files', () => takeOpenedFiles());

  // The install folder (or the portable exe) can move between versions; point the menu
  // at the exe that is running now
  if (isShellIntegrationSupported() && readSetting(CONTEXT_MENU_SETTING) === 'true') {
    registerContextMenu().catch((err) => console.warn('Could not refresh the Explorer menu:', err));
  }
}

function notifyOpenedFiles(): void {
  mainWindow?.webContents.send('app:files-opened');
}

app.on('second-instance', (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  queueOpenedPaths(imagePathsFromArgv(argv), notifyOpenedFiles);
});

function registerLoraDbHandlers(): void {
  // Reads go straight to SQLite; writes go through core/lora-cache so this process's
  // in-memory index (used by main-process extraction) sees the renderer's changes too.
  ipcMain.handle('lora-db:get-all', () => sqliteLoraPersistence.getAll());
  ipcMain.handle('lora-db:get-by-hash', (_event, rawHash: string) => sqliteLoraPersistence.getByHash(rawHash));
  ipcMain.handle('lora-db:get-by-version', (_event, versionId: number) =>
    sqliteLoraPersistence.getByVersionId(Number(versionId))
  );
  ipcMain.handle('lora-db:get-by-alias', (_event, rawAlias: string) => sqliteLoraPersistence.getByAlias(rawAlias));

  ipcMain.handle('lora-db:upsert', (_event, record: any) => {
    if (!record || !record.name) return;
    upsertLoraRecord(record);
  });

  ipcMain.handle('lora-db:remove', (_event, hashOrAlias: string) => {
    if (!hashOrAlias) return;
    removeLoraRecord(hashOrAlias);
  });

  ipcMain.handle('lora-db:clear-user-records', () => {
    clearLoraCache();
  });

  ipcMain.handle('lora-db:get-stats', () => {
    if (!loraDbInstance) return { count: 0, userCount: 0 };
    const totalRow = loraDbInstance.prepare('SELECT COUNT(*) as count FROM lora_cache').get() as { count: number };
    const userRow = loraDbInstance.prepare('SELECT COUNT(*) as count, MAX(cachedAt) as latest FROM lora_cache WHERE cachedAt > 0').get() as { count: number; latest: number | null };
    return {
      count: totalRow.count,
      userCount: userRow.count,
      lastUpdated: userRow.latest || undefined,
    };
  });
}

function registerLibraryHandlers(): void {
  ipcMain.handle('library:save-prompt', (_event, item: any) => {
    if (!loraDbInstance || !item) return;
    const uuid = item.id || `prompt_${Date.now()}`;
    const title = item.title || 'Untitled';
    const prompt = item.metadata?.prompt || item.prompt || '';
    const negativePrompt = item.metadata?.negativePrompt || item.negativePrompt || null;
    const model = item.model || item.metadata?.model || null;
    const sampler = item.metadata?.sampler || item.sampler || null;
    const steps = item.metadata?.steps || item.steps || null;
    const cfgScale = item.metadata?.cfgScale || item.cfgScale || null;
    const seed = item.metadata?.seed ? String(item.metadata.seed) : (item.seed ? String(item.seed) : null);
    const width = item.metadata?.width || null;
    const height = item.metadata?.height || null;
    const loras = JSON.stringify(item.metadata?.loras || item.loras || []);
    const folder = item.folder || 'My Creations';
    const isFavorite = item.isFavorite ? 1 : 0;
    const sourceLabel = item.source || 'Local';
    const previewUrl = item.thumbnailUrl || item.previewUrl || null;
    const rawItem = JSON.stringify(item);
    const createdAt = Date.now();

    loraDbInstance.prepare(`
      INSERT INTO saved_prompts (
        uuid, title, prompt, negative_prompt, model, sampler, steps, cfg_scale,
        seed, width, height, loras, folder, is_favorite, source_label, preview_url, raw_item, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(uuid) DO UPDATE SET
        title = excluded.title,
        prompt = excluded.prompt,
        negative_prompt = excluded.negative_prompt,
        model = excluded.model,
        sampler = excluded.sampler,
        steps = excluded.steps,
        cfg_scale = excluded.cfg_scale,
        seed = excluded.seed,
        width = excluded.width,
        height = excluded.height,
        loras = excluded.loras,
        folder = excluded.folder,
        is_favorite = excluded.is_favorite,
        source_label = excluded.source_label,
        preview_url = excluded.preview_url,
        raw_item = excluded.raw_item
    `).run(
      uuid, title, prompt, negativePrompt, model, sampler, steps, cfgScale,
      seed, width, height, loras, folder, isFavorite, sourceLabel, previewUrl, rawItem, createdAt
    );
  });

  ipcMain.handle('library:get-all', (_event) => {
    if (!loraDbInstance) return [];
    try {
      const rows = loraDbInstance.prepare('SELECT raw_item, is_favorite, folder FROM saved_prompts ORDER BY created_at DESC').all() as Array<{ raw_item: string; is_favorite: number; folder: string }>;
      return rows.map((r) => {
        try {
          const item = JSON.parse(r.raw_item);
          item.isFavorite = Boolean(r.is_favorite);
          item.folder = r.folder || item.folder || 'My Creations';
          return item;
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch {
      return [];
    }
  });

  ipcMain.handle('library:delete-prompt', (_event, uuid: string) => {
    if (!loraDbInstance || !uuid) return;
    loraDbInstance.prepare('DELETE FROM saved_prompts WHERE uuid = ?').run(uuid);
  });

  ipcMain.handle('library:search-fts', (_event, query: string) => {
    if (!loraDbInstance || !query || !query.trim()) return [];
    try {
      const clean = query.replace(/[^\w\s]/g, ' ').trim();
      if (!clean) return [];
      const matchPattern = clean.split(/\s+/).map((w) => `"${w}"*`).join(' ');
      const rows = loraDbInstance.prepare(`
        SELECT sp.raw_item, sp.is_favorite, sp.folder
        FROM saved_prompts sp
        JOIN saved_prompts_fts fts ON sp.id = fts.rowid
        WHERE saved_prompts_fts MATCH ?
        ORDER BY rank
      `).all(matchPattern) as Array<{ raw_item: string; is_favorite: number; folder: string }>;

      return rows.map((r) => {
        try {
          const item = JSON.parse(r.raw_item);
          item.isFavorite = Boolean(r.is_favorite);
          item.folder = r.folder || item.folder;
          return item;
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch {
      return [];
    }
  });

  /** Writes a library backup zip where the user chooses; returns the path, or null if cancelled */
  ipcMain.handle('library:save-backup', async (_event, bytes: Uint8Array, defaultName: string): Promise<string | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Prompt Library',
      defaultPath: path.join(app.getPath('documents'), path.basename(String(defaultName || 'PromptHound-Library.zip'))),
      filters: [{ name: 'PromptHound library backup', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, Buffer.from(bytes));
    return result.filePath;
  });

  /** Reads a library backup zip the user picks; null if cancelled */
  ipcMain.handle('library:open-backup', async (): Promise<{ name: string; bytes: Uint8Array } | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Prompt Library',
      properties: ['openFile'],
      filters: [{ name: 'PromptHound library backup', extensions: ['zip'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    if (stat.size > 2 * 1024 * 1024 * 1024) throw new Error('Backups larger than 2 GB are not supported.');
    return { name: path.basename(filePath), bytes: new Uint8Array(await fs.readFile(filePath)) };
  });

  ipcMain.handle('library:toggle-favorite', (_event, uuid: string, isFav: boolean) => {
    if (!loraDbInstance || !uuid) return;
    loraDbInstance.prepare('UPDATE saved_prompts SET is_favorite = ? WHERE uuid = ?').run(isFav ? 1 : 0, uuid);
  });
}

function registerSafetensorsHandlers(): void {
  ipcMain.handle('safetensors:read-file', async (_event, filePath: string) => {
    try {
      const fileHandle = await fs.open(filePath, 'r');
      const lenBuf = Buffer.alloc(8);
      await fileHandle.read(lenBuf, 0, 8, 0);
      const headerLen = Number(lenBuf.readBigUInt64LE(0));
      if (headerLen <= 0 || headerLen > 50 * 1024 * 1024) {
        await fileHandle.close();
        return null;
      }
      const headerBuf = Buffer.alloc(headerLen);
      await fileHandle.read(headerBuf, 0, headerLen, 8);
      await fileHandle.close();
      const parsed = JSON.parse(headerBuf.toString('utf-8'));
      const meta = parsed.__metadata__ ?? {};
      return analyzeSafetensorsMetadata(meta);
    } catch (err) {
      console.warn('Failed to parse safetensors file:', err);
      return null;
    }
  });

  ipcMain.handle('dialog:open-safetensors-file', async (): Promise<string | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a .safetensors LoRA file',
      properties: ['openFile'],
      filters: [{ name: 'Safetensors Model', extensions: ['safetensors'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const iconPath = path.join(__dirname, '../build/icon.ico');
  const preloadPath = path.join(__dirname, 'preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1536,
    height: 1024,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    frame: false,
    backgroundColor: '#0B0E15',
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Safety fallback to guarantee window visibility
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1200);

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL as string);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load local HTML file, falling back to appPath:', err);
      mainWindow?.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    });
  }

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-change', false);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerWindowControlHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);
  ipcMain.on('shell:openExternal', (_event, url: string) => {
    shell.openExternal(url);
  });
}

function registerExtractionHandlers(): void {
  ipcMain.handle(
    'extraction:from-file-path',
    async (_event, filePath: string): Promise<ExtractionResult | ExtractionError> => {
      try {
        const buffer = await fs.readFile(filePath);
        const result = await extractFromImageBuffer(buffer, { kind: 'file', label: filePath });
        if (!isExtractionError(result)) {
          result.previewUrl = pathToFileURL(filePath).toString();
        }
        return result;
      } catch (error) {
        return {
          code: 'fetch-failed',
          message: `Could not read that file: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  );

  ipcMain.handle('extraction:from-clipboard', async (): Promise<ExtractionResult | ExtractionError> => {
    const image = (clipboard as any).readImage();
    if (!image || image.isEmpty()) {
      return { code: 'no-metadata-found', message: 'No image was found on the clipboard.' };
    }
    // Note: clipboard only holds decoded pixels — original PNG chunks are gone.
    // Clipboard paste will often legitimately find no metadata. See core/README.md.
    const buffer = image.toPNG();
    const result = await extractFromImageBuffer(buffer, {
      kind: 'clipboard',
      label: 'Clipboard image',
    });
    if (!isExtractionError(result)) {
      result.previewUrl = image.toDataURL();
    }
    return result;
  });

  ipcMain.handle(
    'extraction:from-url',
    async (_event, url: string): Promise<ExtractionResult | ExtractionError> => {
      try {
        return await extractFromUrl(url);
      } catch (error) {
        return {
          code: 'fetch-failed',
          message: `Something went wrong fetching that link: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  );

  // Lets the renderer embed local images (exports, library thumbnails). Image files only.
  ipcMain.handle('file:read-image-data-url', async (_event, fileUrl: string): Promise<string | null> => {
    try {
      const filePath = fileURLToPath(fileUrl);
      const ext = path.extname(filePath).toLowerCase();
      const mime: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg',
        '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
      };
      if (!mime[ext]) return null;
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > 60 * 1024 * 1024) return null;
      const data = await fs.readFile(filePath);
      return `data:${mime[ext]};base64,${data.toString('base64')}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle('dialog:open-image-file', async (): Promise<string | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose an AI-generated image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'jfif', 'avif'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

/**
 * Automatic updates from GitHub Releases (latest.yml). The new version downloads in the
 * background and replaces the installed one when the app quits, or at once when the
 * user clicks "Restart to update". The portable build cannot update itself.
 */
type UpdateStatus =
  | { state: 'idle' | 'checking' | 'unsupported' }
  | { state: 'available' | 'downloaded'; version: string }
  | { state: 'downloading'; version?: string; percent: number }
  | { state: 'error'; message: string };

let updateStatus: UpdateStatus = { state: 'idle' };
let availableVersion: string | undefined;

function sendUpdateStatus(status: UpdateStatus): void {
  updateStatus = status;
  mainWindow?.webContents.send('update:status', status);
}

function canAutoUpdate(): boolean {
  return app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_DIR;
}

function registerUpdateHandlers(): void {
  ipcMain.handle('update:get-status', () => updateStatus);
  ipcMain.handle('update:check', async () => {
    if (!canAutoUpdate()) return sendUpdateStatus({ state: 'unsupported' });
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      sendUpdateStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  });
  ipcMain.handle('update:install', () => {
    if (updateStatus.state !== 'downloaded') return;
    // Silent reinstall into the same folder, then start the new version
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });

  if (!canAutoUpdate()) {
    updateStatus = { state: 'unsupported' };
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    availableVersion = info.version;
    sendUpdateStatus({ state: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'idle' }));
  autoUpdater.on('download-progress', (progress) =>
    sendUpdateStatus({ state: 'downloading', version: availableVersion, percent: Math.round(progress.percent) })
  );
  autoUpdater.on('update-downloaded', (info) => sendUpdateStatus({ state: 'downloaded', version: info.version }));
  autoUpdater.on('error', (err) => sendUpdateStatus({ state: 'error', message: err?.message ?? String(err) }));

  // Check shortly after start, then every 6 hours while the app stays open
  const check = () => autoUpdater.checkForUpdates().catch(() => undefined);
  setTimeout(check, 5000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

function registerLibraryImageHandlers(): void {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const filePath = libraryImagePath(request.url);
    if (!filePath) return new Response('Not found', { status: 404 });
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  /** Saves one image (original bytes + JPEG thumbnail) for a library item */
  ipcMain.handle(
    'library:store-image',
    async (_event, itemId: string, original: Uint8Array, extension: string, thumbnail: Uint8Array, name?: string) => {
      const ext = String(extension || '').toLowerCase().replace(/^\./, '');
      if (!SAFE_SEGMENT.test(itemId) || !IMAGE_EXTENSIONS.has(ext)) throw new Error('Unsupported image');
      if (original.byteLength > 60 * 1024 * 1024) throw new Error('Image is larger than 60 MB');
      const dir = path.join(libraryImagesDir(), itemId);
      await fs.mkdir(dir, { recursive: true });
      const base = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await fs.writeFile(path.join(dir, `${base}.${ext}`), Buffer.from(original));
      await fs.writeFile(path.join(dir, `${base}.thumb.jpg`), Buffer.from(thumbnail));
      const urlFor = (file: string) => `${IMAGE_SCHEME}://library/${encodeURIComponent(itemId)}/${encodeURIComponent(file)}`;
      return { url: urlFor(`${base}.${ext}`), thumbUrl: urlFor(`${base}.thumb.jpg`), name };
    }
  );

  /** Removes the files of one stored image (original and thumbnail) */
  ipcMain.handle('library:delete-image', async (_event, urls: string[]) => {
    for (const url of Array.isArray(urls) ? urls : []) {
      const filePath = libraryImagePath(url);
      if (filePath) await fs.rm(filePath, { force: true }).catch(() => undefined);
    }
  });

  /** Removes every stored image of a library item */
  ipcMain.handle('library:delete-item-images', async (_event, itemId: string) => {
    if (!SAFE_SEGMENT.test(itemId)) return;
    await fs.rm(path.join(libraryImagesDir(), itemId), { recursive: true, force: true }).catch(() => undefined);
  });
}

// The window asks for these once it has loaded
queueOpenedPaths(imagePathsFromArgv(process.argv), notifyOpenedFiles);

app.whenReady().then(() => {
  if (!isPrimaryInstance) return;
  initLoraDatabase();
  configureLoraPersistence(loraDbInstance ? sqliteLoraPersistence : null);
  setRuntimeCivitaiApiKey(readCivitaiKey());
  registerLoraDbHandlers();
  registerSettingsHandlers();
  registerLibraryHandlers();
  registerSafetensorsHandlers();
  registerWindowControlHandlers();
  registerExtractionHandlers();
  registerUpdateHandlers();
  registerLibraryImageHandlers();
  registerShellIntegrationHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
