/**
 * Step 1 of the LoRA identification benchmark: downloads real Civitai images (original
 * files, metadata intact) plus ground truth, i.e. the model versions Civitai lists for
 * each image. Images come from 60 random catalog LoRAs and two general feeds.
 *
 *   CIVITAI_API_KEY=... npm run benchmark:collect   (writes .benchmark/)
 */
import fs from 'node:fs';
const DIR = process.argv[2] || '.benchmark';
fs.mkdirSync(`${DIR}/img`, { recursive: true });
const KEY = process.env.CIVITAI_API_KEY!;
const H = { Authorization: `Bearer ${KEY}`, Accept: 'application/json' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function j(url: string) {
  for (let a = 0; a < 5; a++) {
    const r = await fetch(url, { headers: H });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * 2 ** a); continue; }
    throw new Error(`${r.status} ${url}`);
  }
  throw new Error('retries ' + url);
}
const catalog: any[] = JSON.parse(fs.readFileSync('core/data/lora-seed.json', 'utf8'));
const loraVersions = [...new Set(catalog.filter((e) => e.modelType !== 'Checkpoint').map((e) => e.civitaiVersionId))];
let seedRand = 42; const rnd = () => ((seedRand = (seedRand * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const picked = loraVersions.sort(() => rnd() - 0.5).slice(0, 60);
const queries = [
  ...picked.map((v) => `modelVersionId=${v}&limit=6`),
  'sort=Most%20Reactions&period=Month&limit=100',
  'sort=Newest&limit=100',
];
const images = new Map<number, any>();
for (const q of queries) {
  try {
    const d = await j(`https://civitai.com/api/v1/images?withMeta=true&nsfw=X&${q}`);
    for (const it of d.items || []) if (it.type === 'image' && Array.isArray(it.modelVersionIds) && it.modelVersionIds.length) images.set(it.id, it);
  } catch (e) { console.error(String(e)); }
  process.stdout.write(`\rqueries done, images: ${images.size}`);
  await sleep(300);
}
console.log();
// Model type per version (to know which truth entries are LoRAs)
const types: Record<number, { type: string; modelId: number; name: string }> = {};
for (const e of catalog) types[e.civitaiVersionId] = { type: e.modelType, modelId: e.civitaiModelId, name: e.name };
const need = [...new Set([...images.values()].flatMap((i) => i.modelVersionIds))].filter((v) => !types[v]);
console.log('looking up', need.length, 'versions not in catalog');
for (const v of need) {
  try { const d = await j(`https://civitai.com/api/v1/model-versions/${v}`); types[v] = { type: d.model?.type, modelId: d.modelId, name: d.model?.name }; } catch { types[v] = { type: 'unknown', modelId: 0, name: '?' }; }
  await sleep(150);
}
let n = 0;
const truth: any[] = [];
for (const it of images.values()) {
  const file = `${DIR}/img/${it.id}.bin`;
  if (!fs.existsSync(file)) {
    const r = await fetch(it.url, { headers: H, redirect: 'follow' });
    if (!r.ok) continue;
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  truth.push({ id: it.id, url: it.url, baseModel: it.baseModel, onSiteMeta: it.meta ? Object.keys(it.meta).length : 0,
    versions: it.modelVersionIds.map((v: number) => ({ v, ...types[v] })) });
  if (++n % 20 === 0) process.stdout.write(`\rdownloaded ${n}/${images.size}`);
}
fs.writeFileSync(`${DIR}/truth.json`, JSON.stringify(truth, null, 1));
console.log(`\nsaved ${truth.length} images`);
