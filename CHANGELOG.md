# Changelog

## v1.0.10

### Prompt Library and Favorites
- Edit Library: select items and move them to an existing folder or a new one
  (Move to folder… → + New folder…).
- Favorites work like the Prompt Library: the first click previews a favorite in a
  side pane (image, prompt, settings, LoRAs), a second click or a double-click opens
  the full result.

### Fixed
- Esc closes the full-size image view, as its close button says.
- The saved image card ("Save Image Card") and the LoRA trigger-word chips still used
  the old green theme; both now use the current blue-black palette.
- The image card shows the generator name (e.g. "A1111 / Forge", "ComfyUI") instead of
  "UNKNOWN", and hides the badge when the generator is unknown.
- The About page names the current theme.

## v1.0.9

### Fixed
- Dropping an image after opening a Prompt Library, Favorites or Recent item showed
  that saved item instead of the new extraction; it only corrected itself after a
  second image. Every new extraction now leaves the saved-item view.
- LoRA re-link / unlink edits no longer carry over to the next image, and they are
  kept when saving to the library.
- "Open Image" on the result page in the desktop app now extracts the chosen file.

### Base model card
- The checkpoint is identified the same way as LoRAs (file hash, Civitai version id,
  AIR id, then name) and shown in a card with a preview image, version, base model and
  how it was matched.
- The offline catalog now also covers the 1,000 most-downloaded checkpoints. On 308
  real Civitai images the base model was identified in 96% of cases online and 80%
  offline.
- Cover images are loaded as small thumbnails instead of full-size originals (about
  100 KB instead of several MB), with an icon when a preview cannot be loaded.

## v1.0.8

### Prompt extraction
- PromptHound's own PNG / WebP / JPEG readers now run alongside Civitai's metadata
  engine, and the results are merged field by field instead of keeping whichever
  parser answered first.
- ComfyUI: rewritten graph tracing. Prompts are found through text, primitive,
  concatenate and wildcard nodes and through ControlNet / guidance / area nodes; the
  sampler that produced the saved image is reported (base pass for hires fix);
  SamplerCustom(Advanced), Flux guidance, Efficient Loader, rgthree / CR / Efficiency /
  Easy-Use LoRA loaders, bypassed and muted nodes and workflow-only images are handled.
- EXIF text (JPEG / WebP) is decoded by its declared charset, including UTF-16 and
  Windows XPComment; SwarmUI images now extract, with their LoRA weights and hashes.
- Civitai on-site images: the checkpoint and every LoRA are read from
  "Civitai resources"; `<lora:>` tags and resource entries are no longer duplicated.
- `<lyco:>` tags, A1111 sampler labels for internal sampler ids, clean prompts without
  leftover commas.

### LoRA identification
- No more invented LoRAs from prompt words (e.g. "highly detailed" was reported as a
  Detail Tweaker LoRA).
- Exact identifiers first: file hash (SHA256 or AutoV3, as written by A1111), Civitai
  version id, and Civitai AIR ids (`urn:air:...:civitai:MODEL@VERSION`); name matching
  only as a fallback. Each LoRA card shows how it was matched.
- LyCORIS (LoCon) and DoRA models are included in searches.
- New offline catalog generated from Civitai: 2,000 models with full details plus a
  compact index covering every version of the top 10,000 models. The old catalog was
  largely incorrect (wrong ids, invented hashes and trigger words).
- Found and linked LoRAs are saved and reused across sessions, in both the window and
  the background extraction process; the Civitai API key now applies to both.
- Measured on 361 real Civitai images (678 LoRAs): 99.6% identified online, 80%
  offline; every hash-verified match correct.

### Prompt Library
- Four real example images with their actual settings replace the placeholder samples.

### Developer
- `npm run catalog:build` / `catalog:verify` to regenerate and check the offline catalog.
- `npm run benchmark:collect` / `benchmark:eval` to measure LoRA identification.
