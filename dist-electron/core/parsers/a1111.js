"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseA1111 = parseA1111;
/**
 * Parses settings string into key-value pairs while respecting quotes.
 * Example: 'Steps: 30, Sampler: DPM++ 2M Karras, CFG scale: 7, Size: 1024x1024, Lora hashes: "foo: 12345, bar: 67890"'
 */
function parseSettingsPairs(settingsStr) {
    const fields = {};
    let currentKey = '';
    let currentValue = '';
    let readingKey = true;
    let inQuotes = false;
    for (let i = 0; i < settingsStr.length; i++) {
        const char = settingsStr[i];
        if (char === '"') {
            inQuotes = !inQuotes;
            currentValue += char;
        }
        else if (char === ':' && readingKey && !inQuotes) {
            readingKey = false;
            // Skip optional space after colon
            if (settingsStr[i + 1] === ' ')
                i++;
        }
        else if (char === ',' && !inQuotes) {
            if (currentKey) {
                fields[currentKey.trim()] = currentValue.trim();
            }
            currentKey = '';
            currentValue = '';
            readingKey = true;
            // Skip optional space after comma
            if (settingsStr[i + 1] === ' ')
                i++;
        }
        else {
            if (readingKey) {
                currentKey += char;
            }
            else {
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
 * Extracts and removes inline <lora:name:strength> tags from the positive prompt.
 */
function extractInlineLoras(prompt) {
    const loras = [];
    const loraRegex = /<lora:([^:>]+)(?::([^>]+))?>/gi;
    let cleanPrompt = prompt.replace(loraRegex, (_match, rawName, strengthStr) => {
        const strength = strengthStr !== undefined ? parseFloat(strengthStr) : 1.0;
        loras.push({
            rawName: rawName.trim(),
            strength: Number.isFinite(strength) ? strength : 1.0,
        });
        return '';
    });
    // Clean up duplicate commas or spacing left behind
    cleanPrompt = cleanPrompt
        .replace(/,\s*,+/g, ',')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .replace(/^,\s*|,\s*$/g, '');
    return { cleanPrompt, loras };
}
/**
 * Parses the A1111 / SD WebUI / Forge `parameters` text block.
 */
function parseA1111(rawText, imageDimensions) {
    const lines = rawText.split(/\r?\n/);
    let promptLines = [];
    let negativeLines = [];
    let settingsLines = [];
    let state = 'prompt';
    for (const line of lines) {
        if (line.startsWith('Negative prompt:')) {
            state = 'negative';
            negativeLines.push(line.replace(/^Negative prompt:\s*/, ''));
        }
        else if (/^(Steps:\s*\d+|Sampler:|Size:\s*\d+x\d+)/i.test(line) ||
            (line.includes('Steps:') && line.includes('Sampler:'))) {
            state = 'settings';
            settingsLines.push(line);
        }
        else if (state === 'prompt') {
            promptLines.push(line);
        }
        else if (state === 'negative') {
            if (line.includes('Steps:') && line.includes('Sampler:')) {
                state = 'settings';
                settingsLines.push(line);
            }
            else {
                negativeLines.push(line);
            }
        }
        else if (state === 'settings') {
            settingsLines.push(line);
        }
    }
    const rawPrompt = promptLines.join('\n').trim();
    const rawNegativePrompt = negativeLines.join('\n').trim();
    const settingsStr = settingsLines.join(', ').trim();
    const settings = parseSettingsPairs(settingsStr);
    const { cleanPrompt, loras } = extractInlineLoras(rawPrompt);
    // Parse Lora hashes: "name: hash, name2: hash2"
    const loraHashesRaw = settings['Lora hashes'] || settings['Lora Hashes'];
    if (loraHashesRaw) {
        const unquoted = loraHashesRaw.replace(/^"+|"+$/g, '');
        const pairs = unquoted.split(',').map((s) => s.trim());
        for (const pair of pairs) {
            const [name, hash] = pair.split(':').map((s) => s.trim());
            if (name && hash) {
                const existing = loras.find((l) => l.rawName.toLowerCase() === name.toLowerCase());
                if (existing) {
                    existing.hash = hash;
                }
                else {
                    loras.push({ rawName: name, hash });
                }
            }
        }
    }
    // Parse Dimensions from Size: WxH
    let width = imageDimensions?.width;
    let height = imageDimensions?.height;
    if (settings['Size']) {
        const match = settings['Size'].match(/^(\d+)x(\d+)$/i);
        if (match) {
            width = parseInt(match[1], 10);
            height = parseInt(match[2], 10);
        }
    }
    const steps = settings['Steps'] ? parseInt(settings['Steps'], 10) : undefined;
    const cfgScale = settings['CFG scale'] ? parseFloat(settings['CFG scale']) : undefined;
    return {
        prompt: cleanPrompt,
        negativePrompt: rawNegativePrompt || undefined,
        sampler: settings['Sampler'],
        steps: Number.isFinite(steps) ? steps : undefined,
        cfgScale: Number.isFinite(cfgScale) ? cfgScale : undefined,
        seed: settings['Seed'],
        model: settings['Model'],
        modelHash: settings['Model hash'] || settings['Model Hash'],
        width,
        height,
        loras,
        detectedFormat: 'a1111',
        extraFields: settings,
    };
}
