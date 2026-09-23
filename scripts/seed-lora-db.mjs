import fs from 'node:fs';

const API_KEY = process.env.CIVITAI_API_KEY ?? '';
const PAGES = 10; // 100 per page × 10 = 1,000 top LoRAs
const entries = [];

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\.(safetensors|pt|ckpt)$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\b(v\d[\d.]*|sdxl|sd15|sd1\.5|pony|flux|epoch\d+|offset|lora)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  console.log(`Fetching top LoRAs from Civitai API (up to ${PAGES * 100} models)...`);
  for (let page = 1; page <= PAGES; page++) {
    const url = `https://civitai.com/api/v1/models?types=LORA&sort=Most%20Downloaded&limit=100&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'PromptHound/1.0.4 (Metadata-Extractor)',
          'Accept': 'application/json',
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        },
      });

      if (!res.ok) {
        console.warn(`Page ${page} failed with status ${res.status}`);
        break;
      }

      const data = await res.json();
      if (!data.items || data.items.length === 0) break;

      for (const model of data.items) {
        const version = model.modelVersions?.[0];
        if (!version) continue;

        const coverImage = version.images?.[0];
        entries.push({
          civitaiModelId: model.id,
          civitaiVersionId: version.id,
          name: model.name,
          normalizedAlias: normalize(model.name),
          hashSha256: version.files?.[0]?.hashes?.SHA256 ?? null,
          coverImageId: coverImage?.id ? String(coverImage.id) : undefined,
          coverImageUrl: coverImage?.url ?? undefined,
          triggerWords: version.trainedWords ?? [],
          baseModel: version.baseModel ?? 'Unknown',
          modelUrl: `https://civitai.com/models/${model.id}?modelVersionId=${version.id}`,
        });
      }

      console.log(`Page ${page}: collected ${entries.length} models so far`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`Error fetching page ${page}:`, err.message);
      break;
    }
  }

  if (entries.length > 0) {
    fs.mkdirSync('core/data', { recursive: true });
    fs.writeFileSync(
      'core/data/lora-seed.json',
      JSON.stringify(entries, null, 2)
    );
    console.log(`Successfully wrote ${entries.length} entries to core/data/lora-seed.json`);
  }
}

run();
