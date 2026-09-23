# PromptHound - Architecture & Extraction Pipeline Q&A Breakdown

This document provides detailed answers to the architectural and implementation questions regarding the extraction pipeline, browser vs. IPC contexts, PNG handling, and WebP metadata extraction.

---

## 1. Was `core/png.ts` moved into the renderer / browser context, or was something else restructured?

### Summary
**No, `core/png.ts` was not physically moved, but the code in `core/` is now executed in both the Electron Main process and the Browser/Renderer context (Dual-Mode / Isomorphic architecture).**

### Details
- The `core/` directory was originally authored with Node.js dependencies (`import zlib from 'node:zlib'`).
- In PromptHound's architecture, `core/` is imported by:
  1. **Electron Main Process** (`electron/main.ts` -> `core/index.ts` -> `core/link-fetch.ts` -> `core/png.ts`) via Node.js.
  2. **Vite Browser/Renderer** (`src/extraction/ExtractionContext.tsx` -> `core/civitai-extractor.ts` / `core/link-fetch.ts` -> `core/png.ts`) for web previews, web deployment, and client-side drag-and-drop.
- When `core/png.ts` runs inside the Vite browser environment, calling `node:zlib` to inflate compressed PNG chunks (`zTXt`, compressed `iTXt`) fails or throws unhandled module errors.
- **The fix**: Replacing `node:zlib` with a universal pure-JS/Wasm decompressor like `fflate` (`inflateSync`) makes `core/png.ts` truly isomorphic, allowing it to decompress PNG chunks identically in both Node/Electron and Vite/Browser contexts without changing directory locations.

---

## 2. Did the extraction pipeline change so the renderer now calls parsing code directly instead of going through IPC?

### Summary
**PromptHound uses an adaptive Dual-Pipeline architecture: it uses Electron IPC when available, and seamlessly falls back to direct client-side parsing in the browser/renderer.**

### How the Pipeline Works:

```
                          User Drops / Selects Image
                                      │
                         Is `window.promptHound`
                             (Electron) present?
                                ┌─────┴─────┐
                                │           │
                              YES           NO (Web / Preview)
                                │           │
                   electron.webUtils        │
                  .getPathForFile(file)     │
                                │           │
                        Has native path?    │
                           ┌────┴────┐      │
                          YES        NO     │
                           │          │     │
            IPC `extraction:from-     └─────┼──────────────────┐
                 file-path`                 │                  │
                           │                ▼                  ▼
                    (Electron Main)    (Renderer)         (Renderer)
                   Reads file buffer   Direct Buffer:     Direct Buffer:
                           │           `await file.       `await file.
                           │            arrayBuffer()`     arrayBuffer()`
                           ▼                │                  │
                `extractFromImageBuffer` ◄──┴──────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
          1. Civitai Pipeline    2. Local Chunk Fallbacks
         (`civitai-extractor`)      (`readPngChunks`, WebP RIFF)
```

### Why Both Exist:
1. **Electron Desktop Mode (IPC)**:
   - When running in Electron, `ExtractionContext.tsx` uses `window.promptHound.extraction.getPathForFile(file)` and invokes `ipcRenderer.invoke('extraction:from-file-path', filePath)`.
   - The main process reads the raw filesystem buffer using Node's `fs.readFile` and runs `extractFromImageBuffer`.
2. **Web / Vite / In-Browser Mode (Direct Renderer Parsing)**:
   - In Vite dev/preview mode, shared web builds, or if `getPathForFile` returns empty, `ExtractionContext.tsx` dynamically imports `core/civitai-extractor.ts` and parses `new Uint8Array(await file.arrayBuffer())` directly in the browser.

---

## 3. For Issue 2 (WebP) — was a WebP parser added, or was the architecture change what affects it?

### Summary
**Both. WebP parsing was introduced via `@civitai/generation-metadata`, but two specific issues cause WebP extractions to fail without dedicated fallback handling:**

### Root Causes for WebP Failures:
1. **Civitai WebP Normalizer Limitations**:
   - `@civitai/generation-metadata` handles standard WebP EXIF and XMP chunks.
   - However, many WebP generators (such as Automatic1111/Forge with WebP output extension, or ComfyUI WebP nodes) store metadata in EXIF tag `0x9286 (UserComment)`, `0x0110 (Model)`, or `0x010e (ImageDescription)` with custom headers (e.g. `UNICODE\0`, `ASCII\0`, or raw JSON).
   - In these cases, `readCivitaiMetadata` parses the EXIF block into `md.exif`, but fails to recognize the generator (`md.generator` is `null`), resulting in empty prompts and resources in the normalized output.
2. **Missing Secondary Fallback in `extractFromImageBuffer`**:
   - In `core/link-fetch.ts`, the secondary fallback specifically checked `readPngChunks(buffer)`.
   - There was **no equivalent WebP RIFF chunk fallback** (`readWebpChunks`) to inspect `EXIF` and `XMP ` RIFF chunks if the Civitai pipeline returned empty metadata.

### The Concrete WebP Fix:
1. **Inspect `md.exif` directly in `civitai-extractor.ts`**:
   - Check `md.exif.UserComment`, `md.exif.userComment`, `md.exif.ImageDescription`, and `md.exif.Model`.
   - If `md.generator` was not resolved, run these raw strings through `parseA1111()` or `parseComfyUI()`.
2. **Add a lightweight WebP RIFF chunk reader (`core/webp.ts`)**:
   - Scans the WebP binary structure for `RIFF....WEBP` -> `EXIF` or `XMP ` chunks.
   - Decodes the raw text payload and routes it through standard parameter extractors as a reliable second line of defense.

---

## Architecture Comparison Matrix

| Component | Electron Desktop (Main) | Browser / Vite Renderer | Recommended Fix |
|---|---|---|---|
| **File Reading** | Node `fs.readFile` via IPC | `file.arrayBuffer()` via `Uint8Array` | Retain dual-path in `ExtractionContext.tsx` |
| **PNG Chunk Inflation** | Node `zlib.inflateRawSync` | Browser Wasm / JS `fflate.inflateSync` | Switch `core/png.ts` to `fflate` |
| **Civitai Engine** | `@civitai/generation-metadata` | `@civitai/generation-metadata` | Convert buffers to `Uint8Array` consistently |
| **WebP Parsing** | EXIF via Civitai / RIFF scanner | EXIF via Civitai / RIFF scanner | Add `md.exif` string fallback & RIFF parser |
| **LoRA Resolution** | Civitai API / In-Memory cache | Civitai API / In-Memory cache | Retain `core/lora-resolution.ts` |
