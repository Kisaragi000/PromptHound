# Civitai Image Metadata Extraction: Architectural Analysis & PromptHound Implementation Guide

> **Document Type:** Technical Architecture & Comparative Research  
> **Topic:** Reverse engineering Civitai's client-side image metadata parsing & resource resolution pipeline (`civitai.com/posts/create`)  
> **Target Audience:** PromptHound Engineering Team, Open Source Contributors, AI Tool Builders  
> **Date:** September 2026  

---

## 1. Executive Summary

When creators drop an image onto Civitai's **Post Creator** (`https://civitai.com/posts/create`), the platform performs instantaneous (sub-50ms) client-side extraction of generation prompts, negative prompts, sampling parameters (steps, sampler, CFG, seed, dimensions), checkpoint models, and embedded LoRAs—followed by live cloud reconciliation of model hashes to display trained trigger words and download links.

Civitai extracted and open-sourced the parser portion of this system into the npm package `@civitai/generation-metadata`. This document deconstructs how Civitai's pipeline operates under the hood, examines its binary parsing and graph traversal techniques, and provides an actionable blueprint for adopting this exact workflow within **PromptHound**.

---

## 2. The Civitai Extraction Pipeline (Step-by-Step)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Drops Image File                           │
│                     (PNG, WebP, JPEG, or AVIF)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Binary Chunk Parsing (Client-Side / Browser Memory)           │
│  - No upload required for extraction                                   │
│  - Reads raw bytes via ArrayBuffer & DataView                          │
│  - PNG:  Parses chunks for 'parameters' (A1111) or 'prompt'/'workflow' │
│  - WebP: Traverses RIFF header -> EXIF / XMP chunk payloads            │
│  - JPEG: Reads APP1 (0xFFE1) markers for Exif UserComment or XMP       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Generator Signature Identification & Normalization            │
│  - Inspects text payloads to classify the source generator:            │
│    • Automatic1111 / WebUI / Forge / SD.Next                           │
│    • ComfyUI (JSON node graph execution tree)                          │
│    • Fooocus / RuinedFooocus                                           │
│    • SwarmUI / NovelAI / InvokeAI                                      │
│  - Transforms generator-specific schema into normalized schema         │
│  - Normalizes sampler & scheduler names using a unified dictionary     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Resource & Hash Resolution (Cloud API)                        │
│  - Extracts Model Hash & LoRA Hashes (AutoV1, AutoV2, SHA256, BLAKE3)   │
│  - Queries Civitai API: /api/v1/model-versions/by-hash/:hash           │
│  - Resolves AIR URNs: urn:air:{ecosystem}:{type}:civitai:{id}@{ver}    │
│  - Retrieves real Model Names, Creators, Base Architectures, Thumbnails│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Interactive UI Population                                     │
│  - Fills Prompt & Negative Prompt input boxes                          │
│  - Displays Step, CFG, Sampler, Seed metrics                           │
│  - Injects resolved LoRAs with strength sliders                        │
│  - Renders 1-click Trigger Word tag chips for instant insertion        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Deep Dive: How Civitai Handles Specific File Formats

### 3.1 PNG Files
PNG stores image metadata in ancillary chunks that can be parsed sequentially without decoding the image pixel payload (`IDAT`):
- **`tEXt`**: Latin-1 encoded key-value pairs (e.g. `parameters\0<prompt data>`).
- **`iTXt`**: International UTF-8 encoded text chunks (commonly used by ComfyUI to store both `prompt` and `workflow` JSON strings).
- **`zTXt`**: Compressed Latin-1 text (zlib deflate).

**Automatic1111 Signature in PNG:**
A1111 writes a single `tEXt` chunk with the keyword `parameters`. Its body follows a strict three-part newline-delimited convention:
```text
masterpiece, best quality, 1girl, solo, dark forest, glowing amber eyes <lora:ForestLight_v2:0.85>
Negative prompt: low quality, blurry, extra limbs, bad anatomy
Steps: 28, Sampler: DPM++ 2M Karras, CFG scale: 7, Seed: 384729104, Size: 1024x1024, Model hash: e3b0c44298, Model: PonyDiffusionV6, Hashes: {"model": "e3b0c44298", "lora:ForestLight_v2": "a1b2c3d4e5"}
```

**ComfyUI Signature in PNG:**
ComfyUI stores two `iTXt` chunks:
1. `prompt`: The executed node graph containing node IDs, inputs, and widget values.
2. `workflow`: The visual canvas state (node positions, linkages, groups).

### 3.2 WebP Files
WebP files use the **RIFF container format**. Civitai scans RIFF four-character code (FourCC) chunks:
- `EXIF`: Holds an embedded TIFF/EXIF header. Metadata is stored within the standard `UserComment` tag (`0x9286`) or `ImageDescription` tag (`0x010E`).
- `XMP `: Holds RDF/XML text containing `dc:description` or custom namespaces like `xmp:CreatorTool`.

### 3.3 JPEG Files
JPEG files structure metadata inside **APP markers**:
- Marker `0xFFE1` denotes either standard EXIF (starting with ASCII `Exif\0\0`) or Adobe XMP (`http://ns.adobe.com/xap/1.0/\0`).
- WebUI tools write the complete generation text block into the EXIF `UserComment` tag with an 8-byte charset prefix (`UNICODE\0` or `ASCII\0\0\0`).

---

## 4. ComfyUI Node Graph Traversal Algorithm

Unlike A1111, which outputs flat strings, ComfyUI stores a directed execution graph. Civitai resolves ComfyUI metadata by **backtracking from the output nodes**:

1. **Find Output / Save Node:**
   Locates nodes with `class_type: "SaveImage"` or `"PreviewImage"`.
2. **Backtrack to KSampler:**
   Follows the `images` link backward into `KSampler` or `KSamplerAdvanced`.
   - Extracts: `seed`, `steps`, `cfg`, `sampler_name`, `scheduler`, `denoise`.
3. **Trace Conditioning Inputs:**
   - Follows `positive` conditioning connection backward:
     - If passing through `CLIPTextEncodeSDXL` or `CLIPTextEncode`, extracts the string widget input (`text` or `text_g` + `text_l`).
   - Follows `negative` conditioning connection backward to resolve negative text.
4. **Trace Model & LoRA Loaders:**
   - Follows the `model` connection backward:
     - Identifies `LoraLoader` or `LoraLoaderModelOnly` nodes, extracting `lora_name`, `strength_model`, and `strength_clip`.
     - Recursively follows up the tree until reaching `CheckpointLoaderSimple` or `UNETLoader` to extract the base model filename.

---

## 5. Hash Resolution & Civitai AIR Identifiers

### 5.1 Supported Hash Formats
Civitai supports multiple hashing schemes:
- **AutoV1 / AutoV2**: A legacy 10-character partial SHA256 representation used by early A1111 releases.
- **SHA256**: Full or truncated 64-character hexadecimal SHA256 of the model/LoRA binary.
- **BLAKE3**: Fast 256-bit cryptographic hash now widely used on Civitai.

### 5.2 Civitai Resolution Endpoints
When hashes are parsed from the image, Civitai resolves their identity via public REST endpoints:

```http
GET https://civitai.com/api/v1/model-versions/by-hash/:hash
```

**Civitai API Response Payload:**
```json
{
  "id": 128743,
  "modelId": 98450,
  "name": "v2.0",
  "baseModel": "Pony",
  "air": "urn:air:pony:lora:civitai:98450@128743",
  "trainedWords": [
    "forestlight",
    "golden hour",
    "amber glow"
  ],
  "model": {
    "name": "Forest Light & Atmosphere",
    "type": "LORA",
    "nsfw": false
  },
  "images": [
    {
      "url": "https://image.civitai.com/.../width=450/preview.jpg"
    }
  ]
}
```

### 5.3 Trigger Word Extraction
Once the LoRA version is resolved:
1. Civitai retrieves `trainedWords`.
2. Cross-references whether the trigger words already appear in the user's positive prompt.
3. Renders the missing trigger words as interactive chips, allowing creators to append them with a single click.

---

## 6. PromptHound Implementation Roadmap

PromptHound's desktop architecture (Electron + React + TypeScript + standalone `/core` engine) is ideally suited to replicate and enhance this workflow:

### Phase 1: Native In-Memory Binary Parser (`/core/binaryReader.ts`)
- Implement a pure TypeScript `DataView` reader that parses:
  - PNG chunk sequences (`tEXt`, `iTXt`, `zTXt`).
  - WebP RIFF headers (`EXIF`, `XMP`).
  - JPEG APP1 segments (`Exif` UserComment).
- **Advantage:** 100% offline, runs instantly in renderer or Node main process without external binary dependencies.

### Phase 2: Enhanced ComfyUI & Format Normalization (`/core/parser.ts`)
- Integrate ComfyUI recursive node-graph traversal (backtracking from `SaveImage` through `KSampler`, `CLIPTextEncode`, and `LoraLoader`).
- Provide an automatic fallback mapper for sampler naming discrepancies (e.g. mapping ComfyUI `euler_ancestral` / `karras` to standard `Euler a Karras`).

### Phase 3: Civitai API Hash & AIR Resolver (`/core/loraResolver.ts`)
- Implement cached hash lookups against `https://civitai.com/api/v1/model-versions/by-hash/:hash`.
- Store resolved metadata (Model Name, Version, Creator, Base Architecture, AIR string, Trained Trigger Words, Preview Image URL) in PromptHound's local IndexedDB or cache store.

### Phase 4: Trigger Word Chips & Prompt Builder (`/src/pages/ExtractionResultPage.tsx`)
- Display detected LoRAs alongside their associated trained trigger words.
- Provide interactive tag chips:
  - **Click-to-Append**: Injects trigger word into positive prompt at cursor or end.
  - **Copy Trigger Words**: One-click copy of all associated tags.
  - **Civitai Link**: Direct navigation button to model page.

### Phase 5: Batch File Ingestion
- Extend the Dropzone to accept multi-image folders or sets.
- Process images concurrently and present a fluid batch inspection gallery.

---

## 7. Key Architecture Takeaways

1. **Extraction must be client-side and instant:** Images should never leave the user's computer for metadata extraction. Only the resulting hashes are optionally sent to Civitai's API for name and tag enrichment.
2. **Normalize to a common domain contract:** Standardize outputs into a single, predictable structure (`PromptHoundMetadata`) regardless of whether the source was Automatic1111, ComfyUI, Fooocus, or SeaArt.
3. **Decouple parsing from UI:** Keep parsing logic in `/core`, entirely independent of React and Electron, ensuring comprehensive automated unit testing against real-world test images.
