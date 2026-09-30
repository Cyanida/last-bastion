import { describe, expect, it } from 'vitest';
import { FLAGSTONE, SPREADING_FIRE } from '../src/config/arenas';
import { GAME } from '../src/config/game';
import { createGame } from '../src/game';
import { inLava } from '../src/logic/lava';
import { onSlab, slabAt, type Slab } from '../src/logic/presses';
import { advanceFire, bankSlabs, catchFire, catchSlabs, creep, fireOn, fireTongues, flameState, type FireFront, type Flame } from '../src/logic/spreadingFire';
import { updateArena } from '../src/systems/arena';
import { spawnEnemy } from '../src/systems/spawning';

// #224: the Cinderlands' spreading fire: it catches at the lava's bank and creeps over the floor to where the champion stood, slab by slab
const C = FLAGSTONE;
const F = SPREADING_FIRE;
const DT = 1 / 60;
const anywhere = () => true;

describe('spreading fire (#224)', () => {
  it('spreads only in the Cinderlands, in its own arena', () => {
    expect(fireOn('cinderlands', 'emberForge')).toBe(true);
    expect(fireOn('cinderlands', 'keep')).toBe(false);
    expect(fireOn('ironHold', 'keep')).toBe(false);
    expect(fireOn(undefined, 'emberForge')).toBe(false); // a plain run in the Ember Forge keeps just its lava
  });

  it('catches on the slabs along both banks of a channel, each once', () => {
    const channel = { x: 0, y: 100, w: 240, h: 56 };
    const banks = bankSlabs([channel], C);
    expect(banks).toHaveLength(6); // three slabs long, two banks
    expect(banks.filter((s) => s.y < 100)).toHaveLength(3);
    expect(banks.filter((s) => s.y > 156)).toHaveLength(3);
    for (const s of banks) {
      expect(slabAt(s.x, s.y, C)).toEqual(s); // a whole slab, named by its centre
      expect(Math.min(Math.abs(s.y - 100), Math.abs(s.y - 156))).toBeLessThanOrEqual(C); // at the bank
    }
    // a channel that runs down the map has its banks left and right
    const down = bankSlabs([{ x: 100, y: 0, w: 56, h: 240 }], C);
    expect(down.filter((s) => s.x < 100)).toHaveLength(3);
    expect(down.filter((s) => s.x > 156)).toHaveLength(3);
  });

  it('catches nearest the champion; two tongues late on, well apart', () => {
    const banks = bankSlabs([{ x: 0, y: 100, w: 800, h: 56 }], C);
    const [one, ...none] = catchSlabs(banks, 200, 400, 1, F.apart * C);
    expect(none).toHaveLength(0);
    expect(one.x).toBe(200);
    expect(one.y).toBeGreaterThan(156); // the champion's side of the channel
    const two = catchSlabs(banks, 200, 400, 2, F.apart * C);
    expect(two[0]).toEqual(one);
    expect(Math.hypot(two[1].x - one.x, two[1].y - one.y)).toBeGreaterThanOrEqual(F.apart * C);
    expect(fireTongues(F.twoFrom - 1, F.twoFrom)).toBe(1);
    expect(fireTongues(F.twoFrom, F.twoFrom)).toBe(2);
  });

  it('creeps to the slab beside it nearest its spot, never a diagonal, and round what it cannot hold', () => {
    expect(creep(200, 200, 600, 210, C, anywhere)).toEqual({ x: 280, y: 200 });
    expect(creep(200, 200, 210, 900, C, anywhere)).toEqual({ x: 200, y: 280 });
    expect(creep(200, 200, 600, 600, C, (s) => s.x <= 200)).toEqual({ x: 200, y: 280 }); // the way east is shut: it goes round
    expect(creep(200, 200, 600, 600, C, () => false)).toBeNull();
  });

  it('kindles first, then burns, then is out', () => {
    expect(flameState(0, F.kindle, F.life)).toBe('kindling');
    expect(flameState(F.kindle - 0.01, F.kindle, F.life)).toBe('kindling');
    expect(flameState(F.kindle, F.kindle, F.life)).toBe('burning');
    expect(flameState(F.kindle + F.life - 0.01, F.kindle, F.life)).toBe('burning');
    expect(flameState(F.kindle + F.life, F.kindle, F.life)).toBe('out');
  });

  it('a tongue lights a slab each step towards its spot, in one unbroken trail, its reach and no further, and burns out', () => {
    const flames: Flame[] = [];
    const fronts: FireFront[] = [];
    catchFire(flames, fronts, [{ x: 200, y: 200 }], 2000, 200);
    expect(flames).toEqual([{ x: 200, y: 200, t: 0 }]);
    const lit: Slab[] = [{ x: 200, y: 200 }];
    let most = 0;
    for (let t = 0; t < F.reach * F.step + F.kindle + F.life + 1; t += DT) {
      advanceFire(flames, fronts, DT, C, anywhere);
      for (const f of flames) if (!lit.some((s) => s.x === f.x && s.y === f.y)) lit.push({ x: f.x, y: f.y });
      most = Math.max(most, flames.length);
    }
    expect(lit).toHaveLength(F.reach);
    expect(lit.map((s) => s.x)).toEqual(Array.from({ length: F.reach }, (_, i) => 200 + i * C)); // straight at the spot, slab by slab
    expect(lit.every((s) => s.y === 200)).toBe(true);
    expect(most).toBeLessThanOrEqual(F.reach);
    expect(flames).toHaveLength(0);
    expect(fronts).toHaveLength(0);
  });

  it('heads for where the champion stood, not after them, and spreads round that spot once it is there', () => {
    const flames: Flame[] = [];
    const fronts: FireFront[] = [];
    catchFire(flames, fronts, [{ x: 200, y: 200 }], 290, 210, { reach: 5, step: F.step }); // the spot: the next slab east
    const lit: Slab[] = [];
    for (let t = 0; t < 5 * F.step; t += DT) {
      advanceFire(flames, fronts, DT, C, anywhere, { step: F.step, kindle: 99, life: 99 });
      for (const f of flames) if (!lit.some((s) => s.x === f.x && s.y === f.y)) lit.push({ x: f.x, y: f.y });
    }
    expect(lit).toHaveLength(5);
    expect(lit[1]).toEqual({ x: 280, y: 200 }); // the spot's slab
    for (const s of lit) expect(Math.hypot(s.x - 280, s.y - 200)).toBeLessThanOrEqual(2 * C); // it pools there: nothing runs off
    for (const [i, s] of lit.entries()) if (i) expect(lit.slice(0, i).some((o) => Math.abs(o.x - s.x) + Math.abs(o.y - s.y) === C)).toBe(true); // each slab beside one alight
  });

  it('never lights a slab that is alight, and dies where it is boxed in', () => {
    const flames: Flame[] = [];
    const fronts: FireFront[] = [];
    catchFire(flames, fronts, [{ x: 200, y: 200 }, { x: 200, y: 200 }], 1000, 200);
    expect(flames).toHaveLength(1); // the same slab twice catches once
    // only two slabs of floor: the tongue lights the second and stops
    const open = (s: Slab) => s.y === 200 && (s.x === 200 || s.x === 280);
    for (let t = 0; t < 3 * F.step; t += DT) advanceFire(flames, fronts, DT, C, open);
    expect(flames.map((f) => f.x).sort()).toEqual([200, 280]);
    expect(fronts).toHaveLength(0);
  });

  it('in a Cinderlands level it catches at the bank by the champion with a warning, creeps to where they stand, and burns only once kindled', () => {
    const g = createGame('viking', 5, { level: { realm: 'cinderlands', level: 1 } });
    expect(g.fireT).toBe(F.grace);
    g.wave = Math.max(1, g.wave);
    g.hazardT = g.pressT = g.lavaT = 99;
    const lava = g.arena.lava!;
    const run = lava.slice().sort((a, b) => a.x - b.x || a.y - b.y)[0];
    // two slabs south of the first channel's bank
    const bank = bankSlabs([run], C).filter((s) => s.y > run.y + run.h).sort((a, b) => a.x - b.x)[2];
    const p = g.player;
    Object.assign(p, { x: bank.x, y: bank.y + 2 * C, iFrames: 0, invulnT: 0 });
    g.fireT = 0;
    updateArena(g, DT);
    expect(g.fireT).toBe(F.every);
    expect(g.flames).toHaveLength(1); // level 1: one tongue
    expect({ x: g.flames[0].x, y: g.flames[0].y }).toEqual(bank);
    expect(inLava(bank.x, bank.y, 0, lava)).toBe(false);
    expect(g.banner?.text).toMatch(/Fire/);
    // it creeps to the champion's slab: the slab under them kindles, and does no harm yet
    const hp = p.hp;
    const under = () => g.flames.find((f) => onSlab(f.x, f.y, C, p.x, p.y, p.r / 2));
    for (let i = 0; i < 600 && !under(); i++) updateArena(g, DT);
    expect(under()).toBeDefined();
    expect(flameState(under()!.t, F.kindle, F.life)).toBe('kindling');
    expect(p.hp).toBe(hp);
    expect(g.flames.every((f) => !inLava(f.x, f.y, 0, lava))).toBe(true);
    // stand still: it burns; a foe on the trail burns harder
    const foe = spawnEnemy(g, 'knight', bank.x, bank.y + C);
    const foeHp = foe.hp;
    for (let i = 0; i < Math.ceil((F.kindle + GAME.fieldTick) / DT) + 1; i++) updateArena(g, DT);
    expect(hp - p.hp).toBeGreaterThan(0);
    expect(p.statuses.burn).toBeUndefined(); // plain fire: it leaves no burn stack
    expect(foeHp - foe.hp).toBeGreaterThan(hp - p.hp);
    // step off the trail: no more
    Object.assign(p, { x: bank.x + 3 * C, y: bank.y + 2 * C });
    g.fireFronts.length = 0; // the tongue creeps no further
    const off = p.hp;
    for (let i = 0; i < 60; i++) updateArena(g, DT);
    expect(p.hp).toBe(off);
    // and it burns out
    for (let i = 0; i < (F.kindle + F.life) / DT + 1; i++) updateArena(g, DT);
    expect(g.flames).toHaveLength(0);
  });

  it('from the third level on two tongues catch', () => {
    const g = createGame('viking', 5, { level: { realm: 'cinderlands', level: 3 } });
    g.wave = Math.max(F.twoFrom, g.wave);
    g.fireT = 0;
    updateArena(g, DT);
    expect(g.flames).toHaveLength(2);
    expect(g.fireFronts).toHaveLength(2);
  });

  it('stays out of a plain run in the Ember Forge', () => {
    const g = createGame('viking', 5, { arena: 'emberForge' });
    expect(g.arena.id).toBe('emberForge');
    g.wave = 1;
    g.fireT = 0;
    g.hazardT = g.pressT = 99;
    updateArena(g, DT);
    expect(g.flames).toHaveLength(0);
  });
});
