// #138: a before-and-after sheet of every sprite: the old art (a git ref, default v0.8.0) beside the current one, same size on screen.
// Usage: node scripts/sprite-sheet.mjs [ref] [out.png]   (default: v0.8.0 → docs/art/138-before-after.png)
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const ref = process.argv[2] ?? 'v0.8.0';
const out = process.argv[3] ?? 'docs/art/138-before-after.png';

/** Pull PALETTE, SPRITES and SPRITE_RES out of sprites.ts as plain objects (they are literal data). */
function load(src) {
  const grab = (name) => {
    const m = src.match(new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\}`));
    return m ? new Function(`return {${m[1]}\n}`)() : {}; // the newline ends a trailing // comment
  };
  return { palette: grab('PALETTE'), sprites: grab('SPRITES'), res: grab('SPRITE_RES') };
}

const before = load(execSync(`git show ${ref}:src/render/sprites.ts`, { encoding: 'utf8' }));
const after = load(readFileSync('src/render/sprites.ts', 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.setContent('<body style="margin:0;background:#2a2622"><canvas id="c"></canvas></body>');
await page.evaluate(({ before, after }) => {
  const SCALE = 4; // on-screen pixels per old grid pixel
  const ids = Object.keys(after.sprites);
  const size = (set, id) => {
    const rows = set.sprites[id];
    const r = set.res[id] ?? 1;
    return rows ? { w: (rows[0].length * SCALE) / r, h: (rows.length * SCALE) / r } : { w: 0, h: 0 };
  };
  const cells = ids.map((id) => {
    const a = size(before, id), b = size(after, id);
    return { id, a, b, w: a.w + b.w + 36, h: Math.max(a.h, b.h) + 22 };
  });
  const COLS = 6, PAD = 12;
  const colW = Math.max(...cells.map((c) => c.w));
  const rowsOf = [];
  for (let i = 0; i < cells.length; i += COLS) rowsOf.push(cells.slice(i, i + COLS));
  const rowH = rowsOf.map((r) => Math.max(...r.map((c) => c.h)));
  const cv = document.getElementById('c');
  cv.width = COLS * (colW + PAD) + PAD;
  cv.height = rowH.reduce((s, h) => s + h + PAD, PAD);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#2a2622';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const draw = (set, id, x, y) => {
    const rows = set.sprites[id];
    if (!rows) {
      ctx.fillStyle = '#8a8070';
      ctx.fillText('(new)', x, y + 10);
      return;
    }
    const cell = SCALE / (set.res[id] ?? 1);
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const col = set.palette[row[rx]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell);
      }
    });
  };
  ctx.font = '12px sans-serif';
  let y = PAD;
  rowsOf.forEach((r, ri) => {
    r.forEach((c, ci) => {
      const x = PAD + ci * (colW + PAD);
      ctx.fillStyle = '#e8e2d0';
      ctx.fillText(c.id, x, y + 12);
      draw(before, c.id, x, y + 20);
      ctx.fillStyle = '#8a8070';
      ctx.fillText('→', x + c.a.w + 10, y + 20 + Math.max(c.a.h, c.b.h) / 2);
      draw(after, c.id, x + (c.a.w || 30) + 30, y + 20);
    });
    y += rowH[ri] + PAD;
  });
}, { before, after });
mkdirSync(dirname(out), { recursive: true });
await page.locator('#c').screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
