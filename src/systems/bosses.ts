import { FINAL } from '../config/acts';
import { DRAGON, FORGEMASTER, IRON_KING, WARDEN } from '../config/bosses';
import { sfx } from '../sim/view';
import { TAU } from '../core/math';
import type { Enemy, Game } from '../core/types';
import { addZone, timer } from '../entities/hazards';
import { waypoint } from '../logic/regions';
import { hammerZones, wardenJudges, wardenMove, wardenSpecialCd } from '../logic/crownBoss';
import { forgeCd, forgeMove, pressTiles, slamZones } from '../logic/forgemaster';
import { decreeZones, kingCd, kingMove } from '../logic/ironKing';
import { angleTo, chargeStart, chargeThrough, distTo, hitDamage, keepRange, move, moveTo, seek, specialDamage, summon, touch, type Target } from './aiHelpers';
import { pickTarget, registerBoss } from './enemyAI';
import { burst, floatText, ring, shake } from './effects';
import { regionsOf } from './regions';
import { markPhase } from './runlog';
import { spawnEnemy } from './spawning';
import { aimFan } from './patterns';

/**
 * The Act bosses: three phases (66% / 33% HP), and each of them changes the arena itself.
 * e.state / e.timer / e.special / e.combo are their scratch space, like every boss script.
 */

const FIRE = '#e07b28';
const SEAL = '#a77fd0';

function fireField(g: Game, e: Enemy) {
  const dps = e.def.poolDps! * g.waveDmgMult * g.tier.enemyDmg;
  return { life: e.def.poolLife!, dps, color: FIRE, dtype: 'fire' as const, apply: { id: 'burn' as const, power: dps * DRAGON.burnStacks } }; // standing in fire stacks the burn: step out
}

/** The Dragon burns a whole strip of the map: a telegraphed band of fire, straight through where you stand. */
function burnBand(g: Game, e: Enemy): void {
  const b = g.bounds; // v0.5: only across the open part of the map
  const p = g.player;
  const vertical = g.rng() < 0.5;
  const start = vertical ? b.y : b.x;
  const length = vertical ? b.h : b.w;
  const n = DRAGON.band;
  for (let along = start + n.start; along < start + length; along += n.step) {
    const x = vertical ? p.x : along;
    const y = vertical ? along : p.y;
    addZone(g, { x, y, r: n.radius, delay: n.delay, damage: specialDamage(e) * n.damage, hostile: true, color: FIRE, owner: e, dtype: 'fire', leaveField: fireField(g, e) });
  }
  g.banner = { text: 'The ground burns', t: n.delay };
}

registerBoss('dragon', (g, e, dt) => {
  const t = pickTarget(g, e);
  const def = e.def;
  // airborne: untargetable, gliding to where you are, then a telegraphed landing and a burning strip of map
  if (e.state === 2) {
    e.timer -= dt;
    moveTo(e, g.player.x, g.player.y, e.baseSpeed * DRAGON.flight.speed, dt);
    if (e.timer > 0) return;
    e.state = 0;
    e.hidden = false;
    addZone(g, { x: e.x, y: e.y, r: DRAGON.landing.radius, delay: DRAGON.landing.delay, damage: specialDamage(e), hostile: true, color: FIRE, owner: e, dtype: 'fire' });
    burnBand(g, e);
    shake(g, 12);
    return;
  }

  const d = keepRange(e, t, dt);
  e.timer -= dt;
  if (e.timer <= 0 && d < def.range! * DRAGON.fanReach) {
    e.timer = def.fireCd! / (e.phase === 3 ? DRAGON.phase3Rate : 1);
    // v0.6: five of them, point blank a shotgun: marked lines first
    const f = DRAGON.fan;
    if (!e.telegraph) aimFan(g, e, { angle: angleTo(e, t), count: f.count, spread: f.spread, windup: f.windup, damage: hitDamage(e) * f.damage, speed: def.projSpeed!, range: f.range, dtype: 'fire', color: FIRE });
    if (e.phase === 3) {
      // meteors: nowhere near you is safe for long
      const m = DRAGON.meteors;
      for (let i = 0; i < m.count; i++) {
        const ma = g.rng() * TAU;
        const off = g.rng() * m.scatter;
        addZone(g, { x: g.player.x + Math.cos(ma) * off, y: g.player.y + Math.sin(ma) * off, r: m.radius, delay: m.delay + i * m.stagger, damage: specialDamage(e) * m.damage, hostile: true, color: FIRE, owner: e, dtype: 'fire' });
      }
    }
  }

  e.special -= dt;
  if (e.special > 0) return;
  e.special = def.specialCd!;
  sfx(g, 'warn');
  if (e.phase >= 2 && e.combo++ % DRAGON.flight.every === 0) {
    e.state = 2; // take off
    e.timer = DRAGON.flight.time;
    e.hidden = true;
    ring(g, e.x, e.y, 160, FIRE, 0.6);
    return;
  }
  // a line of fire from his jaws, through you and far beyond, that keeps burning
  const a = angleTo(e, g.player);
  for (let i = 1; i <= def.lineZones!; i++) {
    addZone(g, { x: e.x + Math.cos(a) * def.lineSpacing! * i, y: e.y + Math.sin(a) * def.lineSpacing! * i, r: def.zoneRadius!, delay: def.windup! + i * DRAGON.lineStagger, damage: specialDamage(e), hostile: true, color: FIRE, owner: e, dtype: 'fire', leaveField: fireField(g, e) });
  }
});

/** The Warden seals you in: a ring of stone that blocks everyone, with a few gaps to fight your way out through. */
function seal(g: Game, x: number, y: number, radius: number, gaps: number, life: number): void {
  const { radius: r, gap, gapWidth } = WARDEN.stone;
  const count = Math.floor((TAU * radius) / (r * 2 + gap));
  const start = Math.floor(g.rng() * count);
  for (let i = 0; i < count; i++) {
    const inGap = Array.from({ length: gaps }, (_, k) => (start + Math.floor((k * count) / gaps)) % count).some((s) => (i - s + count) % count < gapWidth);
    if (inGap) continue;
    const a = (i / count) * TAU;
    g.barriers.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius, r, life });
  }
  ring(g, x, y, radius, SEAL, 0.7);
}
const closeSeal = timer('warden.seal', (g, a: { e: Enemy; x: number; y: number }) => !a.e.dead && seal(g, a.x, a.y, WARDEN.close.radius, WARDEN.close.gaps, WARDEN.close.life));

registerBoss('warden', (g, e, dt) => {
  const t = pickTarget(g, e);
  const def = e.def;
  // #202: the crown's Judgement begins: his own third phase, and the next seal comes at once (#219: an elite's fourth)
  if (wardenJudges(e.phase, e.crown) && e.state !== 3) {
    e.state = 3;
    e.special = Math.min(e.special, 0.8);
    g.banner = { text: 'The Warden’s judgement', t: 2.5 };
    markPhase(g, 'The Warden’s judgement');
  }
  seek(e, t, e.speed, dt);
  touch(g, e, t);
  e.special -= dt;
  if (e.special > 0 || distTo(e, g.player) > WARDEN.reach) return;
  e.special = wardenSpecialCd(def.specialCd!, e.phase, e.crown);
  sfx(g, 'warn');
  const { x, y } = g.player;
  const move = wardenMove(e.phase, e.crown, e.combo++);
  g.banner = { text: move.inner ? 'Judged' : 'Sealed in', t: 1.4 };
  seal(g, x, y, WARDEN.seal.radius, move.gaps, WARDEN.seal.life);
  if (move.inner) seal(g, x, y, WARDEN.crown.inner.radius, WARDEN.crown.inner.gaps, WARDEN.crown.inner.life); // a ring inside the ring

  if (move.sweep) {
    // a clock hand of force sweeps the sealed circle: keep moving ahead of it
    const base = g.rng() * TAU;
    const w = WARDEN.sweep;
    for (let k = 0; k < w.hands; k++) {
      const a = base + (k / w.hands) * TAU;
      for (let i = 1; i <= w.zones; i++) {
        addZone(g, { x: x + Math.cos(a) * i * w.step, y: y + Math.sin(a) * i * w.step, r: def.zoneRadius!, delay: def.windup! + k * w.delay, damage: specialDamage(e), hostile: true, color: SEAL, owner: e, dtype: 'shadow' });
      }
    }
  }
  if (move.hammer) {
    // his hammer: rings of force rolling out from him, one after another; step through a ring once it has struck
    for (const z of hammerZones(e.x, e.y, g.rng() * TAU)) addZone(g, { x: z.x, y: z.y, r: WARDEN.crown.hammer.radius, delay: z.delay, damage: specialDamage(e) * WARDEN.crown.hammer.damage, hostile: true, color: SEAL, owner: e, dtype: 'shadow' });
    shake(g, 8);
  }
  if (move.close) closeSeal(g, WARDEN.close.after, { e, x, y }); // the circle closes
  if (move.summon) summon(g, e);
});

// ---------------------------------------------------------------- #215: the Forgemaster, the Iron Hold's level-3 boss (config/bosses.ts FORGEMASTER)

const EMBER = '#f08a1c';
const IRON = '#9a9aa0';

registerBoss('forgemaster', (g, e, dt) => {
  const t = pickTarget(g, e);
  const def = e.def;
  // a new phase (enemyAI's enterPhase moved e.phase on): he reforges his plate whole, so it has to be broken again
  if (e.phase > 1 && e.state < e.phase) {
    e.state = e.phase;
    e.armorHp = e.armorMax;
    g.banner = { text: 'The Forgemaster reforges his plate', t: 2.2 };
    markPhase(g, 'The Forgemaster reforges his plate');
    ring(g, e.x, e.y, 130, EMBER, 0.6);
    sfx(g, 'clang');
  }
  seek(e, t, e.speed, dt);
  touch(g, e, t);
  e.special -= dt;
  if (e.special > 0 || distTo(e, g.player) > FORGEMASTER.reach) return;
  e.special = forgeCd(e.phase);
  sfx(g, 'warn');
  const move = forgeMove(e.phase, e.combo++);
  if (move.slam) {
    // his hammer comes down in an arc in front of him; from phase 3 the struck ground stays molten (the Dragon's fire fields' burn)
    const a = angleTo(e, t);
    e.flip = t.x < e.x;
    for (const z of slamZones(e.x, e.y, e.r, a)) addZone(g, { x: z.x, y: z.y, r: FORGEMASTER.slam.radius, delay: def.windup!, damage: specialDamage(e) * FORGEMASTER.slam.damage, hostile: true, color: EMBER, owner: e, dtype: 'fire', leaveField: move.slag ? fireField(g, e) : null });
    const s = FORGEMASTER.sparks;
    if (move.sparks && !e.telegraph) aimFan(g, e, { angle: a, count: s.count, spread: s.spread, windup: s.windup, damage: hitDamage(e) * s.damage, speed: def.projSpeed!, range: s.range, dtype: 'fire', color: EMBER });
    return;
  }
  // the forge presses: a checkerboard of marked tiles round you, one colour slamming after the other
  const { x, y } = g.player;
  for (const z of pressTiles(x, y, move.strokes)) addZone(g, { x: z.x, y: z.y, r: FORGEMASTER.press.radius, delay: z.delay, damage: specialDamage(e) * FORGEMASTER.press.damage, hostile: true, color: IRON, owner: e });
  g.banner = { text: 'The presses fall', t: 1.4 };
  shake(g, 6);
});

// ---------------------------------------------------------------- #216: the Iron King, the Iron Hold's crown boss (config/bosses.ts IRON_KING)

const KING_PHASE: Record<number, string> = { 2: 'The Iron King raises his shield', 3: 'The Iron King’s thorns' };
const kingPhase = new WeakMap<Enemy, number>(); // the phase whose change of guard has been shown (e.state is his rush)

registerBoss('ironKing', (g, e, dt) => {
  const t = pickTarget(g, e);
  const def = e.def;
  // a new phase (enemyAI's enterPhase moved e.phase on): a change of guard, plate -> shield -> thorns (logic/ironKing kingGuard)
  if (e.phase > (kingPhase.get(e) ?? 1)) {
    kingPhase.set(e, e.phase);
    e.armorHp = 0; // whatever plate is left he casts off: the plate is phase 1's lesson
    g.banner = { text: KING_PHASE[e.phase] ?? def.name, t: 2.4 };
    markPhase(g, KING_PHASE[e.phase] ?? def.name);
    burst(g, e.x, e.y, IRON, 24, 260);
    ring(g, e.x, e.y, 150, IRON, 0.6);
    sfx(g, e.phase === 2 ? 'block' : 'thorns');
  }
  if (e.state === 1) {
    // the rush winds up along its line
    e.timer -= dt;
    e.telegraph!.t += dt;
    if (e.timer > 0) return;
    e.state = 2;
    e.timer = def.chargeDist! / def.chargeSpeed!;
    e.telegraph = null;
    chargeStart(e);
    return;
  }
  if (e.state === 2) {
    // behind the shield, straight down the line: it runs through you once
    e.timer -= dt;
    move(e, e.angle, def.chargeSpeed!, dt);
    chargeThrough(g, e);
    if (e.timer <= 0) e.state = 0;
    return;
  }
  seek(e, t, e.speed, dt);
  touch(g, e, t);
  e.special -= dt;
  if (e.special > 0 || distTo(e, g.player) > IRON_KING.reach) return;
  e.special = kingCd(e.phase);
  sfx(g, 'warn');
  const blow = kingMove(e.phase, e.combo++);
  const a = angleTo(e, g.player);
  if (blow.rush) {
    e.state = 1;
    e.timer = def.windup!;
    e.angle = a;
    e.flip = Math.cos(a) < 0;
    e.telegraph = { angle: a, length: def.chargeDist!, width: e.r * 2.4, t: 0, dur: e.timer };
    return;
  }
  // the Decree: lines of iron marked out from him, one straight at you, landing from the inside out
  for (const z of decreeZones(e.x, e.y, e.r, a, blow.decree)) addZone(g, { x: z.x, y: z.y, r: def.zoneRadius!, delay: z.delay, damage: specialDamage(e) * IRON_KING.decree.damage, hostile: true, color: IRON, owner: e });
  g.banner = { text: 'The King’s decree', t: 1.2 };
  if (blow.guard) summon(g, e); // his guard of Iron Knights
  shake(g, 5);
});

// ---------------------------------------------------------------- v0.6: the Usurper, the end of the run (config/acts.ts FINAL)

const GOLD = '#e9c95a';
const U = FINAL.usurper;

/** Where he stands on the dais: just in front of the throne (the throne itself is an obstacle). */
function dais(g: Game): { x: number; y: number } {
  const t = g.arena.final!.throne;
  return { x: t.x, y: t.y + U.ward.stand };
}

/** A marked arc of blows in front of him. Standing inside his reach (right on top of him) is the safe spot. */
function cleave(g: Game, e: Enemy, t: Target): void {
  const a = angleTo(e, t);
  e.flip = t.x < e.x;
  for (let i = 0; i < U.cleave.zones; i++) {
    const za = a + (i / (U.cleave.zones - 1) - 0.5) * U.cleave.arc;
    const d = e.r + U.cleave.reach;
    addZone(g, { x: e.x + Math.cos(za) * d, y: e.y + Math.sin(za) * d, r: U.cleave.radius, delay: U.cleave.windup, damage: specialDamage(e), hostile: true, color: GOLD, owner: e });
  }
}

function lungeWindup(g: Game, e: Enemy, t: Target, scale: number): void {
  e.state = 2;
  e.timer = U.lunge.windup * scale;
  e.angle = angleTo(e, t);
  e.telegraph = { angle: e.angle, length: U.lunge.dist, width: e.r * 2.4, t: 0, dur: e.timer };
  sfx(g, 'warn');
}

/** Phase 3: two burning bands across the whole open map that cross where you stand. Get off both lines. */
function decree(g: Game, e: Enemy): void {
  const b = g.bounds;
  const p = g.player;
  const damage = specialDamage(e) * 0.8;
  for (let x = b.x + U.decree.spacing / 2; x < b.x + b.w; x += U.decree.spacing) addZone(g, { x, y: p.y, r: U.decree.radius, delay: U.decree.windup, damage, hostile: true, color: FIRE, owner: e, dtype: 'fire' });
  for (let y = b.y + U.decree.spacing / 2; y < b.y + b.h; y += U.decree.spacing) addZone(g, { x: p.x, y, r: U.decree.radius, delay: U.decree.windup, damage, hostile: true, color: FIRE, owner: e, dtype: 'fire' });
  g.banner = { text: 'By royal decree', t: 1.5 };
}

/** Phase 3: rings of broken ground rolling out from him, one after another. Step through a ring once it has struck. */
function quake(g: Game, e: Enemy): void {
  const q = U.quake;
  for (let k = 1; k <= q.rings; k++) {
    const d = k * q.step;
    const n = Math.ceil((TAU * d) / (q.radius * 1.6));
    const off = g.rng() * TAU;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      addZone(g, { x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, r: q.radius, delay: q.first + (k - 1) * q.gap, damage: specialDamage(e) * 0.8, hostile: true, color: GOLD, owner: e });
    }
  }
  shake(g, 8);
}

/** Phase 2 begins: he makes for his throne behind a ward, and the Royal Flames are lit. */
function raiseWard(g: Game, e: Enemy): void {
  e.warded = true;
  e.state = 10;
  e.telegraph = null;
  for (const spot of g.arena.final!.flames) {
    spawnEnemy(g, U.ward.flameId, spot.x, spot.y);
    burst(g, spot.x, spot.y, FIRE, 20, 200);
  }
  e.hp = Math.max(e.hp, e.maxHp * 0.34); // one huge blow must not carry him past the ward into phase 3
  g.vars['usurper.pitch'] = U.ward.pitch.every;
  g.vars['usurper.volley'] = U.ward.volley.every;
  g.vars['usurper.pulse'] = U.ward.pulse.every;
  g.banner = { text: 'The Usurper hides behind his ward: put out the Royal Flames', t: 4 };
  ring(g, e.x, e.y, 220, GOLD, 0.8);
  sfx(g, 'warn');
}

/** While warded on the dais: burning pitch from the walls around you, crossbow fans from the dais, and the flames flare. */
function holdDais(g: Game, e: Enemy, dt: number): void {
  const w = U.ward;
  const p = g.player;
  const tick = (key: string, every: number) => (g.vars[key] -= dt) <= 0 && ((g.vars[key] = every), true);
  if (tick('usurper.pitch', w.pitch.every)) {
    for (let i = 0; i < w.pitch.count; i++) {
      const a = g.rng() * TAU;
      const d = i === 0 ? 0 : 60 + g.rng() * w.pitch.spread;
      addZone(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: w.pitch.radius, delay: w.pitch.delay + i * 0.12, damage: specialDamage(e) * 0.6, hostile: true, color: FIRE, owner: e, dtype: 'fire' });
    }
  }
  if (tick('usurper.volley', w.volley.every) && !e.telegraph) {
    aimFan(g, e, { angle: angleTo(e, p), count: w.volley.bolts, spread: w.volley.spread, windup: w.volley.windup, damage: hitDamage(e) * 0.6, speed: w.volley.speed, range: 1100 });
  }
  if (tick('usurper.pulse', w.pulse.every)) {
    let i = 0;
    for (const f of g.enemies) if (f.def.id === w.flameId && !f.dead) addZone(g, { x: f.x, y: f.y, r: w.pulse.radius, delay: w.pulse.delay + 0.2 * i++, damage: specialDamage(e) * 0.5, hostile: true, color: FIRE, owner: f, dtype: 'fire' });
  }
}

registerBoss(FINAL.boss, (g, e, dt) => {
  const t = pickTarget(g, e);
  // a new phase (enemyAI's enterPhase moved e.phase on): phase 2 raises the ward, phase 3 is the crown's wrath
  g.vars['usurper.since'] ??= g.time;
  if (e.phase !== (g.vars['usurper.phase'] ?? 1)) {
    g.vars['usurper.phase'] = e.phase;
    g.vars['usurper.since'] = g.time;
    if (e.phase === 2) raiseWard(g, e);
    else if (e.phase === 3) {
      e.state = 4;
      e.timer = 0.6;
      e.telegraph = null;
      g.banner = { text: 'The crown’s wrath', t: 2.5 };
    }
  }
  e.timer -= dt;
  // a phase runs its minimum time: until then his HP holds at the next threshold (phase 3: he cannot fall yet)
  const early = g.time - g.vars['usurper.since'] < U.minPhase[e.phase - 1];
  e.hpFloor = !early ? 0 : e.phase === 1 ? e.maxHp * (2 / 3) + 1 : e.phase === 3 ? 1 : 0;
  if (e.hpFloor > 0 && e.hp <= e.hpFloor && e.flash > 0 && (g.vars['usurper.firm'] ?? 0) <= g.time) {
    g.vars['usurper.firm'] = g.time + 1.2;
    floatText(g, e.x, e.y - e.r - 24, 'UNYIELDING', '#e9c95a', 15);
  }
  const flames = e.warded ? g.enemies.filter((f) => f.def.id === U.ward.flameId && !f.dead).length : 0;
  if (e.warded && flames < (g.vars['usurper.flames'] ?? flames)) markPhase(g, `A Royal Flame is out (${flames} left)`);
  g.vars['usurper.flames'] = flames;
  if (e.warded && flames === 0) {
    // the last flame is out (on the dais or still on his way there): the ward breaks and he staggers
    e.warded = false;
    e.state = 12;
    e.timer = U.ward.stagger;
    e.waypoint = null;
    g.banner = { text: 'The ward breaks: strike now', t: 2.5 };
    ring(g, e.x, e.y, 240, GOLD, 0.8);
    shake(g, 12);
    sfx(g, 'levelup');
  }

  if (e.state === 10) {
    // back to the throne, through the right gate if he is out in a wing
    const d = dais(g);
    e.waypoint = waypoint(regionsOf(g), e.x, e.y, d.x, d.y);
    e.flip = d.x < e.x;
    if (moveTo(e, d.x, d.y, e.baseSpeed * U.ward.retreatSpeed, dt) < 12) e.state = 11;
  } else if (e.state === 11) {
    e.flip = g.player.x < e.x;
    holdDais(g, e, dt);
  } else if (e.state === 12) {
    if (e.timer <= 0) (e.state = 0), (e.special = 1);
  } else if (e.state === 0) {
    seek(e, t, e.speed, dt);
    touch(g, e, t);
    e.special -= dt;
    if (e.special > 0) return;
    const pick = e.combo++ % (e.phase === 3 ? 4 : 3);
    if (e.phase === 3 && pick === 0) {
      decree(g, e);
      (e.state = 4), (e.timer = U.decree.windup * 0.6);
    } else if (e.phase === 3 && pick === 2) {
      quake(g, e);
      (e.state = 4), (e.timer = U.quake.first);
    } else if (pick === 1) {
      g.vars['usurper.chain'] = 0;
      lungeWindup(g, e, t, 1);
    } else if (e.phase === 1 && pick === 2) {
      for (let i = 0; i < U.guards.count; i++) spawnEnemy(g, U.guards.id, e.x + (i ? 70 : -70), e.y + 40);
      g.banner = { text: 'To me, my guard!', t: 1.5 };
      (e.state = 4), (e.timer = 0.6);
    } else {
      cleave(g, e, t);
      (e.state = 1), (e.timer = U.cleave.windup);
    }
    sfx(g, 'warn');
  } else if (e.state === 1) {
    if (e.timer <= 0) (e.state = 4), (e.timer = 0.35); // the blow lands (the zones), then a breath
  } else if (e.state === 2) {
    e.telegraph!.t += dt;
    if (e.timer <= 0) {
      e.state = 3;
      e.timer = U.lunge.dist / U.lunge.speed;
      e.telegraph = null;
      chargeStart(e);
    }
  } else if (e.state === 3) {
    move(e, e.angle, U.lunge.speed, dt);
    chargeThrough(g, e);
    if (e.timer <= 0) {
      if (e.phase === 3 && g.vars['usurper.chain']++ < U.lunge.chain - 1) lungeWindup(g, e, t, 0.55); // phase 3: straight into the next one
      else (e.state = 4), (e.timer = U.lunge.recover);
    }
  } else if (e.timer <= 0) {
    e.state = 0;
    e.special = U.specialCd[e.phase - 1];
  }
});
