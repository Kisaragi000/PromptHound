# Implementation Plan: Offline LoRA Database & Universal PNG Parser Hardening

## 1. Executive Summary & Objective
This plan addresses two critical issues:
1. **PNGs not getting recognized**: Generated images from ComfyUI (custom nodes/workflows), WebUI Forge, Fooocus, NovelAI, or A1111 variations are failing extraction due to restrictive chunk handling and node graph traversing.
2. **LoRAs not getting recognized**: Fresh installs / previews have an empty cache (0 records) and live Civitai API calls are prone to CORS, Cloudflare blocks, rate limits, or missing hash parameters in raw prompt tags (`<lora:name:1>`).

The goal is to deliver **100% offline, instantaneous (< 1ms) recognition** for popular base models and LoRAs, paired with **hardened PNG parsing** that reliably reads all standard and custom generator outputs.

---

## 2. Root Cause Analysis

### A. LoRA Recognition Failures
| Cause | Detail | Impact |
|---|---|---|
| **Empty Cold-Start Cache** | Local storage starts at 0 entries. | No offline fallback available. |
| **CORS / Cloudflare Throttling** | Direct browser `fetch()` to `civitai.com` hits rate limits or blocks. | Live fallback fails silently. |
| **Hash-less Prompt Tags** | Prompts use `<lora:epiCRealism:0.8>` without SHA256 hashes. | Fails without a normalized alias dictionary. |

### B. PNG Extraction Failures
| Generator / Tool | Metadata Pattern | Current Limitation |
|---|---|---|
| **ComfyUI (UI Workflows)** | Saves UI graph in `workflow` chunk with `widgets_values` instead of `prompt` execution graph. | Parser only checked `prompt` node inputs. |
| **ComfyUI Custom Nodes** | Uses `Power LoRA Loader (rgthree)`, `CR Apply LoRA Stack`, `Efficiency Nodes`, `LoraLoader|pysssss`, `Easy LoraStack`. | Parser only checked standard `LoraLoader` inputs. |
| **ComfyUI Text Encoders** | Uses `SDXLPromptStyler`, `PrimitiveNode`, `ShowText`, `CLIPTextEncodeFlux`. | Prompt text tracing lost in chained nodes. |
| **A1111 / WebUI Forge** | Case variations (`Parameters`, `Comment`, `UserComment`, `sd-metadata`), `AddNet` extension tags, complex syntax (`<lora:name:0.8:lbw=...>`). | Bypasses standard regex/parsers. |

---

## 3. Solution Architecture

```
                       [ Input PNG / Image Buffer ]
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │ Multi-Format PNG Parser                                │
       │  • Case-insensitive chunk scanner (tEXt, zTXt, iTXt)   │
       │  • ComfyUI dual engine: prompt graph + workflow graph  │
       │  • Custom LoRA node decoders (rgthree, CR, Efficiency) │
       │  • A1111 / Forge / AddNet / Fooocus / NovelAI parser   │
       └────────────────────────────┬───────────────────────────┘
                                    │ Extracted LoRA References
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │ Tier 1: Embedded Offline Master Database (0ms)         │
       │  • Pre-bundled top LoRAs, base models, trigger words   │
       │  • Normalized alias matching (e.g. "add_detail")       │
       │  • Instant thumbnail + architecture + trigger words    │
       └────────────────────────────┬───────────────────────────┘
                                    │ Cache Miss?
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │ Tier 2: Real-Time Fallback & Auto-Upsert               │
       │  • Civitai /model-versions/by-hash & /models?query     │
       │  • Auto-inserts new models into local Tier 1 storage   │
       └────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Implementation Modules

### Module 1: Pre-Bundled Offline Master Database (`core/data/master-lora-db.ts`)
Create a comprehensive, curated offline database containing popular base models and high-frequency LoRAs:

- **Base Models**:
  - `SDXL 1.0`, `Pony Diffusion V6 XL`, `Flux.1 [dev]`, `Flux.1 [schnell]`, `Stable Diffusion 1.5`, `Illustrious XL`, `SD 3.5 Large`, `Animagine XL 3.1`, `NoobAI XL`.
- **Top Community LoRAs**:
  - **Detail & Lighting**: `add_detail` / `detail_tweaker`, `epiCRealism Helper`, `Filmgrain`, `cinematic_lighting`, `Expressive_H`, `xl_more_art-full`.
  - **Styles & Concepts**: `blindbox`, `Ghibli Style`, `Anime Lineart`, `Cyberpunk 2077`, `Claymation`, `Isometric 3D`.
  - **Anatomy & Realism**: `hands_enhancer`, `perfect_eyes`, `face_detailer`, `skin_texture_sdxl`.
- **Fields Stored per Model**:
  ```typescript
  export interface MasterLoraEntry {
    name: string;
    normalizedAliases: string[];
    hashSha256?: string;
    coverImageUrl: string;
    triggerWords: string[];
    baseModel: string;
    modelUrl: string;
  }
  ```

---

### Module 2: Enhanced LoRA Cache Engine (`core/lora-cache.ts`)
- **Instant Pre-Seeding**: Automatically load `MASTER_LORA_DB` into in-memory indices (`hashIndex` and `aliasIndex`) on module load.
- **Merge with User Cache**: User-discovered models from Tier 2 persist on top of the bundled master database.
- **0ms Cold-Start**: Guarantees instant recognition without requiring network access or prior usage.

---

### Module 3: ComfyUI Dual Graph & Custom Node Support (`core/parsers/comfyui.ts`)
Support both execution and UI workflow schemas:

1. **Dual Graph Traversal**:
   - Inspect `prompt` execution graph (`inputs` on nodes).
   - If missing or empty, inspect `workflow` UI graph (`nodes[].widgets_values`).
2. **Custom LoRA Loaders**:
   - Standard: `LoraLoader`, `LoraLoaderModelOnly`.
   - rgthree: `Power Lora Loader`, `Power Lora Loader (rgthree)`.
   - Comfyroll: `CR Apply LoRA Stack`, `CR LoRA Stack`.
   - Efficiency Nodes: `Efficient Loader`, `LoRA Stacker`.
   - PySSSSS / EasyUse: `LoraLoader|pysssss`, `easy loraStack`.
3. **Advanced Prompt Tracing**:
   - Trace through chained conditioning (`ConditioningCombine`, `ConditioningAverage`, `ConditioningSetArea`).
   - Extract string literals from `SDXLPromptStyler`, `PrimitiveNode`, `ShowText`, and Flux text encoders.

---

### Module 4: A1111 / WebUI Forge / Fooocus Hardening (`core/parsers/a1111.ts` & `core/format-detect.ts`)
1. **Case-Insensitive Chunk Matching**:
   - Inspect `parameters`, `Parameters`, `comment`, `Comment`, `description`, `Description`, `sd-metadata`, `userComment`, `UserComment`, `exif`.
2. **AddNet & Extension Parsing**:
   - Support `AddNet Module 1: LoRA`, `AddNet Model 1: <name>(<hash>)`, `AddNet Weight A 1: <weight>`.
   - Support Forge / WebUI 1.6+ multi-weight tags: `<lora:name:model_weight:clip_weight:lbw=...>`.
   - Support Civitai on-site `Resources: [...]` JSON embedded in parameters.

---

## 5. File Changes Summary

| Target File | Scope of Change |
|---|---|
| `core/data/master-lora-db.ts` | **NEW**: Curated offline master database of top models and LoRAs. |
| `core/lora-cache.ts` | Pre-seed cache with offline master DB + handle user upserts. |
| `core/parsers/comfyui.ts` | Add dual-graph parsing (`prompt` + `workflow`) and custom LoRA loader decoders. |
| `core/parsers/a1111.ts` | Add AddNet parsing, Forge multi-weight regex, and Civitai resource format. |
| `core/format-detect.ts` | Add case-insensitive chunk matching and raw buffer text scanning. |
| `core/png.ts` | Verify robust tEXt, zTXt, and iTXt decoding across all chunks. |

---

## 6. Verification & Test Plan

1. **Standard A1111 PNG**: Verify extraction of prompt, negative prompt, sampler, seed, size, model, and `<lora:...>` tags.
2. **ComfyUI PNG (Custom Nodes & Workflow)**: Test rgthree Power LoRA Loader, CR LoRA Stack, and UI-only workflow PNGs.
3. **Offline / Flight Mode Test**: Drop images with common LoRAs with zero network connection; confirm visual LoRA card, trigger words, and cover thumbnail appear in < 2ms.
4. **Settings Page Verification**: Confirm Model Cache metric displays both pre-seeded master count and user auto-upserts.
