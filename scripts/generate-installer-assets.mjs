import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildDir = path.resolve(__dirname, '../build');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

/**
 * Generates an uncompressed 24-bit BMP buffer.
 * @param {number} width 
 * @param {number} height 
 * @param {(x: number, y: number) => [number, number, number]} pixelShader returns [r, g, b] (0-255)
 */
function createBmp(width, height, pixelShader) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;

  const buf = Buffer.alloc(fileSize);

  // Bitmap File Header (14 bytes)
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt16LE(0, 6);
  buf.writeUInt16LE(0, 8);
  buf.writeUInt32LE(54, 10); // offset to image data

  // DIB Header / BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 14); // header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // bottom-to-top
  buf.writeUInt16LE(1, 26); // color planes
  buf.writeUInt16LE(24, 28); // 24-bit RGB
  buf.writeUInt32LE(0, 30); // compression BI_RGB
  buf.writeUInt32LE(imageSize, 34);
  buf.writeInt32LE(2835, 38); // 72 DPI (2835 ppm)
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  // Pixels (from bottom row y = 0 to top row y = height - 1)
  let offset = 54;
  for (let y = 0; y < height; y++) {
    // In standard BMP bottom-to-top, y=0 is visual bottom, so visual Y is:
    const visualY = (height - 1) - y;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelShader(x, visualY);
      buf.writeUInt8(b, offset);
      buf.writeUInt8(g, offset + 1);
      buf.writeUInt8(r, offset + 2);
      offset += 3;
    }
    // Padding
    const padding = rowSize - (width * 3);
    for (let p = 0; p < padding; p++) {
      buf.writeUInt8(0, offset);
      offset++;
    }
  }

  return buf;
}

// 1. Sidebar BMP (164x314) - Smoked Blue-Black with Orange Accents
const sidebarBmp = createBmp(164, 314, (x, y) => {
  // Background gradient from #0B0E15 (top) to #141822 (bottom)
  const t = y / 314;
  let r = Math.round(11 + t * 9);
  let g = Math.round(14 + t * 10);
  let b = Math.round(21 + t * 13);

  // Soft atmospheric radial light at (82, 100)
  const dx = x - 82;
  const dy = y - 100;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 70) {
    const factor = (1 - dist / 70) * 0.45;
    r = Math.min(255, Math.round(r + 26 * factor));
    g = Math.min(255, Math.round(g + 38 * factor));
    b = Math.min(255, Math.round(b + 58 * factor));
  }

  // Hound orange glowing badge motif around (82, 90)
  const odx = x - 82;
  const ody = y - 90;
  const odist = Math.sqrt(odx * odx + ody * ody);
  if (odist < 22) {
    const ofactor = (1 - odist / 22);
    r = Math.min(255, Math.round(r + (245 - r) * ofactor));
    g = Math.min(255, Math.round(g + (154 - g) * ofactor));
    b = Math.min(255, Math.round(b + (36 - b) * ofactor));
  } else if (odist < 38) {
    const glow = (1 - (odist - 22) / 16) * 0.35;
    r = Math.min(255, Math.round(r + 245 * glow));
    g = Math.min(255, Math.round(g + 154 * glow));
    b = Math.min(255, Math.round(b + 36 * glow));
  }

  // Refined vertical glass border highlight on right edge (x = 163)
  if (x === 163) {
    r = Math.min(255, r + 40);
    g = Math.min(255, g + 45);
    b = Math.min(255, b + 55);
  }

  return [r, g, b];
});

fs.writeFileSync(path.join(buildDir, 'installerSidebar.bmp'), sidebarBmp);
console.log('Generated build/installerSidebar.bmp (164x314)');

// 2. Header BMP (150x57) - Dark smoked glass header
const headerBmp = createBmp(150, 57, (x, y) => {
  const t = x / 150;
  let r = Math.round(11 + t * 9);
  let g = Math.round(14 + t * 10);
  let b = Math.round(21 + t * 13);

  // Soft subtle orange glow on right edge
  const dx = x - 130;
  const dy = y - 28;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 20) {
    const glow = (1 - dist / 20) * 0.3;
    r = Math.min(255, Math.round(r + 245 * glow));
    g = Math.min(255, Math.round(g + 154 * glow));
    b = Math.min(255, Math.round(b + 36 * glow));
  }

  return [r, g, b];
});

fs.writeFileSync(path.join(buildDir, 'installerHeader.bmp'), headerBmp);
console.log('Generated build/installerHeader.bmp (150x57)');
