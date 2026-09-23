import { describe, expect, it } from 'vitest';
import { PATTERNS } from '../src/config/ai';
import { SKILL } from '../src/config/game';
import type { Game } from '../src/core/types';
import { emit } from '../src/core/events';
import { addZone } from '../src/entities/hazards';
import { createGame, updateGame } from '../src/game';
import { inTelegraph, isPerfectDodge, lineAngle } from '../src/logic/telegraph';
import { damagePlayer, updateZones } from '../src/systems/combat';
import { aimFan } from '../src/systems/patterns';
import { spawnEnemy } from '../src/systems/spawning';

const DT = 1 / 60;
const steps = (g: Game, seconds: number, each?: (t: number) => void) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    each?.(i / 60);
    g.time += DT;
    updateZones(g, DT);
  }
};

/** A quiet field: no waves, the player in the middle, nothing else moving. */
function field(): Game {
  const g = createGame('archer', 5);
  g.pendingBoard = false;
  g.breather = 1e9;
  return g;
}

describe('telegraph geometry (v0.6)', () => {
  const line = { angle: 0, length: 300, width: 40, t: 0, dur: 1 };
  it('a charge line covers what is in front, not beside or behind', () => {
    expect(inTelegraph(line, 0, 0, 150, 0, 10)).toBe(true);
    expect(inTelegraph(line, 0, 0, 150, 35, 10)).toBe(false); // 20 half-width + 10 radius
    expect(inTelegraph(line, 0, 0, -30, 0, 10)).toBe(false);
    expect(inTelegraph(line, 0, 0, 320, 0, 10)).toBe(false);
  });
  it('a volley is one line per shot; a ring splits the circle evenly', () => {
    const fan = { ...line, count: 3, spread: 1 };
    expect([0, 1, 2].map((i) => lineAngle(fan, i))).toEqual([-0.5, 0, 0.5]);
    expect(inTelegraph(fan, 0, 0, Math.cos(0.5) * 200, Math.sin(0.5) * 200, 5)).toBe(true);
    expect(inTelegraph(fan, 0, 0, Math.cos(0.25) * 200, Math.sin(0.25) * 200, 5)).toBe(false); // between the lines is safe
    const ring = { ...line, count: 4, spread: Math.PI * 2 };
    expect([0, 1, 2, 3].map((i) => lineAngle(ring, i))).toEqual([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]);
  });
});

describe('the perfect dodge window (v0.6)', () => {
  it('out in the last 0.25 s counts, earlier does not, still inside never does', () => {
    expect(isPerfectDodge(9.8, 10, false)).toBe(true);
    expect(isPerfectDodge(10 - SKILL.perfect.window, 10, false)).toBe(true);
    expect(isPerfectDodge(9.7, 10, false)).toBe(false);
    expect(isPerfectDodge(9.9, 10, true)).toBe(false);
    expect(isPerfectDodge(-1, 10, false)).toBe(false); // never stood in it
  });

  it('stepping out of a zone at the last moment: buff, cooldown back, no damage', () => {
    const g = field();
    const p = g.player;
    p.abilityCd = p.abilityCdMax = 10;
    addZone(g, { x: p.x, y: p.y, r: 60, delay: 1, damage: 50, hostile: true, color: '#fff' });
    steps(g, 1.05, (t) => {
      if (t >= 0.85) p.x = g.arena.w / 2 + 200; // 0.15 s before it lands
    });
    expect(p.hp).toBe(p.stats.hp);
    expect(g.vars.perfectUntil).toBeGreaterThan(g.time);
    expect(p.abilityCd).toBeCloseTo(10 - 10 * SKILL.perfect.refund, 1);
  });

  it('leaving early, or a zone too quick to read, earns nothing', () => {
    const early = field();
    addZone(early, { x: early.player.x, y: early.player.y, r: 60, delay: 1, damage: 50, hostile: true, color: '#fff' });
    steps(early, 1.05, (t) => {
      if (t >= 0.5) early.player.x += 300 * DT;
    });
    expect(early.vars.perfectUntil).toBeUndefined();
    const quick = field();
    addZone(quick, { x: quick.player.x, y: quick.player.y, r: 60, delay: SKILL.perfect.minDelay - 0.1, damage: 50, hostile: true, color: '#fff' });
    steps(quick, 0.3, (t) => {
      if (t >= 0.25) quick.player.x = quick.arena.w / 2 + 200;
    });
    expect(quick.vars.perfectUntil).toBeUndefined();
  });

  it('rolling through it counts too, untouched', () => {
    const g = field();
    const p = g.player;
    addZone(g, { x: p.x, y: p.y, r: 60, delay: 1, damage: 50, hostile: true, color: '#fff' });
    steps(g, 0.9);
    p.invulnT = 0.35;
    emit(g, 'onUtilityUsed', { id: 'dodgeRoll' });
    steps(g, 0.15);
    expect(p.hp).toBe(p.stats.hp);
    expect(g.vars.perfectUntil).toBeGreaterThan(g.time);
  });

  it('a volley along aim lines: step off the line at the last moment', () => {
    const g = field();
    const p = g.player;
    const xbow = spawnEnemy(g, 'crossbow', p.x - 300, p.y);
    xbow.hp = xbow.maxHp = 1e9; // the archer's own arrows must not end it first
    aimFan(g, xbow, { angle: 0, count: 3, spread: 0.6, windup: 0.6, damage: 10, speed: 400, range: 600 });
    expect(xbow.windupT).toBeGreaterThan(0); // it glows while it winds up
    for (let i = 0; i < 40; i++) {
      if (i === 30) p.y += 45; // 0.1 s before the shots: between the middle line and the upper one
      updateGame(g, DT);
    }
    expect(g.vars.perfectUntil).toBeGreaterThan(g.time);
    expect(g.projectiles.filter((pr) => pr.hostile && pr.shape === 'orb')).toHaveLength(3); // the volley (its own bolts are arrows)
  });

  it('the buff: more damage while it lasts, then gone', () => {
    const g = field();
    g.vars.perfectUntil = g.time + 1;
    updateGame(g, DT);
    expect(g.player.mods.damage).toBeCloseTo(g.baseMods.damage * SKILL.perfect.damage);
    g.vars.perfectUntil = 0;
    updateGame(g, DT);
    expect(g.player.mods.damage).toBeCloseTo(g.baseMods.damage);
  });
});

describe('the Last Stand (v0.6)', () => {
  it('once a run: a killing blow leaves you at 1 HP, untouchable, with the ability cooling down faster', () => {
    const g = field();
    const p = g.player;
    damagePlayer(g, 1e6, true);
    expect(g.over).toBe(false);
    expect(p.hp).toBe(1);
    expect(p.invulnT).toBeCloseTo(SKILL.lastStand.time);
    expect(g.lastStand).toBe('used');
    expect(g.log.marks.at(-1)?.[1]).toBe('stand');
    p.abilityCd = 5;
    updateGame(g, DT);
    expect(p.abilityCd).toBeCloseTo(5 - DT * SKILL.lastStand.cooldownRate);
    p.invulnT = 0;
    damagePlayer(g, 1e6, true);
    expect(g.over).toBe(true); // the second time is the last
  });

  it('an Oath can take it away', () => {
    const g = field();
    g.lastStand = 'off';
    damagePlayer(g, 1e6, true);
    expect(g.over).toBe(true);
  });
});

describe('Act III-IV patterns (v0.6)', () => {
  it('a crossbowman adds a marked volley from Act III, never before', () => {
    const early = field();
    early.act = 2;
    const a = spawnEnemy(early, 'crossbow', early.player.x + 250, early.player.y);
    a.hp = a.maxHp = 1e9;
    for (let i = 0; i < 60 * 12; i++) updateGame(early, DT);
    expect(a.telegraph?.count).toBeUndefined();
    const late = field();
    late.act = 3;
    const b = spawnEnemy(late, 'crossbow', late.player.x + 250, late.player.y);
    b.hp = b.maxHp = 1e9;
    let saw = 0;
    for (let i = 0; i < 60 * 12 && !saw; i++) {
      updateGame(late, DT);
      if (b.telegraph?.count === PATTERNS.crossbow!.count) saw = late.time;
    }
    expect(saw).toBeGreaterThan(0);
  });

  it('every pattern has a wind-up long enough to read', () => {
    for (const p of Object.values(PATTERNS)) expect(p!.windup).toBeGreaterThanOrEqual(SKILL.perfect.minDelay);
  });
});
