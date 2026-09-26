# Changelog

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
