import { FLAGSTONE, type ArenaDef, type Obstacle } from '../config/arenas';
import { WING_IDS, type FeatureKind, type Rect } from '../config/regions';
import { mulberry32 } from '../core/math';
import type { Rng } from '../core/types';

import PROPS from './props.json';

type Ctx = CanvasRenderingContext2D;

// #159: the props atlas drawn by the rig (tools/art/props.ts). Until it has loaded the old flat shapes stand in; main.ts rebuilds
// the arenas once it has.
let propImg: HTMLImageElement | null = null;
export function loadProps(): Promise<boolean> {
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => done(!!(propImg = img));
    img.onerror = () => done(false);
    img.src = `${import.meta.env.BASE_URL}sprites/props.png`;
  });
}
export const propsLoaded = (): boolean => propImg !== null;

/** One prop frame with its anchor on (x, y), scaled from the radius it was drawn for to the obstacle's. False while not loaded. */
export function drawProp(ctx: Ctx, kind: keyof typeof PROPS, x: number, y: number, r?: number, frame = 0): boolean {
  const d = PROPS[kind];
  if (!propImg || !d) return false;
  const k = r ? r / d.r : 1;
  ctx.drawImage(propImg, d.x + (frame % d.frames) * d.w, d.y, d.w, d.h, Math.round(x - d.anchor[0] * k), Math.round(y - d.anchor[1] * k), Math.round(d.w * k), Math.round(d.h * k));
  return true;
}
/** #159: each wing feature's rigged prop (tools/art/props.ts). */
export const FEATURE_PROPS: Record<FeatureKind, keyof typeof PROPS> = { shrine: 'shrine', chest: 'strongbox', lair: 'lair', hazard: 'cache' };
/** Frame of an animated prop at `time` seconds: the brazier's flame licks at 8 frames a second. */
export const propFrame = (kind: keyof typeof PROPS, time: number): number => Math.floor(time * 8) % PROPS[kind].frames;

/** #159: a theme colour pushed towards warm light (t > 0) or cool shadow (t < 0), the way the rig's ramps lean. */
function shade(hex: string, t: number): string {
  const to = t > 0 ? [255, 236, 200] : [14, 16, 30];
  const a = Math.min(1, Math.abs(t));
  const c = [1, 3, 5].map((i, k) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - a) + to[k] * a));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** #159: one lit stone: the face, a highlight on its top and left edges, shadow on the bottom and right, a chip or two. */
function stone(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, rng: Rng, e = 2, lit = 1): void {
  ctx.fillStyle = shade(base, -0.35 * lit);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(base, 0.18 * lit);
  ctx.fillRect(x, y, w - e, h - e);
  ctx.fillStyle = base;
  ctx.fillRect(x + e, y + e, w - 2 * e, h - 2 * e);
  ctx.fillStyle = shade(base, -0.15);
  for (let i = 0, n = Math.floor(rng() * 3); i < n; i++) ctx.fillRect(x + e + rng() * (w - 3 * e), y + e + rng() * (h - 3 * e), 2, 2);
  if (rng() < 0.3) {
    ctx.fillStyle = shade(base, 0.1);
    ctx.fillRect(x + e + rng() * (w - 4 * e), y + e + rng() * (h - 4 * e), 3, 1);
  }
}

function tiles(ctx: Ctx, def: ArenaDef, rng: Rng): void {
  const { w, h, theme } = def;
  const pick = () => theme.stones[Math.floor(rng() * theme.stones.length)];
  ctx.fillStyle = theme.mortar;
  ctx.fillRect(0, 0, w, h);
  if (theme.tile === 'cobble') {
    // uneven, rounded-off cobbles in staggered rows, softer lit than the wall's blocks so floor and wall don't read alike
    for (let y = 0; y < h; y += 18) {
      for (let x = -rng() * 20; x < w; ) {
        const cw = 16 + Math.floor(rng() * 12);
        stone(ctx, Math.round(x) + 1, y + 1, cw - 2, 16, pick(), rng, 2, 0.6);
        ctx.fillStyle = theme.mortar;
        for (const [cx, cy] of [[0, 0], [cw - 3, 0], [0, 15], [cw - 3, 15]]) ctx.fillRect(Math.round(x) + 1 + cx, y + 1 + cy, 2, 2);
        x += cw;
      }
    }
  } else if (theme.tile === 'flagstone') {
    const cell = FLAGSTONE; // #211: the forge presses mark these slabs
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        stone(ctx, x + 2, y + 2, cell - 4, cell - 4, pick(), rng, 3);
        if (rng() < 0.25) {
          // a crack across the slab
          ctx.fillStyle = shade(theme.mortar, -0.2);
          let px = x + 10 + rng() * 40, py = y + 8;
          for (let i = 0; i < 20; i++, py += 3, px += Math.round(rng() * 4 - 2)) ctx.fillRect(px, py, 1, 3);
        }
      }
    }
  } else {
    // earth: blotchy ground, lit pebbles and grass tufts with a light tip
    for (let i = 0; i < (w * h) / 900; i++) {
      ctx.fillStyle = pick();
      ctx.fillRect(rng() * w, rng() * h, 20 + rng() * 50, 12 + rng() * 30);
    }
    for (let i = 0; i < (w * h) / 6000; i++) {
      const px = rng() * w, py = rng() * h;
      ctx.fillStyle = shade(theme.mortar, -0.3);
      ctx.fillRect(px, py, 4, 3);
      ctx.fillStyle = '#6b665c';
      ctx.fillRect(px - 1, py - 1, 4, 3);
      ctx.fillStyle = '#8e887a';
      ctx.fillRect(px - 1, py - 1, 2, 1);
    }
    for (let i = 0; i < (w * h) / 2500; i++) {
      const px = rng() * w, py = rng() * h;
      ctx.fillStyle = '#2f3b28';
      ctx.fillRect(px + 1, py + 1, 2, 5);
      ctx.fillStyle = '#46553c';
      ctx.fillRect(px, py, 2, 5);
      ctx.fillRect(px - 2, py + 1, 1, 4);
      ctx.fillStyle = '#6f8254';
      ctx.fillRect(px, py, 1, 2);
    }
  }
}

/**
 * #210: a named wing's floor over the arena's tiles, in the rig's ramps: oak boards (bark) in the armory and the barracks, soot and
 * embers round the forge's fires, a red runner with gold edges from the chapel's gate to its altar.
 */
function wingFloor(ctx: Ctx, f: Rect, kind: 'soot' | 'plank' | 'runner', rng: Rng, toward: 'x' | 'y'): void {
  if (kind === 'plank') {
    const boards = ['#483325', '#5d4431', '#523b2b', '#755940'];
    const across = toward === 'y'; // boards run from the gate inwards
    const len = across ? f.h : f.w, span = across ? f.w : f.h;
    for (let o = 0; o < span; o += 22) {
      for (let a = -rng() * 120; a < len; ) {
        const bl = 90 + rng() * 110;
        const [x, y, w, h] = across ? [f.x + o, f.y + Math.max(0, a), 22, Math.min(bl, len - a)] : [f.x + Math.max(0, a), f.y + o, Math.min(bl, len - a), 22];
        stone(ctx, Math.round(x), Math.round(y), Math.round(Math.min(w, f.x + f.w - x)), Math.round(Math.min(h, f.y + f.h - y)), boards[Math.floor(rng() * boards.length)], rng, 2, 0.7);
        ctx.fillStyle = '#231812'; // nail heads
        ctx.fillRect(Math.round(x) + (across ? 10 : 4), Math.round(y) + (across ? 4 : 10), 2, 2);
        a += bl;
      }
    }
  } else if (kind === 'soot') {
    for (let i = 0; i < (f.w * f.h) / 9000; i++) {
      const gx = f.x + rng() * f.w, gy = f.y + rng() * f.h, gr = 40 + rng() * 80;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0, 'rgba(15,17,24,0.42)');
      grad.addColorStop(1, 'rgba(15,17,24,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    const embers = ['#86260a', '#c2410f', '#ec6a17', '#fb9a2c'];
    for (let i = 0; i < (f.w * f.h) / 1400; i++) {
      ctx.fillStyle = embers[Math.floor(rng() * embers.length)];
      ctx.fillRect(Math.round(f.x + rng() * f.w), Math.round(f.y + rng() * f.h), 2, 2);
    }
  } else {
    const cw = 120;
    const [x, y, w, h] = toward === 'y' ? [f.x + f.w / 2 - cw / 2, f.y, cw, f.h] : [f.x, f.y + f.h / 2 - cw / 2, f.w, cw];
    ctx.fillStyle = '#c98d27';
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.fillStyle = '#7a1a24';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#4f0f1c';
    for (let a = 40; a < (toward === 'y' ? h : w); a += 70) toward === 'y' ? ctx.fillRect(x + 12, y + a, w - 24, 3) : ctx.fillRect(x + a, y + 12, 3, h - 24);
  }
}

/**
 * #223: the Ember Forge's lava channels, in the rig's ember and fire ramps: a warm glow on the floor round each, a dark basalt bank, the
 * molten run with brighter currents along it and cooling crust plates floating on it, and a stone bridge over each gap between runs.
 * Baked into the arena like the floor: the lava itself costs nothing a frame.
 */
function lavaChannels(ctx: Ctx, lava: readonly Rect[], rng: Rng): void {
  const glow = 22;
  for (const c of lava) {
    for (const [y0, y1] of [[c.y - glow, c.y], [c.y + c.h + glow, c.y + c.h]]) {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(236,106,23,0)');
      g.addColorStop(1, 'rgba(236,106,23,0.32)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x, Math.min(y0, y1), c.w, glow);
    }
  }
  for (const c of lava) {
    ctx.fillStyle = '#17151b'; // the bank's outline (coal)
    ctx.fillRect(c.x, c.y - 2, c.w, c.h + 4);
    ctx.fillStyle = '#2f2b35';
    ctx.fillRect(c.x, c.y, c.w, 4); // the far bank, in shadow
    ctx.fillStyle = '#57505f';
    ctx.fillRect(c.x, c.y + c.h - 3, c.w, 3); // the near bank, lit
    const x = c.x, y = c.y + 4, w = c.w, h = c.h - 7;
    ctx.fillStyle = '#c2410f';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#86260a'; // the deeper, cooler edges
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y + h - 3, w, 3);
    const currents = ['#ec6a17', '#fb9a2c', '#ffc95a'];
    for (let i = 0; i < w / 5; i++) {
      ctx.fillStyle = currents[Math.floor(rng() * currents.length)];
      ctx.fillRect(Math.round(x + rng() * (w - 30)), Math.round(y + 5 + rng() * (h - 12)), Math.round(10 + rng() * 26), 2);
    }
    for (let i = 0; i < w / 40; i++) {
      // a crust plate: dark, lit on its top edge, a hot crack across it
      const pw = Math.round(10 + rng() * 22), ph = Math.round(5 + rng() * 8);
      const px = Math.round(x + rng() * (w - pw)), py = Math.round(y + 3 + rng() * (h - ph - 6));
      ctx.fillStyle = '#4a1406';
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#2f2b35';
      ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
      ctx.fillStyle = '#403a48';
      ctx.fillRect(px + 1, py + 1, pw - 2, 1);
      ctx.fillStyle = '#ec6a17';
      ctx.fillRect(px + Math.round(pw / 3), py + Math.round(ph / 2), Math.round(pw / 3), 1);
    }
    ctx.fillStyle = '#fff1b8'; // glints
    for (let i = 0; i < w / 60; i++) ctx.fillRect(Math.round(x + rng() * w), Math.round(y + 4 + rng() * (h - 8)), 2, 1);
  }
  // the bridges: where two runs on one line leave a gap, a slab of stone spans it and reaches a little over the lava
  for (const a of lava) {
    const b = lava.filter((o) => o.y === a.y && o.x > a.x + a.w).sort((p, q) => p.x - q.x)[0];
    if (!b) continue;
    const bx = a.x + a.w - 8, bw = b.x - bx + 8, by = a.y - 6, bh = a.h + 12;
    ctx.fillStyle = 'rgba(8,8,16,0.45)';
    ctx.fillRect(bx + 4, by + 4, bw, bh); // its shadow on the lava, down and right
    stone(ctx, bx, by, bw, bh, '#605e64', rng, 3);
    for (let sy = by + 18; sy < by + bh - 6; sy += 18) {
      ctx.fillStyle = '#302f38';
      ctx.fillRect(bx + 4, sy, bw - 8, 1);
    }
    ctx.fillStyle = '#302f38'; // its kerbs
    ctx.fillRect(bx, by, 5, bh);
    ctx.fillRect(bx + bw - 5, by, 5, bh);
    ctx.fillStyle = '#a19c90';
    ctx.fillRect(bx + 1, by + 1, 2, bh - 2);
    ctx.fillRect(bx + bw - 4, by + 1, 2, bh - 2);
  }
}

/** #159: the walls stand to the top and left of the light: they cast a soft shadow down and right onto each floor. */
function wallShadows(ctx: Ctx, floors: { x: number; y: number; w: number; h: number }[]): void {
  for (const f of floors) {
    const top = ctx.createLinearGradient(0, f.y, 0, f.y + 36);
    top.addColorStop(0, 'rgba(8,8,16,0.55)');
    top.addColorStop(1, 'rgba(8,8,16,0)');
    ctx.fillStyle = top;
    ctx.fillRect(f.x, f.y, f.w, 36);
    const left = ctx.createLinearGradient(f.x, 0, f.x + 22, 0);
    left.addColorStop(0, 'rgba(8,8,16,0.4)');
    left.addColorStop(1, 'rgba(8,8,16,0)');
    ctx.fillStyle = left;
    ctx.fillRect(f.x, f.y, 22, f.h);
  }
}

function drawObstacle(ctx: Ctx, o: Obstacle): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(o.x + 4, o.y + o.r * 0.6, o.r * 1.1, o.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (o.kind === 'brazier' && propImg) return; // #159: its flame moves, the renderer draws it every frame
  if (drawProp(ctx, o.kind, o.x, o.y, o.r)) return;
  if (o.kind === 'tomb') {
    ctx.fillStyle = '#1a1614';
    ctx.fillRect(o.x - o.r - 2, o.y - o.r * 1.5 - 2, o.r * 2 + 4, o.r * 2.3 + 4);
    ctx.fillStyle = '#7c8088';
    ctx.fillRect(o.x - o.r, o.y - o.r * 1.5, o.r * 2, o.r * 2.3);
    ctx.fillStyle = '#5a5d64';
    ctx.fillRect(o.x - 2, o.y - o.r * 1.2, 4, o.r * 1.2);
    ctx.fillRect(o.x - o.r * 0.5, o.y - o.r * 0.85, o.r, 4);
  } else if (o.kind === 'throne') {
    // v0.6: the Usurper's throne: a dark dais, a red seat and a tall gilded back with spikes
    const r = o.r;
    ctx.fillStyle = '#1a1614';
    ctx.fillRect(o.x - r * 1.3, o.y - r * 0.2, r * 2.6, r * 1.3);
    ctx.fillStyle = '#3a3440';
    ctx.fillRect(o.x - r * 1.2, o.y - r * 0.1, r * 2.4, r * 1.1);
    ctx.fillStyle = '#1a1614';
    ctx.fillRect(o.x - r * 0.85, o.y - r * 1.6, r * 1.7, r * 1.9);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(o.x - r * 0.75, o.y - r * 1.5, r * 1.5, r * 1.7);
    for (const dx of [-0.6, 0, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(o.x + (dx - 0.15) * r, o.y - r * 1.5);
      ctx.lineTo(o.x + dx * r, o.y - r * (dx === 0 ? 2.1 : 1.85));
      ctx.lineTo(o.x + (dx + 0.15) * r, o.y - r * 1.5);
      ctx.fill();
    }
    ctx.fillStyle = '#8e1b1b';
    ctx.fillRect(o.x - r * 0.55, o.y - r * 1.25, r * 1.1, r * 1.3);
    ctx.fillRect(o.x - r * 0.75, o.y - r * 0.05, r * 1.5, r * 0.45);
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

/** Stone for everything that is not floor: blocks on the wall colour, a dark rim on the floor edges, the floors cut out. */
function wallLayer(def: ArenaDef): HTMLCanvasElement {
  const { w, h } = def;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = ctx.createPattern(wallPattern(def), 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1a1614';
  ctx.lineWidth = 8;
  for (const r of def.regions!) ctx.strokeRect(r.floor.x, r.floor.y, r.floor.w, r.floor.h);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (const r of def.regions!) {
    ctx.fillRect(r.floor.x, r.floor.y, r.floor.w, r.floor.h);
    if (r.gate) ctx.fillRect(r.gate.x, r.gate.y, r.gate.w, r.gate.h);
  }
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

const patterns = new Map<string, HTMLCanvasElement>();
/** A 96 px tile of the arena's wall stone, reused for the wall layer and for covering closed regions. */
export function wallPattern(def: ArenaDef): HTMLCanvasElement {
  let c = patterns.get(def.id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = shade(def.theme.wall, -0.3);
  ctx.fillRect(0, 0, 96, 96);
  const rng = mulberry32(def.id.length * 97);
  // #159: lit blocks, a highlight top-left and shadow bottom-right like the floor stones
  for (let y = 0; y < 96; y += 24) for (let x = (y / 24) % 2 ? -24 : 0; x < 96; x += 48) stone(ctx, x + 2, y + 2, 44, 20, def.theme.wallTop, rng, 3);
  patterns.set(def.id, c);
  return c;
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
  if (def.wings && def.regions) {
    const wrng = mulberry32(210); // its own stream, so the other arenas' ground stays as it was
    for (const id of WING_IDS) {
      const f = def.regions.find((r) => r.id === id)?.floor;
      if (f) wingFloor(ctx, f, def.wings[id].floor, wrng, id === 'north' || id === 'south' ? 'y' : 'x');
    }
  }

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
  // v0.6 Last Bastion: a red runner from the south wall up to the throne, gold at the edges
  const core = def.regions?.find((r) => r.id === 'core')?.floor;
  if (theme.carpet && def.final && core) {
    const cw = 150;
    const top = def.final.throne.y;
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(def.final.throne.x - cw / 2 - 6, top, cw + 12, core.y + core.h - top);
    ctx.fillStyle = theme.carpet;
    ctx.fillRect(def.final.throne.x - cw / 2, top, cw, core.y + core.h - top);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = top + 40; y < core.y + core.h; y += 80) ctx.fillRect(def.final.throne.x - cw / 2 + 10, y, cw - 20, 3);
  }
  wallShadows(ctx, def.regions ? def.regions.flatMap((r) => (r.gate ? [r.floor, r.gate] : [r.floor])) : [{ x: wall, y: wall, w: w - 2 * wall, h: h - 2 * wall }]);
  if (def.lava) lavaChannels(ctx, def.lava, mulberry32(223)); // its own stream too
  for (const o of def.obstacles) drawObstacle(ctx, o);

  if (def.regions) {
    // v0.5 map: solid stone everywhere but the region floors and their corridors (all drawn open; closed ones are covered at runtime)
    ctx.drawImage(wallLayer(def), 0, 0);
    return c;
  }

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
