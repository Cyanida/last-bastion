import { describe, expect, it } from 'vitest';
import { AI } from '../src/config/ai';
import { SQUADS } from '../src/config/director';
import { ENEMIES } from '../src/config/enemies';
import { createGame } from '../src/game';
import { directWave, enemyCost, updatePerformance, waveBudget } from '../src/logic/director';
import { nextState, type AiContext } from '../src/logic/fsm';
import { commanderOffset, formationOffsets, slotPosition } from '../src/logic/squads';
import { botStep } from '../src/sim/bot';
import { killEnemy } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';
import { createSquad } from '../src/systems/squads';

const ctx = (over: Partial<AiContext> = {}): AiContext => ({
  dist: 300, reach: 26, hpFrac: 1, timeInState: 1, timeAlive: 5, feared: false, fleeOnCooldown: false, squadMarching: false,
  specialReady: false, specialDone: false, retreating: false, crowded: false, flankRoll: 0.5, ...over,
});

describe('enemy state machine', () => {
  const peasant = AI.peasant!;
  const crossbow = AI.crossbow!;
  const wolf = AI.wolf!;

  it('melee: approaches, attacks in reach, flanks when the front is crowded', () => {
    expect(nextState(peasant, 'idle', ctx({ timeAlive: 0.1 }))).toBe('idle');
    expect(nextState(peasant, 'idle', ctx())).toBe('approach');
    expect(nextState(peasant, 'approach', ctx({ dist: 20 }))).toBe('attack');
    expect(nextState(peasant, 'approach', ctx({ crowded: true, flankRoll: 0.2 }))).toBe('flank');
    expect(nextState(peasant, 'approach', ctx({ crowded: true, flankRoll: 0.9 }))).toBe('approach'); // this one is not the flanking kind
    expect(nextState(AI.knight!, 'approach', ctx({ crowded: true, flankRoll: 0.5 }))).toBe('approach'); // knights walk straight in
    expect(nextState(peasant, 'flank', ctx({ timeInState: 2 }))).toBe('flank'); // commits to the manoeuvre
    expect(nextState(peasant, 'flank', ctx({ timeInState: 9 }))).toBe('approach');
    expect(nextState(peasant, 'flank', ctx({ dist: 20 }))).toBe('attack');
  });

  it('ranged: keeps its distance and repositions', () => {
    expect(nextState(crossbow, 'approach', ctx({ dist: 500 }))).toBe('approach');
    expect(nextState(crossbow, 'approach', ctx({ dist: 250 }))).toBe('attack');
    expect(nextState(crossbow, 'attack', ctx({ dist: 100 }))).toBe('retreat');
    expect(nextState(crossbow, 'retreat', ctx({ dist: 250 }))).toBe('attack');
    expect(crossbow.strafe).toBe(true);
  });

  it('wounded units flee (to a healer), come back when healed, and do not yo-yo', () => {
    expect(peasant.fleeToHealer).toBe(true);
    expect(nextState(peasant, 'attack', ctx({ hpFrac: 0.2, dist: 20 }))).toBe('flee');
    expect(nextState(peasant, 'flee', ctx({ hpFrac: 0.35 }))).toBe('flee');
    expect(nextState(peasant, 'flee', ctx({ hpFrac: 0.8 }))).toBe('approach');
    expect(nextState(peasant, 'flee', ctx({ hpFrac: 0.2, timeInState: 99 }))).toBe('approach'); // gives up running
    expect(nextState(peasant, 'approach', ctx({ hpFrac: 0.2, fleeOnCooldown: true }))).toBe('approach');
    expect(nextState(AI.knight!, 'attack', ctx({ hpFrac: 0.05, dist: 20 }))).toBe('attack'); // knights never run
    expect(nextState(AI.knight!, 'attack', ctx({ feared: true }))).toBe('flee'); // ...unless made to
  });

  it('specials play out, then hit-and-run units retreat; squads march in formation first', () => {
    expect(nextState(wolf, 'flank', ctx({ dist: 100, specialReady: true }))).toBe('special');
    expect(nextState(wolf, 'approach', ctx({ dist: 10, specialReady: true }))).toBe('attack'); // too close to leap
    expect(nextState(wolf, 'special', ctx({ dist: 10 }))).toBe('special'); // ordinary transitions cannot interrupt it
    expect(nextState(wolf, 'special', ctx({ specialDone: true, retreating: true }))).toBe('retreat');
    expect(nextState(peasant, 'approach', ctx({ squadMarching: true, dist: 20 }))).toBe('regroup');
    expect(nextState(peasant, 'regroup', ctx({ squadMarching: true, hpFrac: 0.1 }))).toBe('flee');
  });
});

describe('squad formation math', () => {
  it('line: centred, evenly spaced, perpendicular to the facing', () => {
    const o = formationOffsets('line', 5, 30);
    expect(o.map((v) => v.y)).toEqual([-60, -30, 0, 30, 60]);
    expect(o.every((v) => v.x === 0)).toBe(true);
  });

  it('wedge: a tip with symmetric pairs falling back', () => {
    const o = formationOffsets('wedge', 5, 30);
    expect(Math.abs(o[0].x) + Math.abs(o[0].y)).toBe(0);
    expect(o[1].y).toBe(-o[2].y);
    expect(o[1].x).toBe(o[2].x);
    expect(o[3].x).toBeLessThan(o[1].x); // second row is further back
  });

  it('circle: everyone at the same radius, growing with the squad', () => {
    const o = formationOffsets('circle', 8, 40);
    const radii = o.map((v) => Math.hypot(v.x, v.y));
    for (const r of radii) expect(r).toBeCloseTo(radii[0]);
    const big = formationOffsets('circle', 16, 40)[0];
    expect(Math.hypot(big.x, big.y)).toBeGreaterThan(radii[0]);
    expect(commanderOffset('circle', 8, 40)).toEqual({ x: 0, y: 0 });
    expect(commanderOffset('line', 5, 30).x).toBeLessThan(0); // behind the line
  });

  it('slots rotate with the facing', () => {
    const p = slotPosition({ x: 100, y: 100 }, Math.PI / 2, { x: 10, y: 0 }); // "forward" is now +y
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(110);
  });

  it('a squad marches in formation, is buffed by its commander, and reacts when he dies', () => {
    const g = createGame('paladin', 5);
    const members = [0, 1, 2, 3].map(() => spawnEnemy(g, 'peasant', 300, 300));
    const commander = spawnEnemy(g, 'bannerman', 300, 300);
    const sq = createSquad(g, { template: 'levy', formation: 'line', spacing: 34, holdUntil: 100 }, members, commander, 300, 300);
    g.breather = 999; // no waves, just this squad
    for (let i = 0; i < 120; i++) botStep(g);
    expect(sq.marching).toBe(true);
    expect(members.every((m) => m.ai === 'regroup')).toBe(true);
    const spread = Math.max(...members.map((m) => Math.hypot(m.x - sq.x, m.y - sq.y)));
    expect(spread).toBeLessThan(34 * 2.5); // still a line around the anchor, not a blob chasing the player
    expect(members[0].buffT).toBeGreaterThan(0); // the banner's damage aura
    expect(members[0].buffDmg).toBeCloseTo(ENEMIES.bannerman.aura!.value);

    const gold = g.pickups.filter((k) => k.kind === 'gold').length;
    killEnemy(g, commander);
    expect(sq.marching).toBe(false);
    expect(members.every((m) => m.buffDmg > 1.3 && m.buffT > 5)).toBe(true); // bannerman: the squad enrages
    expect(g.commandersKilled).toBe(1);
    expect(g.pickups.filter((k) => k.kind === 'gold').length).toBeGreaterThan(gold); // bounty
  });
});

describe('spawn director', () => {
  const base = { seed: 1234, wave: 12, classId: 'archer' as const };

  it('the same seed gives the same wave; another seed or wave does not', () => {
    expect(directWave(base)).toEqual(directWave(base));
    expect(directWave({ ...base, seed: 99 }).units).not.toEqual(directWave(base).units);
    expect(directWave({ ...base, wave: 13 }).units).not.toEqual(directWave(base).units);
  });

  it('spends its budget: never far over, and it grows with the wave', () => {
    for (const wave of [1, 4, 9, 14, 22]) {
      const plan = directWave({ ...base, wave });
      const spent = plan.units.reduce((s, u) => s + enemyCost(u.id), 0);
      expect(spent).toBeGreaterThanOrEqual(plan.budget);
      expect(spent).toBeLessThan(plan.budget + 12);
    }
    expect(waveBudget(20)).toBeGreaterThan(waveBudget(10));
    expect(new Set(directWave({ ...base, wave: 1 }).units.map((u) => u.id))).toEqual(new Set(['peasant']));
  });

  it('adapts to the class: an Archer sees more shield bearers than a Paladin', () => {
    const count = (classId: 'archer' | 'paladin') => {
      let n = 0;
      for (let seed = 0; seed < 60; seed++) n += directWave({ seed, wave: 14, classId }).units.filter((u) => u.id === 'shieldBearer').length;
      return n;
    };
    expect(count('archer')).toBeGreaterThan(count('paladin') * 1.4);
  });

  it('rubber band: cruising players get more elites, struggling players a smaller budget', () => {
    expect(waveBudget(12, -1)).toBeLessThan(waveBudget(12, 0));
    expect(waveBudget(12, 1)).toBe(waveBudget(12, 0)); // never bigger, only meaner
    const elites = (performance: number) => {
      let n = 0;
      for (let seed = 0; seed < 40; seed++) n += directWave({ ...base, seed, performance }).units.filter((u) => u.affixes.length).length;
      return n;
    };
    expect(elites(1)).toBeGreaterThan(elites(0));
    expect(updatePerformance(0, 1, 10, 40)).toBeGreaterThan(0); // full HP, fast clear
    expect(updatePerformance(0, 0.1, 80, 40)).toBeLessThan(0);
    expect(Math.abs(updatePerformance(1, 1, 1, 40))).toBeLessThanOrEqual(1);
  });

  it('squads: contiguous in the spawn order, led by their commander, none before their wave', () => {
    expect(directWave({ ...base, wave: 3 }).squads).toHaveLength(0);
    let withSquads = 0;
    for (let seed = 0; seed < 30; seed++) {
      const plan = directWave({ ...base, seed, wave: 15 });
      if (plan.squads.length) withSquads++;
      plan.squads.forEach((sq, i) => {
        const idx = plan.units.map((u, k) => (u.squad === i ? k : -1)).filter((k) => k >= 0);
        expect(idx[idx.length - 1] - idx[0]).toBe(idx.length - 1); // contiguous
        const template = SQUADS.find((t) => t.id === sq.template)!;
        expect(template.from).toBeLessThanOrEqual(15);
        expect(plan.units.filter((u) => u.squad === i && u.commander)).toHaveLength(template.commander ? 1 : 0);
      });
    }
    expect(withSquads).toBeGreaterThan(15);
    const officers = directWave({ ...base, wave: 15, seed: 3, eliteCommanders: true, squadMult: 2 }).units.filter((u) => u.commander);
    expect(officers.every((u) => u.affixes.length > 0)).toBe(true);
  });

  it('boss waves: the boss comes first, from the arena rotation', () => {
    const plan = directWave({ ...base, wave: 10, bosses: ['abbot', 'lich'] });
    expect(plan.boss).toBe('lich');
    expect(plan.units[0].id).toBe('lich');
  });
});
