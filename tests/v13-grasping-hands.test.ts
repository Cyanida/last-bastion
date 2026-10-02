import { describe, expect, it } from 'vitest';
import { GRAVE_HANDS } from '../src/config/arenas';
import { MECHANIC_CARDS } from '../src/config/cards';
import { REALMS } from '../src/config/world';
import { createGame } from '../src/game';
import { handsCard } from '../src/logic/cards';
import { graveCount, graveSpots, handsOn, heldFor, openGrave, walkFactor } from '../src/logic/graspingHands';
import { isStunned } from '../src/logic/status';
import { updateArena } from '../src/systems/arena';
import { updateZones } from '../src/systems/combat';
import { updatePlayerMovement } from '../src/systems/movement';
import { spawnEnemy } from '../src/systems/spawning';

// #274: the Barrowvale's grasping hands: graves marked round the champion, and hands that rise from them and hold him
const H = GRAVE_HANDS;
const DT = 1 / 60;
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

describe('grasping hands (#274)', () => {
  it('hold only in the Barrowvale, in its own arena', () => {
    expect(REALMS.barrowvale.hazard).toBe('hands');
    expect(handsOn('barrowvale', 'graveyard')).toBe(true);
    expect(handsOn('barrowvale', 'keep')).toBe(false);
    expect(handsOn('ironHold', 'keep')).toBe(false);
    expect(handsOn(undefined, 'graveyard')).toBe(false);
  });

  it('open one more grave from the late waves on', () => {
    expect(graveCount(1, H.graves, H.moreFrom)).toBe(H.graves);
    expect(graveCount(H.moreFrom - 1, H.graves, H.moreFrom)).toBe(H.graves);
    expect(graveCount(H.moreFrom, H.graves, H.moreFrom)).toBe(H.graves + 1);
  });

  it('mark one grave under the champion and the rest round him, near to far, never two on one side', () => {
    for (const rng of [seq(0), seq(0.99), seq(0.3, 0.7, 0.1), Math.random]) {
      const spots = graveSpots(500, 400, 4, H.near, H.far, rng);
      expect(spots).toHaveLength(4);
      expect(spots[0]).toEqual({ x: 500, y: 400 });
      const rest = spots.slice(1);
      for (const s of rest) {
        const d = Math.hypot(s.x - 500, s.y - 400);
        expect(d).toBeGreaterThanOrEqual(H.near - 1e-9);
        expect(d).toBeLessThanOrEqual(H.far + 1e-9);
      }
      // each in its own third of the circle: no two closer in angle than nothing at all, and all three different
      const angles = rest.map((s) => Math.atan2(s.y - 400, s.x - 500));
      expect(new Set(angles.map((a) => a.toFixed(6))).size).toBe(3);
    }
  });

  it('keep graves off walls, shut gates and obstacles', () => {
    const open = [{ x: 0, y: 0, w: 400, h: 400 }];
    expect(openGrave({ x: 200, y: 200 }, H.radius, open, [])).toBe(true);
    expect(openGrave({ x: 440, y: 200 }, H.radius, open, [])).toBe(false);
    expect(openGrave({ x: 200, y: 200 }, H.radius, open, [{ kind: 'crypt', x: 230, y: 200, r: 34 }])).toBe(false);
  });

  it('hold only a champion they caught, and never cut a hold short', () => {
    expect(heldFor(0, H.hold, true)).toBe(H.hold);
    expect(heldFor(0, H.hold, false)).toBe(0);
    expect(heldFor(3, H.hold, true)).toBe(3);
    expect(walkFactor(0.1)).toBe(0);
    expect(walkFactor(0)).toBe(1);
    expect(walkFactor(-0.5)).toBe(1);
  });

  it('show their card the first time graves are marked, and never again', () => {
    expect(MECHANIC_CARDS.graspingHands.icon.length).toBeGreaterThan(0);
    expect(handsCard([{ hostile: true, hold: H.hold }], [])).toBe(true);
    expect(handsCard([{ hostile: true, hold: H.hold }], ['graspingHands'])).toBe(false);
    expect(handsCard([{ hostile: true }], [])).toBe(false); // a plain graveyard's hands do not hold
    expect(handsCard([{ hostile: false, hold: H.hold }], [])).toBe(false);
  });

  it('in a Barrowvale level: graves are marked first, then the hands hurt and hold the champion standing in one, and hold and hurt a foe harder', () => {
    const g = createGame('viking', 7, { level: { realm: 'barrowvale', level: 1 } });
    expect(g.arena.id).toBe('graveyard');
    g.wave = Math.max(1, g.wave);
    g.hazardT = 0;
    updateArena(g, DT);
    const hostile = g.zones.filter((z) => z.hostile && z.hold);
    const friendly = g.zones.filter((z) => !z.hostile && z.source === 'hazard');
    expect(hostile.length).toBeGreaterThanOrEqual(1);
    expect(hostile.length).toBeLessThanOrEqual(H.graves);
    expect(friendly.length).toBe(hostile.length);
    expect(hostile.every((z) => z.delay === H.delay && z.art === 'hands' && z.r === H.radius)).toBe(true);
    expect(friendly.every((z) => z.damage === hostile[0].damage * H.foeMult)).toBe(true);
    expect(g.hazardT).toBe(H.every);
    const p = g.player;
    const mine = hostile.find((z) => z.x === p.x && z.y === p.y)!;
    expect(mine).toBeDefined();
    const other = friendly.find((z) => z.x !== mine.x || z.y !== mine.y) ?? friendly[0];
    const foe = spawnEnemy(g, 'knight', other.x, other.y);
    foe.hp = foe.maxHp = 1e6;
    g.hash.insert(foe);
    const hp = p.hp;
    updateZones(g, H.delay / 2);
    expect(p.hp).toBe(hp); // the warning: nothing yet
    expect(p.heldT).toBeLessThanOrEqual(0);
    updateZones(g, H.delay);
    expect(p.hp).toBeLessThan(hp);
    expect(p.heldT).toBe(H.hold);
    expect(foe.hp).toBeLessThan(1e6);
    expect(isStunned(foe.statuses)).toBe(true);
    // held: he cannot walk
    const x = p.x, y = p.y;
    g.input.moveX = 1;
    updatePlayerMovement(g, 0.2);
    expect(Math.hypot(p.x - x, p.y - y)).toBeLessThan(1);
    // let go: he walks again
    p.heldT = 0;
    updatePlayerMovement(g, 0.2);
    expect(p.x).toBeGreaterThan(x + 5);
  });

  it('miss a champion who stepped off his grave', () => {
    const g = createGame('viking', 7, { level: { realm: 'barrowvale', level: 1 } });
    g.wave = Math.max(1, g.wave);
    g.hazardT = 0;
    updateArena(g, DT);
    const p = g.player, hp = p.hp;
    g.zones = g.zones.filter((z) => z.x === p.x && z.y === p.y); // his own grave only
    p.x += H.radius + p.r + 5;
    updateZones(g, H.delay + DT);
    expect(p.hp).toBe(hp);
    expect(p.heldT).toBeLessThanOrEqual(0);
  });

  it('leave a plain run in the Forsaken Graveyard its own hands, which do not hold', () => {
    const g = createGame('viking', 7, { arena: 'graveyard' });
    g.wave = 1;
    g.hazardT = 0;
    updateArena(g, DT);
    expect(g.zones.some((z) => z.art === 'hands')).toBe(true);
    expect(g.zones.some((z) => z.hold)).toBe(false);
  });
});
