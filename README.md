# PromptHound

> Universal AI Prompt & Metadata Extraction Utility for Windows Desktop (v1.0.16)

[![Release](https://img.shields.io/badge/Release-v1.0.16-F59A22?logo=github)](https://github.com/Kisaragi000/PromptHound/releases/tag/v1.0.16)
[![Repository](https://img.shields.io/badge/GitHub-PromptHound-F59A22?logo=github)](https://github.com/Kisaragi000/PromptHound)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

PromptHound is a desktop application crafted for AI artists, prompters, and creators. It extracts, normalizes, and visualizes generation recipes, positive/negative prompts, parameters (sampler, steps, CFG, seed, resolution), and LoRA weights embedded within AI-generated images or external links (Civitai, SeaArt, Local PNG/WebP files).

📦 **[Download Latest Release v1.0.16](https://github.com/Kisaragi000/PromptHound/releases/tag/v1.0.16)**

---

## 🎨 Visual Identity & Architecture

PromptHound is built with a bespoke **Dark Forest Glassmorphism** design system with amber accents (`#F59A22`), translucent panels (`rgba(24, 39, 19, 0.7)`), and precision typography (`Plus Jakarta Sans` & `JetBrains Mono`).

### Project Directory Structure

```text
PromptHound/
├── .github/workflows/           # ci.yml (typecheck, tests, build) and release.yml (Windows installer)
├── build/                       # Installer artwork, icon and NSIS script (installer.nsh)
├── core/                        # Extraction engine shared by the app and the main process
│   ├── link-fetch.ts            # Entry points: extract from image bytes or a link
│   ├── png.ts, jpeg.ts, webp.ts # Metadata chunk readers
│   ├── format-detect.ts         # A1111 / ComfyUI / NovelAI / SwarmUI detection
│   ├── parsers/                 # A1111 settings parser and ComfyUI graph tracing
│   ├── civitai-extractor.ts     # Civitai generation-metadata engine, merged with the native readers
│   ├── content-credentials.ts   # C2PA / IPTC "AI-generated" labels (ChatGPT, Gemini, ...)
│   ├── lora-resolution.ts       # LoRA and checkpoint identification (catalog, then Civitai)
│   ├── lora-cache.ts            # In-memory and SQLite catalog of known models
│   ├── seaart.ts                # SeaArt search links
│   └── data/                    # Generated offline catalog (see below)
├── docs/                        # Blueprint, UI spec and archived planning notes
├── electron/
│   ├── main.ts                  # Window, IPC, SQLite library, updates, file dialogs
│   ├── shell-integration.ts     # Explorer right-click menu and opening files from it
│   └── preload.ts               # window.promptHound bridge for the UI
├── public/samples/              # Example images shown in a new Prompt Library
├── scripts/                     # Dev runner, catalog builder, LoRA benchmark
├── src/                         # React UI (Vite + TypeScript)
│   ├── components/              # Shell, primitives, library, LoRA cards, recipe panels, setup wizard
│   ├── extraction/              # Extraction state (single images and batches)
│   ├── navigation/              # Routing and the Prompt Library state
│   ├── pages/                   # Home, Result, Library, Favorites, Settings, About
│   └── utils/                   # Images, library backup and search, paste handling
└── tests/                       # npm test: extraction, search, backup and link tests
```

---

## 🆕 What's New in 1.0.16

- **Up to 5 images per prompt**: add images in New Prompt (drop, paste or browse) or later with "Edit images" in the Library. Cards and the detail pane show ‹ › arrows and dots; click the image for a full-size view.
- **New Prompt fills itself in**: if an added image has generation data, empty fields (title, prompt, model, sampler, steps) are filled from it.
- **Images are kept as files** in the app's data folder (original + thumbnail), so large libraries stay fast.
- **Themed dropdowns** for folders and settings instead of the Windows list.

### 1.0.15

- **ChatGPT, Gemini and other AI services**: their images store no prompt, but they carry a Content Credentials (C2PA) or IPTC label. PromptHound now reads it and shows "Confirmed AI-generated image — Made with ChatGPT (OpenAI)" (or Google Gemini, Adobe Firefly, Microsoft, Meta…) with the model, date and signer, instead of "Could not extract metadata".

### 1.0.14

- **Prompt Library folders**: in Edit Library, click a folder to rename or delete it. Deleting asks first and keeps the prompts (they stay in All Prompts).
- **Fixed**: "Launch PromptHound" on the installer's last page was invisible (black on dark).

### 1.0.13

- **Save to Library** turns green with a check once saved; clicking it again opens the saved item instead of saving a duplicate.
- Saved items get a title from the first descriptive prompt tag instead of "score_9" or "masterpiece".
- **Fixed**: library previews shrank once the grid filled up; text overflowing in Recent Recipes, the Settings key badge and the platform list; button icons sitting above their labels.

### 1.0.12

- **Automatic updates**: new versions download in the background and replace the installed one when you restart (installer version; from 1.0.12 on).
- **Redesigned installer** with a welcome and finish page; installing over an older version replaces it.
- **Fixed**: the saved image card showed black boxes instead of dropped images; dropping a working image after a failed one kept showing the error; library items saved from dropped images lost their preview after a restart; empty space on the right of Favorites.
- **Previews** in the Prompt Library and Favorites use one frame and show the whole image.

### 1.0.11

- **Image card**: "Save Image Card" now shows the base model and every LoRA with its preview image, version, base model and weight, laid out to suit wide and tall images.

### 1.0.10

- **Prompt Library**: Edit Library can move selected items to an existing or a new folder.
- **Favorites**: first click previews a favorite in a side pane, a second click opens it (like the Prompt Library).
- **Fixed**: Esc closes the full-size image view; the saved image card and LoRA trigger chips use the current color theme.

### 1.0.9

- **Base model card**: the checkpoint is identified like the LoRAs (hash, Civitai id, name) and shown with a preview image, version and base model.
- **Fixed**: dropping an image after viewing a library item showed the library item instead of the new result.

### 1.0.8

- **More reliable extraction** from PNG, JPEG and WebP (A1111 / Forge, ComfyUI, SwarmUI, Civitai on-site images), with ComfyUI graph tracing rebuilt.
- **Accurate LoRA identification**: hashes, Civitai version ids and AIR ids first, name matching only as a labeled fallback; no more LoRAs invented from prompt words.
- **Real offline LoRA catalog** generated from Civitai (top 10,000 models), plus a persistent cache of LoRAs you look up or link.
- **Example images** in the Prompt Library on first launch.

See [CHANGELOG.md](CHANGELOG.md) for details.

## ⚡ Features

1. **Extract from anything**: drop or browse up to 10 images, paste with Ctrl+V, paste a Civitai / SeaArt / image link, or right-click an image in Windows Explorer and choose **Extract with PromptHound** (Settings > Windows Integration). Pasting an image copied in a browser fetches the original file, so the prompt is kept.
2. **Formats**: A1111 / Forge, ComfyUI (graph tracing), SwarmUI, Fooocus, NovelAI and Civitai on-site images in PNG, JPEG and WebP, plus Content Credentials labels from ChatGPT, Gemini, Firefly and others.
3. **LoRA and checkpoint identification**: hashes, Civitai version ids and AIR ids against an offline catalog of the top 10,000 models, then Civitai; every LoRA also links to a SeaArt search.
4. **LoRA mixer and prompt formats**: weight sliders, trigger word chips, and conversion between A1111 syntax, ComfyUI text and plain text.
5. **Prompt Library**: folders, favorites, up to 5 images per prompt, grid and table views, side-by-side diff, search across prompts, models and LoRAs (`"phrase"`, `-word`) with model and LoRA filters.
6. **Library backup**: Settings > Prompt Library Backup exports everything to one .zip and imports it on this or another PC.
7. **Image card**: a shareable PNG of the image with its prompt, settings, base model and LoRAs.
8. **Automatic updates** for the installed version.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Node 20 or 22 recommended)
- npm or yarn

### Installation
```bash
git clone https://github.com/Kisaragi000/PromptHound.git
cd PromptHound
npm install
```

### Running in Development

**Desktop app** (Vite, the Electron main process and Electron together):
```bash
node scripts/dev.mjs
```

**Web preview** (the UI in a browser; no file access, Explorer menu or encrypted settings):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

**Windows installer**: `npm run package:win` (on Windows). Releases are built by `.github/workflows/release.yml` from a `v*` tag.

### Checks

```bash
npm run lint   # typecheck the UI, core and Electron main process
npm test       # extraction, library search, backup and link tests (offline)
```

CI runs both, plus `npm run build`, on every push and pull request.

### Rebuilding the Offline LoRA Catalog

PromptHound identifies LoRAs offline from two generated files; never edit their hashes, ids or trigger words by hand:

- `core/data/lora-seed.json`: full records (name, trigger words, cover, SHA256 and AutoV3 hashes) for the 2,000 most-downloaded LoRA / LoCon / DoRA models, 3 versions each, plus the versions in `scripts/catalog-includes.json`.
- `core/data/lora-version-index.json`: a compact index (ids, names, AutoV2 and AutoV3 hash prefixes) of every other version of those models and of the next 8,000 models.

```bash
# Check the catalog against Civitai (writes nothing; exits 1 on mismatches)
npm run catalog:verify

# Rebuild both files
CIVITAI_API_KEY=... npm run catalog:build -- --models 2000 --versions 3 --compact-models 10000
```

Useful options: `--dry-run`, `--extra file.json` (merge hand-made records), `--all-covers` (covers of any rating; PG only by default). See the header of `scripts/build-lora-catalog.ts`. The desktop app replaces its stored copy of the catalog automatically when the bundled file changes; LoRAs users found or linked themselves are kept.

### Measuring LoRA Identification

```bash
CIVITAI_API_KEY=... npm run benchmark:collect    # ~360 real Civitai images + ground truth into .benchmark/
npm run benchmark:eval -- offline                # bundled catalog only
CIVITAI_API_KEY=... npm run benchmark:eval -- online
```

In a sandbox whose proxy Node does not pick up automatically, prefix the commands with `NODE_USE_ENV_PROXY=1`.

---

## 📄 License
MIT License. Created for the AI art community.
