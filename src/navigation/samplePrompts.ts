import type { SavedPromptItem } from '../../core/types.js';

/**
 * Example library entries shown on first launch. The images in public/samples are the
 * original files, so their embedded metadata can also be re-extracted as a demo.
 * Metadata for samples 1, 2 and 4 is PromptHound's own extraction of those files;
 * sample 3's file carries no metadata, so its settings come from the image author.
 */
export const INITIAL_SAMPLE_PROMPTS: SavedPromptItem[] = [
  {
    id: 'sample-1',
    title: 'Nordic Fjord Boathouse',
    folder: 'Landscapes',
    source: 'Civitai',
    date: 'Sep 23, 2026',
    model: 'One obsession_Anima (v4.0)',
    dimensions: '1216 × 832',
    isFavorite: true,
    thumbnailUrl: 'samples/nordic-fjord-boathouse.jpg',
    metadata: {
      prompt:
        'score_9, score_8, score_7, highres, very aesthetic, amazing quality, photo, landscape, fog-drenched Nordic fjord at dawn, steep black rock cliffs rising from still water, thin mist clinging to the rock faces, a single red wooden boathouse on the shoreline, weathered planks, warm light glowing from one window, snow patches on the upper cliffs, pale pink and blue sky, low sun behind layered clouds, mirror-like water reflecting the cliffs, subtle ripples, distant seabirds, muted cinematic color palette, film grain, natural depth of field, atmospheric haze',
      negativePrompt:
        'worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, lowres, censor, text, watermark, signature, people, characters, oversaturated, cartoon, flat lighting, distorted horizon, warped architecture, deformed',
      sampler: 'DPM++ 2M',
      steps: 25,
      cfgScale: 7,
      seed: '866389369',
      model: 'One obsession_Anima (v4.0)',
      width: 1216,
      height: 832,
      loras: [
        {
          rawName: '【Anima】Landscape specialization lora',
          strength: 0.9,
          civitaiVersionId: 2947634,
          resolved: {
            name: '【Anima】Landscape specialization lora',
            source: 'civitai',
            modelUrl: 'https://civitai.com/models/2625400/animalandscape-specialization-lora?modelVersionId=2947634',
            triggerWords: ['landscape', 'fog-drenched', 'fjord', 'scenery', 'mist'],
            baseModel: 'Anima',
            matchedBy: 'civitai-version',
          },
        },
        {
          rawName: 'Anima Lighting Atmosphere Enhancer',
          strength: 0.3,
          civitaiVersionId: 3082260,
          resolved: {
            name: 'Anima Lighting Atmosphere Enhancer',
            source: 'civitai',
            modelUrl: 'https://civitai.com/models/2628200/anima-lighting-atmosphere-enhancer?modelVersionId=3082260',
            triggerWords: ['atmospheric lighting', 'warm glow', 'natural depth of field', 'cinematic'],
            baseModel: 'Anima',
            matchedBy: 'civitai-version',
          },
        },
      ],
      detectedFormat: 'a1111',
      extraFields: {
        Steps: '25',
        Sampler: 'dpmpp_2m',
        'CFG scale': '7',
        Seed: '866389369',
        Size: '1216x832',
        'Model type': 'Anima',
        'Created Date': '2026-09-23T08:20:37.1748538Z',
        'Civitai resources':
          '[{"type":"checkpoint","modelVersionId":3301424,"modelName":"One obsession_Anima","modelVersionName":"v4.0"},{"type":"lora","weight":0.9,"modelVersionId":2947634,"modelName":"\\u3010Anima\\u3011Landscape specialization lora","modelVersionName":"v1.0"},{"type":"lora","weight":0.3,"modelVersionId":3082260,"modelName":"Anima Lighting Atmosphere Enhancer","modelVersionName":"sliderv1"}]',
        'Civitai metadata':
          '{"workflow":"txt2img","priority":"low","outputFormat":"jpeg","ecosystem":"Anima","seed":866389369,"aspectRatio":{"value":"3:2","width":1216,"height":832},"cfgScale":7,"steps":25,"sampler":"dpmpp_2m","scheduler":"simple","prompt":"score_9, score_8, score_7, highres, very aesthetic, amazing quality, photo, landscape, fog-drenched Nordic fjord at dawn, steep black rock cliffs rising from still water, thin mist clinging to the rock faces, a single red wooden boathouse on the shoreline, weathered planks, warm light glowing from one window, snow patches on the upper cliffs, pale pink and blue sky, low sun behind layered clouds, mirror-like water reflecting the cliffs, subtle ripples, distant seabirds, muted cinematic color palette, film grain, natural depth of field, atmospheric haze, <lora:Anima_Landscape_Specialization:0.9>,","negativePrompt":"worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, lowres, censor, text, watermark, signature, people, characters, oversaturated, cartoon, flat lighting, distorted horizon, warped architecture, deformed","quantity":1,"resources":[{"modelVersionId":3301424,"strength":1,"type":"Checkpoint"},{"modelVersionId":2947634,"strength":0.9,"type":"LORA"},{"modelVersionId":3082260,"strength":0.3,"type":"LORA"}]}',
        civitaiCheckpointVersionId: 3301424,
      },
    },
  },
  {
    id: 'sample-2',
    title: 'Coastal Research Station',
    folder: 'Architecture',
    source: 'Civitai',
    date: 'Sep 23, 2026',
    model: 'Wulver (Krea - 2) v0.1 Alpha (v0.1)',
    dimensions: '1376 × 768',
    isFavorite: false,
    thumbnailUrl: 'samples/coastal-research-station.jpg',
    metadata: {
      prompt:
        'A photorealistic architectural photograph of a coastal research station at dusk, perched on a rocky headland above a darkening sea. The main structure is a low, angular brutalist building of weathered concrete and oxidized steel, cantilevered over the cliff edge. Large glass windows glow with warm interior light, revealing faint silhouettes of laboratory equipment and tangled cables. A smaller satellite dish and antenna array sit on the roof, silhouetted against the last band of orange light on the horizon. The sea below is rough, with whitecaps catching the fading light. Wind-bent coastal grass and scattered lichen-covered rocks frame the foreground. The composition is balanced and symmetrical, with the building positioned slightly off-center according to the golden ratio. The image has the precise, methodical feel of a technical architectural rendering, with clean lines and clear structural readability. Muted cinematic color palette, deep blues and grays with warm amber accents, film grain, natural atmospheric haze, shallow depth of field on the foreground rocks. CyberpunkInterior, YFG-Aarchy, masterpiece, very aesthetic.',
      negativePrompt:
        'nsfw, worst quality, low quality, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, jpeg artifacts, signature, watermark, username, blurry, 3d, realistic, photorealistic, deformed',
      sampler: 'Euler',
      steps: 30,
      cfgScale: 3.5,
      seed: '725812185',
      model: 'Wulver (Krea - 2) v0.1 Alpha (v0.1)',
      width: 1376,
      height: 768,
      loras: [
        {
          rawName: 'Cyberpunk Interior (Architecture) (Buildings) (Krea2) (AD)',
          strength: 0.5,
          civitaiVersionId: 3234278,
          resolved: {
            name: 'Cyberpunk Interior (Architecture) (Buildings) (Krea2) (AD)',
            source: 'civitai',
            modelUrl:
              'https://civitai.com/models/2863043/cyberpunk-interior-architecture-buildings-krea2-ad?modelVersionId=3234278',
            triggerWords: ['CyberpunkInterior', 'YFG-Aarchy', 'interior', 'architecture', 'brutalist'],
            baseModel: 'Krea-2',
            matchedBy: 'civitai-version',
          },
        },
        {
          rawName: 'Aesthetic Quality Modifiers - Masterpiece',
          strength: 0.6,
          civitaiVersionId: 3077110,
          resolved: {
            name: 'Aesthetic Quality Modifiers - Masterpiece',
            source: 'civitai',
            modelUrl:
              'https://civitai.com/models/929497/aesthetic-quality-modifiers-masterpiece?modelVersionId=3077110',
            triggerWords: ['masterpiece', 'very aesthetic', 'aesthetic quality'],
            baseModel: 'SDXL',
            matchedBy: 'civitai-version',
          },
        },
        {
          rawName: 'YFG Aarchy [Flux | ZIT | Krea2]',
          strength: 0.7,
          civitaiVersionId: 3098382,
        },
      ],
      detectedFormat: 'a1111',
      extraFields: {
        Steps: '30',
        Sampler: 'euler',
        'CFG scale': '3.5',
        Seed: '725812185',
        Size: '1376x768',
        'Created Date': '2026-09-23T08:28:07.0547834Z',
        'Civitai resources':
          '[{"type":"checkpoint","modelVersionId":3257037,"modelName":"Wulver (Krea - 2) v0.1 Alpha","modelVersionName":"v0.1"},{"type":"lora","weight":0.5,"modelVersionId":3234278,"modelName":"Cyberpunk Interior (Architecture) (Buildings) (Krea2) (AD)","modelVersionName":"V1"},{"type":"lora","weight":0.6,"modelVersionId":3077110,"modelName":"Aesthetic Quality Modifiers - Masterpiece","modelVersionName":"v5.1 [krea2]"},{"type":"lora","weight":0.7,"modelVersionId":3098382,"modelName":"YFG Aarchy [Flux | ZIT | Krea2]","modelVersionName":"Krea2 - v1.0"}]',
        'Civitai metadata':
          '{"workflow":"txt2img","priority":"low","outputFormat":"jpeg","ecosystem":"Krea2","resolution":"1K","aspectRatio":{"value":"16:9","width":1376,"height":768},"negativePrompt":"nsfw, worst quality, low quality, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, jpeg artifacts, signature, watermark, username, blurry, 3d, realistic, photorealistic, deformed","cfgScale":3.5,"steps":30,"prompt":"A photorealistic architectural photograph of a coastal research station at dusk, perched on a rocky headland above a darkening sea. The main structure is a low, angular brutalist building of weathered concrete and oxidized steel, cantilevered over the cliff edge. Large glass windows glow with warm interior light, revealing faint silhouettes of laboratory equipment and tangled cables. A smaller satellite dish and antenna array sit on the roof, silhouetted against the last band of orange light on the horizon. The sea below is rough, with whitecaps catching the fading light. Wind-bent coastal grass and scattered lichen-covered rocks frame the foreground. The composition is balanced and symmetrical, with the building positioned slightly off-center according to the golden ratio. The image has the precise, methodical feel of a technical architectural rendering, with clean lines and clear structural readability. Muted cinematic color palette, deep blues and grays with warm amber accents, film grain, natural atmospheric haze, shallow depth of field on the foreground rocks. CyberpunkInterior, YFG-Aarchy, masterpiece, very aesthetic.","seed":725812185,"quantity":1,"resources":[{"modelVersionId":3257037,"strength":1,"type":"Checkpoint"},{"modelVersionId":3234278,"strength":0.5,"type":"LORA"},{"modelVersionId":3077110,"strength":0.6,"type":"LORA"},{"modelVersionId":3098382,"strength":0.7,"type":"LORA"}]}',
        civitaiCheckpointVersionId: 3257037,
      },
    },
  },
  {
    id: 'sample-3',
    title: 'Reze in the Rain',
    folder: 'Anime',
    source: 'Civitai',
    date: 'Sep 23, 2026',
    model: 'Plant Milk 🌿 - Model Suite (Walnut)',
    dimensions: '1248 × 1824',
    isFavorite: true,
    thumbnailUrl: 'samples/reze-rainy-street.jpg',
    metadata: {
      prompt:
        'masterpiece, best quality, very aesthetic, absurdres, chainsaw man movie style, reze, 1girl, solo, purple hair, single hair bun, green eyes, black choker, wearing a white collared shirt with black neck ribbon, cafe uniform, rain-soaked street at night, neon reflections on wet pavement, standing under a small umbrella, looking over her shoulder with a subtle smile, muted cinematic color palette, film grain, shallow depth of field, dramatic rim lighting, dynamic pose',
      sampler: 'Euler a',
      steps: 30,
      cfgScale: 7,
      model: 'Plant Milk 🌿 - Model Suite (Walnut)',
      width: 1248,
      height: 1824,
      loras: [
        {
          rawName: 'CSMMovieStyleIL',
          strength: 0.5,
          civitaiVersionId: 2681478,
          resolved: {
            name: '[Illustrious XL] Chainsaw Man - The Movie: Reze Arc (劇場版 チェンソーマン レゼ篇) | Character Pack + Style',
            source: 'civitai',
            modelUrl:
              'https://civitai.com/models/2384018/illustrious-xl-chainsaw-man-the-movie-reze-arc-or-character-pack-style?modelVersionId=2681478',
            triggerWords: ['chainsaw man movie style', 'reze'],
            baseModel: 'Illustrious',
            matchedBy: 'manual',
          },
        },
      ],
      detectedFormat: 'unknown',
      extraFields: {
        'Clip skip': '2',
        civitaiCheckpointVersionId: 1714002,
        note: 'This copy of the image has no embedded metadata (it was re-saved without EXIF). The settings were supplied by the image author.',
      },
    },
  },
  {
    id: 'sample-4',
    title: 'Watercolor Hound',
    folder: 'Illustrations',
    source: 'Civitai',
    date: 'Sep 23, 2026',
    model: 'Hyphoria (v0.02)',
    dimensions: '1024 × 1024',
    isFavorite: false,
    thumbnailUrl: 'samples/watercolor-hound.jpg',
    metadata: {
      prompt:
        'masterpiece, best quality, very aesthetic, absurdres, chalk pastel, watercolor, traditional media, solo, orange hound, dog, floppy ears, orange fur, cream underside, dark brown eyes, black nose, wearing a simple purple collar, standing, right paw, tail slightly raised, pointing at with nose, looking in the direction he is pointing, soft pastel texture, grainy paper surface, watercolor washes, muted orange and warm earth tones, dark blue background, soft edges, texture, artistic, hand-drawn, b3Jp, traditional media.',
      negativePrompt:
        'worst quality, low quality, blurry, jpeg artifacts, text, watermark, signature, digital illustration, thick borders, bold outlines, cel shading, flat colors, anime style, realistic, photorealistic, 3d render, oversaturated, neon colors, extra limbs, deformed paws, bad anatomy, monochrome, sketch',
      sampler: 'Heun',
      steps: 30,
      cfgScale: 7,
      seed: '1541505910',
      model: 'Hyphoria (v0.02)',
      width: 1024,
      height: 1024,
      loras: [
        {
          rawName: 'Watercolor/saturated | Illustrious Style Lora',
          strength: 0.6,
          civitaiVersionId: 1714931,
          resolved: {
            name: 'Watercolor/saturated | Illustrious Style Lora',
            source: 'civitai',
            modelUrl:
              'https://civitai.com/models/1362657/watercolorsaturated-or-illustrious-style-lora?modelVersionId=1714931',
            baseModel: 'Illustrious',
            matchedBy: 'civitai-version',
          },
        },
      ],
      detectedFormat: 'a1111',
      extraFields: {
        Steps: '30',
        Sampler: 'Heun',
        'CFG scale': '7',
        Seed: '1541505910',
        Size: '1024x1024',
        'Clip skip': '2',
        'Created Date': '2026-09-23T08:45:09.3407137Z',
        'Civitai resources':
          '[{"type":"checkpoint","modelVersionId":2862490,"modelName":"Hyphoria","modelVersionName":"v0.02"},{"type":"lora","weight":0.6,"modelVersionId":1714931,"modelName":"Watercolor/saturated | Illustrious Style Lora","modelVersionName":"v1.1 illustriousXL v01"}]',
        'Civitai metadata':
          '{"workflow":"txt2img","priority":"low","outputFormat":"jpeg","ecosystem":"Illustrious","aspectRatio":{"value":"1:1","width":1024,"height":1024},"prompt":"masterpiece, best quality, very aesthetic, absurdres, chalk pastel, watercolor, traditional media, solo, orange hound, dog, floppy ears, orange fur, cream underside, dark brown eyes, black nose, wearing a simple purple collar, standing, right paw, tail slightly raised, pointing at with nose, looking in the direction he is pointing, soft pastel texture, grainy paper surface, watercolor washes, muted orange and warm earth tones, dark blue background, soft edges, texture, artistic, hand-drawn, b3Jp, traditional media.","negativePrompt":"worst quality, low quality, blurry, jpeg artifacts, text, watermark, signature, digital illustration, thick borders, bold outlines, cel shading, flat colors, anime style, realistic, photorealistic, 3d render, oversaturated, neon colors, extra limbs, deformed paws, bad anatomy, monochrome, sketch","sampler":"Heun","cfgScale":7,"steps":30,"clipSkip":2,"seed":1541505910,"enhancedCompatibility":false,"quantity":1,"resources":[{"modelVersionId":2862490,"strength":1,"type":"Checkpoint"},{"modelVersionId":1714931,"strength":0.6,"type":"LORA"}]}',
        civitaiCheckpointVersionId: 2862490,
      },
    },
  },
];

/** Thumbnails used by the placeholder samples shipped before v1.0.8 */
export const isLegacyPlaceholderSample = (item: SavedPromptItem): boolean =>
  item.id.startsWith('sample-') &&
  typeof item.thumbnailUrl === 'string' &&
  item.thumbnailUrl.includes('images.unsplash.com');
