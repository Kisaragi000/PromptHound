# Comprehensive LoRA Identification & Visual Display Proposal

## 1. Problem Statement
PromptHound currently encounters several issues when identifying LoRAs from generated images:
1. **Low Match Rate**: Many images only contain inline prompt tags (e.g. `<lora:echidna_re_zero_v2:0.8>`) or ComfyUI node keys (`lora_name: "echidna.safetensors"`), but lack explicit Civitai SHA256 hashes.
2. **Missing Metadata/Image Previews**: Even when a LoRA is extracted, it appears as plain text without visual previews (thumbnails), trigger words, or direct links to Civitai/SeaArt.
3. **Truncated Coverage**: Relying solely on a small offline top-list leaves out hundreds of thousands of community, niche, and newly trained LoRAs on Civitai and SeaArt.

---

## 2. Visual Display Specification (SeaArt-Style Card)
As demonstrated in the reference design:
- **Thumbnail Image Preview**: A rounded avatar/card thumbnail showing the cover art of the LoRA model (fetched from Civitai / SeaArt API).
- **LoRA Name & Link**: Cleanly formatted title linked directly to the model page on Civitai / SeaArt.
- **Weight / Strength Indicator**: Visual slider or badge showing the applied strength (e.g. `0.8` or `1.0`).
- **Trigger Words Chip List**: If available, display the primary trigger words associated with the model with 1-click copy buttons.
- **Quick Status Badge**: Verified checkmark or source indicator (`Civitai` / `SeaArt` / `Custom`).

---

## 3. Multi-Strategy LoRA Recognition Architecture

To achieve full coverage without missing community or obscure LoRAs, we recommend running a **parallel multi-check waterfall**:

```
                 [ Raw Image / Extracted Metadata ]
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
  [ Civitai Hash ]      [ Prompt Lora Tag ]      [ ComfyUI Graph ]
  (e.g., 8a1b2c3d...)   (<lora:name:weight>)     (node inputs)
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
             [Exact Hash Query]      [Name Normalizer Engine]
             (/by-hash/:hash)        (strips prefixes, dates, v1/v2,
                                      underscores, .safetensors)
                     │                       │
                     │               ┌───────┴───────┐
                     │               ▼               ▼
                     │       [Civitai Search] [SeaArt Search]
                     │       (/api/v1/models) (search API/slug)
                     │               │               │
                     └───────────────┼───────────────┘
                                     ▼
                      [ Aggregated Result & Cache ]
                   (Model Title, Cover Image, URL,
                    Trigger Words, Rating, Downloads)
```

---

## 4. The 4 Parallel Check Options

### Check 1: SHA256 Hash Exact Match (Civitai API)
* **Endpoint**: `https://civitai.com/api/v1/model-versions/by-hash/{hash}`
* **Accuracy**: 100% (No false positives).
* **Extracts**: Exact model title, version name, cover image thumbnail, base model (SD 1.5, SDXL, Pony, Flux), download URL, and trigger words.

### Check 2: Intelligent Name Normalization & Civitai API Search
When no hash is embedded in the image metadata:
1. **Normalization Rules**:
   - Strip file extensions: `.safetensors`, `.pt`, `.ckpt`
   - Strip common version suffixes: `_v1.0`, `_v2`, `_epoch5`, `_offset`
   - Strip SD tags: `_sdxl`, `_sd15`, `_pony`, `_flux`
   - Replace underscores and dashes with spaces.
   - Example: `<lora:Echidna_ReZero_SDXL_v1.2:0.8>` ➔ `"Echidna ReZero"`
2. **API Query**: `https://civitai.com/api/v1/models?query=${cleanQuery}&types=LORA&limit=5`
3. **Relevance Scoring**: Compute Levenshtein string distance / token overlap against the returned model titles to pick the top match and fetch its preview image.

### Check 3: SeaArt Resource & Shortlink Resolution
* For images generated via SeaArt (which often use SeaArt internal resource IDs or URL slugs):
* Query SeaArt public resource catalog API / search endpoint for the corresponding model card, creator, and preview thumbnail.

### Check 4: Local Smart Cache (IndexedDB / Local Storage)
* When a LoRA is resolved once, cache the mapping `{ [normalizedName]: { title, coverImage, url, triggerWords, strength } }`.
* Sub-millisecond instant lookup for all future images using that LoRA across sessions, even when offline.

---

## 5. Proposed LoRA Card UI Mockup (React)

```tsx
<div className="lora-card-container">
  {/* Thumbnail Preview */}
  <div className="lora-thumb-wrapper">
    <img 
      src={lora.coverImageUrl || fallbackIcon} 
      alt={lora.name} 
      className="lora-thumb-img" 
    />
    <span className="lora-source-badge">{lora.source}</span>
  </div>

  {/* Info & Weight */}
  <div className="lora-body">
    <div className="lora-header">
      <a href={lora.url} target="_blank" rel="noreferrer" className="lora-title">
        {lora.title || lora.rawName}
      </a>
      <span className="lora-weight-pill">{lora.strength}</span>
    </div>

    {/* Strength bar */}
    <div className="lora-strength-bar">
      <div className="lora-strength-fill" style={{ width: `${Math.min(lora.strength * 100, 100)}%` }} />
    </div>

    {/* Trigger words */}
    {lora.triggerWords?.length > 0 && (
      <div className="lora-triggers">
        {lora.triggerWords.map(tw => (
          <button key={tw} onClick={() => copy(tw)} className="trigger-chip">
            {tw}
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

---

## 6. Summary of Next Implementation Steps
1. **Build `core/lora-search.ts`**: Implement parallel Civitai hash + query search with fuzzy name matching and cover thumbnail retrieval.
2. **Update UI in `ExtractionResultPage.tsx` & `PromptLibraryPage.tsx`**: Render the visual SeaArt-style LoRA card with cover image thumbnail, strength indicator, trigger words, and Civitai/SeaArt outbound links.
3. **Persist Resolved Cache**: Store resolved LoRA models locally so repeat images load instantly.
