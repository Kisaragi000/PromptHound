/**
 * Builds core/data/lora-seed.json, PromptHound's offline LoRA catalog, from Civitai's
 * public REST API, and verifies an existing catalog against it.
 *
 *   npm run catalog:build  -- [options]   Fetch and write a new catalog
 *   npm run catalog:verify -- [options]   Check the current catalog; writes nothing
 *
 * Options
 *   --models N        Most-downloaded LoRA / LoCon / DoRA models to fetch (default 2000)
 *   --versions N      Newest versions to keep per model (default 3)
 *   --checkpoints N   Most-downloaded checkpoints with full records (newest version,
 *                     cover image) for base-model identification (default 1000); their
 *                     older versions go into the compact index
 *   --compact-models N  Total LoRA models to cover (default 10000). Models beyond --models
 *                     go into the compact index only: name, ids and hash prefixes, so
 *                     images using them are still identified offline
 *   --include FILE    Model-version ids that must be in the catalog even if not in the
 *                     top N, e.g. checkpoints (default scripts/catalog-includes.json)
 *   --extra FILE      Extra hand-made records to merge (JSON array, same shape as the
 *                     catalog), e.g. private or non-Civitai models
 *   --all-covers      Keep cover images of any rating (default: PG-rated covers only)
 *   --out FILE        Output path (default core/data/lora-seed.json)
 *   --index-out FILE  Compact index of every other version of the catalog's models
 *                     (default core/data/lora-version-index.json)
 *   --api-base URL    API root (default https://civitai.com/api/v1)
 *   --dry-run         Fetch and report, but do not write
 *
 * Environment
 *   CIVITAI_API_KEY   Optional; raises Civitai's rate limits
 *
 * Every record comes straight from the API. Nothing is inferred: trigger words are the
 * version's trainedWords, hashes are the primary file's SHA256 as Civitai reports it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeLoraName } from '../core/lora-resolution.js';
import { civitaiThumbnail } from '../core/civitai-images.js';

interface CatalogRecord {
  civitaiModelId: number;
  civitaiVersionId: number;
  name: string;
  versionName?: string;
  normalizedAlias: string;
  hashSha256?: string;
  /** Hash of the weights only (first 12 hex); what A1111 writes in "Lora hashes" */
  hashAutoV3?: string;
  coverImageUrl?: string;
  triggerWords: string[];
  baseModel?: string;
  modelType?: string;
  nsfw?: boolean;
  source: 'civitai' | 'local';
  modelUrl: string;
}

const LORA_TYPES = ['LORA', 'LoCon', 'DoRA'];
const MAX_TRIGGER_WORDS = 12;
// Shorter aliases ("xl", "3d") would match far too many unrelated LoRA names
const MIN_ALIAS_LENGTH = 4;

// Upload-generated file names ("pyewdxjpyz8p8r0f1gk7qrzsx0") identify nothing
const looksRandom = (alias: string) =>
  alias.split(' ').some((t) => /=/.test(t) || (t.length >= 12 && /\d/.test(t) && /[a-z]/.test(t)));

// Titles are not paths: "Watercolor/saturated" must keep both words
const titleAlias = (title: string) => normalizeLoraName(title.replace(/[\\/]/g, ' ')).toLowerCase();

// ---------- options ----------

const args = process.argv.slice(2);
const mode = args[0] === 'verify' ? 'verify' : 'build';
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const MODEL_LIMIT = Number(option('models', '2000'));
const VERSIONS_PER_MODEL = Number(option('versions', '3'));
const COMPACT_LIMIT = Math.max(MODEL_LIMIT, Number(option('compact-models', '10000')));
const CHECKPOINT_LIMIT = Number(option('checkpoints', '1000'));
const INCLUDE_FILE = option('include', 'scripts/catalog-includes.json');
const EXTRA_FILE = option('extra', '');
const OUT_FILE = option('out', 'core/data/lora-seed.json');
const INDEX_FILE = option('index-out', 'core/data/lora-version-index.json');
const API_BASE = option('api-base', 'https://civitai.com/api/v1').replace(/\/$/, '');
const ALL_COVERS = flag('all-covers');
const DRY_RUN = flag('dry-run');
const API_KEY = process.env.CIVITAI_API_KEY ?? '';

// ---------- HTTP ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class NotFoundError extends Error {}

async function fetchJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'PromptHound catalog builder (+https://github.com/Kisaragi000/PromptHound)',
          Accept: 'application/json',
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        },
      });
    } catch (err) {
      if (attempt === 5) throw err;
      await sleep(2000 * 2 ** attempt);
      continue;
    }

    if (res.ok) return res.json();
    if (res.status === 404) throw new NotFoundError(`404 ${url}`);
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  throw new Error(`Gave up after retries: ${url}`);
}

// ---------- record building ----------

function primaryFile(version: any): any | undefined {
  const files: any[] = Array.isArray(version?.files) ? version.files : [];
  return files.find((f) => f.primary) || files.find((f) => /\.safetensors$/i.test(f.name || '')) || files[0];
}

function sha256Of(version: any): string | undefined {
  const hash = primaryFile(version)?.hashes?.SHA256;
  return typeof hash === 'string' && /^[0-9a-f]{64}$/i.test(hash) ? hash.toLowerCase() : undefined;
}

function autoV3Of(version: any): string | undefined {
  const hash = primaryFile(version)?.hashes?.AutoV3;
  return typeof hash === 'string' && /^[0-9a-f]{10,64}$/i.test(hash) ? hash.toLowerCase().slice(0, 12) : undefined;
}

function coverOf(version: any): string | undefined {
  const images: any[] = Array.isArray(version?.images) ? version.images : [];
  // nsfwLevel 1 = PG on Civitai; unrated images are skipped unless --all-covers
  const image = ALL_COVERS ? images[0] : images.find((i) => i?.nsfwLevel === 1);
  return typeof image?.url === 'string' ? civitaiThumbnail(image.url) : undefined;
}

function triggerWordsOf(version: any): string[] {
  const words: unknown[] = Array.isArray(version?.trainedWords) ? version.trainedWords : [];
  const clean = words
    .filter((w): w is string => typeof w === 'string')
    .map((w) => w.trim().replace(/,+$/, '').trim())
    .filter((w) => w.length > 0 && w.length <= 120);
  return Array.from(new Set(clean)).slice(0, MAX_TRIGGER_WORDS);
}

// Primary file name per version id, for file-name aliases
const fileNames = new Map<number, string>();

function toRecord(model: { id: number; name: string; type?: string; nsfw?: boolean }, version: any): CatalogRecord {
  const fileName = primaryFile(version)?.name;
  if (typeof fileName === 'string') fileNames.set(Number(version.id), fileName);
  return {
    civitaiModelId: Number(model.id),
    civitaiVersionId: Number(version.id),
    name: String(model.name).trim(),
    versionName: typeof version.name === 'string' ? version.name : undefined,
    normalizedAlias: '', // assigned later, once per alias across the whole catalog
    hashSha256: sha256Of(version),
    hashAutoV3: autoV3Of(version),
    coverImageUrl: coverOf(version),
    triggerWords: triggerWordsOf(version),
    baseModel: typeof version.baseModel === 'string' ? version.baseModel : undefined,
    modelType: model.type,
    nsfw: typeof model.nsfw === 'boolean' ? model.nsfw : undefined,
    source: 'civitai',
    modelUrl: `https://civitai.com/models/${model.id}?modelVersionId=${version.id}`,
  };
}

// ---------- fetching ----------

/** [versionId, modelId, first 10 hex of SHA256 (AutoV2), versionName, AutoV3 (12 hex)] */
type CompactVersion = [number, number, string, string, string];
const compactVersions: CompactVersion[] = [];
/** [modelId, name, alias, baseModel, modelType, nsfw 0/1] for models without full records */
type CompactModel = [number, string, string, string, string, number];
const compactModels: CompactModel[] = [];

const compactVersion = (model: any, version: any): CompactVersion => [
  Number(version.id),
  Number(model.id),
  sha256Of(version)?.slice(0, 10) ?? '',
  String(version.name ?? ''),
  autoV3Of(version) ?? '',
];

async function fetchTopModels(
  types: string[],
  fullLimit: number,
  compactLimit: number,
  versionsPerModel: number
): Promise<CatalogRecord[]> {
  const records: CatalogRecord[] = [];
  const typeParams = types.map((t) => `types=${t}`).join('&');
  let url: string | undefined =
    `${API_BASE}/models?${typeParams}&sort=Most%20Downloaded&period=AllTime&nsfw=true&limit=100`;
  let models = 0;
  const MODEL_LIMIT = fullLimit;
  const COMPACT_LIMIT = Math.max(fullLimit, compactLimit);
  const VERSIONS_PER_MODEL = versionsPerModel;

  while (url && models < COMPACT_LIMIT) {
    const data = await fetchJson(url);
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) break;

    for (const model of items) {
      if (models >= COMPACT_LIMIT) break;
      const versions: any[] = Array.isArray(model.modelVersions) ? model.modelVersions : [];
      if (versions.length === 0) continue;
      models++;
      if (models <= MODEL_LIMIT) {
        // The API lists versions newest first
        for (const version of versions.slice(0, VERSIONS_PER_MODEL)) records.push(toRecord(model, version));
        // Older versions are still used in images: keep just enough to map them to the model
        for (const version of versions.slice(VERSIONS_PER_MODEL)) compactVersions.push(compactVersion(model, version));
      } else {
        compactModels.push([
          Number(model.id),
          String(model.name).trim(),
          '', // alias assigned once full-record aliases are claimed
          String(versions[0]?.baseModel ?? ''),
          String(model.type ?? ''),
          model.nsfw ? 1 : 0,
        ]);
        for (const version of versions) compactVersions.push(compactVersion(model, version));
      }
    }

    process.stdout.write(`\r  models: ${models}/${COMPACT_LIMIT}, full versions: ${records.length}`);
    // Civitai paginates with a cursor; metadata.nextPage is the full next URL
    url = typeof data?.metadata?.nextPage === 'string' ? data.metadata.nextPage : undefined;
    await sleep(350);
  }
  process.stdout.write('\n');
  return records;
}

async function fetchVersion(versionId: number): Promise<CatalogRecord | null> {
  try {
    const version = await fetchJson(`${API_BASE}/model-versions/${versionId}`);
    if (!version?.modelId) return null;
    return toRecord(
      { id: version.modelId, name: version.model?.name ?? `Model ${version.modelId}`, type: version.model?.type, nsfw: version.model?.nsfw },
      version
    );
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---------- aliases ----------

/**
 * Two aliases per model: its display name and its primary file name, both normalized
 * exactly as the app normalizes LoRA names. Earlier (more downloaded) models claim an
 * alias first; only the newest version of a model carries it.
 */
// Aliases are claimed per kind: the app keeps separate name indexes for LoRAs and checkpoints
const claimedByKind = { lora: new Set<string>(), checkpoint: new Set<string>() };

function assignAliases(records: CatalogRecord[]): CatalogRecord[] {
  const seenModels = new Set<number>();
  const out: CatalogRecord[] = [];

  for (const record of records) {
    const claimed = claimedByKind[record.modelType === 'Checkpoint' ? 'checkpoint' : 'lora'];
    const isNewestVersion = !seenModels.has(record.civitaiModelId);
    seenModels.add(record.civitaiModelId);

    const nameAlias = titleAlias(record.name);
    if (isNewestVersion && nameAlias.length >= MIN_ALIAS_LENGTH && !claimed.has(nameAlias)) {
      claimed.add(nameAlias);
      out.push({ ...record, normalizedAlias: nameAlias });
    } else {
      out.push({ ...record, normalizedAlias: '' });
    }

    // Prompt tags and ComfyUI loaders use the file name, which often differs from the title
    const fileName = fileNames.get(record.civitaiVersionId);
    const fileAlias = fileName ? normalizeLoraName(fileName).toLowerCase() : '';
    if (fileAlias.length >= MIN_ALIAS_LENGTH && !looksRandom(fileAlias) && fileAlias !== nameAlias && !claimed.has(fileAlias)) {
      claimed.add(fileAlias);
      out.push({ ...record, normalizedAlias: fileAlias });
    }
  }
  return out;
}

// ---------- verify ----------

async function verify(): Promise<void> {
  const catalog: any[] = readJson(OUT_FILE);
  const byVersion = new Map<number, any[]>();
  for (const entry of catalog) {
    if (!entry.civitaiVersionId) continue;
    byVersion.set(entry.civitaiVersionId, [...(byVersion.get(entry.civitaiVersionId) || []), entry]);
  }

  console.log(`Verifying ${byVersion.size} model versions in ${OUT_FILE} against ${API_BASE}`);
  let problems = 0;
  for (const [versionId, entries] of byVersion) {
    const live = await fetchVersion(versionId);
    const issues: string[] = [];
    if (!live) {
      issues.push('version not found on Civitai');
    } else {
      for (const entry of entries) {
        if (entry.civitaiModelId !== live.civitaiModelId) issues.push(`model id ${entry.civitaiModelId} != ${live.civitaiModelId}`);
        if (entry.name !== live.name) issues.push(`name "${entry.name}" != "${live.name}"`);
        if (entry.hashSha256 && entry.hashSha256 !== live.hashSha256) issues.push('hash does not match the primary file');
        const extraTriggers = (entry.triggerWords || []).filter((w: string) => !live.triggerWords.includes(w));
        if (extraTriggers.length) issues.push(`trigger words not on Civitai: ${extraTriggers.join(', ')}`);
      }
    }
    const label = `${versionId} ${entries[0].name}`;
    if (issues.length) {
      problems++;
      console.log(`  MISMATCH ${label}\n    - ${Array.from(new Set(issues)).join('\n    - ')}`);
    } else {
      console.log(`  ok       ${label}`);
    }
    await sleep(250);
  }
  const noVersion = catalog.filter((e) => !e.civitaiVersionId).length;
  if (noVersion) console.log(`  ${noVersion} entries have no version id and cannot be checked`);
  console.log(problems ? `\n${problems} of ${byVersion.size} versions have problems.` : '\nAll versions match Civitai.');
  process.exitCode = problems ? 1 : 0;
}

// ---------- build ----------

async function build(): Promise<void> {
  console.log(`Fetching the ${COMPACT_LIMIT} most-downloaded ${LORA_TYPES.join('/')} models (top ${MODEL_LIMIT} with full records, ${VERSIONS_PER_MODEL} versions each)`);
  const topLoras = await fetchTopModels(LORA_TYPES, MODEL_LIMIT, COMPACT_LIMIT, VERSIONS_PER_MODEL);
  let topCheckpoints: CatalogRecord[] = [];
  if (CHECKPOINT_LIMIT > 0) {
    console.log(`Fetching the ${CHECKPOINT_LIMIT} most-downloaded checkpoints (newest version with full records)`);
    topCheckpoints = await fetchTopModels(['Checkpoint'], CHECKPOINT_LIMIT, CHECKPOINT_LIMIT, 1);
  }
  const top = [...topLoras, ...topCheckpoints];

  const includeIds: number[] = fs.existsSync(INCLUDE_FILE) ? readJson(INCLUDE_FILE).modelVersionIds || [] : [];
  const have = new Set(top.map((r) => r.civitaiVersionId));
  const included: CatalogRecord[] = [];
  const missing: number[] = [];
  if (includeIds.length) console.log(`Fetching ${includeIds.length} required versions from ${INCLUDE_FILE}`);
  for (const id of includeIds) {
    if (have.has(id)) continue;
    const record = await fetchVersion(id);
    if (record) included.push(record);
    else missing.push(id);
    await sleep(250);
  }

  let records = assignAliases([...top, ...included]);
  // Compact-tier models get a title alias only where no full-record model claimed it
  for (const model of compactModels) {
    const claimed = claimedByKind[model[4] === 'Checkpoint' ? 'checkpoint' : 'lora'];
    const alias = titleAlias(model[1]);
    if (alias.length >= MIN_ALIAS_LENGTH && !claimed.has(alias)) {
      claimed.add(alias);
      model[2] = alias;
    }
  }

  if (EXTRA_FILE) {
    const extra: any[] = readJson(EXTRA_FILE);
    const valid = extra.filter(
      (e) => e && typeof e.name === 'string' && typeof e.modelUrl === 'string' && (e.source === 'civitai' || e.source === 'local')
    );
    console.log(`Merging ${valid.length} of ${extra.length} records from ${EXTRA_FILE}`);
    records = [...records, ...valid];
  }

  const withHash = records.filter((r) => r.hashSha256).length;
  const aliases = records.filter((r) => r.normalizedAlias).length;
  console.log(`\nCatalog: ${records.length} records, ${new Set(records.map((r) => r.civitaiVersionId)).size} versions, ${withHash} with SHA256, ${aliases} aliases`);
  if (missing.length) console.log(`Not found on Civitai (skipped): ${missing.join(', ')}`);

  if (top.length === 0) {
    console.error('No models were fetched; keeping the existing catalog.');
    process.exitCode = 1;
    return;
  }
  if (DRY_RUN) {
    console.log('Dry run: nothing written.');
    return;
  }

  // One record per line keeps diffs readable
  const body = `[\n${records.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]\n`;
  const tmp = `${OUT_FILE}.tmp`;
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, OUT_FILE);
  console.log(`Wrote ${OUT_FILE} (${(Buffer.byteLength(body) / 1024).toFixed(0)} KB)`);

  const indexBody = JSON.stringify({ format: 2, models: compactModels, versions: compactVersions });
  fs.writeFileSync(`${INDEX_FILE}.tmp`, indexBody);
  fs.renameSync(`${INDEX_FILE}.tmp`, INDEX_FILE);
  console.log(
    `Wrote ${INDEX_FILE} (${compactModels.length} compact models, ${compactVersions.length} versions, ${(Buffer.byteLength(indexBody) / 1024).toFixed(0)} KB)`
  );
}

(mode === 'verify' ? verify() : build()).catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
