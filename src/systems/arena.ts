import { FLAGSTONE, LAVA, PRESSES, SPREADING_FIRE } from '../config/arenas';
import { GAME } from '../config/game';
import { sfx } from '../sim/view';
import { TAU } from '../core/math';
import type { Game } from '../core/types';
import { addZone } from '../entities/hazards';
import { inLava, lavaTick } from '../logic/lava';
import { onSlab, openSlab, pressesOn, pressShape, pressSlabs, type Slab } from '../logic/presses';
import { advanceFire, bankSlabs, catchFire, catchSlabs, fireBurn, fireOn, fireTongues, flameState } from '../logic/spreadingFire';
import { applyStatusTo } from '../logic/status';
import { damageEnemy, damageMinion, damagePlayer } from './combat';

/** Each arena's environmental hazard, on a timer. Damage scales with the wave like enemy damage. */
export function updateArena(g: Game, dt: number): void {
  updatePresses(g, dt);
  updateLava(g, dt);
  updateFire(g, dt);
  const hz = g.arena.hazard;
  if (!hz || g.wave === 0) return;
  g.hazardT -= dt;
  if (g.hazardT > 0) return;
  g.hazardT = hz.every;
  const damage = hz.damage * g.waveDmgMult * g.tier.enemyDmg;
  sfx(g, 'warn');

  if (hz.kind === 'graspingHands') {
    const p = g.player;
    for (let i = 0; i < hz.count; i++) {
      const a = g.rng() * TAU;
      const d = i === 0 ? 0 : g.rng() * hz.spread;
      addZone(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: hz.radius, delay: hz.delay + i * 0.15, damage, hostile: true, color: '#8fb08a', art: 'hands' });
    }
  } else if (hz.kind === 'gatehouse') {
    // v0.6 Last Bastion: the gatehouse burns. A marked row of fire rolls across the south end of the hall, one side to the other,
    // and like the braziers it burns the horde too: lure them through it
    const core = g.arena.regions!.find((r) => r.id === 'core')!.floor;
    const y = core.y + core.h - 140;
    const n = Math.floor(core.w / hz.spacing);
    const fromLeft = g.rng() < 0.5;
    for (let i = 0; i <= n; i++) {
      const x = core.x + hz.spacing / 2 + (fromLeft ? i : n - i) * ((core.w - hz.spacing) / n);
      addZone(g, { x, y, r: hz.radius, delay: hz.delay + i * 0.09, damage, hostile: true, color: '#e07b28', dtype: 'fire', art: 'fire' });
      addZone(g, { x, y, r: hz.radius, delay: hz.delay + i * 0.09, damage: damage * 3, hostile: false, color: '#e07b28', dtype: 'fire', source: 'hazard' });
    }
  } else {
    // braziers burn friend and foe: one hostile zone and one friendly zone on the same spot
    for (const o of g.arena.obstacles) {
      if (o.kind !== 'brazier') continue;
      addZone(g, { x: o.x, y: o.y, r: hz.radius, delay: hz.delay, damage, hostile: true, color: '#e07b28', art: 'fire' });
      addZone(g, { x: o.x, y: o.y, r: hz.radius, delay: hz.delay, damage: damage * 3, hostile: false, color: '#e07b28', source: 'hazard' });
    }
  }
}

/**
 * #211: the Iron Hold's forge presses, on their own clock beside the arena's braziers. A press marks the slabs round the player (a line
 * through theirs, late on every other slam a cross), lowers its ram over them and slams: one hostile zone and one friendly zone per
 * slab, like the braziers, so the horde lured under it takes the heavier blow.
 */
function updatePresses(g: Game, dt: number): void {
  if (g.wave === 0 || !pressesOn(g.level?.realm, g.arena.id)) return;
  g.pressT -= dt;
  if (g.pressT > 0) return;
  g.pressT = PRESSES.every;
  const p = g.player;
  const shape = pressShape(g.wave, g.presses++, PRESSES.crossFrom);
  const slabs = pressSlabs(p.x, p.y, FLAGSTONE, shape, PRESSES.line, g.rng() < 0.5, Math.floor(g.rng() * PRESSES.line)).filter((s) => openSlab(s, g.openRects, g.arena.obstacles));
  if (!slabs.length) return;
  const damage = PRESSES.damage * g.waveDmgMult * g.tier.enemyDmg;
  sfx(g, 'warn');
  for (const s of slabs) {
    const z = { x: s.x, y: s.y, r: FLAGSTONE / 2, slab: FLAGSTONE, delay: PRESSES.delay, color: '#e0683f', source: 'hazard' as const };
    addZone(g, { ...z, damage, hostile: true, art: 'press' });
    addZone(g, { ...z, damage: damage * PRESSES.foeMult, hostile: false });
  }
}

/**
 * #223: the Ember Forge's lava burns whoever stands in it, every GAME.fieldTick: you (a dodge's invulnerability carries you over it),
 * your minions, and foes x LAVA.foeMult, so a horde chasing you across a channel pays for it. Terrain, so it burns from the first second.
 */
function updateLava(g: Game, dt: number): void {
  const lava = g.arena.lava;
  if (!lava?.length) return;
  g.lavaT -= dt;
  if (g.lavaT > 0) return;
  g.lavaT += GAME.fieldTick;
  const scale = g.waveDmgMult * g.tier.enemyDmg;
  const p = g.player;
  if (inLava(p.x, p.y, p.r, lava)) damagePlayer(g, lavaTick(LAVA.dps, GAME.fieldTick, scale, LAVA.foeMult, false), true, null, 'the lava');
  for (const m of g.minions) if (inLava(m.x, m.y, m.r, lava)) damageMinion(g, m, lavaTick(LAVA.dps, GAME.fieldTick, scale, LAVA.foeMult, false));
  for (const e of g.enemies) {
    if (!e.dead && inLava(e.x, e.y, e.r, lava)) damageEnemy(g, e, lavaTick(LAVA.dps, GAME.fieldTick, scale, LAVA.foeMult, true), false, 0, 0, 'hazard', 'fire', true);
  }
}

/**
 * #224: the Cinderlands' spreading fire, on its own clock like the forge presses. It catches on the slab at the lava's bank nearest
 * the champion (two slabs late on) and creeps after them slab by slab (logic/spreadingFire.ts); a slab kindles first, the warning,
 * then burns whoever stands on it every GAME.fieldTick, as the lava does: the champion (and a stack of the Cinderlands' burn with
 * it), their minions, and foes x SPREADING_FIRE.foeMult, so a horde led across the trail pays for it.
 */
function updateFire(g: Game, dt: number): void {
  const lava = g.arena.lava;
  if (g.wave === 0 || !lava?.length || !fireOn(g.level?.realm, g.arena.id)) return;
  const F = SPREADING_FIRE;
  const p = g.player;
  // floor the fire can hold: open, clear of what stands there, and not the lava itself
  const open = (s: Slab) => openSlab(s, g.openRects, g.arena.obstacles) && !inLava(s.x, s.y, 0, lava);
  if (g.flames.length || g.fireFronts.length) advanceFire(g.flames, g.fireFronts, dt, p.x, p.y, FLAGSTONE, open);
  g.fireT -= dt;
  if (g.fireT <= 0) {
    g.fireT = F.every;
    const at = catchSlabs(bankSlabs(lava, FLAGSTONE).filter(open), p.x, p.y, fireTongues(g.wave, F.twoFrom), F.apart * FLAGSTONE);
    if (at.length) {
      catchFire(g.flames, g.fireFronts, at);
      sfx(g, 'warn');
      // the first of a level says what it is
      if (!g.vars['fire.seen']) (g.vars['fire.seen'] = 1), (g.banner = { text: 'Fire spreads from the lava', t: 2 });
    }
  }
  g.fireTickT -= dt;
  if (g.fireTickT > 0) return;
  g.fireTickT += GAME.fieldTick;
  // a body is in the fire as it is in the lava: by its feet, the centre within half its radius of the slab
  const burns = (b: { x: number; y: number; r: number }) => g.flames.some((f) => flameState(f.t, F.kindle, F.life) === 'burning' && onSlab(f.x, f.y, FLAGSTONE, b.x, b.y, b.r / 2));
  if (!g.flames.some((f) => flameState(f.t, F.kindle, F.life) === 'burning')) return;
  const scale = g.waveDmgMult * g.tier.enemyDmg;
  if (burns(p)) {
    const before = p.hp;
    damagePlayer(g, lavaTick(F.dps, GAME.fieldTick, scale, F.foeMult, false), true, null, 'the spreading fire');
    if (p.hp < before) applyStatusTo(p.statuses, fireBurn(scale)); // a shield, ward, block or dodge keeps the burn off too, as with a blow (#182)
  }
  for (const m of g.minions) if (burns(m)) damageMinion(g, m, lavaTick(F.dps, GAME.fieldTick, scale, F.foeMult, false));
  for (const e of g.enemies) {
    if (!e.dead && burns(e)) damageEnemy(g, e, lavaTick(F.dps, GAME.fieldTick, scale, F.foeMult, true), false, 0, 0, 'hazard', 'fire', true);
  }
}
