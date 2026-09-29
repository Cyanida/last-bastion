import { describe, expect, it } from 'vitest';
import { REALMS } from '../src/config/world';
import { featuredFoes, levelPanel, nextLevel, recordClear, roadLevels, roadTier, type WorldProgress } from '../src/logic/world';

const SQUIRE = 0, KNIGHT = 1, CHAMPION = 2;
const cleared = (realm: 'marches' | 'ironHold', upTo: number, tier: number, p: WorldProgress = {}): WorldProgress =>
  Array.from({ length: upTo }, (_, i) => i + 1).reduce((q, n) => recordClear(q, realm, n, tier), p);

describe('the realm road (#199)', () => {
  it('a new champion: level 1 open on Squire and Knight, the rest locked, nothing cleared', () => {
    const road = roadLevels({}, 'marches', SQUIRE);
    expect(road).toHaveLength(7);
    expect(road.map((l) => l.open)).toEqual([true, false, false, false, false, false, false]);
    expect(road.every((l) => l.cleared.every((c) => !c))).toBe(true);
    expect(nextLevel({}, 'marches', SQUIRE)).toBe(1);
    expect(roadTier({}, 'marches', KNIGHT)).toBe(KNIGHT);
    expect(roadTier({}, 'marches', CHAMPION)).toBe(KNIGHT); // Champion opens with the Knight crown
    expect(roadTier({}, 'ironHold', KNIGHT)).toBe(SQUIRE); // a shut realm has no tier open
  });

  it('a Knight clear lights the lower crowns and opens the next level on both tiers', () => {
    const p = cleared('marches', 2, KNIGHT);
    const road = roadLevels(p, 'marches', SQUIRE);
    expect(road[1].cleared).toEqual([true, true, false, false]);
    expect(road.map((l) => l.open).slice(0, 4)).toEqual([true, true, true, false]);
    expect(nextLevel(p, 'marches', SQUIRE)).toBe(3);
    expect(nextLevel(cleared('marches', 7, SQUIRE), 'marches', SQUIRE)).toBe(7); // all cleared: the last one
  });
});

describe('the level panel (#199)', () => {
  it('Marches level 1: waves, head start, slots, Squire HP, Steel featured, a pool boss, its rare pick', () => {
    const pn = levelPanel({}, 'marches', 1, SQUIRE);
    expect(pn).toMatchObject({ name: 'The Marches · Level 1', waves: [1, 5], headStart: 1, slots: 1, enemyHp: 100, family: 'steel', boss: 'A mid-Act boss', crownBoss: false, open: true });
    expect(pn.rewards).toEqual(['Pick 1 of 2 Steel rares']);
    expect(pn.foes.length).toBeGreaterThan(0);
    expect(pn.tiers.map((t) => t.open)).toEqual([true, true, false, false]);
  });

  it('the Keep and mastery add head-start levels and slots; Knight shows its HP', () => {
    const pn = levelPanel({}, 'marches', 1, KNIGHT, { slots: 1, levels: 2 });
    expect([pn.headStart, pn.slots, pn.enemyHp]).toEqual([3, 2, 145]);
  });

  it('level 7 is the Warden as crown boss and pays the signature relic with the first crown', () => {
    const pn = levelPanel(cleared('marches', 6, SQUIRE), 'marches', 7, SQUIRE);
    expect([pn.boss, pn.crownBoss, pn.open, pn.headStart]).toEqual(['The Warden', true, true, 24]);
    expect(pn.rewards).toEqual(['Pick 1 of 2 Grave rares', 'Your signature relic']);
  });

  it('a replay pays no first-clear reward again; a relic realm names its own family and ring step', () => {
    expect(levelPanel(cleared('marches', 1, SQUIRE), 'marches', 1, SQUIRE).rewards).toEqual([]);
    const iron = levelPanel(cleared('marches', 7, SQUIRE), 'ironHold', 3, SQUIRE);
    expect(iron.rewards).toEqual(['Your class relic of Steel']);
    expect(iron.enemyHp).toBe(107);
    expect(iron.open).toBe(false);
    expect(levelPanel({}, 'ironHold', 5, KNIGHT).rewards).toEqual(['Pick 1 of 2 Steel legendaries']);
  });

  it('featured foes are the squads new in the waves, at most three, and never empty', () => {
    for (const lv of REALMS.marches.levels) {
      const foes = featuredFoes(lv.waves);
      expect(foes.length).toBeGreaterThan(0);
      expect(foes.length).toBeLessThanOrEqual(3);
    }
    expect(featuredFoes([1, 5])).toContain('wolf');
  });
});
