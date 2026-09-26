import type { ExtractedMetadata, LoraReference } from '../types.js';
import { samplerLabel } from '../sampler-names.js';
import { diceCoefficient } from '../similarity.js';
import { INLINE_LORA_TAG } from '../metadata-merge.js';

/**
 * Parses settings string into key-value pairs while respecting quotes.
 * Example: 'Steps: 30, Sampler: DPM++ 2M Karras, CFG scale: 7, Size: 1024x1024, Lora hashes: "foo: 12345, bar: 67890"'
 */
function parseSettingsPairs(settingsStr: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let currentKey = '';
  let currentValue = '';
  let readingKey = true;
  let inQuotes = false;
  // JSON values (Civitai resources / metadata) contain commas between quoted strings;
  // only split at depth 0
  let depth = 0;

  for (let i = 0; i < settingsStr.length; i++) {
    const char = settingsStr[i];

    if (char === '\\' && inQuotes && !readingKey) {
      currentValue += char + (settingsStr[i + 1] ?? '');
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
      if (readingKey) currentKey += char;
      else currentValue += char;
    } else if (!inQuotes && !readingKey && (char === '[' || char === '{')) {
      depth++;
      currentValue += char;
    } else if (!inQuotes && !readingKey && (char === ']' || char === '}')) {
      depth = Math.max(0, depth - 1);
      currentValue += char;
    } else if (char === ':' && readingKey && !inQuotes) {
      readingKey = false;
      if (settingsStr[i + 1] === ' ') i++;
    } else if ((char === ',' || char === ';') && !inQuotes && depth === 0) {
      if (currentKey) {
        fields[currentKey.trim()] = currentValue.trim();
      }
      currentKey = '';
      currentValue = '';
      readingKey = true;
      depth = 0;
      if (settingsStr[i + 1] === ' ') i++;
    } else {
      if (readingKey) {
        currentKey += char;
      } else {
        currentValue += char;
      }
    }
  }

  if (currentKey) {
    fields[currentKey.trim()] = currentValue.trim();
  }

  return fields;
}

/**
 * Extracts and removes inline <lora:name:strength...> tags from prompt string.
 * Supports:
 *  - Standard: <lora:name:1>
 *  - Multi-weight / Forge: <lora:name:0.8:0.8>
 *  - LBW / Complex: <lora:name:0.8:lbw=...> or <lora:name:0.8:1.0:lbw=...>
 */
export function extractInlineLoras(prompt: string): { cleanPrompt: string; loras: LoraReference[] } {
  const loras: LoraReference[] = [];
  // Greedy on the weight/parameter segment to safely capture Forge / WebUI 1.6+ multi-weights
  const loraRegex = new RegExp(INLINE_LORA_TAG.source, 'gi');

  let cleanPrompt = prompt.replace(loraRegex, (_match, rawName, paramsStr) => {
    let strength = 1.0;
    if (paramsStr) {
      // Split by colon or comma for multi-weight (model_weight:clip_weight)
      const firstParam = paramsStr.split(/[:;,]/)[0]?.trim();
      const parsed = parseFloat(firstParam);
      if (Number.isFinite(parsed)) {
        strength = parsed;
      }
    }

    loras.push({
      rawName: rawName.trim(),
      strength,
    });
    return '';
  });

  cleanPrompt = cleanPrompt
    .replace(/,(\s*,)+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^,\s*|,\s*$/g, '');

  return { cleanPrompt, loras };
}

/**
 * Parses AddNet (Additional Networks) extension parameters.
 * Pattern:
 *  AddNet Enabled: True
 *  AddNet Module 1: LoRA, AddNet Model 1: my_lora_name(hash), AddNet Weight A 1: 0.8
 */
function parseAddNetLoras(settings: Record<string, string>, loras: LoraReference[]): void {
  for (let i = 1; i <= 10; i++) {
    const moduleKey = Object.keys(settings).find((k) => new RegExp(`^AddNet Module ${i}$`, 'i').test(k));
    const modelKey = Object.keys(settings).find((k) => new RegExp(`^AddNet Model ${i}$`, 'i').test(k));
    const weightKey = Object.keys(settings).find((k) => new RegExp(`^AddNet Weight A ${i}$`, 'i').test(k));

    if (modelKey && settings[modelKey]) {
      const isLora = !moduleKey || /lora/i.test(settings[moduleKey]);
      if (isLora) {
        let rawModel = settings[modelKey].trim();
        let hash: string | undefined;

        // Check if model contains hash in parentheses: "name(1234abcd)"
        const hashMatch = rawModel.match(/^(.+?)\(([^)]+)\)$/);
        if (hashMatch) {
          rawModel = hashMatch[1].trim();
          hash = hashMatch[2].trim();
        }

        const weight = weightKey && settings[weightKey] ? parseFloat(settings[weightKey]) : 1.0;

        const existing = loras.find((l) => l.rawName.toLowerCase() === rawModel.toLowerCase());
        if (existing) {
          if (hash && !existing.hash) existing.hash = hash;
          if (Number.isFinite(weight)) existing.strength = weight;
        } else {
          loras.push({
            rawName: rawModel,
            strength: Number.isFinite(weight) ? weight : 1.0,
            hash,
          });
        }
      }
    }
  }
}

/**
 * Parses Civitai Resources JSON if embedded in settings.
 * Example: Civitai resources: [{"type":"lora","modelVersionId":1234,"modelName":"foo","weight":0.8}]
 */
interface CivitaiCheckpoint {
  name?: string;
  versionId?: number;
}

function parseCivitaiResources(settings: Record<string, string>, loras: LoraReference[]): CivitaiCheckpoint | undefined {
  let checkpoint: CivitaiCheckpoint | undefined;
  const resourceKey = Object.keys(settings).find((k) =>
    /^(Civitai resources|Resources|civitai_resources)$/i.test(k)
  );

  if (resourceKey && settings[resourceKey]) {
    try {
      const raw = settings[resourceKey];
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          // Civitai on-site images name the checkpoint only here, not in a "Model:" field
          if ((item.type === 'checkpoint' || item.kind === 'checkpoint') && !checkpoint) {
            const versionName = typeof item.modelVersionName === 'string' ? item.modelVersionName : '';
            const modelName = typeof item.modelName === 'string' ? item.modelName : '';
            checkpoint = {
              name: modelName ? (versionName ? `${modelName} (${versionName})` : modelName) : undefined,
              versionId: Number.isFinite(Number(item.modelVersionId)) ? Number(item.modelVersionId) : undefined,
            };
          }
          if (item.type === 'lora' || item.kind === 'lora') {
            const rawVersionId = item.modelVersionId ?? item.id;
            const versionId = rawVersionId != null && Number.isFinite(Number(rawVersionId)) ? Number(rawVersionId) : undefined;
            const rawName = item.modelName || item.name || (versionId ? `Civitai model version ${versionId}` : 'Unknown LoRA');
            const weight = typeof item.weight === 'number' ? item.weight : 1.0;
            const existing = loras.find(
              (l) =>
                (versionId !== undefined && l.civitaiVersionId === versionId) ||
                l.rawName.toLowerCase() === rawName.toLowerCase()
            );

            // The version id is resolved against /model-versions/{id} in resolveLoras;
            // it is not a model id, so no model URL is built from it here.
            if (existing) {
              existing.strength = weight;
              if (versionId !== undefined && existing.civitaiVersionId === undefined) {
                existing.civitaiVersionId = versionId;
              }
            } else {
              loras.push({ rawName, strength: weight, civitaiVersionId: versionId });
            }
          }
        }
      }
    } catch {
      // ignore invalid json
    }
  }
  return checkpoint;
}

/** Scheduler named in the "Civitai metadata" JSON (on-site generator), if any. */
function extraScheduler(settings: Record<string, string>): string | undefined {
  const key = Object.keys(settings).find((k) => /^Civitai metadata$/i.test(k));
  if (!key) return undefined;
  try {
    const parsed = JSON.parse(settings[key]);
    return typeof parsed?.scheduler === 'string' ? parsed.scheduler : undefined;
  } catch {
    return undefined;
  }
}

const tokenKey = (name: string) =>
  name
    .replace(/\.(safetensors|pt|ckpt)$/i, '')
    .replace(/[【】\[\]()（）]/g, ' ')
    .replace(/\b(lora|v?\d+(\.\d+)*)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();

/**
 * Civitai on-site images list each LoRA twice: as a <lora:file_name:w> prompt tag and
 * as a "Civitai resources" entry with the model's display name. Fold the tag into the
 * resource entry when their weights match and their names clearly agree.
 */
function mergeInlineTagsIntoResources(loras: LoraReference[]): void {
  for (let i = loras.length - 1; i >= 0; i--) {
    const tag = loras[i];
    if (tag.civitaiVersionId !== undefined) continue;
    const matches = loras.filter(
      (r) =>
        r !== tag &&
        r.civitaiVersionId !== undefined &&
        (r.strength ?? 1) === (tag.strength ?? 1) &&
        diceCoefficient(tokenKey(r.rawName), tokenKey(tag.rawName)) >= 0.8
    );
    if (matches.length === 1) {
      if (!matches[0].hash && tag.hash) matches[0].hash = tag.hash;
      loras.splice(i, 1);
    }
  }
}

/**
 * Parses the A1111 / SD WebUI / Forge / Fooocus `parameters` text block.
 * Handles both multi-line text and single-line / EXIF embedded parameter strings.
 */
export function parseA1111(
  rawText: string,
  imageDimensions?: { width?: number; height?: number }
): ExtractedMetadata {
  let normalizedText = rawText.trim();

  // If text is single-line with inline Negative prompt: or Steps:, inject newlines
  if (!normalizedText.includes('\n')) {
    normalizedText = normalizedText
      .replace(/\s+(Negative prompt:)\s*/i, '\n$1 ')
      .replace(/\s+(Steps:\s*\d+)/i, '\n$1');
  }

  const lines = normalizedText.split(/\r?\n/);
  const promptLines: string[] = [];
  const negativeLines: string[] = [];
  const settingsLines: string[] = [];

  let state: 'prompt' | 'negative' | 'settings' = 'prompt';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^Negative prompt:/i.test(line)) {
      state = 'negative';
      negativeLines.push(line.replace(/^Negative prompt:\s*/i, ''));
    } else if (
      /^(Steps:\s*\d+|Sampler:|Size:\s*\d+x\d+)/i.test(line) ||
      (line.includes('Steps:') && line.includes('Sampler:')) ||
      (line.includes('Steps:') && line.includes('Seed:'))
    ) {
      state = 'settings';
      settingsLines.push(line);
    } else if (state === 'prompt') {
      promptLines.push(line);
    } else if (state === 'negative') {
      if (line.includes('Steps:') && (line.includes('Sampler:') || line.includes('Seed:'))) {
        state = 'settings';
        settingsLines.push(line);
      } else {
        negativeLines.push(line);
      }
    } else if (state === 'settings') {
      settingsLines.push(line);
    }
  }

  const rawPrompt = promptLines.join('\n').trim();
  const rawNegativePrompt = negativeLines.join('\n').trim();
  const settingsStr = settingsLines.join(', ').trim();

  const settings = parseSettingsPairs(settingsStr);
  const { cleanPrompt, loras } = extractInlineLoras(rawPrompt);

  // Parse Lora hashes: "name: hash, name2: hash2"
  const loraHashesKey = Object.keys(settings).find((k) => /^Lora hashes$/i.test(k));
  const loraHashesRaw = loraHashesKey ? settings[loraHashesKey] : undefined;
  if (loraHashesRaw) {
    const unquoted = loraHashesRaw.replace(/^"+|"+$/g, '');
    const pairs = unquoted.split(',').map((s) => s.trim());
    for (const pair of pairs) {
      const [name, hash] = pair.split(':').map((s) => s.trim());
      if (name && hash) {
        const existing = loras.find(
          (l) => l.rawName.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          existing.hash = hash;
        } else {
          loras.push({ rawName: name, hash });
        }
      }
    }
  }

  // Parse AddNet Extension LoRAs
  parseAddNetLoras(settings, loras);

  // Parse Civitai Resources JSON
  const civitaiCheckpoint = parseCivitaiResources(settings, loras);
  mergeInlineTagsIntoResources(loras);

  // Parse Dimensions from Size: WxH
  let width = imageDimensions?.width;
  let height = imageDimensions?.height;

  const sizeKey = Object.keys(settings).find((k) => /^Size$/i.test(k));
  if (sizeKey && settings[sizeKey]) {
    const match = settings[sizeKey].match(/^(\d+)x(\d+)$/i);
    if (match) {
      width = parseInt(match[1], 10);
      height = parseInt(match[2], 10);
    }
  }

  const stepsKey = Object.keys(settings).find((k) => /^Steps$/i.test(k));
  const steps = stepsKey && settings[stepsKey] ? parseInt(settings[stepsKey], 10) : undefined;

  const cfgKey = Object.keys(settings).find((k) => /^CFG scale$/i.test(k));
  const cfgScale = cfgKey && settings[cfgKey] ? parseFloat(settings[cfgKey]) : undefined;

  const samplerKey = Object.keys(settings).find((k) => /^Sampler$/i.test(k));
  const seedKey = Object.keys(settings).find((k) => /^Seed$/i.test(k));
  const modelKey = Object.keys(settings).find((k) => /^Model$/i.test(k));
  const modelHashKey = Object.keys(settings).find((k) => /^Model hash$/i.test(k));

  return {
    prompt: cleanPrompt,
    negativePrompt: rawNegativePrompt || undefined,
    sampler: samplerKey ? samplerLabel(settings[samplerKey], extraScheduler(settings)) : undefined,
    steps: Number.isFinite(steps) ? steps : undefined,
    cfgScale: Number.isFinite(cfgScale) ? cfgScale : undefined,
    seed: seedKey ? settings[seedKey] : undefined,
    model: modelKey ? settings[modelKey] : civitaiCheckpoint?.name,
    modelHash: modelHashKey ? settings[modelHashKey] : undefined,
    modelVersionId: civitaiCheckpoint?.versionId,
    width,
    height,
    loras,
    detectedFormat: 'a1111',
    extraFields: civitaiCheckpoint?.versionId
      ? { ...settings, civitaiCheckpointVersionId: civitaiCheckpoint.versionId }
      : settings,
  };
}
