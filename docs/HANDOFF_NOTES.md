# HANDOFF_NOTES.md

Comprehensive handoff for PromptHound.

## 1. Executive Summary

**PromptHound** is an AI Prompt & Metadata Extractor for AI-generated images — a Windows desktop app (Electron + React + TypeScript) that extracts prompts, generation settings, models, and LoRAs (with strength values) from images sourced via pasted links, local files, or clipboard. It resolves LoRA hashes/filenames into named, linked models (Civitai/SeaArt), lets the user save prompts into a personal folder-organized library, and compiles standardized "visual archive" images.

## 2. Key Architecture & Design Decisions

1. **Desktop App (Electron + React) & Web-Preview Compatibility**:
   - The UI is designed to run gracefully both inside Electron with native file access and in browser environments with full responsive preview.
2. **Framework-Agnostic `/core` Package**:
   - Format detection (A1111, ComfyUI, Civitai, SeaArt), link fetching, PNG/EXIF parsing, and LoRA resolution live in `/core` with no DOM or Electron dependencies.
3. **Design System & Tokens**:
   - Translucent dark glassmorphism (`#071006` base, `#182713` glass, `#F59A22` amber accents, `#4F5928` olive highlights).
   - Strict adherence to typography, spacing, and contrast standards.

## 3. GitHub Target

Repository: `https://github.com/Kisaragi000/PromptHound`
