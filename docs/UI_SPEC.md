# `UI_SPEC.md` - Technical Interface Specification

## 0. Document Purpose

This specification converts the three approved PromptHound UI mockups
into an implementation-oriented frontend contract.

**Reference screens** - **Image 1 --- Home / Starting Screen:** idle
state with Paste URL, Drag & Drop, and Check Library. - **Image 2 ---
Metadata Extracted:** analyzed-image detail state with one original
image, normalized generation metadata, source information, resolved
LoRAs, and quick actions. - **Image 3 --- Prompt Library:** saved-prompt
browsing state with folders, prompt cards, search/filter controls,
favorites, and a selected-prompt detail pane.

The visual design is premium, information-dense, and utility-first. It
should give long prompts and generation settings enough room to read,
inspect, copy, and reuse.

> **Color note:** HEX values below are implementation targets inferred
> from the approved visual direction and supplied palette image. Treat
> them as design tokens, not exact pixel measurements.

------------------------------------------------------------------------

## 1. Executive Visual Summary

-   **Design Aesthetic:** Dark Glassmorphism with a botanical/forest
    visual identity. Use translucent surfaces, backdrop blur, thin
    borders, soft inner highlights, restrained shadows, and amber/olive
    accent lighting.
-   **Primary Mood:** Premium, focused, sophisticated, calm, technical,
    fast, and functional.
-   **Brand:** **PromptHound**. Use a compact amber/orange hound-head
    logo in the title bar and small brand placements.
-   **Primary Visual Motif:** Near-black forest-green glass over a
    blurred botanical/organic background, with warm amber/orange
    reserved for primary actions and important highlights.
-   **Color Palette (HEX/RGBA):**
    -   App background: `#071006` / `rgba(7,16,6,0.96)`
    -   Deep forest: `#10200D` / `rgba(16,32,13,0.88)`
    -   Forest glass: `#182713` / `rgba(24,39,19,0.62)`
    -   Olive surface: `#4F5928`
    -   Olive highlight: `#69743A`
    -   Primary amber/orange: `#F59A22`
    -   Deep amber: `#B95405`
    -   Warm gold: `#D7923A`
    -   Primary text: `#F3F4EE`
    -   Secondary text: `#C5C9BC`
    -   Muted text: `#858C7D`
    -   Border: `rgba(225,235,210,0.18)`
    -   Strong accent border: `rgba(245,154,34,0.48)`
    -   Glass highlight: `rgba(255,255,255,0.08)`
    -   Success: `#A6D86A` / `#74D99A`
    -   Error: `#E46B5D`
    -   Source/link accent: `#70C8D1`
-   **Primary CTA gradient:**
    `linear-gradient(135deg, #D8780E, #F6A52B)`.
-   **Transparency:** Major cards should appear approximately 55--80%
    transparent depending on hierarchy.
-   **Blur:** Approximately 20--32px on major glass surfaces; 10--18px
    on smaller controls.
-   **Borders:** 1px translucent borders; avoid heavy solid outlines.
-   **Corner language:** 16--20px for major panels/window; 12--16px for
    cards; 8--12px for controls.
-   **Background imagery:** Low-contrast blurred foliage/berries may sit
    behind the application shell. Content must remain dominant and
    readable. No decorative desktop background outside the application
    window is part of the UI.

------------------------------------------------------------------------

## 2. Layout & Typography

### 2.1 Grid Structure

The application is a Windows desktop shell with a persistent left
sidebar and fluid workspace.

-   Reference design size: approximately `1536 × 1024px`.
-   Minimum practical size: approximately `1200 × 760px`.
-   Custom-looking glass title bar integrated into the shell.
-   Rounded outer window corners.
-   Desktop-first; do not turn the product into a mobile-style layout.

### Persistent sidebar

-   Width: approximately `230–250px`.
-   Full-height.
-   Right-side translucent divider.
-   Navigation order:
    1.  Home
    2.  Prompt Library
    3.  Visual Archive
    4.  Favorites
    5.  Divider
    6.  **TOOLS**
    7.  Settings
    8.  About
-   Bottom utility card:
    -   Amber lightning icon.
    -   `Extract. Organize. Create.`
    -   `Get the most out of your AI-generated images.`
-   Small version label near the bottom.

### Image 2 workspace

Three visual zones:
- Left image preview: roughly 35--40% of central workspace.
- Center metadata: roughly 45--50%.
- Right source/actions: roughly 25--30% of overall content.

### Image 3 workspace

Three visual zones:
- Folder rail: roughly 220px.
- Prompt card grid: fluid center.
- Detail pane: roughly 380--410px.

## 2.2 Component Spacing

Use an 8px spacing system:
- 4px micro spacing.
- 8px compact spacing.
- 12px control/card spacing.
- 16px default card padding.
- 20px major card padding.
- 24px section spacing.
- 32px major header separation.
- 40--48px hero spacing.

## 2.3 Typography

Recommended stack:

``` text
Inter, "Segoe UI", system-ui, sans-serif
```

Weights: - 400 Regular - 500 Medium - 600 Semibold - 700 Bold

------------------------------------------------------------------------

## 3. Global Components (Master List)

### 3.1 Buttons

**Primary** - Amber gradient. - Near-white text. - 1px amber translucent border. - 10--12px radius. - 40--44px height. - 16--20px horizontal padding. - Hover: brighter gradient and subtle amber glow.

**Secondary** - Dark translucent glass. - 1px translucent border. - Near-white text. - Olive/green hover tint.

**Icon button** - 32--36px square. - 8--10px radius. - Centered icon. - Glass/transparent background.

### 3.2 Inputs

**URL input** - 42px height. - Dark forest glass. - 1px translucent border. - Placeholder: `Paste a Civitai, SeaArt, or direct image URL...`

**Search input** - Search icon on left. - Placeholder: `Search prompts...` - Approximately 230--260px wide.

------------------------------------------------------------------------

## 4. Data-to-UI Contract

The frontend consumes normalized metadata:

``` ts
export interface ExtractedMetadata {
  source?: {
    platform?: "Civitai" | "SeaArt" | "Local File" | "Clipboard" | "Unknown";
    url?: string;
    detectedFormat?: string;
  };

  image: {
    path?: string;
    width: number;
    height: number;
  };

  prompt?: string;
  negativePrompt?: string;

  generation: {
    sampler?: string;
    steps?: number;
    cfgScale?: number;
    seed?: number | string;
    model?: string;
    resolution?: {
      width: number;
      height: number;
    };
  };

  loras: Array<{
    rawValue: string;
    name?: string;
    strength?: number;
    source?: {
      platform?: "Civitai" | "SeaArt";
      url?: string;
    };
    resolved: boolean;
  }>;
}
```
