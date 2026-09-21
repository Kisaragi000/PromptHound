# Issue Report: LoRA False-Positive Recognition ("Unknownspy - Sploot")

**Status:** Resolved in Engine & Native Database Storage  
**Component:** LoRA Metadata Extraction, Resolution Engine (`core/lora-resolution.ts`, `core/similarity.ts`), and Local SQLite Cache (`electron/main.ts`, `core/lora-cache.ts`)  
**Affected Behavior:** Image metadata containing custom or unrecognized LoRAs displayed as **"Unknownspy - Sploot"** instead of the actual model name or an unlinked tag.

---

## 1. Executive Summary & Root Cause

When extracting image generation metadata (from Automatic1111, Forge, ComfyUI, Fooocus, or SeaArt), LoRA references (e.g. `<lora:name:weight>` or `Lora hashes: "name: hash"`) are looked up against online model repositories (primarily Civitai).

The false attribution of **"Unknownspy - Sploot"** was caused by a combination of three factors:

### Factor A: Civitai Search Engine Fallback Behavior
* Civitai's public REST API (`GET /api/v1/models?query=...&types=LORA`) does **not** return an empty list when an exact match is not found.
* Instead, Civitai's backend performs a fuzzy/popularity-weighted fallback search. For queries with common prefixes, stripped keywords, or unrecognized model names, Civitai returns trending/popular models matching partial tags. Model `#34586` (*"Unknownspy - Sploot"*) is a popular model frequently returned as Civitai's top fallback item.

### Factor B: Lack of Candidate Similarity Verification (Prior to v1.0.4)
* The initial implementation of `resolveSingleLora` took `searchData.items[0]` blindly without verifying whether the returned title or filename bore any resemblance to the query tokens.
* If a query like `"my_custom_lora"` was sent, Civitai returned `[ { name: "Unknownspy - Sploot", ... } ]`, which was accepted without validation.

### Factor C: Stale Local Cache
* Once accepted, the incorrect match was persisted in the local storage layer to speed up future lookups.
* Subsequent extractions of the same image immediately pulled `"Unknownspy - Sploot"` from local cache without making a new network request.

---

## 2. Architecture of the Fix

### A. Multi-Factor Token & Similarity Filter (`core/similarity.ts`)
1. **Noise Token Pruning**: Strips architecture markers (`sdxl`, `pony`, `flux`, `sd15`), version tags (`v1`, `v2`, `epoch10`), and file extensions (`.safetensors`, `.ckpt`).
2. **Token Overlap & Intersection Check**: Compares query tokens against candidate titles and file names. If a multi-token query has **zero token intersection** with the candidate, it is **hard rejected** (score = 0.0).
3. **Dice Bigram & Harmonic Precision Scoring**: Candidates must score **>= 0.45** to be accepted. For example:
   * `"Unknownspy Sploot"` vs `"Unknownspy - Sploot"` $\rightarrow$ **0.97** (Accepted)
   * `"Echidna ReZero"` vs `"Unknownspy - Sploot"` $\rightarrow$ **0.00** (Rejected $\rightarrow$ Displays as clean raw tag)
   * `"Echidna ReZero"` vs `"Echidna (Re:Zero) SDXL"` $\rightarrow$ **0.88** (Accepted fuzzy match)

### B. Multi-Format Hash Waterfall
1. Direct exact/prefix lookup against Civitai `/api/v1/model-versions/by-hash/:hash`.
2. Supports **SHA256** (64 hex characters), **AutoV2** (10 hex characters), **AutoV1** (8 hex characters), **CRC32**, and **BLAKE3**.

### C. Native SQLite Database Storage Engine (`electron/main.ts`, `core/lora-cache.ts`)
* LoRA cache persistence runs on a dedicated native SQLite database (`lora_catalog.sqlite` in `app.getPath('userData')`).
* All user-discovered records are indexed and managed via Electron IPC.
* Database wipes cleanly purge user-discovered records while preserving the bundled offline seed records via:
  ```sql
  DELETE FROM lora_cache WHERE cachedAt > 0;
  ```

### D. Interactive LoRA Inspector & Manual Re-Linker (`src/components/lora/LoraDetailsModal.tsx`)
* Clicking any LoRA card in the extraction view opens the **LoRA Model Inspector**.
* Users can manually search Civitai, select the exact version, or click **"Unlink"** to keep it as a custom/private model.

---

## 3. How to Clear Existing Stale Cache

If your installation still displays the old cached result from previous sessions:

### Method 1: Via PromptHound Settings (Recommended)
1. Go to **Settings** in the left navigation sidebar.
2. Scroll down to the **Local Model Cache (Tier 1)** section.
3. Click the **"Clear Cache"** button. This invokes the IPC handler to execute `DELETE FROM lora_cache WHERE cachedAt > 0`, safely removing stale user discoveries while keeping the offline seed dataset intact.
4. Re-upload or re-extract your image.

### Method 2: Via the LoRA Inspector UI
1. On the **Extraction Result** page, click the LoRA card showing `"Unknownspy - Sploot"`.
2. In the modal dialog, click **"Unlink"** to immediately break the incorrect association or type a search query to link the correct Civitai model.

---

## 4. Verification Test Matrix

| Query / LoRA Tag | Civitai Candidate | Pre-fix Result | Post-fix Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `<lora:Echidna_ReZero_SDXL:0.8>` | *Unknownspy - Sploot* | ❌ Sploot (False Match) | ✅ Echidna ReZero (Unlinked/Clean) | **PASSED** |
| `<lora:Echidna_ReZero_v2:0.8>` | *Echidna (Re:Zero) SDXL* | ❌ Missed / Wrong Model | ✅ Echidna (Re:Zero) SDXL (Fuzzy match $\ge 0.45$) | **PASSED** |
| `Lora hashes: "detail_tweaker: 4b6ec340"` | *Add More Details* | ✅ Add More Details | ✅ Add More Details (Exact Hash) | **PASSED** |
| `<lora:custom_private_model:1>` | *Unknownspy - Sploot* | ❌ Sploot (False Match) | ✅ custom_private_model (Preserved) | **PASSED** |
| `<lora:Unknownspy_Sploot_v1:0.7>` | *Unknownspy - Sploot* | ✅ Sploot | ✅ Sploot (Valid Match) | **PASSED** |
