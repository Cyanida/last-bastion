import type { ArenaDef, Obstacle } from '../config/arenas';
import { mulberry32 } from '../core/math';
import type { Rng } from '../core/types';

type Ctx = CanvasRenderingContext2D;

function tiles(ctx: Ctx, def: ArenaDef, rng: Rng): void {
  const { w, h, theme } = def;
  const pick = () => theme.stones[Math.floor(rng() * theme.stones.length)];
  ctx.fillStyle = theme.mortar;
  ctx.fillRect(0, 0, w, h);
  if (theme.tile === 'cobble') {
    const cell = 40;
    for (let y = 0, row = 0; y < h; y += cell / 2, row++) {
      for (let x = row % 2 ? -cell / 2 : 0; x < w; x += cell) {
        ctx.fillStyle = pick();
        ctx.fillRect(x + 1, y + 1, cell - 2, cell / 2 - 2);
      }
    }
  } else if (theme.tile === 'flagstone') {
    const cell = 80;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        ctx.fillStyle = pick();
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      }
    }
  } else {
    // earth: blotchy ground with tufts
    for (let i = 0; i < (w * h) / 900; i++) {
      ctx.fillStyle = pick();
      ctx.fillRect(rng() * w, rng() * h, 20 + rng() * 50, 12 + rng() * 30);
    }
    ctx.fillStyle = '#46553c';
    for (let i = 0; i < (w * h) / 2500; i++) ctx.fillRect(rng() * w, rng() * h, 2, 5);
  }
}

function drawObstacle(ctx: Ctx, o: Obstacle): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(o.x + 4, o.y + o.r * 0.6, o.r * 1.1, o.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (o.kind === 'tomb') {
    ctx.fillStyle = '#1a1614';
    ctx.fillRect(o.x - o.r - 2, o.y - o.r * 1.5 - 2, o.r * 2 + 4, o.r * 2.3 + 4);
    ctx.fillStyle = '#7c8088';
    ctx.fillRect(o.x - o.r, o.y - o.r * 1.5, o.r * 2, o.r * 2.3);
    ctx.fillStyle = '#5a5d64';
    ctx.fillRect(o.x - 2, o.y - o.r * 1.2, 4, o.r * 1.2);
    ctx.fillRect(o.x - o.r * 0.5, o.y - o.r * 0.85, o.r, 4);
  } else if (o.kind === 'tree') {
    ctx.strokeStyle = '#1f1712';
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(o.x + Math.cos(a) * o.r * 2.1, o.y + Math.sin(a) * o.r * 1.7 - 10);
      ctx.stroke();
    }
    ctx.fillStyle = '#2b2018';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#1a1614';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.kind === 'pillar' ? '#8a8378' : '#3a3330';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.kind === 'pillar' ? '#a39c90' : '#e07b28';
    ctx.beginPath();
    ctx.arc(o.x - (o.kind === 'pillar' ? 5 : 0), o.y - (o.kind === 'pillar' ? 6 : 0), o.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    if (o.kind === 'brazier') {
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Pre-renders a whole arena once; the renderer blits the visible part each frame. */
export function buildArena(def: ArenaDef): HTMLCanvasElement {
  const { w, h, wall, theme } = def;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(1337);
  tiles(ctx, def, rng);

  // soft patches: moss in the courtyard, mist in the graveyard, old carpet stains in the keep
  for (let i = 0; i < 70; i++) {
    const gx = rng() * w;
    const gy = rng() * h;
    const gr = 30 + rng() * 90;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    grad.addColorStop(0, theme.patch);
    grad.addColorStop(1, theme.patch.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = grad;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  // old blood
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = 'rgba(110,20,20,0.25)';
    ctx.beginPath();
    ctx.ellipse(rng() * w, rng() * h, 8 + rng() * 22, 5 + rng() * 12, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const o of def.obstacles) drawObstacle(ctx, o);

  // wall with crenellations
  ctx.fillStyle = theme.wall;
  ctx.fillRect(0, 0, w, wall);
  ctx.fillRect(0, h - wall, w, wall);
  ctx.fillRect(0, 0, wall, h);
  ctx.fillRect(w - wall, 0, wall, h);
  ctx.fillStyle = theme.wallTop;
  for (let x = 0; x < w; x += 48) {
    ctx.fillRect(x + 4, 6, 28, wall - 16);
    ctx.fillRect(x + 4, h - wall + 10, 28, wall - 16);
  }
  for (let y = 0; y < h; y += 48) {
    ctx.fillRect(6, y + 4, wall - 16, 28);
    ctx.fillRect(w - wall + 10, y + 4, wall - 16, 28);
  }
  ctx.strokeStyle = '#1a1614';
  ctx.lineWidth = 4;
  ctx.strokeRect(wall, wall, w - wall * 2, h - wall * 2);
  return c;
}
