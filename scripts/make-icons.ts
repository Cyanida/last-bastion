/**
 * Draws the app icon in code (the rigged Paladin, #155, on a framed shield-dark field) and writes every size the
 * platforms need, plus the QR code for the README.   npm run icons
 *   public/icons/*      PWA + iOS home screen + favicon
 *   build/icon.ico|png  Electron / NSIS installer
 *   docs/qr.png         the GitHub Pages URL
 * No canvas in Node: pixels go into a buffer and through the minimal PNG writer the art tool uses.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';
import { png } from '../tools/art/png';
import { sprite as paladin } from '../tools/art/sprites/paladin';

const PAGES_URL = 'https://cyanida.github.io/last-bastion/';

const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

function drawIcon(size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const set = (x: number, y: number, [r, g, b]: [number, number, number]) => px.set([r, g, b, 255], (y * size + x) * 4);
  // the figure's bounding box in his first idle frame, scaled to 60% of the icon (inside the 80% maskable safe zone)
  const pixels = paladin.anims.idle[0][1].render();
  const W = paladin.w;
  const xs = [...pixels.keys()].map((q) => q % W), ys = [...pixels.keys()].map((q) => Math.floor(q / W));
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const fw = Math.max(...xs) - x0 + 1, fh = Math.max(...ys) - y0 + 1;
  const fit = (size * 0.6) / fh;
  const cell = fit >= 1 ? Math.floor(fit) : fit; // whole pixels when it grows, nearest-neighbour when it shrinks (favicon)
  const tw = Math.round(fw * cell), th = Math.round(fh * cell);
  const ox = Math.floor((size - tw) / 2);
  const oy = Math.floor((size - th) / 2);
  const frame = Math.round(size * 0.06);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
      const glow = 1 - Math.hypot(x - size / 2, y - size / 2) / size; // soft vignette
      const bg: [number, number, number] = [Math.round(52 * glow + 10), Math.round(40 * glow + 8), Math.round(30 * glow + 6)];
      set(x, y, edge >= frame && edge < frame * 1.6 ? hex('#c9a227') : bg);
    }
  }
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const color = pixels.get((y0 + Math.floor(y / cell)) * W + x0 + Math.floor(x / cell));
      if (color) set(ox + x, oy + y, hex(color));
    }
  }
  return px;
}

// ---- ICO writer (PNG: tools/art/png.ts) ----
/** ICO container around one 256px PNG (what Windows and NSIS use). */
function ico(png256: Buffer): Buffer {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(1, 4); // one image
  head.set([0, 0, 0, 0], 6); // 256x256, no palette
  head.writeUInt16LE(1, 10);
  head.writeUInt16LE(32, 12);
  head.writeUInt32LE(png256.length, 14);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png256]);
}

for (const dir of ['public/icons', 'build', 'docs']) mkdirSync(dir, { recursive: true });
const icon = (size: number) => png(size, size, drawIcon(size));
writeFileSync('public/icons/icon-192.png', icon(192));
writeFileSync('public/icons/icon-512.png', icon(512));
writeFileSync('public/icons/icon-maskable-512.png', icon(512));
writeFileSync('public/icons/apple-touch-icon.png', icon(180));
writeFileSync('public/icons/favicon-32.png', icon(32));
writeFileSync('build/icon.png', icon(512));
writeFileSync('build/icon.ico', ico(icon(256)));
await QRCode.toFile('docs/qr.png', PAGES_URL, { width: 360, margin: 2, color: { dark: '#2a1d10', light: '#e4d3a6' } });
console.log('icons written; QR ->', PAGES_URL);
