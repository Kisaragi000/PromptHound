# Master Plan: 100% Complete Offline LoRA & Model Catalog Engine (400,000+ Models)

## 1. Executive Summary & Objective
PromptHound aims to provide **complete offline recognition for ALL ~400,000+ LoRAs, Checkpoints, and Base Models** across the AI generation ecosystem without manual hunting, rate limits, or missing metadata.

This document details the engineering blueprint to store, index, query, and synchronize the entire catalog in **under 35 MB of storage** with **< 1ms lookup latency** and zero memory bloat.

---

## 2. Technical Feasibility & Compression Math

### The Problem with Raw JSON at Scale:
- 400,000 models × ~500 bytes per raw JSON record = **~200–250 MB**.
- Loading 250 MB JSON into JavaScript memory (`JSON.parse`) consumes **~800 MB+ of RAM** and causes 2–4 second UI freezes.

### The Compact SQLite Solution:
By storing normalized binary columns, packing integer IDs, and using SQLite's B-Tree indexing:
- **Hash Lookup Index (B-Tree)**: Sub-millisecond indexed binary hash lookups.
- **Name/Alias Search (FTS5 / Prefix B-Tree)**: Instant substring and token matching.
- **Storage Profile**:
  | Format | 100,000 LoRAs | 400,000 LoRAs (ALL) | RAM Footprint | Query Speed |
  |---|---|---|---|---|
  | **Raw JSON** | ~50 MB | ~220 MB | ~850 MB (High) | 150ms–500ms (O(N) scan) |
  | **Indexed SQLite (.db)** | ~9 MB | **~34 MB** | **< 12 MB (Pager cache)** | **< 0.5ms (O(log N))** |
  | **Zstd / Gzip Compressed Archive** | ~4.5 MB | **~16 MB** | N/A (Transfer size) | N/A |

---

## 3. The 4-Pillar Architecture

```
                       [ User Drops Image / Drag & Drop ]
                                       │
                                       ▼
     ┌───────────────────────────────────────────────────────────────────┐
     │ TIER 1: Universal 400k+ SQLite Master Catalog (Local Disk)        │
     │  • `prompthound-catalog.db` (B-Tree + FTS5)                       │
     │  • Exact SHA256 Index + Normalized Slug B-Tree                    │
     │  • Returns: canonical name, trigger words, baseModel, modelId     │
     │  • Speed: < 0.5ms | 0% Network Dependency                         │
     └─────────────────────────────────┬─────────────────────────────────┘
                                       │
                                 [Cache Hit?]
                                   ├── YES ──▶ [ Instant LoRA Card UI ]
                                   └── NO  ──┐
                                             ▼
     ┌───────────────────────────────────────────────────────────────────┐
     │ TIER 2: Live Waterfall Fallback & Instant Auto-Upsert             │
     │  • Civitai /model-versions/by-hash & /models?query                │
     │  • Immediately writes new discovery into local SQLite DB          │
     └─────────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
     ┌───────────────────────────────────────────────────────────────────┐
     │ TIER 3: Automated Incremental Delta Catalog Sync                  │
     │  • 1-Click "Download / Refresh Full Catalog" in Settings          │
     │  • Delta updater pulls only models created since `last_synced_at` │
     │  • Fast binary batch insert (`BEGIN TRANSACTION; ... COMMIT;`)    │
     └───────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema Specification (`better-sqlite3`)

```sql
-- Main LoRA & Model Catalog Table
CREATE TABLE IF NOT EXISTS lora_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civitai_model_id INTEGER NOT NULL,
  civitai_version_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  hash_sha256 TEXT,                   -- Indexed for exact hash matches
  cover_image_id TEXT,                -- Image ID for dynamic URL construction
  trigger_words TEXT,                 -- Compact JSON array: '["trigger1","trigger2"]'
  base_model TEXT NOT NULL,           -- 'SDXL 1.0', 'Pony', 'Flux.1 D', 'SD 1.5'
  model_url TEXT NOT NULL,
  download_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  updated_at INTEGER NOT NULL         -- Unix timestamp for incremental delta sync
);

-- Indexes for instant sub-millisecond retrieval
CREATE INDEX IF NOT EXISTS idx_lora_hash ON lora_catalog (hash_sha256);
CREATE INDEX IF NOT EXISTS idx_lora_alias ON lora_catalog (normalized_alias);
CREATE INDEX IF NOT EXISTS idx_lora_model_id ON lora_catalog (civitai_model_id);
```

---

## 5. Implementation Roadmap & Milestones

### Phase 1: High-Speed Batch Catalog Harvester (`scripts/harvest-full-catalog.mjs`)
- Multi-threaded worker queue to harvest Civitai's entire LoRA/Checkpoint catalog via paginated API (`/api/v1/models?types=LORA&limit=100`).
- Filters and sanitizes entries: strips junk characters, normalizes filenames, removes duplicated versions.
- Directly streams harvested batches into `prompthound-catalog.db` inside SQLite transactions (10,000 inserts/sec).
- Compresses the output database to `prompthound-catalog-all.db.gz` (~16 MB).

### Phase 2: Native SQLite Storage Engine (`core/sqlite-catalog.ts`)
- In Electron: Uses `better-sqlite3` directly on the local file system.
- In Browser/Preview: Uses `sql.js` (WebAssembly SQLite) with IndexedDB persistence fallback.
- Provides unified query APIs:
  - `findLoraByHash(sha256: string): ModelCatalogRecord | null`
  - `findLoraByAlias(rawOrNormalizedName: string): ModelCatalogRecord | null`
  - `searchLorasFts(query: string, limit?: number): ModelCatalogRecord[]`
  - `upsertDiscoveredLora(record: ModelCatalogRecord): void`

### Phase 3: 1-Click Catalog Downloader & Delta Sync (`src/pages/SettingsPage.tsx`)
- **Settings UI Controls**:
  - **Status Indicator**: `● Master Offline Catalog: 412,890 Models Available`.
  - **Progress Bar**: Shows live progress during full database download or delta sync.
  - **"Download / Update Complete Catalog" Button**:
    - If cold install: downloads the pre-built ~16 MB compressed snapshot and extracts it into the app data directory.
    - If existing catalog: queries Civitai for only models added/updated since the newest record's `updated_at` timestamp.
  - **Storage Management**: Shows exact DB size on disk (`34.2 MB`) with a "Vacuum & Optimize" button.

---

## 6. Execution Priority Table

| Step | Action | Output |
|---|---|---|
| **1** | Write multi-batch Harvester Script | `scripts/harvest-full-catalog.mjs` |
| **2** | Create SQLite Catalog Manager | `core/sqlite-catalog.ts` (B-Tree + FTS indices) |
| **3** | Hook SQLite lookups into `lora-resolution.ts` | 0ms resolution for all 400k+ models |
| **4** | Build Sync & Download Manager in Settings | Progress bar, model counter, delta sync UI |
