# PromptHound

> Universal AI Prompt & Metadata Extraction Utility for Windows Desktop (v1.0.4)

[![Release](https://img.shields.io/badge/Release-v1.0.4-F59A22?logo=github)](https://github.com/Kisaragi000/PromptHound/releases/tag/v1.0.4)
[![Repository](https://img.shields.io/badge/GitHub-PromptHound-F59A22?logo=github)](https://github.com/Kisaragi000/PromptHound)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

PromptHound is a desktop application crafted for AI artists, prompters, and creators. It extracts, normalizes, and visualizes generation recipes, positive/negative prompts, parameters (sampler, steps, CFG, seed, resolution), and LoRA weights embedded within AI-generated images or external links (Civitai, SeaArt, Local PNG/WebP files).

📦 **[Download Latest Release v1.0.4](https://github.com/Kisaragi000/PromptHound/releases/tag/v1.0.4)**

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

## ⚡ Features in Version 1.0.4

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

`core/data/lora-seed.json` is the catalog PromptHound uses to identify LoRAs without a network connection. It is generated from Civitai's public API; never edit hashes, ids or trigger words by hand.

```bash
# Check the current catalog against Civitai (writes nothing; exits 1 on mismatches)
npm run catalog:verify

# Rebuild it: the 2,000 most-downloaded LoRA / LoCon / DoRA models, 3 versions each,
# plus every version listed in scripts/catalog-includes.json
CIVITAI_API_KEY=... npm run catalog:build -- --models 2000 --versions 3
```

Useful options: `--dry-run` (report only), `--extra file.json` (merge hand-made records, e.g. private models), `--all-covers` (keep cover images of any rating; PG-rated only by default). See the header of `scripts/build-lora-catalog.ts` for the full list. The desktop app replaces its stored copy of the catalog automatically when the bundled file changes; LoRAs users found or linked themselves are kept.

---

## 📄 License
MIT License. Created for the AI art community.
