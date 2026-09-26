# FEATURE_PLAN_LORA_AND_IMPROVEMENTS.md

## Scope

This document covers two selected improvements from `RECOMMENDED_IMPROVEMENTS.md`
plus a comprehensive architecture and implementation plan for incorporating three external GitHub repos as reference/source material.

**Selected improvements:**
- **Improvement #4:** Encrypted Civitai API Key in Settings (`safeStorage` at rest + rate-limit lifting).
- **Improvement #5:** FTS5 full-text search baked into SQLite library schema (`saved_prompts` + `saved_prompts_fts`).

**External reference repositories:**
- [idrirap/ComfyUI-Lora-Auto-Trigger-Words](https://github.com/idrirap/ComfyUI-Lora-Auto-Trigger-Words)
- [Xypher7/lora-metadata-viewer](https://github.com/Xypher7/lora-metadata-viewer)
- [rgthree/rgthree-comfy](https://github.com/rgthree/rgthree-comfy)

---

## What each repo actually is & key takeaways

### 1. idrirap/ComfyUI-Lora-Auto-Trigger-Words
A ComfyUI custom node pack (Python). Its core purpose: given a LoRA filename, fetch trigger words from two distinct sources:
1. **Civitai API**: `trainedWords` array on the model version object (`/api/v1/model-versions/{versionId}`).
2. **Embedded Training Metadata**: The LoRA file's own embedded header (`__metadata__` $\rightarrow$ `ss_tag_frequency` in `.safetensors`).

**What we borrow:** The two-source trigger word pipeline:
- Source 1: Civitai API `GET /api/v1/model-versions/{versionId}` $\rightarrow$ `trainedWords[]`
- Source 2: Read the LoRA file's safetensors header $\rightarrow$ `__metadata__` $\rightarrow$ `ss_tag_frequency` JSON map of `{ "tag": count }`, taking the top $N$ tags by frequency as inferred trigger words for unlisted, custom, or private LoRAs.

**Zero-Dependency Safetensors Reader:**
```typescript
// safetensors header: first 8 bytes = uint64 header length (little-endian)
// followed by header_length bytes of UTF-8 JSON containing __metadata__
export async function readSafetensorsMetadata(filePath: string): Promise<Record<string, any>> {
  const fd = await fs.open(filePath, 'r');
  const lenBuf = Buffer.alloc(8);
  await fd.read(lenBuf, 0, 8, 0);
  const headerLen = Number(lenBuf.readBigUInt64LE(0));
  const headerBuf = Buffer.alloc(headerLen);
  await fd.read(headerBuf, 0, headerLen, 8);
  await fd.close();
  const header = JSON.parse(headerBuf.toString('utf-8'));
  return header.__metadata__ ?? {};
}
```

---

### 2. Xypher7/lora-metadata-viewer
A client-side browser tool (HTML/JS) running at `xypher7.github.io/lora-metadata-viewer/`. Users drop a `.safetensors` file and the browser parses the byte header using `FileReader` and `DataView`.

**What we borrow:**
- Confirmation of pure buffer-level parsing without external Python/Rust dependencies.
- Ability to parse safetensors headers in browser memory (`ArrayBuffer` / `Uint8Array`) as well as in Node.js / Electron (`Buffer`).

---

### 3. rgthree/rgthree-comfy
A flagship ComfyUI node ecosystem. The relevant component is the **Power Lora Loader**:
1. Caches Civitai metadata and trigger words in local sidecar JSON files or SQLite store.
2. Fast offline lookups on subsequent runs.
3. Fallback extraction of `trainedWords` from both Civitai API and `__metadata__` tags.

**What we borrow:**
- Persistent local caching architecture with SQLite and exportable JSON backup.
- Clean separation between offline seeds, local user-discovered models, and remote API enrichment.

---

## Combined Architecture Pipeline

```
LoRA Reference Extracted from Image
               │
               ├─► [1] Has SHA256 / AutoV2 hash?
               │       ├─ YES ──► Local SQLite Catalog (`lora_cache`)
               │       └─ NO  ──► Civitai API `/api/v1/model-versions/by-hash/:hash`
               │                  └─► Extract `name`, `trainedWords`, `coverImageUrl`
               │
               ├─► [2] Has Raw Name Only?
               │       ├─► Check SQLite Alias Index
               │       └─► Civitai API Name Search (`/api/v1/models?query=...`)
               │           └─► Multi-factor Similarity Filter (Dice ≥ 0.45 & Token Overlap)
               │
               └─► [3] Local Safetensors File Available? (Private / Offline LoRAs)
                       ├─► Read `__metadata__` byte header (zero external deps)
                       ├─► Parse `ss_tag_frequency` $\rightarrow$ Sort tags by frequency count
                       └─► Merge inferred trigger words with Civitai `trainedWords`
```

---

## Improvement #4: Encrypted Civitai API Key in Settings

### Why it matters
Anonymous Civitai API requests have strict rate limits. Searching by name for hash-less LoRAs or processing batch folders quickly hits rate limit errors (HTTP 429). Storing a personal API key increases rate limits and allows resolving private/early-access models.

### Security Implementation
Keys are encrypted at rest using Electron's native `safeStorage` API (DPAPI on Windows, Keychain on macOS, libsecret on Linux) instead of plaintext:

```typescript
// electron/main.ts
import { safeStorage, ipcMain } from 'electron';

ipcMain.handle('settings:save-civitai-key', (_event, key: string) => {
  if (!key.trim()) {
    db.prepare('DELETE FROM settings WHERE key = ?').run('civitai_api_key');
    return;
  }
  const encrypted = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key.trim()).toString('base64')
    : Buffer.from(key.trim()).toString('base64');

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run('civitai_api_key', encrypted);
});

ipcMain.handle('settings:get-civitai-key', () => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?')
    .get('civitai_api_key') as { value: string } | undefined;
  if (!row) return null;
  try {
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(row.value, 'base64'))
      : Buffer.from(row.value, 'base64').toString('utf8');
  } catch {
    return null;
  }
});
```

### Authorization Header Propagation
All Civitai fetch calls (`/api/v1/models`, `/api/v1/model-versions/by-hash/:hash`) accept an optional `apiKey` and append:
```typescript
headers: {
  'Content-Type': 'application/json',
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
}
```

---

## Improvement #5: FTS5 Full-Text Search in SQLite Library Schema

### Database Schema Design
When persisting the Prompt Library, SQLite's built-in `FTS5` engine is initialized alongside `saved_prompts` with automatic sync triggers:

```sql
-- Main Table
CREATE TABLE IF NOT EXISTS saved_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  model TEXT,
  sampler TEXT,
  steps INTEGER,
  cfg_scale REAL,
  seed TEXT,
  width INTEGER,
  height INTEGER,
  loras TEXT,           -- JSON array of resolved LoRA objects
  folder_id INTEGER,
  is_favorite INTEGER DEFAULT 0,
  source_label TEXT,
  preview_url TEXT,
  created_at INTEGER NOT NULL
);

-- FTS5 Virtual Table for Instant Search
CREATE VIRTUAL TABLE IF NOT EXISTS saved_prompts_fts USING fts5(
  prompt,
  negative_prompt,
  model,
  loras,
  content='saved_prompts',
  content_rowid='id'
);

-- Triggers to maintain FTS index automatically
CREATE TRIGGER IF NOT EXISTS saved_prompts_ai AFTER INSERT ON saved_prompts BEGIN
  INSERT INTO saved_prompts_fts(rowid, prompt, negative_prompt, model, loras)
  VALUES (new.id, new.prompt, new.negative_prompt, new.model, new.loras);
END;

CREATE TRIGGER IF NOT EXISTS saved_prompts_ad AFTER DELETE ON saved_prompts BEGIN
  INSERT INTO saved_prompts_fts(saved_prompts_fts, rowid, prompt, negative_prompt, model, loras)
  VALUES ('delete', old.id, old.prompt, old.negative_prompt, old.model, old.loras);
END;

CREATE TRIGGER IF NOT EXISTS saved_prompts_au AFTER UPDATE ON saved_prompts BEGIN
  INSERT INTO saved_prompts_fts(saved_prompts_fts, rowid, prompt, negative_prompt, model, loras)
  VALUES ('delete', old.id, old.prompt, old.negative_prompt, old.model, old.loras);
  INSERT INTO saved_prompts_fts(rowid, prompt, negative_prompt, model, loras)
  VALUES (new.id, new.prompt, new.negative_prompt, new.model, new.loras);
END;
```

---

## Action Plan & Target Files

| Target File | Type | Implementation Summary |
| :--- | :--- | :--- |
| `core/safetensors.ts` | **New** | Isomorphic parser for `.safetensors` header reading and `ss_tag_frequency` extraction |
| `core/lora-resolution.ts` | **Update** | Support `apiKey` parameter and safetensors fallback for trigger words |
| `core/types.ts` | **Update** | Add `triggerWords: string[]` and `coverImageId?: string` to `LoraReference.resolved` |
| `src/pages/SettingsPage.tsx` | **Update** | Civitai API key field with `safeStorage` IPC and UI status |
| `electron/main.ts` | **Update** | `safeStorage` encrypt/decrypt IPC handlers + FTS5 database schemas |
| `electron/preload.ts` | **Update** | Expose `settings.saveCivitaiKey` and `settings.getCivitaiKey` |
