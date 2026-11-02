// Writes THIRD-PARTY-NOTICES.txt: the license text of every open-source package
// that ships inside the app. Run with --check to fail when the file is out of date.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'THIRD-PARTY-NOTICES.txt');

// Runtime packages bundled into the app. Build tools (vite, tailwind, ...) are not shipped.
const RUNTIME = [
  '@civitai/generation-metadata',
  'cheerio',
  'electron-updater',
  'fflate',
  'html-to-image',
  'react',
  'react-dom',
];

const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')).packages;

// Same lookup Node uses: nearest node_modules folder first, then its parents.
function resolve(name, fromPath) {
  let base = fromPath;
  for (;;) {
    const candidate = `${base ? `${base}/` : ''}node_modules/${name}`;
    if (lock[candidate]) return candidate;
    if (!base) return null;
    const idx = base.lastIndexOf('/node_modules/');
    base = idx === -1 ? '' : base.slice(0, idx);
  }
}

const found = new Map();
const queue = RUNTIME.map((name) => resolve(name, ''));
while (queue.length) {
  const path = queue.shift();
  if (!path || found.has(path)) continue;
  const entry = lock[path];
  found.set(path, entry);
  for (const dep of Object.keys(entry.dependencies ?? {})) {
    queue.push(resolve(dep, path));
  }
}

// Standard texts for the few packages that ship no license file of their own.
const STANDARD = {
  MIT: (who) => `MIT License

Copyright (c) ${who}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  ISC: (who) => `ISC License

Copyright (c) ${who}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`,
};

function licenseText(dir, spdx) {
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$|-)/i.test(f));
  if (file) return readFileSync(join(dir, file), 'utf8').trim();
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
  return STANDARD[spdx] && author ? STANDARD[spdx](author.replace(/\s*<[^>]*>/, '')) : null;
}

const byName = new Map();
for (const [path, entry] of found) {
  const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const key = `${name}@${entry.version}`;
  if (byName.has(key)) continue;
  byName.set(key, { name, version: entry.version, license: entry.license ?? 'see package', text: licenseText(join(root, path), entry.license) });
}

const packages = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
const missing = packages.filter((p) => !p.text);
if (missing.length) {
  console.error(`No license file found for: ${missing.map((p) => p.name).join(', ')}. Run npm ci first.`);
  process.exit(1);
}

const line = '-'.repeat(72);
const out = [
  'PromptHound uses the open-source packages listed below. Their licenses follow.',
  'The Electron and Chromium licenses are installed next to the app as',
  'LICENSE.electron.txt and LICENSES.chromium.html.',
  '',
  ...packages.map((p) => `- ${p.name} ${p.version} (${p.license})`),
  '',
  ...packages.flatMap((p) => [line, `${p.name} ${p.version} (${p.license})`, line, '', p.text, '']),
].join('\n');

if (process.argv.includes('--check')) {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
  if (current !== out) {
    console.error('THIRD-PARTY-NOTICES.txt is out of date. Run: npm run notices');
    process.exit(1);
  }
  console.log(`THIRD-PARTY-NOTICES.txt is up to date (${packages.length} packages).`);
} else {
  writeFileSync(outFile, out);
  console.log(`Wrote THIRD-PARTY-NOTICES.txt (${packages.length} packages).`);
}
