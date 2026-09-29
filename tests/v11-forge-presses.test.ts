import { describe, expect, it } from 'vitest';
import { FLAGSTONE, PRESSES } from '../src/config/arenas';
import { createGame } from '../src/game';
import { onSlab, openSlab, pressesOn, pressShape, pressSlabs, slabAt } from '../src/logic/presses';
import { updateArena } from '../src/systems/arena';
import { updateZones } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

// #211: the Iron Hold's forge presses: they mark the slabs round the player, lower a ram for a moment, and slam
const C = FLAGSTONE;
const DT = 1 / 60;

describe('forge presses (#211)', () => {
  it('work only in the Iron Hold, in its own arena', () => {
    expect(pressesOn('ironHold', 'keep')).toBe(true);
    expect(pressesOn('ironHold', 'courtyard')).toBe(false); // test mode may start the level in another arena
    expect(pressesOn('marches', 'keep')).toBe(false);
    expect(pressesOn(undefined, 'keep')).toBe(false); // a plain run in the Great Keep keeps only its braziers
  });

  it('name a slab by its centre, laid from the map corner like the floor', () => {
    expect(slabAt(10, 10, C)).toEqual({ x: 40, y: 40 });
    expect(slabAt(170, 239, C)).toEqual({ x: 200, y: 200 });
  });

  it("mark a line through the player's own slab, across or down", () => {
    expect(pressSlabs(170, 239, C, 'line', 3, true, 0)).toEqual([{ x: 200, y: 200 }, { x: 280, y: 200 }, { x: 360, y: 200 }]);
    expect(pressSlabs(170, 239, C, 'line', 3, false, 1)).toEqual([{ x: 200, y: 120 }, { x: 200, y: 200 }, { x: 200, y: 280 }]);
    expect(pressSlabs(170, 239, C, 'line', 3, true, 9)).toContainEqual({ x: 200, y: 200 }); // `at` stays on the line
  });

  it('mark a cross of five late on, every other slam', () => {
    const cross = pressSlabs(170, 239, C, 'cross', 3, true, 0);
    expect(cross).toHaveLength(5);
    expect(cross[0]).toEqual({ x: 200, y: 200 });
    expect(cross).not.toContainEqual({ x: 280, y: 280 }); // the diagonal is the way out
    expect(pressShape(PRESSES.crossFrom - 1, 1, PRESSES.crossFrom)).toBe('line');
    expect([0, 1, 2, 3].map((n) => pressShape(PRESSES.crossFrom, n, PRESSES.crossFrom))).toEqual(['line', 'cross', 'line', 'cross']);
  });

  it('keep off walls, shut gates and what stands on a slab', () => {
    const open = [{ x: 0, y: 0, w: 400, h: 400 }];
    expect(openSlab({ x: 200, y: 200 }, open, [])).toBe(true);
    expect(openSlab({ x: 440, y: 200 }, open, [])).toBe(false);
    expect(openSlab({ x: 200, y: 200 }, open, [{ kind: 'pillar', x: 210, y: 190, r: 30 }])).toBe(false);
  });

  it('hit a body on the slab, or overlapping its edge, and miss one a step aside', () => {
    expect(onSlab(200, 200, C, 200, 200, 14)).toBe(true);
    expect(onSlab(200, 200, C, 250, 200, 14)).toBe(true); // over the mortar line
    expect(onSlab(200, 200, C, 255, 200, 14)).toBe(false);
    expect(onSlab(200, 200, C, 250, 250, 14)).toBe(false); // off the corner, diagonally
    expect(onSlab(200, 200, C, 245, 245, 14)).toBe(true);
  });

  it('slam in an Iron Hold level: a telegraph first, then the player standing there is hurt and a foe under it takes more', () => {
    const g = createGame('paladin', 7, { level: { realm: 'ironHold', level: 1 } });
    expect(g.arena.id).toBe('keep');
    g.wave = Math.max(1, g.wave);
    g.pressT = 0;
    updateArena(g, DT);
    const hostile = g.zones.filter((z) => z.slab && z.hostile);
    const friendly = g.zones.filter((z) => z.slab && !z.hostile);
    expect(hostile.length).toBeGreaterThan(0);
    expect(friendly.length).toBe(hostile.length);
    expect(hostile.every((z) => z.delay === PRESSES.delay && z.art === 'press')).toBe(true);
    expect(friendly.every((z) => z.source === 'hazard' && z.damage > hostile[0].damage)).toBe(true);
    expect(g.pressT).toBe(PRESSES.every);
    const mine = hostile.find((z) => onSlab(z.x, z.y, C, g.player.x, g.player.y, g.player.r))!;
    expect(mine).toBeDefined();
    const foe = spawnEnemy(g, 'peasant', mine.x, mine.y);
    g.hash.insert(foe); // updateGame rebuilds the hash each tick; here by hand
    const hp = g.player.hp, foeHp = foe.hp;
    updateZones(g, PRESSES.delay / 2);
    expect(g.player.hp).toBe(hp); // the telegraph: nothing yet
    updateZones(g, PRESSES.delay);
    expect(g.player.hp).toBeLessThan(hp);
    expect(foe.hp < foeHp || foe.dead).toBe(true);
    expect(g.zones.some((z) => z.slab)).toBe(false);
  });

  it('stay out of a plain run in the Great Keep', () => {
    const g = createGame('paladin', 7, { arena: 'keep' });
    g.wave = 1;
    g.pressT = 0;
    g.hazardT = 99;
    updateArena(g, DT);
    expect(g.zones.some((z) => z.slab)).toBe(false);
  });
});
