import { describe, expect, it } from 'vitest';
import { FAMILY_IDS, relicDef, type RelicId } from '../src/config/relics';
import { MARCHES_FAMILIES, REALMS } from '../src/config/world';
import { createGame } from '../src/game';
import { grantRelic, newChampion, rarePickOptions } from '../src/logic/champions';
import { clearRewards, recordClear } from '../src/logic/world';
import { addRelic, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

// v0.10 (#200): the Marches' seven levels, their rare pick, and the new Flame rare (Ember Mantle)
describe('the Marches: seven levels', () => {
  const m = REALMS.marches;

  it('seven levels in the Castle Courtyard, one featured family each, a pool boss on 1-6 and the Warden as the crown', () => {
    expect(m.arena).toBe('courtyard');
    expect(m.levels.map((l) => l.family)).toEqual(['steel', 'flame', 'blood', 'storm', 'frost', 'holy', 'grave']);
    expect(new Set(MARCHES_FAMILIES).size).toBe(FAMILY_IDS.length);
    expect(m.levels.map((l) => l.boss.boss)).toEqual(['pool', 'pool', 'pool', 'pool', 'pool', 'pool', 'warden']);
    for (const [i, l] of m.levels.entries()) expect(l.reward, `level ${i + 1}`).toEqual({ kind: 'rarePick', family: l.family, of: 2 });
  });

  it('every level offers two different rares of its family to a new champion, none a class relic', () => {
    const c = newChampion('paladin');
    for (const l of m.levels) {
      const opts = rarePickOptions(c, l.family!, 2);
      expect(opts, l.family).toHaveLength(2);
      for (const id of opts) expect([relicDef(id).family, relicDef(id).rarity, relicDef(id).classId]).toEqual([l.family, 'rare', undefined]);
    }
    expect(rarePickOptions(c, 'flame', 2)).toContain('emberMantle');
  });

  it('a rare the champion owns is not offered again; with every one owned the pick is empty (it pays Runes)', () => {
    const c = { ...newChampion('viking'), inventory: ['salamanderScale'] as RelicId[] };
    expect(rarePickOptions(c, 'flame', 2)).toEqual(['emberMantle', 'flashpowder']); // v0.12 (#229): the Cinderlands' rares come next
    expect(rarePickOptions(grantRelic(grantRelic(c, 'emberMantle'), 'flashpowder'), 'flame', 2)).toEqual(['pitchPot']);
    expect(rarePickOptions(['emberMantle', 'flashpowder', 'pitchPot'].reduce((ch, id) => grantRelic(ch, id as RelicId), c), 'flame', 2)).toEqual([]);
  });

  it('the pick joins the inventory once', () => {
    const c = grantRelic(newChampion('archer'), 'emberMantle');
    expect(c.inventory).toEqual(['emberMantle']);
    expect(grantRelic(c, 'emberMantle')).toBe(c);
  });

  it('the rare pick is a first-clear reward: a replay of the level offers none', () => {
    expect(clearRewards({}, 'marches', 2, 0).level).toEqual([{ kind: 'rarePick', family: 'flame', of: 2 }]);
    expect(clearRewards(recordClear({}, 'marches', 2, 0), 'marches', 2, 1).level).toEqual([]);
  });
});

describe('Ember Mantle (Flame rare, #200)', () => {
  const setup = () => {
    const g = createGame('paladin', 1);
    addRelic(g, 'emberMantle');
    const near = spawnEnemy(g, 'knight', g.player.x + 60, g.player.y);
    const far = spawnEnemy(g, 'knight', g.player.x + 400, g.player.y);
    for (const e of g.enemies) g.hash.insert(e);
    return { g, near, far };
  };
  const run = (g: ReturnType<typeof createGame>, s: number) => {
    for (let t = 0; t < s; t += 0.1) {
      g.player.mods = { ...g.baseMods };
      updateRelics(g, 0.1);
    }
  };

  it('every 1.5 s sets the enemies near you burning, not the far ones', () => {
    const { g, near, far } = setup();
    run(g, 1);
    expect(near.statuses.burn).toBeUndefined();
    run(g, 0.6);
    expect(near.statuses.burn?.stacks).toBe(1);
    expect(far.statuses.burn).toBeUndefined();
  });

  it('awakened (Firewalk) leaves a trail of fire', () => {
    const { g } = setup();
    g.player.relics.tiers.emberMantle = 3;
    const fields = () => g.fields.filter((f) => !f.hostile && f.dtype === 'fire').length;
    const before = fields();
    run(g, 1);
    expect(fields()).toBeGreaterThan(before + 1);
  });
});
