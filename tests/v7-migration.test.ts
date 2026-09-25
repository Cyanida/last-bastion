import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/config/achievements';
import { META } from '../src/config/economy';
import { BOSS_RELIC_CHOICES, RELIC_IDS } from '../src/config/relics';
import { createGame, summarizeRun } from '../src/game';
import { newlyEarned } from '../src/logic/achievements';
import { metaLoadout } from '../src/logic/economy';
import { applyRun, defaultSave, migrate, SAVE_VERSION, type RunSummary } from '../src/logic/save';
import { oldSave } from './fixtures/saves';
import { killEnemy } from '../src/systems/combat';
import { momentRerolls } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

/** A save as v0.6.0 wrote it: format 5, the old relic ids in the compendium, three ranks of the old Reliquary Guard. */
const v060 = () => ({
  ...oldSave('v0.6.0'),
  gold: 1000,
  meta: { relicChance: 3, relicSlot: 1, startRelic: 1 },
  relicPicks: { whetstone: 5, echoBell: 3, hawkeyeQuiver: 2, frostBrand: 4, powderKeg: 1, bloodPact: 2 },
  achievements: ['curator', 'collector:2'],
  refund: null,
  newRelics: undefined,
  duos: undefined,
});

describe('the Keep after the relic rework (v0.7 A7)', () => {
  it("Reliquary Guard's third rank comes back at v0.6's price, once, with a notice", () => {
    const s = migrate(v060());
    expect(s.meta.relicChance).toBe(2);
    expect(s.meta.relicSlot).toBe(1);
    expect(s.meta.startRelic).toBe(1); // Armorer's Choice stays
    expect(s.gold).toBe(1000 + Math.round(190 * 1.8 ** 2));
    expect(s.refund).toEqual({ gold: 616, runes: 0, version: 'v0.7' });
    const again = migrate({ ...s, version: SAVE_VERSION });
    expect(again.gold).toBe(s.gold);
    expect(migrate({ ...v060(), meta: { relicChance: 2 } }).refund).toBeNull();
  });

  it('a v0.5 save gets both reworks back in one notice', () => {
    const s = migrate({ ...v060(), version: 4, meta: { relicChance: 3, str: 2 } });
    expect(s.refund?.version).toBe('v0.6,v0.7');
    expect(s.refund!.gold).toBeGreaterThan(616);
  });

  it('Reliquary Guard adds rerolls at relic moments; the Reliquary Vault adds a fourth option at wave bosses', () => {
    expect(META.relicChance.max).toBe(2);
    expect(metaLoadout({ relicChance: 2, relicSlot: 1 })).toMatchObject({ relicRerolls: 2, bossChoices: 1 });
    const g = createGame('paladin', 1, { meta: { relicChance: 2, relicSlot: 1 } });
    expect(momentRerolls(g)).toBe(momentRerolls(createGame('paladin', 1)) + 2);
    killEnemy(g, spawnEnemy(g, 'warden', g.player.x + 300, g.player.y));
    expect(g.player.relics.offers[0].options).toHaveLength(BOSS_RELIC_CHOICES + 1);
  });
});

describe('a v0.6.0 save migrates (v0.7 A7)', () => {
  it('the compendium keeps kept relics, moves renamed ones, drops the removed, and marks the new as new', () => {
    const s = migrate(v060());
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.relicPicks).toEqual({ thunderDrum: 3, galeforceQuiver: 2, frostBrand: 4, bloodPact: 2 });
    expect(s.newRelics).toHaveLength(RELIC_IDS.length - 19);
    expect(s.newRelics).not.toContain('frostBrand');
    expect(s.newRelics).not.toContain('thunderDrum');
    expect(s.newRelics).toContain('dragonsTongue');
    expect(s.achievements).toEqual(['curator', 'collector:2']); // earned stays earned
    expect(migrate({ ...s }).newRelics).toEqual(s.newRelics); // and a second pass changes nothing
    expect(migrate(defaultSave()).newRelics).toEqual([]); // a fresh save has nothing "new"
  });
});

describe('relic achievements (v0.7 A7): a 6-set, duos in one run, awakened relics in one run', () => {
  it('a run folds its sets, duos and awakenings into the counters the achievements read', () => {
    const g = createGame('paladin', 1);
    const run: RunSummary = {
      ...summarizeRun(g),
      relics: ['brimstoneOil', 'emberheart', 'cinderCharm', 'salamanderScale', 'dragonsTongue', 'radiantBrand', 'frostBrand', 'stormPennant'],
      duos: ['thermalShock', 'wildfire'],
      relicTiers: { brimstoneOil: 3, emberheart: 3, cinderCharm: 3, salamanderScale: 3, frostBrand: 2 },
    };
    const save = applyRun(defaultSave(), run, 'd').save;
    expect(save.counters).toMatchObject({ sixSets: 1, maxDuos: 2, maxAwakened: 4 });
    const earned = newlyEarned(save).map((e) => `${e.id}:${e.tier}`);
    expect(earned).toEqual(expect.arrayContaining(['sixSet:1', 'duos:1', 'duos:2', 'awakening:1', 'awakening:2', 'awakening:3']));
    expect(earned).not.toContain('duos:3');
    for (const id of ['sixSet', 'duos', 'awakening']) expect(ACHIEVEMENTS.some((a) => a.id === id)).toBe(true);
  });
});
