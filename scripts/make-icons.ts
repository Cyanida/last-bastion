/**
 * Draws the app icon in code (the Paladin sprite on a framed shield-dark field) and writes every size the
 * platforms need, plus the QR code for the README.   npm run icons
 *   public/icons/*      PWA + iOS home screen + favicon
 *   build/icon.ico|png  Electron / NSIS installer
 *   docs/qr.png         the GitHub Pages URL
 * No canvas in Node: pixels go into a buffer and through a minimal PNG encoder (zlib is built in).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import QRCode from 'qrcode';
import { PALETTE, SPRITES } from '../src/render/sprites';

const PAGES_URL = 'https://cyanida.github.io/last-bastion/';

const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

function drawIcon(size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const set = (x: number, y: number, [r, g, b]: [number, number, number]) => px.set([r, g, b, 255], (y * size + x) * 4);
  const rows = SPRITES.paladin;
  const cell = Math.floor((size * 0.6) / rows.length); // inside the 80% maskable safe zone
  const ox = Math.floor((size - rows[0].length * cell) / 2);
  const oy = Math.floor((size - rows.length * cell) / 2);
  const frame = Math.round(size * 0.06);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
      const glow = 1 - Math.hypot(x - size / 2, y - size / 2) / size; // soft vignette
      const bg: [number, number, number] = [Math.round(52 * glow + 10), Math.round(40 * glow + 8), Math.round(30 * glow + 6)];
      set(x, y, edge >= frame && edge < frame * 1.6 ? hex('#c9a227') : bg);
    }
  }
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const color = PALETTE[ch];
      if (!color) return;
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) set(ox + rx * cell + x, oy + ry * cell + y, hex(color));
    });
  });
  return px;
}

// ---- minimal PNG + ICO writers ----
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
function png(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1); // filter byte 0 per row
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]);
}
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
const icon = (size: number) => png(size, drawIcon(size));
writeFileSync('public/icons/icon-192.png', icon(192));
writeFileSync('public/icons/icon-512.png', icon(512));
writeFileSync('public/icons/icon-maskable-512.png', icon(512));
writeFileSync('public/icons/apple-touch-icon.png', icon(180));
writeFileSync('public/icons/favicon-32.png', icon(32));
writeFileSync('build/icon.png', icon(512));
writeFileSync('build/icon.ico', ico(icon(256)));
await QRCode.toFile('docs/qr.png', PAGES_URL, { width: 360, margin: 2, color: { dark: '#2a1d10', light: '#e4d3a6' } });
console.log('icons written; QR ->', PAGES_URL);
