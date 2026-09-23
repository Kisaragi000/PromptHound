# BLUEPRINT.md
## AI Prompt & Metadata Extractor — Phase 1
### (Windows Desktop App)

---

## 1. App Overview & Core Problem

AI-generated images from platforms like Civitai, SeaArt, and local tools (Automatic1111/Stable Diffusion WebUI, ComfyUI) carry rich generation metadata — prompts, negative prompts, sampler settings, model checkpoint, and LoRAs with their strength values. This data is inconsistently accessible:

- Sometimes it's displayed openly on the hosting page.
- Sometimes it's hidden and only exists embedded inside the image file itself (PNG text chunks or JSON workflow blobs).
- LoRAs are frequently referenced only by filename or hash, with no human-readable link back to the source model.
- Prompts and settings can be long and detail-heavy, needing real screen space to browse comfortably.

**Core problem:** there is no single, frictionless tool that extracts and normalizes this metadata regardless of where the image came from (a pasted link, a local file, or the clipboard) or how its data is stored, gives it enough room to actually browse and compare, and resolves opaque LoRA references into identifiable, linked models.

---

## 2. Target User & Use Cases

**Primary user:** A small group of AI artists/hobbyists who regularly browse, save, and remix AI-generated images and need to reverse-engineer how an image was made.

**Core use cases:**
1. Copying a link while browsing Civitai/SeaArt — either the post/gallery page URL or a direct image file URL — and pasting it into the app to fetch and extract the generation recipe.
2. Having a folder of previously downloaded images (own generations or saved from elsewhere) and dragging them into the app to inspect embedded metadata.
3. Pasting an image from the clipboard/a screenshot to extract metadata.
4. Encountering images from *other* platforms or local generation tools, not just Civitai/SeaArt — the tool should be format-agnostic, not site-locked.
5. Seeing a LoRA referenced only by hash/filename and getting it resolved to its actual name and source page (Civitai or SeaArt).
6. Building a personal, organized library of prompts (grouped into folders) and compiled "visual guide" images for future reuse and style reference.

---

## 3. Initial Feature List (Phase 1)

| # | Feature | Notes |
|---|---------|-------|
| 1 | Paste-a-link input | Accepts either a post/gallery page URL or a direct image file URL; app auto-detects which kind it received and handles accordingly |
| 2 | Drag-and-drop / file-picker import of local image files | Covers offline/downloaded images and locally generated images |
| 3 | Clipboard paste support | Paste a copied image/screenshot directly into the app |
| 4 | Format auto-detection engine | Detects and parses: A1111/SD WebUI (PNG tEXt), ComfyUI (embedded JSON workflow), and Civitai/SeaArt page-displayed JSON — without the user specifying which |
| 5 | Structured metadata display | Prompt, negative prompt, sampler, steps, CFG scale, seed, checkpoint/model, resolution, and LoRA list with strengths — read-only, on-screen, copyable, with full window space to work with |
| 6 | LoRA resolution via Civitai/SeaArt | Resolves hash/filename references to LoRA name + link to its seaart.ai or civitai model page (falls back to raw value if lookup fails) |
| 7 | Copy-to-clipboard per field and "copy all as text" | Fast reuse of extracted prompt elsewhere |
| 8 | Saved-prompts library | Save an extracted prompt + all settings in text form; browse via user-created groups/folders; export any saved prompt to a file |
| 9 | Compiled "visual archive" image | One-click compile of a fixed-layout image: original generated image on one side, prompt/model/LoRAs/settings on the other; saves to disk as PNG/JPG |

**Explicitly out of scope for Phase 1** (future phases): handling anti-bot-protected sites (headless-browser fetching), tags/auto-grouping/search for the library, multiple archive-image layout templates, direct re-injection into ComfyUI/A1111, OS-level clipboard monitoring, automatic folder watching, multi-user/cloud sync, macOS/Linux builds.

### Core User Flow (Phase 1)
```
Image source
   │
   ├─ Paste a link ──────► App detects: page URL or direct image URL?
   │                              │
   │                    ┌─────────┴─────────┐
   │                    ▼                   ▼
   │            Page URL: fetch      Direct image URL:
   │            HTML, locate image   fetch image bytes
   │            + any page-JSON      directly
   │                    │                   │
   │                    └─────────┬─────────┘
   │                              ▼
   ├─ Drag & drop local file ──►  │
   │                              │
   └─ Paste from clipboard ────►  │
                                  ▼
                    Format auto-detection
        (A1111 PNG tEXt / ComfyUI JSON / Civitai-SeaArt page JSON)
                                  │
                                  ▼
                    Parse → normalize into common schema
                                  │
                                  ▼
                LoRA hash/filename → Civitai/SeaArt lookup (async)
                                  │
                                  ▼
                Render structured, copyable results panel
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                  ▼
       "Save prompt" → stored into          "Compile" → renders fixed-
       a user-chosen group/folder            layout archive image →
       in the local library                  saves as PNG/JPG
```

---

## 4. Recommended Tech Stack & Architectural Approach

### Platform decision: Windows Desktop App (Electron) — sole platform
The browser extension has been dropped. All capture paths — pasted links, local files, and clipboard — are handled natively inside the desktop app, which also gives the prompt/settings library and compile tool the screen space they need. This simplifies the architecture considerably: no export/import bundle format, no cross-process communication, one codebase.

### Stack

| Layer | Choice | Why |
|---|---|---|
| App shell | **Electron** | Full Node.js access (file system, native `fetch`/`https` with no CORS restriction) needed for link fetching; mature, heavily documented, lowest-risk ecosystem for a small build |
| UI | React + Vite | Fast dev loop; full-window layout comfortably fits the results panel, library browser, and compile tool |
| Language | TypeScript | Type safety for parsing binary formats and multiple metadata schemas; strong ecosystem support |
| Link handling | URL-shape detection (page vs. direct image) → HTML fetch + parse (`cheerio` or similar) for page URLs, direct `fetch` for image URLs | A page URL needs its HTML scanned for the image element and any embedded generation-JSON; a direct image URL just needs its bytes. Plain HTTP fetch is sufficient for Phase 1 — no headless browser/anti-bot handling yet, so some protected pages may fail to fetch (acceptable trade-off for now) |
| Image metadata parsing | `exifr` (handles PNG tEXt/iTXt + EXIF) + a small custom PNG-chunk parser for ComfyUI's embedded JSON workflow chunk | `exifr` is fast and well-maintained and already covers the common Stable-Diffusion metadata convention; the thin custom layer handles ComfyUI's specific chunk key |
| LoRA resolution | Civitai public REST API (`/api/v1/model-versions/by-hash/{hash}`) as the primary source; SeaArt lookup added if/when an equivalent public endpoint is confirmed to exist | Civitai's by-hash API is documented and known-working; SeaArt does not have a confirmed public equivalent yet — needs investigation during build. Fall back gracefully to "unresolved" for anything that can't be matched on either |
| Image compositing | HTML5 `<canvas>` (native, no library needed) | Renders the fixed-layout archive image — draws the source image, then overlays prompt/model/LoRA/settings text — exported via `canvas.toBlob()` |
| Persistence | Local filesystem + a lightweight embedded store (`better-sqlite3`, or a simple JSON-file store if querying needs stay basic) | Stores the saved-prompt library (text + settings + group/folder structure) fully locally, no account/server required |
| Build/tooling | Vite + `electron-builder` | Modern, fast dev loop and straightforward Windows packaging (installer/exe) |

### Architecture principle
Keep parsing/business logic separate from the UI from day one, even within a single app:
```
/core   — pure TypeScript, no Electron/DOM dependency:
          link-type detection, page/image fetching, format detection,
          PNG/EXIF parsing, normalization, Civitai/SeaArt lookup client
/app    — Electron + React: results panel, library, compile tool,
          consumes /core only, owns persistence and the UI
```
This keeps the extraction logic independently testable and leaves the door open for a future macOS/Linux build or a lightweight companion browser extension later, without needing to untangle logic from UI first.

---

## 5. Development Roadmap — Phase 1

**Step 1 — Core parsing library**
Build the format-agnostic `/core` package: PNG chunk reader, A1111 tEXt parser, ComfyUI JSON-workflow parser, and a normalized output schema (prompt, negative prompt, sampler, steps, CFG, seed, model, LoRAs[]).

**Step 2 — Format auto-detection**
Implement detection logic that inspects raw bytes/chunks and picks the correct parser without user input; define a safe "unknown format" fallback state.

**Step 3 — Link handling**
Implement URL-shape detection (page vs. direct image link); build the page-URL path (fetch HTML, locate the image + any embedded generation-JSON) and the direct-image-URL path (fetch bytes directly); handle fetch failures gracefully.

**Step 4 — Civitai/SeaArt page-JSON adapters**
Add adapters that read openly-displayed generation JSON directly from these sites' pages when present, merging it with file-embedded data as a fallback/cross-check.

**Step 5 — LoRA resolution**
Integrate the Civitai lookup client (confirmed working API); research whether SeaArt has an equivalent public lookup endpoint and add it if so; implement graceful fallback display when a LoRA can't be resolved on either.

**Step 6 — App shell & results panel**
Set up the Electron + React project; build the structured, copyable results panel consuming `/core`; wire up the paste-a-link input, drag-and-drop file import, and clipboard paste.

**Step 7 — Saved-prompts library**
Implement local persistence (SQLite or JSON store): save extracted prompt + settings as text, user-created groups/folders for browsing, and per-prompt export-to-file.

**Step 8 — Compiled visual-archive image**
Build the canvas-based compile pipeline: fixed layout (image one side, prompt/model/LoRAs/settings the other), rendered from the same normalized data used in the results panel, saved to disk as PNG/JPG.

**Step 9 — Internal testing & hardening**
Test against a real sample set (A1111 outputs, ComfyUI outputs, Civitai page links, SeaArt page links, direct image links, local files) with your small user group; fix format and link-fetching edge cases before wider use.

**Step 10 — Windows installer (confirmed requirement)**
The distributable must be a standard `.exe` installer with a multi-step wizard: Welcome → choose install folder → install progress → finish, using Next/Back/Cancel — not a silent one-click installer, so non-technical users get a familiar install experience. The wizard should be visually branded to match the app (icon, header banner, welcome/finish page art in the app's palette), not the default plain NSIS look. Implemented via `electron-builder`'s NSIS target with `oneClick: false`.

---

*This blueprint covers Phase 1 only. Anti-bot-resilient fetching (headless browser), library tags/search, multiple archive layouts, direct re-injection into ComfyUI/A1111, and cross-platform builds are natural, additive next phases once the core app is proven.*
