# `/core`

Framework-agnostic TypeScript package with no Electron or DOM dependency.
Consumed identically by the Electron main process and the web frontend.

Per `docs/BLUEPRINT.md` §4, this package owns:

- Link-type detection (page URL vs. direct image URL) and fetching
- Format auto-detection (A1111 PNG `tEXt`, ComfyUI embedded JSON workflow,
  Civitai/SeaArt page-displayed JSON)
- PNG chunk / EXIF metadata parsing
- Normalization into the shared `ExtractedMetadata` schema
  (`docs/UI_SPEC.md` §6)
- Civitai/SeaArt LoRA hash/filename resolution
