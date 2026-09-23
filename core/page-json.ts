import * as cheerio from 'cheerio';
import type { ExtractedMetadata, LoraReference } from './types.js';

interface PageScrapeResult {
  metadata?: ExtractedMetadata;
  primaryImageUrl?: string;
}

/**
 * Recursively inspects a JSON tree to find an object containing AI generation metadata.
 */
function findMetadataObject(obj: any): any | null {
  if (!obj || typeof obj !== 'object') return null;

  // Check if current object looks like an image metadata or generation details block
  if (
    typeof obj.prompt === 'string' &&
    obj.prompt.length > 5 &&
    (obj.sampler || obj.steps || obj.cfgScale || obj.seed || obj.negativePrompt || obj.meta)
  ) {
    return obj;
  }

  // Civitai specific structures: obj.meta with prompt
  if (obj.meta && typeof obj.meta.prompt === 'string') {
    return { ...obj.meta, url: obj.url };
  }

  for (const key of Object.keys(obj)) {
    // Avoid traversing huge raw arrays or cycles
    if (key === 'comments' || key === 'reactions') continue;
    const found = findMetadataObject(obj[key]);
    if (found) return found;
  }

  return null;
}

/**
 * Extracts AI generation metadata from HTML containing embedded Next.js or inline JSON.
 */
export function scrapePageMetadata(html: string): PageScrapeResult {
  const $ = cheerio.load(html);

  // Extract primary image URL
  const ogImage = $('meta[property="og:image"]').attr('content');
  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  const primaryImageUrl = ogImage || twitterImage || $('img').first().attr('src');

  // 1. Try Next.js __NEXT_DATA__
  const nextDataScript = $('#__NEXT_DATA__').html();
  let candidateJson: any = null;

  if (nextDataScript) {
    try {
      const parsed = JSON.parse(nextDataScript);
      candidateJson = findMetadataObject(parsed);
    } catch {
      // Continue to inline scripts
    }
  }

  // 2. If not found, scan inline <script> tags
  if (!candidateJson) {
    $('script').each((_i, elem) => {
      const scriptContent = $(elem).html() || '';
      if (
        (scriptContent.includes('"prompt"') || scriptContent.includes('Negative prompt')) &&
        (scriptContent.includes('Sampler') || scriptContent.includes('sampler'))
      ) {
        try {
          // Attempt parsing if pure JSON or json-ld
          const parsed = JSON.parse(scriptContent);
          const found = findMetadataObject(parsed);
          if (found) {
            candidateJson = found;
            return false; // break each
          }
        } catch {
          // May be JS assignment, ignore
        }
      }
    });
  }

  if (!candidateJson) {
    return { primaryImageUrl };
  }

  const loras: LoraReference[] = [];
  if (Array.isArray(candidateJson.resources)) {
    for (const res of candidateJson.resources) {
      if (res.modelType === 'LORA' || res.modelType === 'LoCon' || res.type === 'lora') {
        loras.push({
          rawName: res.name || res.modelName || 'Unknown LoRA',
          strength: typeof res.strength === 'number' ? res.strength : 1.0,
          hash: res.hash,
        });
      }
    }
  }

  const metadata: ExtractedMetadata = {
    prompt: candidateJson.prompt || '',
    negativePrompt: candidateJson.negativePrompt || candidateJson.negative_prompt,
    sampler: candidateJson.sampler || candidateJson.sampler_name,
    steps: candidateJson.steps ? Number(candidateJson.steps) : undefined,
    cfgScale: candidateJson.cfgScale || candidateJson.cfg_scale ? Number(candidateJson.cfgScale || candidateJson.cfg_scale) : undefined,
    seed: candidateJson.seed,
    model: candidateJson.model || candidateJson.baseModel,
    width: candidateJson.width ? Number(candidateJson.width) : undefined,
    height: candidateJson.height ? Number(candidateJson.height) : undefined,
    loras,
    detectedFormat: 'page-json',
  };

  return { metadata, primaryImageUrl };
}
