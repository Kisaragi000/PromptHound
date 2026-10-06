# Changelog

## Unreleased

### New
- **Explorer right-click menu**: "Extract with PromptHound" on PNG, JPEG, WebP and AVIF
  files (Settings > Windows Integration, or the setup wizard). Images opened from it go
  to the running window; selecting several opens them as one batch.
- **Library backup**: Settings > Prompt Library Backup exports every prompt, folder,
  favorite and image to one .zip, and imports one on this or another PC. Prompts already
  in the library are kept as they are.
- **Paste keeps the prompt**: pasting an image copied in a browser fetches the original
  file (Civitai's resized copies are swapped for the original upload). Pasting an image
  link or an Explorer "Copy as path" path opens it too.
- **Library search** matches every word across title, prompts, model, LoRAs and trigger
  words, sampler and folder; `"phrases"` and `-word` work. New model and LoRA filters.
- **SeaArt links**: every LoRA card and the LoRA details dialog link to a SeaArt search.

### Fixed
- Sampler names keep their scheduler ("DPM++ 2M Karras" showed as "DPM++ 2M"), including
  A1111 1.9+'s separate "Schedule type".
- NovelAI samplers show as labels ("Euler a" instead of "k_euler_ancestral").
- Web links opened from the app go to the default browser instead of an app window.
- The desktop app no longer stores the Civitai API key in plain text next to the
  encrypted copy; an existing plain copy is moved and deleted.

### Removed
- Settings toggles that had no effect (Clipboard Auto-Detection, Resolve Remote LoRAs,
  Default Archive Directory) and the setup wizard's drag and hotkey options.

### Project
- Tests (`npm test`) and a CI workflow (typecheck, tests, build) on every push and pull
  request; the typecheck now covers the Electron main process.
- Removed unused dependencies and leftover AI Studio files; archived old planning docs;
  added the MIT LICENSE file the README refers to.

## v1.0.16

### Several images per prompt
- New Prompt has an image area: drop, paste or browse up to 5 images, remove them or
  pick the cover (the first image).
- If an added image has generation data, the empty fields (title, prompt, negative
  prompt, model, sampler, steps) are filled from it; what you typed is never replaced.
  CFG, seed, size and LoRAs from the image are kept too.
- Library cards and the detail pane show ‹ › arrows (on hover) and dots for items with
  more than one image; the arrows never select or open the card. ← → switch images in
  the detail pane, and clicking the image opens a full-size view.
- "Edit images" / "Add images" in the detail pane adds, removes or reorders the images
  of any saved prompt, including ones saved from an extraction.
- Table view shows the cover with a "+N" badge.

### Storage
- The desktop app keeps library images as files in its data folder
  (`library-images\<item>\`, original plus a small thumbnail) instead of inside the
  library data; deleting a prompt deletes its images. Images of dropped files saved from
  the result page are stored the same way.

### Other
- Themed dropdowns replace the Windows lists for the New Prompt folder, Edit Library's
  "Move to folder…" and the Civitai platform setting (keyboard: arrows, Enter, Esc).
- Prompts without a sampler, steps, CFG or seed show "—" instead of made-up defaults
  ("Euler a", 30, 7); New Prompt no longer pre-fills "SDXL Base 1.0 / Euler a / 30".
- Dropping or pasting images while a dialog is open no longer starts an extraction.

## v1.0.15

### AI labels (ChatGPT, Gemini and others)
- Images from ChatGPT / OpenAI, Google Gemini, Adobe Firefly, Microsoft, Meta and other
  services contain no prompt, but many carry a provenance label: C2PA Content
  Credentials (PNG, JPEG, WebP) or an IPTC "AI-generated" source type in XMP.
- When an image has no generation metadata but has such a label, the result page shows
  "Confirmed AI-generated image" (or "AI-edited" for partly generated images), the
  service, model, creation date, the app that wrote the label and the signer, and
  explains that no prompt is available.
- Images whose Content Credentials do not mark them as AI (e.g. camera photos) say so.
- The label is read offline and shown as written; its signature is not verified.
  Screenshots and most social media uploads remove it.

## v1.0.14

### Prompt Library
- Edit Library: click a folder to show Rename and Delete folder. Rename moves the
  folder's prompts along; a name already in use is refused.
- Delete folder asks for confirmation (with Cancel) and never deletes prompts: the
  folder's prompts stay in All Prompts.
- Removed the "Edit Mode Active" label from the edit toolbar.

### Fixed
- Installer: the "Launch PromptHound" checkbox text on the last page was drawn black
  on the dark background and was unreadable.

## v1.0.13

### Save to Library
- After saving, the button turns green with a check ("Saved · View in Library") and
  stays that way for this image; clicking it again opens the item in the Prompt
  Library instead of saving a duplicate.
- Saved items are titled from the first descriptive prompt tag, skipping quality and
  rating tags such as "score_9", "masterpiece" or "very awa".

### Fixed
- Prompt Library previews shrank to a thin strip once the grid had more rows than fit
  the window; every card keeps the same 4:3 frame.
- Recent Recipes: long model names pushed the LoRA badge out of its card; names are
  now shortened with "…" and the badge stays on one line.
- Settings: the "Key saved (encrypted)" badge and the Civitai platform list no longer
  overflow their boxes.
- Button icons sat above their labels instead of beside them.

## v1.0.12

### Updates and installer
- Automatic updates: the installed app checks GitHub for a new version at start (and
  every few hours), downloads it in the background and shows "Restart to update".
  The update also installs by itself the next time the app is closed. Works from
  1.0.12 on; install 1.0.12 once by hand. The portable build does not update itself.
- Redesigned installer: new artwork, dark theme, welcome and finish pages. Running a
  newer installer replaces the installed version in place; library and settings are kept.
- Windows may still show a SmartScreen warning because the installer is not code-signed.

### Fixed
- Dropping a working image after one that failed kept showing the error; the new image
  now opens, and the failed one stays in the image strip.
- The saved image card showed black boxes instead of dropped images (and sometimes
  model previews); all images are now embedded before the card is drawn.
- Library items saved from dropped or pasted images lost their preview after a
  restart; a small copy of the image is now stored with the item.
- Favorites left an empty column on the right on wide windows.

### Previews
- The Prompt Library (grid, detail pane, table), Favorites and recent extractions use
  one 4:3 frame and show the whole image instead of cropping it.

## v1.0.11

### Image card ("Save Image Card")
- Shows the base model and every LoRA with its preview image, name, version, base
  model and weight, instead of plain text pills.
- The layout follows the image: model and LoRAs sit under wide images and next to
  tall ones; the four main settings share one row.
- LoRA re-links made on the result page are reflected on the card.
- Exports still work offline: previews that cannot be loaded show an icon.

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
