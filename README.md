# PromptHound

> Universal AI Prompt & Metadata Extraction Utility for Windows Desktop (v1.0.15)

[![Release](https://img.shields.io/badge/Release-v1.0.15-F59A22?logo=github)](https://github.com/Kisaragi000/PromptHound/releases/tag/v1.0.15)
[![Repository](https://img.shields.io/badge/GitHub-PromptHound-F59A22?logo=github)](https://github.com/Kisaragi000/PromptHound)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

PromptHound is a desktop application crafted for AI artists, prompters, and creators. It extracts, normalizes, and visualizes generation recipes, positive/negative prompts, parameters (sampler, steps, CFG, seed, resolution), and LoRA weights embedded within AI-generated images or external links (Civitai, SeaArt, Local PNG/WebP files).

📦 **[Download Latest Release v1.0.15](https://github.com/Kisaragi000/PromptHound/releases/tag/v1.0.15)**

---

## 🎨 Visual Identity & Architecture

PromptHound is built with a bespoke **Dark Forest Glassmorphism** design system with amber accents (`#F59A22`), translucent panels (`rgba(24, 39, 19, 0.7)`), and precision typography (`Plus Jakarta Sans` & `JetBrains Mono`).

### Project Directory Structure

```text
PromptHound/
├── .github/                     # GitHub workflows and release automation
├── core/                        # Framework-agnostic parsing & resolution engine
│   ├── formatDetector.ts        # Heuristic detection for A1111, ComfyUI, Civitai, SeaArt
│   ├── parser.ts                # Metadata normalization and regex chunk extraction
│   ├── loraResolver.ts          # Civitai & remote LoRA lookup & metadata enrichment
│   ├── types.ts                 # Shared TypeScript domain contracts
│   └── README.md                # Core package architectural notes
├── docs/                        # Complete design & specification documents
│   ├── BLUEPRINT.md             # Engineering roadmap & Phase 1 requirements
│   ├── UI_SPEC.md               # Visual design tokens & interface specifications
│   ├── PROJECT_STATE.md         # Current status & milestones checklist
│   └── HANDOFF_NOTES.md         # Handoff notes & architectural overview
├── electron/                    # Electron Windows Desktop shell
│   ├── main.ts                  # Main process: native menus, IPC handlers, window controls
│   ├── preload.ts               # Secure contextBridge API for IPC communication
│   └── tsconfig.json            # Electron TypeScript build config
├── scripts/                     # Tooling & dev runners
│   └── dev.mjs                  # Development orchestrator (tsc + vite + electron)
├── src/                         # React UI (Vite + TypeScript)
│   ├── components/
│   │   ├── icons/Icons.tsx      # Inline vector icons (Hound mark, window controls, etc.)
│   │   ├── home/                # Batch extraction queue & recent extractions strip
│   │   ├── setup/               # 4-step setup & install wizard
│   │   ├── recipe/              # Prompt format selector & interactive LoRA mixer
│   │   ├── library/             # Side-by-side prompt difference modal
│   │   ├── primitives/          # Atomic UI components
│   │   │   ├── GlassPanel.tsx
│   │   │   ├── GlassCard.tsx
│   │   │   ├── PrimaryButton.tsx
│   │   │   ├── SecondaryButton.tsx
│   │   │   ├── IconButton.tsx
│   │   │   ├── GlassInput.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── EmptyStatePanel.tsx
│   │   └── shell/               # App layout & frame components
│   │       ├── AppShell.tsx     # Framing container with radial gradient backdrop
│   │       ├── TitleBar.tsx     # Custom frameless title bar with drag region & status
│   │       └── Sidebar.tsx      # Navigation rail with route buttons and utility card
│   ├── navigation/
│   │   ├── NavigationContext.tsx# Route management and state sharing
│   │   └── RouteView.tsx        # View switcher
│   ├── pages/
│   │   ├── HomePage.tsx         # Batch queue, Paste URL, Drag & Drop, Library hero
│   │   ├── ExtractionResultPage.tsx # 3-zone metadata inspection, LoRA mixer, format converter
│   │   ├── PromptLibraryPage.tsx    # Folder rail, grid/table view, diff modal, detail pane
│   │   ├── VisualArchivePage.tsx    # Canvas visual archive compiler
│   │   ├── FavoritesPage.tsx        # Starred prompt bookmarker
│   │   ├── SettingsPage.tsx         # Automation, API key & storage configurations
│   │   └── AboutPage.tsx            # Version specifications & software credits
│   ├── styles/
│   │   ├── tokens.css           # Design tokens (colors, spacing, typography, radii)
│   │   └── global.css           # Global resets and scrollbar styling
│   ├── types/
│   │   └── global.d.ts          # Window.promptHound Electron bridge types
│   ├── App.tsx                  # Root React component
│   ├── index.css                # Tailwind + global styles entry
│   └── main.tsx                 # DOM entry point
├── index.html                   # HTML entry point with Plus Jakarta Sans font imports
├── metadata.json                # Project descriptor
├── package.json                 # Dependencies & build scripts
├── tsconfig.json                # TypeScript project configuration
└── vite.config.ts               # Vite bundler configuration
```

---

## 🆕 What's New in 1.0.15

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

1. **Batch Extraction Queue (10-File Limit)**:
   - Drag & drop or browse up to 10 images concurrently.
   - Individual status cards showing progress spinner, success checkmarks, extracted model, and LoRA counts.
   - 1-click **"Save All Extracted to Library"** and click-to-inspect.

2. **First-Run Install & Configuration Wizard**:
   - 4-step wizard for configuring workflow profile (A1111/Forge, ComfyUI, SD.Next, Fooocus), model directories, Civitai API key, and shell context menu integration.

3. **LoRA Mixer & Trigger Words Copier**:
   - Live weight sliders ($0.00$ – $2.00$), trigger word toggles, and instant stack copying.

4. **Prompt Syntax Transformer**:
   - Instant 1-click conversion between Automatic1111/Forge syntax (`<lora:name:0.8>`), ComfyUI node clip text, and Clean Plaintext.

5. **Prompt Library with Diffing & Dual View**:
   - Visual card grid and compact table view.
   - Side-by-side prompt diffing with parameter comparison.

6. **Visual Archive Compiler**:
   - Dynamic HTML5 Canvas rendering composite recipe sheet for export and archival.
   - **Prompt Library**: 3-column layout (Folder Rail with count badges, Fluid Prompt Cards Grid with favorite toggles, and Selected Prompt Detail Pane).
   - **Visual Archive Compiler**: Dynamic HTML5 Canvas generator rendering high-resolution composite record sheets embedding prompt, parameters, seed, and LoRAs into an exportable PNG.
   - **Favorites & Preferences**: Starred prompts organizer, settings panel with Civitai API key entry and storage directories, and About screen.

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

**Web Preview Mode:**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

**Electron Desktop App:**
```bash
npm run electron:dev
```
Or use the development runner:
```bash
node scripts/dev.mjs
```

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
