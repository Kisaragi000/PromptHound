# PROJECT_STATE.md

Quick-reference status snapshot. For full context, architecture rationale,
and codebase walkthrough, see [`HANDOFF_NOTES.md`](HANDOFF_NOTES.md) in
this same `docs/` folder.

## Current phase

**Phase 1 (MVP) — Step 2 of 4 complete**, plus stabilization and installer-branding work.

| Step | Status | Summary |
|---|---|---|
| 1. Project Scaffolding & Configuration | ✅ Done | Electron + Vite + React + TS pipeline, IPC window controls, dev/build/package scripts |
| 2. Global UI Layout | ✅ Done | AppShell, TitleBar, Sidebar, router, primitives, all 7 pages routed |
| Installer branding (ad hoc) | ✅ Done | Multi-step branded NSIS wizard |
| 3. Core Extraction Logic | 🔄 In Progress | `/core` package: format detection, parsing, link fetching, LoRA resolution |
| 4. Library, Archive & Persistence | 🔄 In Progress | SQLite/local-store backed library, canvas compile pipeline, Home page wired to real data |

## Repository Structure & GitHub Target

- Target Repository: `https://github.com/Kisaragi000/PromptHound`
- Structure conforms to desktop-first Electron + React app with framework-agnostic `/core` parser engine.
