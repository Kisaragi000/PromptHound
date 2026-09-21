# PromptHound

> Universal AI Prompt & Metadata Extraction Utility for Windows Desktop (Phase 1)

[![Repository](https://img.shields.io/badge/GitHub-PromptHound-F59A22?logo=github)](https://github.com/Kisaragi000/PromptHound)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

PromptHound is a desktop application crafted for AI artists, prompters, and creators. It extracts, normalizes, and visualizes generation recipes, positive/negative prompts, parameters (sampler, steps, CFG, seed, resolution), and LoRA weights embedded within AI-generated images or external links (Civitai, SeaArt, Local PNG/WebP files).

---

## 🎨 Visual Identity & Architecture

PromptHound is built with a bespoke **Dark Forest Glassmorphism** design system with amber accents (`#F59A22`), translucent panels (`rgba(24, 39, 19, 0.7)`), and precision typography (`Plus Jakarta Sans` & `JetBrains Mono`).

### Project Directory Structure

```text
PromptHound/
├── .github/                     # GitHub workflows and issue templates
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
│   │   ├── HomePage.tsx         # Paste URL, Drag & Drop, Check Library hero cards
│   │   ├── ExtractionResultPage.tsx # 3-zone metadata inspection & copy workspace
│   │   ├── PromptLibraryPage.tsx    # 3-column folder rail, prompt card grid, detail pane
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

## ⚡ Features Implemented in Phase 1

1. **Format Detection & Parsing (`/core`)**:
   - Supports Automatic1111 (PNG `tEXt` parameter blocks).
   - Supports ComfyUI prompt graphs and nodes.
   - Supports Civitai and SeaArt page link resolution.
   - LoRA weight extractor (`<lora:name:weight>` regex and ComfyUI node parsing).

2. **Custom Frameless Electron Shell (`/electron`)**:
   - Frameless Windows desktop app window with custom draggable titlebar.
   - Custom minimize, maximize, and close window controls via IPC `contextBridge`.
   - Native file dialog hooks for image loading and JSON/TXT/PNG exports.

3. **Pixel-Perfect React Desktop Frontend (`/src`)**:
   - **Home Screen**: 3 primary action cards (Paste URL with modal, Drag & Drop with dropzone, Check Library) and 4-item capability strip.
   - **Extraction Result Screen**: 3-zone workspace (Original image preview with aspect ratio preservation, Center tabs for Prompt, Negative Prompt, 4-metric Generation Grid, and Attached LoRAs, Right side panels for Source Platform, Resolved Civitai LoRAs, and Quick Actions).
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

---

## 📄 License
MIT License. Created for the AI art community.
