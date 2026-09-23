import { AFFIXES, ELITES } from '../config/elites';
import { GAME, RENDER } from '../config/game';
import { MODIFIERS } from '../config/waves';
import { clamp, TAU } from '../core/math';
import { STATUSES } from '../config/damage';
import { begin, end } from '../core/perf';
import { drawRings, drawShadows, quality } from '../core/quality';
import { STATUS_IDS, statusCount } from '../logic/status';
import type { Game } from '../core/types';
import { FEATURES, REGIONS } from '../config/regions';
import { QUESTS } from '../config/quests';
import { eventMarks, questMarks, type Mark } from '../logic/quests';
import { wallPattern } from './arena';
import { digitGlyphs, fogSprite, getSprite, glyphIndex, isNumeric, ringSprite, shadowSprite, textSprite, type Sprite } from './sprites';

export interface View {
  w: number; // canvas pixels
  h: number;
  zoom: number; // canvas pixels per world pixel (includes dpr)
  dpr: number; // canvas pixels per CSS pixel, capped by the quality level
}

type Ctx = CanvasRenderingContext2D;

/** Top-left of the visible world rect. Shared by rendering and mouse-to-world conversion. */
export function cameraFor(g: Game, view: View): { x: number; y: number } {
  const vw = view.w / view.zoom;
  const vh = view.h / view.zoom;
  // v0.5: the open part of the map plus its walls; closed wings are not worth looking at
  const pad = g.arena.wall;
  const b = g.bounds.w > 0 ? g.bounds : { x: pad, y: pad, w: g.arena.w - 2 * pad, h: g.arena.h - 2 * pad };
  const x0 = b.x - pad;
  const y0 = b.y - pad;
  const w = b.w + 2 * pad;
  const h = b.h + 2 * pad;
  return {
    x: vw >= w ? x0 + (w - vw) / 2 : clamp(g.player.x - vw / 2, x0, x0 + w - vw),
    y: vh >= h ? y0 + (h - vh) / 2 : clamp(g.player.y - vh / 2, y0, y0 + h - vh),
  };
}

function blitArena(ctx: Ctx, arena: HTMLCanvasElement, cx: number, cy: number, vw: number, vh: number): void {
  const sx = Math.max(0, cx);
  const sy = Math.max(0, cy);
  const sw = Math.min(arena.width, cx + vw) - sx;
  const sh = Math.min(arena.height, cy + vh) - sy;
  if (sw > 0 && sh > 0) ctx.drawImage(arena, sx, sy, sw, sh, sx, sy, sw, sh);
}

function drawSprite(ctx: Ctx, s: Sprite, x: number, y: number, flip: boolean, flash: boolean): void {
  const img = flash ? (flip ? s.flashFlipped : s.flash) : flip ? s.flipped : s.img;
  ctx.drawImage(img, Math.round(x - s.w / 2), Math.round(y - s.h + s.h * 0.25));
}

function shadow(ctx: Ctx, x: number, y: number, r: number): void {
  const s = shadowSprite(r);
  ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y + r * 0.7 - s.height / 2));
}
/** Blit a pre-rendered ring centred on (x, y). */
function blitRing(ctx: Ctx, img: HTMLCanvasElement, x: number, y: number): void {
  ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
}

function disc(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

/**
 * v0.5: a closed wing is darkness behind a portcullis; the hidden vault is solid stone until it opens. A handful of rects a frame.
 */
function drawClosedRegions(ctx: Ctx, g: Game, cx: number, cy: number, vw: number, vh: number): void {
  const regions = g.arena.regions;
  if (!regions) return;
  if (g.arena.id !== closedArena) closedPattern = null; // the pattern belongs to one arena's stone
  closedArena = g.arena.id;
  const overlaps = (r: { x: number; y: number; w: number; h: number }) => r.x < cx + vw && r.x + r.w > cx && r.y < cy + vh && r.y + r.h > cy;
  for (const r of regions) {
    if (g.regionOpen[r.id]) continue;
    const covers = r.gate ? [r.floor, r.gate] : [r.floor];
    if (!covers.some(overlaps)) continue;
    if (r.hidden) {
      ctx.fillStyle = (closedPattern ??= ctx.createPattern(wallPattern(g.arena), 'repeat')!);
      for (const q of covers) ctx.fillRect(q.x, q.y, q.w, q.h);
      continue;
    }
    ctx.fillStyle = 'rgba(12,10,8,0.93)';
    ctx.fillRect(r.floor.x, r.floor.y, r.floor.w, r.floor.h);
    const gt = r.gate!;
    // the portcullis sits in the wall part of the corridor: iron bars across it
    ctx.fillStyle = '#1b1715';
    ctx.fillRect(gt.x, gt.y, gt.w, gt.h);
    ctx.fillStyle = '#5b5550';
    const inner = gt.along === 'y' ? { x: gt.x, y: gt.y + REGIONS.gateReach, w: gt.w, h: gt.h - 2 * REGIONS.gateReach } : { x: gt.x + REGIONS.gateReach, y: gt.y, w: gt.w - 2 * REGIONS.gateReach, h: gt.h };
    if (gt.along === 'y') for (let x = inner.x + 10; x < inner.x + inner.w; x += 22) ctx.fillRect(x, inner.y, 5, inner.h);
    else for (let y = inner.y + 10; y < inner.y + inner.h; y += 22) ctx.fillRect(inner.x, y, inner.w, 5);
    ctx.fillRect(inner.x, inner.y + inner.h / 2 - 3, inner.w, 6);
    ctx.fillRect(inner.x + inner.w / 2 - 3, inner.y, 6, inner.h);
  }
  // the features in open wings: an altar, a strongbox, a lair's bones, a cache among the vents
  for (const f of g.features) {
    if (!g.regionOpen[f.wing] || (f.used && f.kind !== 'lair')) continue;
    if (f.x < cx - 40 || f.x > cx + vw + 40 || f.y < cy - 40 || f.y > cy + vh + 40) continue;
    const icon = textSprite(FEATURES[f.kind].icon, 34, '#ffffff', 64);
    ctx.globalAlpha = f.used ? 0.35 : 0.8 + Math.sin(g.time * 3) * 0.2;
    ctx.drawImage(icon, Math.round(f.x - icon.width / 2), Math.round(f.y - icon.height / 2));
    ctx.globalAlpha = 1;
  }
}
let closedPattern: CanvasPattern | null = null;
let closedArena = '';

/** #h-map's content box in canvas pixels: the HUD lays the minimap's frame out (style.css), the canvas fills it. Read once per window size. */
function minimapBox(view: View): { x: number; bottom: number; w: number } | null {
  const key = view.w * 100000 + view.h;
  if (mapBox && mapKey === key) return mapBox;
  const el = document.getElementById('h-map');
  const r = el?.getBoundingClientRect();
  if (!el || !r?.width) return null; // the HUD is not laid out yet: try again next frame
  mapKey = key;
  return (mapBox = { x: (r.left + el.clientLeft) * view.dpr, bottom: (r.top + el.clientTop + el.clientHeight) * view.dpr, w: el.clientWidth * view.dpr });
}
let mapBox: { x: number; bottom: number; w: number } | null = null;
let mapKey = 0;

/**
 * Bottom-left corner: the whole map at a glance. Shape says what a marker is: squares are foes (commanders orange, bosses big),
 * green diamonds quests and events, gold discs the wings' features, the white disc is you. Walked regions are lit, open but
 * unexplored ones dim with a gold edge, closed wings dark with their gate barred; the vault shows nothing.
 */
function drawMinimap(ctx: Ctx, g: Game, view: View, cx: number, cy: number, vw: number, vh: number, marks: Mark[]): void {
  const box = minimapBox(view);
  if (!box) return;
  const d = view.dpr;
  const { x: x0, w } = box;
  const k = w / g.arena.w;
  const h = g.arena.h * k;
  const y0 = box.bottom - h; // bottom-anchored: hud.ts gives the frame this arena's shape
  ctx.fillStyle = 'rgba(14,12,10,0.8)';
  ctx.fillRect(x0, y0, w, h);
  const dot = (x: number, y: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x0 + x * k - size / 2, y0 + y * k - size / 2, size, size);
  };
  // outlined markers: a square, a disc or a diamond of radius r
  const mark = (x: number, y: number, r: number, color: string, shape: 'square' | 'disc' | 'diamond') => {
    const px = x0 + x * k;
    const py = y0 + y * k;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (shape === 'square') ctx.rect(px - r, py - r, r * 2, r * 2);
    else if (shape === 'disc') ctx.arc(px, py, r, 0, TAU);
    else {
      ctx.moveTo(px, py - r * 1.3);
      ctx.lineTo(px + r * 1.3, py);
      ctx.lineTo(px, py + r * 1.3);
      ctx.lineTo(px - r * 1.3, py);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.fill();
  };
  for (const r of g.arena.regions ?? []) {
    const open = g.regionOpen[r.id];
    if (r.hidden && !open) continue;
    const q = r.floor;
    const seen = g.regionSeen.includes(r.id);
    ctx.fillStyle = !open ? 'rgba(255,255,255,0.04)' : seen ? 'rgba(196,174,128,0.36)' : 'rgba(196,174,128,0.14)';
    ctx.fillRect(x0 + q.x * k, y0 + q.y * k, q.w * k, q.h * k);
    if (open && !seen) {
      ctx.strokeStyle = 'rgba(233,201,90,0.6)';
      ctx.lineWidth = d;
      ctx.strokeRect(x0 + q.x * k + d / 2, y0 + q.y * k + d / 2, q.w * k - d, q.h * k - d);
    }
    if (r.gate) {
      ctx.fillStyle = open ? 'rgba(196,174,128,0.36)' : '#b08a4a';
      ctx.fillRect(x0 + r.gate.x * k, y0 + r.gate.y * k, Math.max(3 * d, r.gate.w * k), Math.max(3 * d, r.gate.h * k));
    }
  }
  for (const o of g.arena.obstacles) if (g.openRects.some((q) => o.x >= q.x && o.x <= q.x + q.w && o.y >= q.y && o.y <= q.y + q.h)) dot(o.x, o.y, 2 * d, '#5d5e64');
  for (const e of g.enemies) if (!e.hidden && !e.def.boss && !e.def.aura && !e.def.onDeath && !e.def.structure) dot(e.x, e.y, (e.elite ? 3 : 2) * d, e.elite ? '#e8913a' : '#d0584c');
  for (const m of g.minions) dot(m.x, m.y, 2 * d, '#7ec8d8');
  ctx.strokeStyle = '#14110f';
  ctx.lineWidth = 1.5 * d;
  for (const f of g.features) if (g.regionOpen[f.wing] && !f.used) mark(f.x, f.y, 3 * d, '#e9c95a', 'disc');
  for (const e of g.enemies) {
    if (e.hidden) continue;
    if (e.def.boss) mark(e.x, e.y, 4.5 * d, '#e0402f', 'square');
    else if (e.def.aura || e.def.onDeath) mark(e.x, e.y, 3 * d, '#ff9f43', 'square'); // commanders: the targets to hunt
    else if (e.def.id === 'royalFlame') mark(e.x, e.y, 4 * d, '#f2c94c', 'diamond'); // v0.6: the Usurper's ward anchors: the objective
    else if (e.def.structure) dot(e.x, e.y, 3 * d, '#d0584c');
  }
  for (const m of marks) if (!m.hidden) mark(m.x, m.y, 3.5 * d, '#9fe07b', 'diamond'); // v0.5 quests and events (not the hidden chest)
  mark(g.player.x, g.player.y, 3.5 * d, '#ffffff', 'disc');
  ctx.strokeStyle = 'rgba(232,226,208,0.55)';
  ctx.lineWidth = d;
  ctx.strokeRect(x0 + Math.max(0, cx) * k, y0 + Math.max(0, cy) * k, Math.min(vw, g.arena.w) * k, Math.min(vh, g.arena.h) * k);
}

/** v0.5: a quest or event icon on a dark disc with a green ring (the minimap's quest colour), so it reads over any floor. */
function questBadge(ctx: Ctx, icon: HTMLCanvasElement, x: number, y: number, r: number, line: number): void {
  ctx.fillStyle = 'rgba(20,17,15,0.7)';
  ctx.strokeStyle = '#9fe07b';
  ctx.lineWidth = line;
  disc(ctx, x, y, r);
  ctx.fill();
  ctx.stroke();
  ctx.drawImage(icon, Math.round(x - icon.width / 2), Math.round(y - icon.height / 2));
}

/** v0.5: on the ground: the shrine's circle, and the hidden chest's glint once the player is close. */
function drawQuestGround(ctx: Ctx, g: Game): void {
  const p = g.player;
  for (const q of g.quests) {
    if (q.state !== 'active') continue;
    if (q.kind === 'shrine') {
      const r = QUESTS.shrine.radius;
      if (Math.hypot(p.x - q.x, p.y - q.y) < r && g.breather <= 0 && g.wave > 0) {
        ctx.fillStyle = 'rgba(159,224,123,0.12)';
        disc(ctx, q.x, q.y, r);
        ctx.fill();
      }
      blitRing(ctx, ringSprite('rgba(159,224,123,0.8)', r, r, 3, true), q.x, q.y);
    } else if (q.kind === 'chest' && Math.hypot(p.x - q.x, p.y - q.y) < QUESTS.chest.glint) {
      ctx.fillStyle = '#1a1614';
      ctx.fillRect(q.x - 8, q.y - 7, 16, 13);
      ctx.fillStyle = '#8a6a42';
      ctx.fillRect(q.x - 6, q.y - 5, 12, 9);
      const s = 3 + Math.abs(Math.sin(g.time * 5)) * 7;
      ctx.fillStyle = '#fff6c0';
      ctx.fillRect(q.x - s, q.y - 9, s * 2, 2);
      ctx.fillRect(q.x - 1, q.y - 8 - s, 2, s * 2);
    }
  }
}

/**
 * v0.5: an arrow for every quest or event mark out of view, with its icon. They sit on an ellipse near the screen's edge rather
 * than on the edge itself, so the HUD's corner panels never cover them. Screen space.
 */
function drawEdgeArrows(ctx: Ctx, marks: Mark[], view: View, cx: number, cy: number, time: number): void {
  const d = view.dpr;
  const mx = view.w / 2;
  const my = view.h / 2;
  for (const m of marks) {
    const sx = (m.x - cx) * view.zoom - mx;
    const sy = (m.y - cy) * view.zoom - my;
    if (m.hidden || (Math.abs(sx) < mx && Math.abs(sy) < my)) continue;
    const a = Math.atan2(sy, sx);
    const x = mx + Math.cos(a) * view.w * 0.42;
    const y = my + Math.sin(a) * view.h * 0.38;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = '#9fe07b';
    ctx.strokeStyle = '#1a1614';
    ctx.lineWidth = 2 * d;
    ctx.beginPath();
    ctx.moveTo((16 + Math.sin(time * 6) * 2) * d, 0);
    ctx.lineTo(-4 * d, -10 * d);
    ctx.lineTo(-4 * d, 10 * d);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    const icon = textSprite(m.icon, Math.round(18 * d), '#ffffff', 64);
    questBadge(ctx, icon, x - Math.cos(a) * 20 * d, y - Math.sin(a) * 20 * d, 15 * d, 2 * d);
  }
}

const FRIEND_SPRITES = { caravan: 'siegeTower', monk: 'priest', knight: 'knight', hound: 'wolf' } as const;
const FRIEND_PALETTE = 2; // the gilded palette: allies read apart from the enemies that share their sprites

/** Slow pan over an empty arena behind the menus. */
export function renderBackdrop(ctx: Ctx, view: View, arena: HTMLCanvasElement, time: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14110f';
  ctx.fillRect(0, 0, view.w, view.h);
  const cx = (arena.width - view.w) / 2 + Math.sin(time * 0.1) * 200;
  const cy = (arena.height - view.h) / 2 + Math.cos(time * 0.13) * 120;
  ctx.setTransform(1, 0, 0, 1, -Math.round(cx), -Math.round(cy));
  blitArena(ctx, arena, cx, cy, view.w, view.h);
}

export function render(ctx: Ctx, g: Game, view: View, arena: HTMLCanvasElement, aimRadius: number): void {
  const z = view.zoom;
  const vw = view.w / z;
  const vh = view.h / z;
  const cam = cameraFor(g, view);
  const cx = cam.x + (Math.random() - 0.5) * g.shake * quality.shake;
  const cy = cam.y + (Math.random() - 0.5) * g.shake * quality.shake;
  const visible = (x: number, y: number, pad: number) => x > cx - pad && x < cx + vw + pad && y > cy - pad && y < cy + vh + pad;
  const p = g.player;
  const rings = drawRings();
  const marks = [...questMarks(g), ...eventMarks(g)];
  let _t = begin();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14110f';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(z, 0, 0, z, -Math.round(cx * z), -Math.round(cy * z));
  blitArena(ctx, arena, cx, cy, vw, vh);
  drawClosedRegions(ctx, g, cx, cy, vw, vh);
  end('arena', _t);
  _t = begin();
  // corpses
  const corpseLife = GAME.corpseLifetime * g.arena.corpseLifeMult;
  ctx.fillStyle = '#d8d2bd';
  for (const c of g.corpses) {
    if (!visible(c.x, c.y, 20)) continue;
    ctx.globalAlpha = clamp(1 - c.t / corpseLife, 0, 1) * 0.8;
    ctx.fillRect(c.x - 6, c.y - 1, 12, 3);
    ctx.fillRect(c.x - 1, c.y - 5, 3, 10);
  }

  end('corpses', _t);
  _t = begin();
  // lasting fields: fire, poison, holy ground
  for (const f of g.fields) {
    if (!visible(f.x, f.y, f.r)) continue;
    const fade = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.globalAlpha = (0.2 + Math.sin(g.time * 8 + f.x) * 0.05) * fade;
    disc(ctx, f.x, f.y, f.r);
    ctx.fill();
    ctx.globalAlpha = 0.7 * fade;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = f.hostile ? 2 : 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawQuestGround(ctx, g);

  end('fields', _t);
  _t = begin();
  // barriers a boss raised: stone that fades as it runs out
  for (const b of g.barriers) {
    if (!visible(b.x, b.y, b.r)) continue;
    ctx.globalAlpha = clamp(b.life, 0, 1);
    ctx.fillStyle = '#1a1614';
    disc(ctx, b.x, b.y, b.r + 2);
    ctx.fill();
    ctx.fillStyle = '#6b5f7a';
    disc(ctx, b.x, b.y, b.r - 1);
    ctx.fill();
    ctx.fillStyle = '#a77fd0';
    disc(ctx, b.x - 5, b.y - 6, b.r * 0.35);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  end('barriers', _t);
  _t = begin();
  // zones (telegraphs and falling arrows)
  for (const zn of g.zones) {
    if (!visible(zn.x, zn.y, zn.r + 320)) continue;
    const k = clamp(zn.t / zn.delay, 0, 1);
    if (zn.arrow) {
      ctx.strokeStyle = 'rgba(232,226,208,0.25)';
      ctx.lineWidth = 1;
      disc(ctx, zn.x, zn.y, zn.r * 0.5);
      ctx.stroke();
      const left = zn.delay - zn.t;
      if (left < 0.22) {
        const f = left / 0.22; // 1 = high up, 0 = impact
        ctx.strokeStyle = zn.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(zn.x + f * 60, zn.y - f * 300);
        ctx.lineTo(zn.x + f * 60 + 5, zn.y - f * 300 - 24);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = zn.color;
      ctx.globalAlpha = zn.hostile ? 0.16 : 0.08;
      disc(ctx, zn.x, zn.y, zn.r);
      ctx.fill();
      ctx.globalAlpha = zn.hostile ? 0.35 : 0.15;
      disc(ctx, zn.x, zn.y, zn.r * k);
      ctx.fill();
      ctx.globalAlpha = zn.hostile ? 0.9 : 0.4;
      ctx.strokeStyle = zn.color;
      ctx.lineWidth = 2;
      disc(ctx, zn.x, zn.y, zn.r);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  end('zones', _t);
  _t = begin();
  // charge telegraphs (black knight, cavalry)
  for (const e of g.enemies) {
    const t = e.telegraph;
    if (!t) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(t.angle);
    ctx.fillStyle = 'rgba(194,58,46,0.2)';
    ctx.fillRect(0, -t.width / 2, t.length, t.width);
    ctx.fillStyle = 'rgba(194,58,46,0.4)';
    ctx.fillRect(0, -t.width / 2, t.length * clamp(t.t / t.dur, 0, 1), t.width);
    ctx.restore();
  }

  end('telegraphs', _t);
  _t = begin();
  // pickups: xp gems, gold coins, relic chests
  for (const k of g.pickups) {
    if (!visible(k.x, k.y, 12)) continue;
    ctx.fillStyle = '#1a1614';
    if (k.kind === 'fragment') {
      // v0.5: a sacred treasure's fragment, a pale shard that bobs higher than a relic chest
      const bob = Math.sin(g.time * 4) * 3;
      ctx.fillRect(k.x - 6, k.y - 10 + bob, 12, 16);
      ctx.fillStyle = '#7ec8d8';
      ctx.fillRect(k.x - 4, k.y - 8 + bob, 8, 12);
      ctx.fillStyle = '#e8f6fa';
      ctx.fillRect(k.x - 1, k.y - 6 + bob, 2, 6);
    } else if (k.kind === 'relic') {
      const bob = Math.sin(g.time * 5) * 2;
      ctx.fillRect(k.x - 8, k.y - 7 + bob, 16, 13);
      ctx.fillStyle = '#8a6a42';
      ctx.fillRect(k.x - 6, k.y - 5 + bob, 12, 9);
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(k.x - 6, k.y - 2 + bob, 12, 2);
      ctx.fillRect(k.x - 1, k.y - 3 + bob, 2, 4);
    } else if (k.kind === 'gold') {
      disc(ctx, k.x, k.y, 4.5);
      ctx.fill();
      ctx.fillStyle = '#e2c04a';
      disc(ctx, k.x, k.y, 3);
      ctx.fill();
    } else {
      ctx.fillRect(k.x - 4, k.y - 4, 8, 8);
      ctx.fillStyle = k.value >= 10 ? '#c9a227' : '#7ec8d8';
      ctx.fillRect(k.x - 2, k.y - 2, 4, 4);
    }
  }

  end('pickups', _t);
  _t = begin();
  // shadows in one batch, then sprites
  if (drawShadows()) {
    for (const e of g.enemies) if (visible(e.x, e.y, 80) && !e.hidden) shadow(ctx, e.x, e.y, e.r);
    for (const m of g.minions) shadow(ctx, m.x, m.y, m.r);
    shadow(ctx, p.x, p.y, p.r);
  }

  end('shadows', _t);
  _t = begin();
  for (const e of g.enemies) {
    if (!visible(e.x, e.y, 80)) continue;
    if (e.def.aura) {
      // commanders: their aura on the ground and a gold chevron overhead, so they read as the target to hunt
      const color = e.def.aura.kind === 'heal' ? 'rgba(111,220,111,0.35)' : e.def.aura.kind === 'speed' ? 'rgba(242,230,160,0.3)' : 'rgba(194,58,46,0.35)';
      blitRing(ctx, ringSprite(color, e.def.aura.radius, e.def.aura.radius, 2, true), e.x, e.y);
      ctx.fillStyle = '#c9a227';
      ctx.beginPath();
      ctx.moveTo(e.x - 7, e.y - e.r - 40);
      ctx.lineTo(e.x + 7, e.y - e.r - 40);
      ctx.lineTo(e.x, e.y - e.r - 31);
      ctx.fill();
    }
    if (e.buffT > 0) {
      ctx.fillStyle = e.buffDmg > 1 ? '#c23a2e' : '#f2e6a0';
      ctx.fillRect(e.x + 5, e.y - e.r - 34, 5, 5);
    }
    if (e.elite && rings) {
      // elites: coloured ground ring per affix (pre-rendered), bigger sprite
      for (let i = 0; i < e.affixes.length; i++) blitRing(ctx, ringSprite(AFFIXES[e.affixes[i]].color, e.r * 1.5 + i * 5, e.r * 0.7 + i * 3), e.x, e.y + e.r * 0.7);
    }
    const fuse = e.def.behavior === 'exploder' && e.state === 1 && Math.floor(e.timer * 14) % 2 === 0;
    if (e.hidden) ctx.globalAlpha = 0.12; // a vanished assassin, a dragon overhead: barely a shimmer
    drawSprite(ctx, (e.spr ??= getSprite(e.def.sprite, e.def.scale + (e.elite ? ELITES.scaleBonus : 0), e.def.palette)), e.x, e.y, e.flip, e.flash > 0 || fuse);
    ctx.globalAlpha = 1;
    if (e.hidden) continue;
    if (e.def.reflect && e.attackTimer <= 0 && e.armorHp > 0) {
      // mirror up: a glint on his front. It drops for a moment after he swings.
      ctx.strokeStyle = '#7ec8d8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y - 8, e.r + 8, e.angle - 0.9, e.angle + 0.9);
      ctx.stroke();
    }
    if (e.def.wall && e.charged) {
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y - 6, e.r + 6, e.angle - 1, e.angle + 1);
      ctx.stroke();
    }
    if (e.shield > 0) {
      ctx.globalAlpha = 0.25 + 0.5 * (e.shield / e.shieldMax);
      ctx.strokeStyle = AFFIXES.shielded.color;
      ctx.lineWidth = 2;
      disc(ctx, e.x, e.y - e.r * 0.4, e.r * 1.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.warded) {
      // v0.6: the Usurper's ward, a pulsing gold bubble; every Royal Flame still burning ties a gold thread to it
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(g.time * 5);
      ctx.strokeStyle = '#e9c95a';
      ctx.lineWidth = 3;
      for (const f of g.enemies) {
        if (f.def.id !== 'royalFlame' || f.dead) continue;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y - f.r);
        ctx.lineTo(e.x, e.y - e.r * 0.4);
        ctx.stroke();
      }
      ctx.lineWidth = 4;
      disc(ctx, e.x, e.y - e.r * 0.4, e.r * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(233,201,90,0.12)';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // status effects: one pip per effect (taller with more stacks), an ice block when frozen solid
    const count = statusCount(e.statuses) + (e.fearT > 0 ? 1 : 0);
    if (count > 0) {
      let i = 0;
      for (const id of STATUS_IDS) {
        const st = e.statuses[id];
        if (!st) continue;
        ctx.fillStyle = STATUSES[id].color;
        ctx.fillRect(e.x - count * 3.5 + i++ * 7, e.y - e.r - 34 - st.stacks, 5, 4 + st.stacks);
      }
      if (e.fearT > 0) {
        ctx.fillStyle = STATUSES.fear.color;
        ctx.fillRect(e.x - count * 3.5 + i * 7, e.y - e.r - 35, 5, 5);
      }
    }
    if (e.statuses.stun) {
      ctx.fillStyle = 'rgba(169,216,239,0.45)';
      ctx.fillRect(e.x - e.r, e.y - e.r * 2, e.r * 2, e.r * 2.6);
    }
    if (e.armorHp > 0) {
      // armor: a steel bar over the health bar; gone once it breaks
      const w = e.r * 2;
      ctx.fillStyle = '#1a1614';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 30, w, 3);
      ctx.fillStyle = '#9a9aa0';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 30, (w * e.armorHp) / e.armorMax, 3);
    }
    if (e.hp < e.maxHp && !e.def.boss) {
      const w = e.r * 2;
      ctx.fillStyle = '#1a1614';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 26, w, 4);
      ctx.fillStyle = e.elite ? '#c9a227' : '#c23a2e';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 26, (w * e.hp) / e.maxHp, 4);
    }
  }

  end('enemies', _t);
  _t = begin();
  for (const m of g.minions) {
    ctx.globalAlpha = clamp(m.life, 0.2, 1);
    drawSprite(ctx, m.kind ? getSprite(FRIEND_SPRITES[m.kind], m.scale, FRIEND_PALETTE) : getSprite('skeleton', m.scale), m.x, m.y, m.flip, m.flash > 0);
    if (!m.kind) continue;
    // v0.5 allies from quests and events: a green health bar
    const w = m.r * 2 + 8;
    ctx.fillStyle = '#1a1614';
    ctx.fillRect(m.x - w / 2, m.y - m.r - 30, w, 4);
    ctx.fillStyle = '#6fbf4e';
    ctx.fillRect(m.x - w / 2, m.y - m.r - 30, w * clamp(m.hp / m.maxHp, 0, 1), 4);
  }
  ctx.globalAlpha = 1;
  if (g.event?.kind === 'peddler') drawSprite(ctx, getSprite('engineer', GAME.spriteScale, FRIEND_PALETTE), g.event.x, g.event.y, false, false);

  end('minions', _t);
  _t = begin();
  // player
  if (p.abilityTime > 0) {
    const pulse = 30 + Math.sin(g.time * 12) * 3;
    ctx.fillStyle = p.cls.ability.aura;
    ctx.globalAlpha = 0.22;
    disc(ctx, p.x, p.y - 6, pulse);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = p.cls.ability.aura;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (p.reviveT > 0 || p.revives > 0) {
    // a halo while a revive is ready
    ctx.strokeStyle = '#f2e6a0';
    ctx.globalAlpha = p.reviveT > 0 ? 0.9 : 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 38, 9, 3, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (p.invulnT <= 0 || Math.floor(g.time * 16) % 2 === 0) {
    drawSprite(ctx, getSprite(p.cls.sprite, GAME.spriteScale, g.palette), p.x, p.y, p.flip, p.flash > 0);
  }
  if (p.chillT > 0) {
    ctx.fillStyle = 'rgba(169,216,239,0.3)';
    disc(ctx, p.x, p.y - 6, 22);
    ctx.fill();
  }

  end('player', _t);
  _t = begin();
  // projectiles
  for (const pr of g.projectiles) {
    if (!visible(pr.x, pr.y, 40)) continue;
    if (pr.shape === 'arrow') {
      const v = Math.hypot(pr.vx, pr.vy) || 1;
      const len = pr.r > 8 ? 46 : 16; // ballista bolts
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = pr.r > 8 ? 5 : 2;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x - (pr.vx / v) * len, pr.y - (pr.vy / v) * len);
      ctx.stroke();
    } else {
      ctx.fillStyle = pr.color;
      disc(ctx, pr.x, pr.y, pr.r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(pr.x - 1.5, pr.y - 1.5, 3, 3);
    }
  }

  end('projectiles', _t);
  _t = begin();
  // swing arcs, rings, beams
  for (const e of g.effects) {
    const k = e.t / e.dur;
    ctx.globalAlpha = 1 - k;
    if (e.kind === 'ring') {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 4;
      disc(ctx, e.x, e.y, e.r * (1 - (1 - k) * (1 - k)));
      ctx.stroke();
    } else if (e.kind === 'line') {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo((e.x + e.x2) / 2 + (Math.random() - 0.5) * 16, (e.y + e.y2) / 2 + (Math.random() - 0.5) * 16);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.arc(e.x, e.y, e.r, e.angle - e.arc / 2, e.angle + e.arc / 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  end('effects', _t);
  _t = begin();
  // particles: four alpha buckets, colour set only when it changes (a burst's particles share one)
  for (let bucket = 0; bucket < 4; bucket++) {
    ctx.globalAlpha = 0.25 + bucket * 0.25;
    let color = '';
    for (const pt of g.particles) {
      const b = Math.min(3, Math.floor((pt.life / pt.max) * 4));
      if (b !== bucket || !visible(pt.x, pt.y, 4)) continue;
      if (pt.color !== color) ctx.fillStyle = color = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
  }
  ctx.globalAlpha = 1;

  end('particles', _t);
  _t = begin();
  // targeted-ability reticle
  if (aimRadius > 0 && p.abilityCd <= 0 && g.input.showAim) {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = p.cls.ability.aura;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    disc(ctx, g.input.aimX, g.input.aimY, aimRadius);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  end('reticle', _t);
  _t = begin();
  // damage numbers
  // damage numbers: each rendered once into a small sprite (outline + fill), then blitted
  for (const t of g.texts) {
    if (!visible(t.x, t.y, 40)) continue;
    ctx.globalAlpha = clamp(t.life * 3, 0, 1);
    if (isNumeric(t.text)) {
      // digits from the atlas: glyphs overlap by their 3px outline margin
      const glyphs = digitGlyphs(t.size, t.color);
      let width = 0;
      for (let i = 0; i < t.text.length; i++) width += glyphs[glyphIndex(t.text[i])].width - 6;
      let x = Math.round(t.x - width / 2) - 3;
      const y = Math.round(t.y - glyphs[0].height / 2);
      for (let i = 0; i < t.text.length; i++) {
        const img = glyphs[glyphIndex(t.text[i])];
        ctx.drawImage(img, x, y);
        x += img.width - 6;
      }
    } else {
      const img = (t.img ??= textSprite(t.text, t.size, t.color, RENDER.textCacheSize));
      ctx.drawImage(img, Math.round(t.x - img.width / 2), Math.round(t.y - img.height / 2));
    }
  }
  ctx.globalAlpha = 1;
  // v0.5 quest and event marks: an icon over each target (the hidden chest has none)
  for (const m of marks) {
    if (m.hidden || !visible(m.x, m.y, 80)) continue;
    const bob = m.lift ? Math.sin(g.time * 4 + m.x) * 3 : 0;
    questBadge(ctx, textSprite(m.icon, 20, '#ffffff', 64), m.x, m.y - m.lift + bob, 16, 2);
  }

  end('texts', _t);
  _t = begin();
  // wave modifier overlays, in screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!g.curses.includes('blind')) drawMinimap(ctx, g, view, cx, cy, vw, vh, marks);
  drawEdgeArrows(ctx, marks, view, cx, cy, g.time);
  if (g.modifier === 'fog') {
    // a cached tile with the hole in it, centred on the player; plain fog around it
    const tile = fogSprite(MODIFIERS.fog.n.vision, z);
    const px = Math.round((p.x - cx) * z - tile.width / 2);
    const py = Math.round((p.y - cy) * z - tile.height / 2);
    ctx.drawImage(tile, px, py);
    ctx.fillStyle = 'rgba(120,130,136,0.96)';
    if (py > 0) ctx.fillRect(0, 0, view.w, py);
    if (py + tile.height < view.h) ctx.fillRect(0, py + tile.height, view.w, view.h - py - tile.height);
    if (px > 0) ctx.fillRect(0, Math.max(0, py), px, tile.height);
    if (px + tile.width < view.w) ctx.fillRect(px + tile.width, Math.max(0, py), view.w - px - tile.width, tile.height);
  } else if (g.modifier === 'bloodMoon') {
    ctx.fillStyle = 'rgba(140,10,10,0.16)';
    ctx.fillRect(0, 0, view.w, view.h);
  } else if (g.modifier === 'plague') {
    ctx.fillStyle = 'rgba(80,120,40,0.08)';
    ctx.fillRect(0, 0, view.w, view.h);
  }
  end('overlay', _t);
}
