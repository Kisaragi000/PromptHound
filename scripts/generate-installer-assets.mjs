/**
 * Renders the NSIS installer artwork (build/installerSidebar.bmp, build/installerHeader.bmp)
 * from the app's hound logo. The BMPs are committed; re-run only when the artwork changes:
 *
 *   npm run build:installer-assets
 *
 * Needs Playwright with Chromium (dev machines only; CI uses the committed files).
 * Colors match build/installer.nsh (MUI_BGCOLOR 0B0E15).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build');
fs.mkdirSync(buildDir, { recursive: true });

// The hound mark, taken from the app's own icon so the installer always matches it
const iconsSource = fs.readFileSync(path.join(root, 'src/components/icons/Icons.tsx'), 'utf8');
const logoBlock = iconsSource.slice(iconsSource.indexOf('export const PromptHoundLogo'));
const logoPaths = [...logoBlock.slice(0, logoBlock.indexOf('</svg>')).matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
if (logoPaths.length === 0) throw new Error('PromptHoundLogo paths not found in Icons.tsx');

/** Uncompressed 24-bit BMP from RGBA pixels (top row first). */
function encodeBmp(width, height, rgba) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const buf = Buffer.alloc(54 + rowSize * height);
  buf.write('BM', 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(rowSize * height, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width * 4; // BMP rows run bottom to top
    let offset = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const i = src + x * 4;
      buf[offset++] = rgba[i + 2];
      buf[offset++] = rgba[i + 1];
      buf[offset++] = rgba[i];
    }
  }
  return buf;
}

// Drawn in the page so text uses the app font (Inter)
function draw({ kind, width, height, logoPaths }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const AMBER = '#F59A24';
  const logo = (x, y, size, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 256, size / 256);
    ctx.fillStyle = color;
    for (const d of logoPaths) ctx.fill(new Path2D(d));
    ctx.restore();
  };
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  };

  if (kind === 'sidebar') {
    const bg = ctx.createLinearGradient(0, 0, width * 0.4, height);
    bg.addColorStop(0, '#141A28');
    bg.addColorStop(0.55, '#0E121B');
    bg.addColorStop(1, '#0B0E15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    glow(82, 108, 95, 'rgba(111,143,184,0.20)');
    glow(82, 118, 60, 'rgba(245,154,36,0.16)');

    // Fine dot grid, fading downward
    for (let y = 10; y < height; y += 12) {
      for (let x = 10; x < width; x += 12) {
        ctx.fillStyle = `rgba(160,175,200,${0.07 * (1 - y / height)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    logo(22, 42, 120, AMBER);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#F2F3F5';
    ctx.font = '800 19px Inter';
    ctx.fillText('PromptHound', 82, 196);

    ctx.fillStyle = AMBER;
    ctx.fillRect(66, 207, 32, 2);

    ctx.fillStyle = '#8F9DB2';
    ctx.font = '500 10.5px Inter';
    ctx.fillText('Prompts, models and LoRAs', 82, 228);
    ctx.fillText('from any AI image', 82, 243);

    ctx.fillStyle = '#687386';
    ctx.font = '600 8.5px Inter';
    ctx.fillText('A1111 · FORGE · COMFYUI · CIVITAI', 82, 296);

    // Right edge highlight against the page
    ctx.fillStyle = 'rgba(245,154,36,0.35)';
    ctx.fillRect(width - 1, 0, 1, height);
  } else {
    ctx.fillStyle = '#0B0E15';
    ctx.fillRect(0, 0, width, height);
    glow(120, 28, 48, 'rgba(245,154,36,0.14)');
    logo(96, 1, 54, AMBER);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#F2F3F5';
    ctx.font = '800 12px Inter';
    ctx.fillText('Prompt', 96, 26);
    ctx.fillStyle = AMBER;
    ctx.fillText('Hound', 96, 40);
  }
  return Array.from(ctx.getImageData(0, 0, width, height).data);
}

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  // Fetch Inter in Node (which honors the proxy settings) and hand it to the page inline
  const cssResponse = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800&display=block', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
  });
  let css = await cssResponse.text();
  for (const url of new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) ?? [])) {
    const font = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('base64');
    css = css.split(url).join(`data:font/woff2;base64,${font}`);
  }
  await page.setContent(`<style>${css}</style>`);
  const loaded = await page.evaluate(async () => {
    await Promise.all(['500', '600', '800'].map((w) => document.fonts.load(`${w} 12px Inter`)));
    return document.fonts.check('800 12px Inter');
  });
  if (!loaded) throw new Error('Inter did not load');
  for (const [kind, file, width, height] of [
    ['sidebar', 'installerSidebar.bmp', 164, 314],
    ['header', 'installerHeader.bmp', 150, 57],
  ]) {
    const rgba = await page.evaluate(draw, { kind, width, height, logoPaths });
    fs.writeFileSync(path.join(buildDir, file), encodeBmp(width, height, rgba));
    console.log(`Generated build/${file} (${width}x${height})`);
  }
} finally {
  await browser.close();
}
