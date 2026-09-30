import { describe, expect, it } from 'vitest';
import { championBonus, championRealmOpen, championSlots, newChampion, readChampion } from '../src/logic/champions';
import { MASTERY } from '../src/config/economy';
import { RELIC_IDS, relicDef, isCursedRelic } from '../src/config/relics';
import { defaultSave, migrate, SAVE_VERSION, saveFormatLabel } from '../src/logic/save';
import { oldSave } from './fixtures/saves';

/** #193: save v7 keeps a champion per class; a v6 save migrates without losing a relic. */
describe('save v7: champions (#193)', () => {
  it('is format 7 (8 since v0.11, #237), and a new save has no champions yet', () => {
    expect(SAVE_VERSION).toBe(8);
    expect(saveFormatLabel(7)).toBe('v0.10');
    expect(defaultSave().champions).toEqual({});
  });

  it('a v6 save: every class played becomes a champion holding every relic the save picked', () => {
    const raw = oldSave('v0.7.4');
    const s = migrate(raw);
    const played = Object.entries(raw.classes as Record<string, { runs: number }>).filter(([, c]) => c.runs > 0).map(([id]) => id);
    expect(Object.keys(s.champions).sort()).toEqual(played.sort());
    const picked = Object.keys(raw.relicPicks as object);
    for (const c of Object.values(s.champions)) expect(c!.inventory).toEqual(expect.arrayContaining(picked));
    expect(s.champions.viking!.talents).toEqual(['viking.berserk.0', 'viking.berserk.1']); // its last logged run's talents (#238: a run takes as many as it has points for)
    expect(s.champions.viking!.name).toBe('Viking');
  });

  it('no relic is lost, a class relic goes to its own class, a cursed one to nobody, and a win opens the Last Bastion', () => {
    const cls = relicDef('fireArrows').classId!;
    const cursed = RELIC_IDS.find(isCursedRelic)!;
    const picks = Object.fromEntries(RELIC_IDS.map((id) => [id, 1]));
    const s = migrate({ ...JSON.parse(JSON.stringify(defaultSave())), version: 6, relicPicks: picks, classes: { [cls]: { runs: 1 }, paladin: { runs: 2 } }, wins: { paladin: 1 } });
    const owned = new Set(Object.values(s.champions).flatMap((c) => c!.inventory));
    const usable = RELIC_IDS.filter((id) => !isCursedRelic(id) && [undefined, cls, 'paladin'].includes(relicDef(id).classId));
    expect(usable.filter((id) => !owned.has(id))).toEqual([]);
    expect(s.champions[cls]!.inventory).toContain('fireArrows');
    expect(s.champions.paladin!.inventory).not.toContain('fireArrows');
    expect(owned.has(cursed)).toBe(false);
    expect(s.relicPicks.fireArrows).toBe(1); // the compendium keeps its count too
    expect(s.champions.paladin!.lastBastion).toBe(true);
    expect(s.champions[cls]!.lastBastion).toBe(false);
    expect(championRealmOpen(s.champions.paladin!, 'lastBastion')).toBe(true);
    expect(championRealmOpen(s.champions[cls]!, 'lastBastion')).toBe(false);
  });

  it('a v7 save reads its champions back as they were, and migrating twice changes nothing', () => {
    const s = migrate(oldSave('v0.10.0'));
    expect(s.champions.viking).toMatchObject({ name: 'Hrolf the Red', signature: true, world: { marches: [7, 3], ironHold: [0, 2] } });
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('a hand-edited champion is cleaned: markup, unknown relics, loadouts outside the inventory, clears past the last level', () => {
    const c = readChampion({
      name: '<img src=x onerror=alert(1)>Ragnar', inventory: ['brimstoneOil', 'brimstoneOil', 'nope', 'fireArrows'], loadouts: { marches: ['brimstoneOil', 'emberheart'], nowhere: ['brimstoneOil'] },
      talentPlan: ['viking.berserk.0', 'paladin.x', 7], world: { marches: [99, -1, 'x'], nowhere: [1] }, signature: 'yes',
    }, 'viking');
    expect(c.name).not.toMatch(/[<>=()]/);
    expect(c.name.length).toBeLessThanOrEqual(24);
    expect(c.inventory).toEqual(['brimstoneOil']); // fireArrows is the Archer's
    expect(c.loadouts).toEqual({ marches: ['brimstoneOil'] });
    expect(c.talents).toEqual(['viking.berserk.0']); // #238: a v7 talent plan becomes its talents
    expect(c.world).toEqual({ marches: [7] });
    expect(c.signature).toBe(false);
    expect(readChampion(null, 'angel')).toEqual(newChampion('angel'));
    expect(newChampion('angel', '   ').name).toBe('Angel');
  });

  it("the Keep repurposed: Armorer's Choice and Keepsake add a slot each, Veteran Levies and Seasoned levels on the head start", () => {
    expect(championBonus({}, 0)).toEqual({ slots: 0, levels: 0 });
    const keepsake = MASTERY[MASTERY.findIndex((r) => r.reward.kind === 'relic')].xp;
    const seasoned = MASTERY[MASTERY.findIndex((r) => r.reward.kind === 'startLevel')].xp;
    expect(championBonus({ startRelic: 1 }, keepsake)).toEqual({ slots: 2, levels: 0 });
    expect(championBonus({ startLevel: 1 }, seasoned).levels).toBe(2);
    expect(championSlots({ startRelic: 1 }, keepsake, 'marches', 1)).toBe(5); // #237: a realm run's 3 slots + 2
    expect(championSlots({ startRelic: 1 }, keepsake, 'ironHold', 5)).toBe(5); // the same at every level of the run
    expect(championSlots({ startRelic: 1 }, keepsake, 'lastBastion', 1)).toBe(6); // 5 + 2, capped at 6
  });
});
