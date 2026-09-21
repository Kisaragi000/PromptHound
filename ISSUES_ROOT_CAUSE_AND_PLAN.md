# PromptHound - Root-Cause Analysis & Actionable Plan for 5 Issues

This document provides a root-cause breakdown and step-by-step implementation blueprint for the 5 critical issues in PromptHound.

---

## Summary of Issues

1. **Issue 1: PNG Metadata Extraction Failing**
2. **Issue 2: WebP Metadata Extraction Failing**
3. **Issue 3: Drag & Drop New Image on Extraction Result Page**
4. **Issue 4: Preview Image Cut Off on Extraction Result Page**
5. **Issue 5: Export Extraction Results Page as an Image**

---

## Issue 1: PNG Metadata Extraction Failing

### Root Cause
1. **Node.js `zlib` imported in browser code (`core/png.ts`)**:
   `core/png.ts` contains `import zlib from 'node:zlib'`. In client-side Vite/browser runtime, `node:zlib` cannot decompress compressed PNG text chunks (`zTXt` or compressed `iTXt`), throwing errors or crashing decompression.
2. **Buffer type mismatch**:
   `readCivitaiMetadata` requires a standard `Uint8Array` or `ArrayBuffer`. Passing `File` or `Blob` directly without converting to `new Uint8Array(await file.arrayBuffer())` causes parsing failures across some browser engines.
3. **Fallback handling missing**:
   When `readCivitaiMetadata` fails on non-standard chunk keys (like SD.Next, InvokeAI, SwarmUI, NovelAI, or Fooocus), the fallback parser in `core/png.ts` fails to execute due to the `node:zlib` dependency.

### Solution & Action Steps
- [ ] In `core/png.ts`, replace `import zlib from 'node:zlib'` with `fflate` (`inflateSync` from `fflate` which is already a pure JS/Wasm browser dependency).
- [ ] In `core/civitai-extractor.ts` and `ExtractionContext.tsx`, ensure file buffers are strictly converted to `new Uint8Array(await file.arrayBuffer())`.
- [ ] Provide fallback parsing: If `readCivitaiMetadata` returns empty/null fields, inspect all PNG text chunks (`tEXt`, `zTXt`, `iTXt`) for `parameters`, `prompt`, `workflow`, `Comment`, or `Description`, then route through `parseA1111` or `parseComfyUI`.

---

## Issue 2: WebP Metadata Extraction Failing

### Root Cause
1. **EXIF / XMP chunk encoding nuances**:
   WebP files created by ComfyUI, Automatic1111, or SD-WebUI store generation parameters in either:
   - `EXIF` chunk (specifically tags `0x9286 UserComment`, `0x0110 Model`, or `0x010e ImageDescription`)
   - `XMP ` chunk (XML containing `<dc:description>` or `<exif:UserComment>`)
2. **Civitai parser omissions for WebP**:
   Civitai's detector may return `generator: null` if the WebP has non-standard EXIF offsets (e.g. 6-byte `Exif\0\0` header offset differences).
3. **Missing raw chunk extractor for WebP**:
   There is no lightweight pure-JS RIFF/WebP chunk scanner fallback when EXIF parsing fails.

### Solution & Action Steps
- [ ] In `core/civitai-extractor.ts`, inspect raw metadata returned in `md.exif`:
  - Check `exif.userComment`, `exif.UserComment`, `exif.description`, `exif.ImageDescription`, `exif.Model`.
  - Check if any string contains JSON (`{"prompt": ...}` or `{"class_type": ...}`) for ComfyUI or `Steps: ` for A1111/Forge.
- [ ] Add a pure-JS WebP RIFF chunk extractor (`readWebpChunks`) in `core/webp.ts` that iterates through RIFF chunks (`EXIF`, `XMP `), decodes UTF-8 strings, and runs them through the parameter parsers.

---

## Issue 3: Drag & Drop New Image on Extraction Result Page

### Root Cause
- `src/pages/ExtractionResultPage.tsx` does not have `dragover`, `dragleave`, or `drop` event listeners attached to the window or container. Users must navigate back to the home page to inspect another image.

### Solution & Action Steps
- [ ] In `src/pages/ExtractionResultPage.tsx`, attach drag-and-drop event listeners (`onDragOver`, `onDragLeave`, `onDrop`) with visual state (`isDraggingOver`).
- [ ] Render a semi-transparent drag overlay when an image is dragged over the viewport.
- [ ] On drop or manual file selection (via an added "Open Image" button in the result page header), call `extractFromFile(file)` from `useExtraction()` to update state in-place.

---

## Issue 4: Preview Image Cut Off on Extraction Result Page

### Root Cause
- The image preview container in `src/pages/ExtractionResultPage.tsx` uses fixed-height boundaries and/or `object-cover`, causing tall portrait aspect ratios (e.g., 832x1216, 512x1024) or wide landscapes to be cropped.

### Solution & Action Steps
- [ ] Change the preview image styling to `max-h-[70vh] w-full object-contain` with a clean checkerboard/neutral dark backdrop container (`bg-black/10 dark:bg-black/30 rounded-xl overflow-hidden flex items-center justify-center`).
- [ ] Add an aspect ratio indicator badge (e.g., `832 × 1216 (2:3)`).
- [ ] Add a 1-click Lightbox modal / zoom view so users can click the image to inspect it at full resolution or 1:1 pixel scale.

---

## Issue 5: Export Extraction Results Page as an Image

### Root Cause
- Currently, users can only copy text prompts or download JSON. There is no feature to export the extracted metadata card as an image/infographic for social sharing or archiving.

### Solution & Action Steps
- [ ] Use `html-to-image` (`toPng` or `toBlob`) to capture a designated share card element.
- [ ] Create a dedicated, beautifully styled export card component (or ref target) containing:
  - Thumbnail preview of the generated image
  - Positive prompt & negative prompt
  - Model name & Civitai badge / hash
  - Sampler parameters (Steps, Sampler, Schedule/Scheduler, CFG, Seed, Resolution)
  - LoRA list with trigger words and weights
  - PromptHound branding watermark
- [ ] Add an **"Export as Image"** button in the actions toolbar with:
  - Direct PNG download (`prompthound-[seed].png`)
  - "Copy Image to Clipboard" action (`navigator.clipboard.write([new ClipboardItem(...)])`).

---

## Execution Checklist

| Task | File(s) | Status |
|---|---|---|
| Replace `node:zlib` with `fflate` | `core/png.ts` | Pending |
| Add WebP chunk & EXIF fallback | `core/civitai-extractor.ts`, `core/webp.ts` | Pending |
| Drag & drop on result page | `src/pages/ExtractionResultPage.tsx` | Pending |
| Fix image preview cutoff + lightbox | `src/pages/ExtractionResultPage.tsx` | Pending |
| Export result card as PNG image | `src/pages/ExtractionResultPage.tsx`, `src/components/ExportCard.tsx` | Pending |
