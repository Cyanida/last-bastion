import { sfx } from '../core/audio';
import { TAU } from '../core/math';
import type { Enemy, Game } from '../core/types';
import { addZone, after, fireProjectile } from '../entities/hazards';
import { angleTo, distTo, hitDamage, keepRange, moveTo, seek, specialDamage, summon, touch } from './aiHelpers';
import { pickTarget, registerBoss } from './enemyAI';
import { ring, shake } from './effects';

/**
 * The Act bosses: three phases (66% / 33% HP), and each of them changes the arena itself.
 * e.state / e.timer / e.special / e.combo are their scratch space, like every boss script.
 */

const FIRE = '#e07b28';
const SEAL = '#a77fd0';

function fireField(g: Game, e: Enemy) {
  const dps = e.def.poolDps! * g.waveDmgMult * g.tier.enemyDmg;
  return { life: e.def.poolLife!, dps, color: FIRE, dtype: 'fire' as const, apply: { id: 'burn' as const, power: dps * 0.12 } }; // standing in fire stacks the burn: step out
}

/** The Dragon burns a whole strip of the map: a telegraphed band of fire, straight through where you stand. */
function burnBand(g: Game, e: Enemy): void {
  const { w, h, wall } = g.arena;
  const p = g.player;
  const vertical = g.rng() < 0.5;
  const length = vertical ? h : w;
  for (let along = wall + 60; along < length - wall; along += 170) {
    for (const side of [0]) {
      const x = vertical ? p.x + side : along;
      const y = vertical ? along : p.y + side;
      addZone(g, { x, y, r: 105, delay: 1.6, damage: specialDamage(e) * 0.6, hostile: true, color: FIRE, owner: e, dtype: 'fire', leaveField: fireField(g, e) });
    }
  }
  g.banner = { text: 'The ground burns', t: 1.6 };
}

registerBoss('dragon', (g, e, dt) => {
  const t = pickTarget(g, e);
  const def = e.def;
  // airborne: untargetable, gliding to where you are, then a telegraphed landing and a burning strip of map
  if (e.state === 2) {
    e.timer -= dt;
    moveTo(e, g.player.x, g.player.y, e.baseSpeed * 3, dt);
    if (e.timer > 0) return;
    e.state = 0;
    e.hidden = false;
    addZone(g, { x: e.x, y: e.y, r: 190, delay: 0.9, damage: specialDamage(e), hostile: true, color: FIRE, owner: e, dtype: 'fire' });
    burnBand(g, e);
    shake(g, 12);
    return;
  }

  const d = keepRange(e, t, dt);
  e.timer -= dt;
  if (e.timer <= 0 && d < def.range! * 1.6) {
    e.timer = def.fireCd! / (e.phase === 3 ? 1.5 : 1);
    const a = angleTo(e, t);
    for (const spread of [-0.36, -0.18, 0, 0.18, 0.36]) {
      fireProjectile(g, e.x, e.y, a + spread, { damage: hitDamage(e) * 0.5 /* five of them: point blank it is a shotgun */, crit: false, hostile: true, pierce: 0, shape: 'orb', color: FIRE, r: 9, speed: def.projSpeed!, range: 640, dtype: 'fire' });
    }
    if (e.phase === 3) {
      // meteors: nowhere near you is safe for long
      for (let i = 0; i < 3; i++) {
        const ma = g.rng() * TAU;
        const off = g.rng() * 220;
        addZone(g, { x: g.player.x + Math.cos(ma) * off, y: g.player.y + Math.sin(ma) * off, r: 70, delay: 1.1 + i * 0.2, damage: specialDamage(e) * 0.7, hostile: true, color: FIRE, owner: e, dtype: 'fire' });
      }
    }
  }

  e.special -= dt;
  if (e.special > 0) return;
  e.special = def.specialCd!;
  sfx('warn');
  if (e.phase >= 2 && e.combo++ % 2 === 0) {
    e.state = 2; // take off
    e.timer = 2.2;
    e.hidden = true;
    ring(g, e.x, e.y, 160, FIRE, 0.6);
    return;
  }
  // a line of fire from his jaws, through you and far beyond, that keeps burning
  const a = angleTo(e, g.player);
  for (let i = 1; i <= def.lineZones!; i++) {
    addZone(g, { x: e.x + Math.cos(a) * def.lineSpacing! * i, y: e.y + Math.sin(a) * def.lineSpacing! * i, r: def.zoneRadius!, delay: def.windup! + i * 0.06, damage: specialDamage(e), hostile: true, color: FIRE, owner: e, dtype: 'fire', leaveField: fireField(g, e) });
  }
});

/** The Warden seals you in: a ring of stone that blocks everyone, with a few gaps to fight your way out through. */
function seal(g: Game, x: number, y: number, radius: number, gaps: number, life: number): void {
  const r = 24;
  const count = Math.floor((TAU * radius) / (r * 2 + 6));
  const gapWidth = 3;
  const start = Math.floor(g.rng() * count);
  for (let i = 0; i < count; i++) {
    const inGap = Array.from({ length: gaps }, (_, k) => (start + Math.floor((k * count) / gaps)) % count).some((s) => (i - s + count) % count < gapWidth);
    if (inGap) continue;
    const a = (i / count) * TAU;
    g.barriers.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius, r, life });
  }
  ring(g, x, y, radius, SEAL, 0.7);
}

registerBoss('warden', (g, e, dt) => {
  const t = pickTarget(g, e);
  const def = e.def;
  seek(e, t, e.speed, dt);
  touch(g, e, t);
  e.special -= dt;
  if (e.special > 0 || distTo(e, g.player) > 700) return;
  e.special = def.specialCd!;
  sfx('warn');
  const { x, y } = g.player;
  g.banner = { text: 'Sealed in', t: 1.4 };
  seal(g, x, y, 300, e.phase === 1 ? 3 : 2, 8);

  if (e.phase >= 2) {
    // a clock hand of force sweeps the sealed circle: keep moving ahead of it
    const base = g.rng() * TAU;
    for (let k = 0; k < 8; k++) {
      const a = base + (k / 8) * TAU;
      for (let i = 1; i <= 5; i++) {
        addZone(g, { x: x + Math.cos(a) * i * 55, y: y + Math.sin(a) * i * 55, r: def.zoneRadius!, delay: def.windup! + k * 0.4, damage: specialDamage(e), hostile: true, color: SEAL, owner: e, dtype: 'shadow' });
      }
    }
  }
  if (e.phase === 3) {
    after(g, 2.5, () => !e.dead && seal(g, x, y, 175, 2, 5.5)); // the circle closes
    summon(g, e);
  }
});
