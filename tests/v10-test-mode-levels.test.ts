import { describe, expect, it } from 'vitest';
import { talentsFor } from '../src/config/talents';
import { REALM_IDS, REALMS } from '../src/config/world';
import { createGame } from '../src/game';
import { botBuild, championStep, expectedChampionLevel } from '../src/logic/championLevels';
import { levelStep, parseTestLevel, ringStep, testLevels, tierStep } from '../src/logic/world';
import { createTestRun, isTestRun, type TestSetup } from '../src/systems/testMode';

const row0 = talentsFor('viking').filter((n) => n.row === 0).slice(0, 2).map((n) => n.id);
const BASE: TestSetup = { classId: 'viking', arena: 'keep', act: 1, wave: 1, level: 1, talents: [], relics: {} };

describe('test mode starts any realm level (#206)', () => {
  it('lists every level of every realm, built or not, and reads its choice back', () => {
    const all = testLevels();
    expect(all.length).toBe(REALM_IDS.reduce((n, r) => n + REALMS[r].levels.length, 0));
    expect(all[2]).toEqual({ value: 'marches:3', realm: 'marches', level: 3, label: 'The Marches · Level 3 (waves 13–18)' }); // #243
    expect(all.at(-1)!.label).toBe('The Last Bastion · Level 1 (waves 1–40)');
    for (const l of all) expect(parseTestLevel(l.value)).toEqual({ realm: l.realm, level: l.level });
    for (const bad of ['', 'marches', 'marches:0', 'marches:8', 'ironHold:6', 'nowhere:1', 'marches:1.5']) expect(parseTestLevel(bad)).toBeNull();
  });

  it('starts the level as the realm road does: its waves, arena and opening pick, with the bot\u2019s build at the level it expects (#238)', () => {
    const t = createTestRun({ ...BASE, realmLevel: { realm: 'marches', level: 3 } }, 7);
    const real = createGame('viking', 7, { level: { realm: 'marches', level: 3, champion: { ...botBuild('viking', expectedChampionLevel('marches', 3)), talents: [] } } });
    expect(isTestRun(t)).toBe(true);
    expect(t.level).toMatchObject({ realm: 'marches', level: 3, last: 18, cleared: false });
    expect(t.startWave).toBe(13);
    expect(t.wave).toBe(12);
    expect(t.player.level).toBe(3);
    expect(t.player.stats).toEqual(real.player.stats); // no head start: the champion's growth and points
    expect(t.player.upgrades).toEqual(real.player.upgrades);
    expect([t.pendingAbilityTiers, t.pendingLevelUps]).toEqual([[], 0]); // nothing queued
    expect(t.arena.id).toBe('courtyard'); // the realm's arena over the one chosen
    expect(t.player.relics.offers[0]).toMatchObject({ from: 'start' });
    expect(t.breather).toBeLessThan(0.1); // the level's first wave comes next
  });

  it('a realm not built yet plays in the chosen arena, on its ring step; the chosen Act, wave and level are the level’s own', () => {
    const t = createTestRun({ ...BASE, act: 4, wave: 9, level: 50, realmLevel: { realm: 'ironHold', level: 4 } }, 3);
    expect(t.arena.id).toBe('keep');
    expect(t.level?.realm).toBe('ironHold');
    expect(t.startWave).toBe(25);
    expect(t.player.level).toBe(expectedChampionLevel('ironHold', 4));
    expect(t.tier.enemyHp).toBeCloseTo(createGame('viking', 3).tier.enemyHp * ringStep('ironHold').hp * levelStep('ironHold', 4).hp * championStep('ironHold', 4).hp * tierStep(0, 'ironHold', 4).hp, 5); // #250: test mode plays Squire, with its ease
  });

  it('spends the chosen talents along the plan and pays for every one, and holds the chosen relics', () => {
    const keystone = talentsFor('viking').find((n) => n.keystone)!.id;
    const t = createTestRun({ ...BASE, talents: [keystone, ...row0], relics: { frostBrand: 2 }, realmLevel: { realm: 'marches', level: 1 } }, 5);
    expect(t.player.level).toBe(1); // level 1 of the Marches: a level-1 champion
    expect(t.player.talents).toEqual(row0);
    expect(t.talentPoints).toBeGreaterThanOrEqual(1); // the keystone it could not take stays a point
    expect(t.player.relics.tiers.frostBrand).toBe(2);
  });

  it('without a realm level it starts at the chosen Act and wave, as before', () => {
    const t = createTestRun({ ...BASE, act: 2, wave: 4, level: 12, realmLevel: null }, 11);
    expect(t.level).toBeNull();
    expect(t.wave).toBe(13);
    expect(t.player.level).toBe(12);
  });
});
