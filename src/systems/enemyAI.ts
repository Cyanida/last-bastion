import { AFFIXES } from '../config/elites';
import type { Behavior } from '../config/enemies';
import { MODIFIERS } from '../config/waves';
import { sfx } from '../core/audio';
import { dist2, TAU } from '../core/math';
import type { Enemy, Game, Minion, Player } from '../core/types';
import { addZone, fireProjectile } from '../entities/hazards';
import { hurtTarget } from './combat';
import { burst, floatText, line, ring, shake } from './effects';
import { spawnEnemy } from './spawning';

type Target = Player | Minion;
const HOSTILE = '#c23a2e';
const POISON = '#6f8f4e';
const MAX_SUMMONS = 60; // bosses stop calling reinforcements above this many enemies

/** Enemies go for whatever is closest, so minions genuinely tank for the Necromancer. */
function pickTarget(g: Game, e: Enemy): Target {
  let best: Target = g.player;
  let bestD = dist2(e.x, e.y, best.x, best.y);
  for (const m of g.minions) {
    const d = dist2(e.x, e.y, m.x, m.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

const distTo = (e: Enemy, t: { x: number; y: number }) => Math.hypot(t.x - e.x, t.y - e.y);
const angleTo = (e: Enemy, t: { x: number; y: number }) => Math.atan2(t.y - e.y, t.x - e.x);
const enraged = (e: Enemy) => e.affixes.includes('enraged') && e.hp < e.maxHp * AFFIXES.enraged.n.threshold;
const hitDamage = (e: Enemy) => e.damage * (enraged(e) ? AFFIXES.enraged.n.damage : 1);

function move(e: Enemy, angle: number, speed: number, dt: number): void {
  e.x += Math.cos(angle) * speed * dt;
  e.y += Math.sin(angle) * speed * dt;
}

/** Walk at the target until touching it. e.angle doubles as the facing (shield bearers block along it). */
function seek(e: Enemy, t: Target, speed: number, dt: number): void {
  e.flip = t.x < e.x;
  e.angle = angleTo(e, t);
  if (distTo(e, t) > e.r + t.r - 2) move(e, e.angle, speed, dt);
}

function touch(g: Game, e: Enemy, t: Target, mult = 1): void {
  if (e.attackTimer <= 0 && distTo(e, t) < e.r + t.r + 4) {
    e.attackTimer = e.def.attackCd;
    hurtTarget(g, t, hitDamage(e) * mult, false, e);
  }
}

function shootAt(g: Game, e: Enemy, angle: number): void {
  fireProjectile(g, e.x, e.y, angle, {
    damage: hitDamage(e),
    crit: false,
    hostile: true,
    pierce: 0,
    shape: e.def.boss ? 'orb' : 'arrow',
    color: e.def.id === 'abbot' ? POISON : e.def.boss ? '#7a4fa0' : '#c23a2e',
    r: e.def.boss ? 8 : 5,
    speed: e.def.projSpeed!,
    range: 700,
  });
}

/** Hold a preferred distance: approach when far, back off when crowded. */
function keepRange(e: Enemy, t: Target, dt: number): number {
  const d = distTo(e, t);
  const a = angleTo(e, t);
  e.flip = t.x < e.x;
  if (d > e.def.range!) move(e, a, e.speed, dt);
  else if (d < e.def.range! * 0.55) move(e, a + Math.PI, e.speed * 0.8, dt);
  return d;
}

function summon(g: Game, e: Enemy): void {
  if (g.enemies.length > MAX_SUMMONS) return;
  for (let i = 0; i < e.def.summonCount!; i++) {
    const a = (i / e.def.summonCount!) * TAU;
    spawnEnemy(g, e.def.summon!, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
  }
}

const specialDamage = (e: Enemy) => e.damage * e.def.specialMult!;

/**
 * Behavior hooks. Each enemy def names one; e.state / e.timer / e.special are its scratch space.
 * Adding an enemy type = a row in config/enemies.ts, plus a hook here only if it behaves in a new way.
 * Bosses switch to e.phase 2 below half HP (see updateEnemies) and branch on it.
 */
const BEHAVIORS: Record<Behavior, (g: Game, e: Enemy, dt: number) => void> = {
  chaser(g, e, dt) {
    const t = pickTarget(g, e);
    seek(e, t, e.speed, dt);
    touch(g, e, t);
  },

  // approach -> crouch -> leap in a straight line -> recover. Wolves do it quickly, cavalry does it long and telegraphed.
  lunger(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    e.timer -= dt;
    if (e.state === 0) {
      seek(e, t, e.speed, dt);
      if (distTo(e, t) < def.lungeRange!) {
        e.state = 1;
        e.timer = def.windup!;
        e.angle = angleTo(e, t);
        if (def.telegraphLunge) e.telegraph = { angle: e.angle, length: def.lungeSpeed! * def.lungeTime!, width: e.r * 2, t: 0, dur: def.windup! };
      }
    } else if (e.state === 1) {
      if (e.telegraph) e.telegraph.t += dt;
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = def.lungeTime!;
        e.telegraph = null;
      }
    } else if (e.state === 2) {
      move(e, e.angle, def.lungeSpeed!, dt);
      if (e.timer <= 0) {
        e.state = 3;
        e.timer = def.recover!;
      }
    } else if (e.timer <= 0) e.state = 0;
    touch(g, e, t, e.state === 2 ? 1.5 : 1);
  },

  ranged(g, e, dt) {
    const t = pickTarget(g, e);
    const d = keepRange(e, t, dt);
    e.timer -= dt;
    if (e.timer <= 0 && d < e.def.range! * 1.2) {
      e.timer = e.def.fireCd!;
      shootAt(g, e, angleTo(e, t));
    }
  },

  // runs in, plants itself, blows up after a telegraphed fuse. Killing it first cancels the blast.
  exploder(g, e, dt) {
    const t = pickTarget(g, e);
    if (e.state === 0) {
      seek(e, t, e.speed, dt);
      if (distTo(e, t) < e.def.blastRadius! * 0.6) {
        e.state = 1;
        e.timer = e.def.fuse!;
        addZone(g, { x: e.x, y: e.y, r: e.def.blastRadius!, delay: e.def.fuse!, damage: hitDamage(e), hostile: true, color: '#e07b28', owner: e, killsOwner: true });
        sfx('warn');
      }
    } else e.timer -= dt; // only drives the blink; the zone kills its owner when it detonates
  },

  // hangs back behind the line and tops up the most wounded ally in reach
  healer(g, e, dt) {
    keepRange(e, g.player, dt);
    e.timer -= dt;
    if (e.timer > 0) return;
    e.timer = e.def.healCd!;
    let worst: Enemy | null = null;
    for (const o of g.hash.query(e.x, e.y, e.def.healRange!, [])) {
      if (o !== e && !o.dead && o.hp < o.maxHp && (!worst || o.hp / o.maxHp < worst.hp / worst.maxHp)) worst = o;
    }
    if (!worst) return;
    const amount = Math.min(worst.maxHp - worst.hp, e.def.healAmount! * g.waveHpMult);
    worst.hp += amount;
    line(g, e.x, e.y - 10, worst.x, worst.y, '#6fdc6f');
    floatText(g, worst.x, worst.y - worst.r - 8, `+${Math.round(amount)}`, '#6fdc6f', 12);
  },

  // Black Knight: telegraphed line charge. Phase 2: chains several charges back to back.
  bossKnight(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    e.timer -= dt;
    const windUp = (scale: number) => {
      e.state = 1;
      e.timer = def.windup! * scale;
      e.angle = angleTo(e, t);
      e.telegraph = { angle: e.angle, length: def.chargeDist!, width: e.r * 2.4, t: 0, dur: e.timer };
      sfx('warn');
    };
    if (e.state === 0) {
      seek(e, t, e.speed, dt);
      touch(g, e, t);
      e.special -= dt;
      if (e.special <= 0 && distTo(e, t) < def.chargeDist!) windUp(1);
    } else if (e.state === 1) {
      e.telegraph!.t += dt;
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = def.chargeDist! / def.chargeSpeed!;
        e.telegraph = null;
        e.charged = false;
      }
    } else if (e.state === 2) {
      move(e, e.angle, def.chargeSpeed!, dt);
      for (const v of [g.player, ...g.minions]) {
        if (distTo(e, v) > e.r + v.r + 6 || (v === g.player && e.charged)) continue;
        if (v === g.player) e.charged = true;
        hurtTarget(g, v, specialDamage(e), true, e);
      }
      if (e.timer <= 0) {
        if (e.phase === 2 && e.combo < def.p2Combo!) {
          e.combo++;
          windUp(0.55);
        } else {
          e.combo = 0;
          e.state = 3;
          e.timer = 0.7;
        }
      }
    } else if (e.timer <= 0) {
      e.state = 0;
      e.special = def.specialCd!;
    }
  },

  // Warlord: telegraphed ground slam around himself, then calls the pack. Phase 2: hurls boulders after every slam.
  bossWarlord(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    if (e.state === 0) {
      seek(e, t, e.speed, dt);
      touch(g, e, t);
      e.special -= dt;
      if (e.special <= 0 && distTo(e, t) < def.slamRadius! * 1.3) {
        e.state = 1;
        e.timer = def.windup!;
        addZone(g, { x: e.x, y: e.y, r: def.slamRadius!, delay: def.windup!, damage: specialDamage(e), hostile: true, color: HOSTILE, owner: e });
        sfx('warn');
      }
    } else {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 0;
        e.special = def.specialCd!;
        summon(g, e);
        if (e.phase === 2) {
          for (let i = 0; i < def.p2Boulders!; i++) {
            const a = g.rng() * TAU;
            const off = i === 0 ? 0 : 40 + g.rng() * 110;
            addZone(g, { x: g.player.x + Math.cos(a) * off, y: g.player.y + Math.sin(a) * off, r: 70, delay: 0.9 + i * 0.35, damage: specialDamage(e) * 0.7, hostile: true, color: '#8a6a42', owner: e });
          }
        }
      }
    }
  },

  // Lich: keeps its distance, fans of bolts, telegraphed hexes under the player's feet. Phase 2: bolt rings and more hexes.
  bossLich(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    const d = keepRange(e, t, dt);
    e.timer -= dt;
    if (e.timer <= 0 && d < def.range! * 1.5) {
      e.timer = def.fireCd!;
      for (const spread of [-0.3, 0, 0.3]) shootAt(g, e, angleTo(e, t) + spread);
      if (e.phase === 2 && e.combo++ % 2 === 0) for (let i = 0; i < def.p2RingBolts!; i++) shootAt(g, e, (i / def.p2RingBolts!) * TAU);
    }
    e.special -= dt;
    if (e.special <= 0) {
      e.special = def.specialCd!;
      sfx('warn');
      const p = g.player;
      const count = def.zoneCount! + (e.phase === 2 ? def.p2ExtraZones! : 0);
      for (let i = 0; i < count; i++) {
        const off = i === 0 ? 0 : 60 + g.rng() * 140; // first hex is dead on, the rest cut off escape routes
        const a = g.rng() * TAU;
        addZone(g, { x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off, r: def.zoneRadius!, delay: def.windup! + i * 0.12, damage: specialDamage(e), hostile: true, color: '#7a4fa0', owner: e });
      }
    }
  },

  // Grand Inquisitor: walks you down and sends a line of pyres racing at you. Phase 2: a fan of lines, plus cultists.
  bossInquisitor(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    if (e.state === 1) {
      e.timer -= dt; // stands still while casting
      if (e.timer <= 0) e.state = 0;
      return;
    }
    seek(e, t, e.speed, dt);
    touch(g, e, t);
    e.special -= dt;
    if (e.special > 0 || distTo(e, t) > def.lineZones! * def.lineSpacing!) return;
    e.special = def.specialCd!;
    e.state = 1;
    e.timer = 0.6;
    sfx('warn');
    const lines = e.phase === 2 ? def.p2Lines! : 1;
    for (let k = 0; k < lines; k++) {
      const a = angleTo(e, t) + (k - (lines - 1) / 2) * 0.5;
      for (let i = 1; i <= def.lineZones!; i++) {
        addZone(g, { x: e.x + Math.cos(a) * def.lineSpacing! * i, y: e.y + Math.sin(a) * def.lineSpacing! * i, r: def.zoneRadius!, delay: def.windup! + i * 0.09, damage: specialDamage(e), hostile: true, color: '#e07b28', owner: e });
      }
    }
    if (e.phase === 2) summon(g, e);
  },

  // Plague Abbot: lobs flasks that leave poison pools. Phase 2: a ring of flasks closes in around you.
  bossAbbot(g, e, dt) {
    const t = pickTarget(g, e);
    const def = e.def;
    const d = keepRange(e, t, dt);
    e.timer -= dt;
    if (e.timer <= 0 && d < def.range! * 1.5) {
      e.timer = def.fireCd!;
      shootAt(g, e, angleTo(e, t));
    }
    e.special -= dt;
    if (e.special > 0) return;
    e.special = def.specialCd!;
    sfx('warn');
    const p = g.player;
    const pool = { life: def.poolLife!, dps: def.poolDps! * g.waveDmgMult * g.tier.enemyDmg, color: POISON };
    const flask = (x: number, y: number, delay: number) =>
      addZone(g, { x, y, r: def.zoneRadius!, delay, damage: specialDamage(e), hostile: true, color: POISON, owner: e, leaveField: pool });
    for (let i = 0; i < def.flasks!; i++) {
      const a = g.rng() * TAU;
      const off = i === 0 ? 0 : 70 + g.rng() * 120;
      flask(p.x + Math.cos(a) * off, p.y + Math.sin(a) * off, def.windup! + i * 0.2);
    }
    if (e.phase === 2) {
      const gap = Math.floor(g.rng() * def.p2RingFlasks!); // one way out
      for (let i = 0; i < def.p2RingFlasks!; i++) {
        if (i !== gap) flask(p.x + Math.cos((i / def.p2RingFlasks!) * TAU) * 190, p.y + Math.sin((i / def.p2RingFlasks!) * TAU) * 190, def.windup! + 0.4);
      }
    }
  },
};

function enterPhaseTwo(g: Game, e: Enemy): void {
  e.phase = 2;
  e.special = Math.min(e.special, 1.2);
  g.banner = { text: `${e.def.name} is enraged`, t: 2.2 };
  ring(g, e.x, e.y, 200, HOSTILE, 0.7);
  burst(g, e.x, e.y, HOSTILE, 40, 300);
  shake(g, 14);
  sfx('warn');
  if (e.def.id === 'abbot') summon(g, e);
}

export function updateEnemies(g: Game, dt: number): void {
  const p = g.player;
  const moon = g.modifier === 'bloodMoon' ? MODIFIERS.bloodMoon.n.speed : 1;
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.attackTimer -= dt;
    e.flash -= dt;
    e.slowT -= dt;
    e.fearT -= dt;
    e.markT -= dt;
    if (e.def.boss && e.phase === 1 && e.hp <= e.maxHp / 2) enterPhaseTwo(g, e);

    e.speed = e.baseSpeed * moon * (e.slowT > 0 ? e.slowMul : 1) * (enraged(e) ? AFFIXES.enraged.n.speed : 1) * (e.phase === 2 ? (e.def.p2SpeedMult ?? 1) : 1);

    if (e.shieldMax > 0) {
      e.shieldT -= dt;
      if (e.shieldT <= 0 && e.shield < e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + (e.shieldMax / AFFIXES.shielded.n.regenTime) * dt);
    }
    if (e.affixes.includes('frostAura') && dist2(e.x, e.y, p.x, p.y) < AFFIXES.frostAura.n.radius ** 2) p.chillT = AFFIXES.frostAura.n.linger;

    if (e.fearT > 0) {
      e.telegraph = null;
      e.state = 0;
      e.flip = p.x > e.x;
      move(e, angleTo(e, p) + Math.PI, e.speed, dt);
    } else BEHAVIORS[e.def.behavior](g, e, dt);
  }
}
