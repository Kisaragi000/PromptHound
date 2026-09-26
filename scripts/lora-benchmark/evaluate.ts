/**
 * Step 2 of the LoRA identification benchmark: runs PromptHound's extractor on every
 * collected image and compares each identified LoRA with the ground truth.
 *
 *   npm run benchmark:eval -- offline   bundled catalog only (network blocked)
 *   npm run benchmark:eval -- online    live Civitai lookups (needs CIVITAI_API_KEY)
 *
 * "found" counts ground-truth LoRAs identified (right model). Hashed LoRAs are also
 * checked against Civitai's by-hash lookup ("hashVerified"), which is authoritative;
 * Civitai's per-image lists are often incomplete, so "wrong" for unhashed name matches
 * is an upper bound.
 */
import fs from 'node:fs';
const MODE = (process.argv[2] || 'offline') as 'offline' | 'online';
const DIR = process.argv[3] || '.benchmark';
const realFetch = globalThis.fetch;
if (MODE === 'offline') (globalThis as any).fetch = async () => { throw new Error('offline'); };
const { extractFromImageBuffer } = await import('../../core/link-fetch.js');
const { setRuntimeCivitaiApiKey } = await import('../../core/lora-resolution.js');
if (MODE === 'online') setRuntimeCivitaiApiKey(process.env.CIVITAI_API_KEY!);
const LORA = new Set(['LORA', 'LoCon', 'DoRA']);
// Authoritative answer for hashed LoRAs: Civitai's own by-hash lookup (cached on disk)
const hashFile = `${DIR}/hashtruth.json`;
const hashTruth: Record<string, { modelId: number; versionId: number; name: string } | null> = fs.existsSync(hashFile) ? JSON.parse(fs.readFileSync(hashFile, 'utf8')) : {};
async function truthForHash(h: string) {
  const k = h.toLowerCase().replace(/^0x/, '');
  if (k in hashTruth) return hashTruth[k];
  const r = await realFetch(`https://civitai.com/api/v1/model-versions/by-hash/${k}`, { headers: { Authorization: `Bearer ${process.env.CIVITAI_API_KEY}` } });
  hashTruth[k] = r.ok ? await r.json().then((d: any) => ({ modelId: d.modelId, versionId: d.id, name: d.model?.name })) : null;
  return hashTruth[k];
}
const truth: any[] = JSON.parse(fs.readFileSync(`${DIR}/truth.json`, 'utf8'));
const v = { hashedResolved: 0, hashedCorrect: 0, hashedWrong: 0, hashUnknownToCivitai: 0 };
const c = { images: 0, noMeta: 0, withLoraTruth: 0, truthLoras: 0, found: 0, refs: 0, exactVersion: 0, rightModel: 0, wrong: 0, unresolved: 0, byMethod: {} as Record<string, any> };
const wrongExamples: any[] = []; const unresolvedExamples: any[] = []; const missed: any[] = [];
for (const t of truth) {
  c.images++;
  const buf = new Uint8Array(fs.readFileSync(`${DIR}/img/${t.id}.bin`));
  const r: any = await extractFromImageBuffer(buf, { kind: 'file', label: String(t.id) });
  if (r.code) { c.noMeta++; continue; }
  const tl = t.versions.filter((v: any) => LORA.has(v.type));
  if (tl.length === 0) continue;
  c.withLoraTruth++; c.truthLoras += tl.length;
  const tVersions = new Set(tl.map((v: any) => v.v)); const tModels = new Set(tl.map((v: any) => v.modelId));
  const matchedTruth = new Set<number>();
  for (const l of r.metadata.loras) {
    c.refs++;
    const m = l.resolved?.modelUrl?.match(/models\/(\d+)(?:.*modelVersionId=(\d+))?/);
    const method = l.resolved?.matchedBy || 'unresolved';
    c.byMethod[method] ??= { n: 0, exact: 0, model: 0, wrong: 0 };
    c.byMethod[method].n++;
    if (!m) { c.unresolved++; const kind = l.civitaiVersionId ? 'versionId' : l.hash ? 'hash' : 'nameOnly'; (c as any).unresolvedKinds ??= {}; (c as any).unresolvedKinds[kind] = ((c as any).unresolvedKinds[kind] || 0) + 1; if (unresolvedExamples.length < 25) unresolvedExamples.push({ img: t.id, raw: l.rawName, hash: l.hash, v: l.civitaiVersionId, truth: tl.map((x: any) => x.name) }); continue; }
    const mid = Number(m[1]); const vid = Number(m[2]);
    if (l.hash) {
      const ht = await truthForHash(l.hash);
      if (!ht) v.hashUnknownToCivitai++;
      else { v.hashedResolved++; if (ht.modelId === mid) v.hashedCorrect++; else { v.hashedWrong++; if (wrongExamples.length < 40) wrongExamples.push({ img: t.id, raw: l.rawName, hash: l.hash, method, got: l.resolved.name, truthByHash: ht.name }); } }
    }
    if (tVersions.has(vid)) { c.exactVersion++; c.byMethod[method].exact++; matchedTruth.add(mid); }
    else if (tModels.has(mid)) { c.rightModel++; c.byMethod[method].model++; matchedTruth.add(mid); }
    else { c.wrong++; c.byMethod[method].wrong++; if (wrongExamples.length < 30) wrongExamples.push({ img: t.id, raw: l.rawName, hash: l.hash, method, got: l.resolved.name, score: l.resolved.matchScore, truth: tl.map((x: any) => x.name) }); }
  }
  for (const v of tl) if (matchedTruth.has(v.modelId)) c.found++; else if (missed.length < 30) missed.push({ img: t.id, want: v.name, extracted: r.metadata.loras.map((l: any) => l.rawName) });
}
fs.writeFileSync(hashFile, JSON.stringify(hashTruth));
console.log(JSON.stringify({ ...c, hashVerified: v }, null, 1));
fs.writeFileSync(`${DIR}/${MODE}-details.json`, JSON.stringify({ wrongExamples, unresolvedExamples, missed }, null, 1));
