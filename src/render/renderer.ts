import { AFFIXES, ELITES } from '../config/elites';
import { GAME } from '../config/game';
import { MODIFIERS } from '../config/waves';
import { clamp, TAU } from '../core/math';
import { STATUSES } from '../config/damage';
import { quality } from '../core/quality';
import { activeStatuses } from '../logic/status';
import type { Game } from '../core/types';
import { getSprite, type Sprite } from './sprites';

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
  const { w, h } = g.arena;
  return {
    x: vw >= w ? (w - vw) / 2 : clamp(g.player.x - vw / 2, 0, w - vw),
    y: vh >= h ? (h - vh) / 2 : clamp(g.player.y - vh / 2, 0, h - vh),
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
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.7, r, r * 0.45, 0, 0, TAU);
  ctx.fill();
}

function disc(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

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

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14110f';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(z, 0, 0, z, -Math.round(cx * z), -Math.round(cy * z));
  blitArena(ctx, arena, cx, cy, vw, vh);

  // corpses
  const corpseLife = GAME.corpseLifetime * g.arena.corpseLifeMult;
  ctx.fillStyle = '#d8d2bd';
  for (const c of g.corpses) {
    if (!visible(c.x, c.y, 20)) continue;
    ctx.globalAlpha = clamp(1 - c.t / corpseLife, 0, 1) * 0.8;
    ctx.fillRect(c.x - 6, c.y - 1, 12, 3);
    ctx.fillRect(c.x - 1, c.y - 5, 3, 10);
  }

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

  // pickups: xp gems, gold coins, relic chests
  for (const k of g.pickups) {
    if (!visible(k.x, k.y, 12)) continue;
    ctx.fillStyle = '#1a1614';
    if (k.kind === 'relic') {
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

  // shadows in one batch, then sprites
  if (quality.shadows) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (const e of g.enemies) if (visible(e.x, e.y, 80)) shadow(ctx, e.x, e.y, e.r);
    for (const m of g.minions) shadow(ctx, m.x, m.y, m.r);
    shadow(ctx, p.x, p.y, p.r);
  }

  for (const e of g.enemies) {
    if (!visible(e.x, e.y, 80)) continue;
    if (e.def.aura) {
      // commanders: their aura on the ground and a gold chevron overhead, so they read as the target to hunt
      ctx.strokeStyle = e.def.aura.kind === 'heal' ? 'rgba(111,220,111,0.35)' : e.def.aura.kind === 'speed' ? 'rgba(242,230,160,0.3)' : 'rgba(194,58,46,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      disc(ctx, e.x, e.y, e.def.aura.radius);
      ctx.stroke();
      ctx.setLineDash([]);
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
    if (e.elite) {
      // elites: coloured ground ring per affix, bigger sprite
      e.affixes.forEach((id, i) => {
        ctx.strokeStyle = AFFIXES[id].color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.r * 0.7, e.r * 1.5 + i * 5, e.r * 0.7 + i * 3, 0, 0, TAU);
        ctx.stroke();
      });
    }
    const fuse = e.def.behavior === 'exploder' && e.state === 1 && Math.floor(e.timer * 14) % 2 === 0;
    drawSprite(ctx, getSprite(e.def.sprite, e.def.scale + (e.elite ? ELITES.scaleBonus : 0)), e.x, e.y, e.flip, e.flash > 0 || fuse);
    if (e.shield > 0) {
      ctx.globalAlpha = 0.25 + 0.5 * (e.shield / e.shieldMax);
      ctx.strokeStyle = AFFIXES.shielded.color;
      ctx.lineWidth = 2;
      disc(ctx, e.x, e.y - e.r * 0.4, e.r * 1.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // status effects: one pip per effect (taller with more stacks), an ice block when frozen solid
    const active = activeStatuses(e.statuses);
    if (e.fearT > 0) active.push('fear');
    active.forEach((id, i) => {
      const stacks = e.statuses[id]?.stacks ?? 1;
      ctx.fillStyle = STATUSES[id].color;
      ctx.fillRect(e.x - active.length * 3.5 + i * 7, e.y - e.r - 34 - stacks, 5, 4 + stacks);
    });
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

  for (const m of g.minions) {
    ctx.globalAlpha = clamp(m.life, 0.2, 1);
    drawSprite(ctx, getSprite('skeleton', m.scale), m.x, m.y, m.flip, m.flash > 0);
  }
  ctx.globalAlpha = 1;

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
    drawSprite(ctx, getSprite(p.cls.sprite, GAME.spriteScale), p.x, p.y, p.flip, p.flash > 0);
  }
  if (p.chillT > 0) {
    ctx.fillStyle = 'rgba(169,216,239,0.3)';
    disc(ctx, p.x, p.y - 6, 22);
    ctx.fill();
  }

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

  for (const pt of g.particles) {
    ctx.globalAlpha = pt.life / pt.max;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }

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

  // damage numbers
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1614';
  for (const t of g.texts) {
    ctx.globalAlpha = clamp(t.life * 3, 0, 1);
    ctx.font = `bold ${t.size}px Georgia, serif`;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // wave modifier overlays, in screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (g.modifier === 'fog') {
    const px = (p.x - cx) * z;
    const py = (p.y - cy) * z;
    const vision = MODIFIERS.fog.n.vision * z;
    const fog = ctx.createRadialGradient(px, py, vision * 0.55, px, py, vision * 1.5);
    fog.addColorStop(0, 'rgba(170,180,185,0)');
    fog.addColorStop(1, 'rgba(120,130,136,0.96)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, view.w, view.h);
  } else if (g.modifier === 'bloodMoon') {
    ctx.fillStyle = 'rgba(140,10,10,0.16)';
    ctx.fillRect(0, 0, view.w, view.h);
  } else if (g.modifier === 'plague') {
    ctx.fillStyle = 'rgba(80,120,40,0.08)';
    ctx.fillRect(0, 0, view.w, view.h);
  }
}
