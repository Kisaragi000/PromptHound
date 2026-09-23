# Master Plan: Comprehensive LoRA & Model Catalog Access Engine

## 1. Executive Summary & Objective
PromptHound requires a scalable, fast, and comprehensive model identification engine that covers **all LoRAs, Checkpoints, and Base Models** across both Civitai and SeaArt without being constrained by rate limits, latency, or small pre-selected top-lists.

This document outlines the proposed 3-tier mass-access architecture, database schema, synchronization mechanism, and UI integrations.

---

## 2. The Core Challenges
1. **Catalog Scale**: Civitai currently indexes over 400,000+ models, versions, and LoRAs, with thousands added weekly.
2. **Rate Limits & Latency**: Sending individual live search queries (`/api/v1/models?query=...`) for every hash-less LoRA during batch image drops leads to HTTP 429 errors and slow extraction UI (300ms–1.5s per LoRA).
3. **SeaArt Catalog Variations**: SeaArt often generates images using internal numeric IDs (e.g. `1048291`), stripped prompt tags, or modified model filenames without standard SHA256 hashes.
4. **Desktop Performance Expectation**: Extraction should happen instantly (< 10ms), work offline, and display visual cover thumbnails, trigger words, and base model architectures.

---

## 3. The 3-Tier Mass-Access Architecture

```
                       [ Input Image / Metadata ]
                                   │
                                   ▼
                ┌──────────────────────────────────────┐
                │ TIER 1: Offline Local Master Index   │
                │  • SQLite / IndexedDB Storage        │
                │  • Indexed by Hash & Normalized Slug │
                │  • Covers Hashes, Triggers, Covers   │
                │  • < 2ms Instant Lookups             │
                └──────────────────┬───────────────────┘
                                   │
                             [Cache Hit?]
                               ├── YES ──▶ [ Instant Visual LoRA Card UI ]
                               └── NO  ──┐
                                         ▼
                ┌──────────────────────────────────────┐
                │ TIER 2: Real-Time Fallback & Upsert  │
                │  • Waterfall: Hash -> Name Search    │
                │  • Auto-inserts result into Tier 1   │
                │  • Self-healing user catalog         │
                └──────────────────┬───────────────────┘
                                   │
                                   ▼
                ┌──────────────────────────────────────┐
                │ TIER 3: Background Catalog Sync      │
                │  • Incremental API dump / sync       │
                │  • "Update Model Catalog" in Settings│
                │  • Keeps offline master index fresh  │
                └──────────────────────────────────────┘
```

---

## 4. Tier Specifications

### Tier 1: Compressed Offline Master Index (Local SQLite / Storage)
- **Data Model per Entry**:
  ```typescript
  interface ModelCatalogRecord {
    id: string;             // Civitai/SeaArt Model ID
    versionId?: string;     // Model Version ID
    name: string;           // Official Title (e.g. "Echidna (Re:Zero) SDXL")
    normalizedAlias: string;// Normalized clean slug (e.g. "echidna rezero")
    hashShort?: string;     // 8-10 char hash prefix (e.g. "8a1b2c3d")
    hashSha256?: string;    // Full SHA256 (for exact matching)
    coverImageUrl?: string; // Optimized CDN preview thumbnail URL
    triggerWords: string[]; // ['echidna', 'black dress', 'white hair']
    baseModel: string;      // 'SDXL 1.0', 'Pony', 'Flux.1 D', 'SD 1.5', 'Illustrious'
    source: 'civitai' | 'seaart' | 'local';
    modelUrl: string;       // Direct link to model page
  }
  ```
- **Storage Efficiency**:
  Using compressed column representations, **100,000 entries require only ~8–12 MB** on disk.
- **Speed**: Sub-millisecond lookup by exact hash or normalized text query.

---

### Tier 2: Live Fallback & Self-Healing Auto-Upsert
- If an image contains an obscure, niche, or newly released LoRA not in Tier 1:
  1. Trigger background live resolution query to Civitai API with user API key if configured.
  2. Extract full metadata (`trainedWords`, `images[0].url`, `baseModel`, version name).
  3. **Auto-Upsert**: Immediately insert the resolved metadata into the local Tier 1 database.
  4. Next time this LoRA (or any image using it) is opened, it resolves in < 1ms offline.

---

### Tier 3: Mass Sync & Catalog Updater
To give users access to the broad ecosystem without manual downloads:
1. **Periodic Background Index Sync**:
   - Downloads incremental catalog updates (new models, top community LoRAs, SeaArt mappings).
2. **Settings UI Sync Controls**:
   - Added to `SettingsPage.tsx`:
     - **"Model Catalog Status"**: Shows total indexed models (e.g. `124,580 models indexed`).
     - **"Check for Model Updates"** button: Fetches the latest database delta in the background.
     - **"Clear / Rebuild Cache"** button.

---

## 5. Visual LoRA Card UI (SeaArt Reference Matching)
Each identified LoRA displays in the extraction result and prompt library as:
- **Square Rounded Cover Art Thumbnail**: Pre-cached CDN image with source indicator badge (`civitai` / `seaart`).
- **Model Title with External Outbound Link**: Opens the model page in browser.
- **Visual Weight / Strength Slider Bar**: Visual progress bar indicating applied strength weight (e.g. `0.80`, `1.0`).
- **Clickable Trigger Word Chips**: 1-click copy with instant feedback.
- **Architecture Pill Badges**: Visual indicator of base model compatibility (`SDXL 1.0`, `Pony`, `Flux`, `SD 1.5`).

---

## 6. Proposed Implementation Plan

| Phase | Deliverable | Impact |
|---|---|---|
| **Phase 1** | **Master Catalog Engine (`core/lora-catalog.ts`)**<br>Initialize local master model dataset + high-speed multi-index search (by SHA256 hash, short hash, and normalized alias). | 95%+ of LoRAs resolve instantly offline with rich thumbnails and trigger words. |
| **Phase 2** | **Self-Healing Auto-Upsert**<br>Connect live API queries so any newly identified model is permanently saved to the local database. | App dynamically gets smarter and learns all user-specific LoRAs. |
| **Phase 3** | **Catalog Sync Manager in Settings**<br>Provide sync status, model count stats, and 1-click catalog update in the Settings UI. | Keeps the catalog fresh and synced with Civitai/SeaArt ecosystem. |
