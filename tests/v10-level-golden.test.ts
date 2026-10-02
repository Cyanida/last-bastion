import { beforeEach, describe, expect, it } from 'vitest';
import type { ClassId } from '../src/config/classes';
import type { RealmId } from '../src/config/world';
import { simulateLevel, simulateRealm, type LevelRun } from '../src/sim/levels';

/**
 * v0.10 (#207): golden runs for the Marches' first and last level. The bot plays a first try on Knight with expected progress (its
 * inventory from the earlier levels' first clears, the loadout it fills from it; src/sim/levels.ts), and the run must match the stored
 * values: the champion's build (#238: the bot's, at the level enemy scaling expects), the loadout, the opening pick and the level's end
 * all stay put unless a change means them to move. v0.11 (#220): the Iron Hold's level 1 too, and a realm run of its first two levels
 * (simulateRealm: level 2 goes on from level 1's checkpoint with what the run carries and the champion level its clear banked).
 * v0.12 (#232): the Cinderlands' level 1 and a realm run of its first two levels, as the Iron Hold's.
 * Update GOLDEN only in a commit that says why (a balance change, never a refactor), as tests/v8-golden.test.ts.
 */

interface GoldenLevel { cls: ClassId; seed: number; level: number; variant?: number; realm?: RealmId; run?: true } // `run`: a realm run up to `level`
const RUNS: Record<string, GoldenLevel> = {
  'marches 1 paladin:1': { cls: 'paladin', seed: 1, level: 1 },
  'marches 1 archer:2': { cls: 'archer', seed: 2, level: 1 },
  'marches 1 angel:4 variant 1': { cls: 'angel', seed: 4, level: 1, variant: 1 },
  'marches 7 paladin:1': { cls: 'paladin', seed: 1, level: 7 },
  'marches 7 angel:1': { cls: 'angel', seed: 1, level: 7 },
  'marches 7 viking:2 variant 1': { cls: 'viking', seed: 2, level: 7, variant: 1 },
  'iron hold 1 viking:1': { cls: 'viking', seed: 1, level: 1, realm: 'ironHold' },
  'iron hold 1 archer:3 variant 1': { cls: 'archer', seed: 3, level: 1, variant: 1, realm: 'ironHold' },
  'iron hold run 1-2 paladin:5': { cls: 'paladin', seed: 5, level: 2, realm: 'ironHold', run: true },
  'cinderlands 1 viking:1': { cls: 'viking', seed: 1, level: 1, realm: 'cinderlands' },
  'cinderlands 1 archer:3 variant 1': { cls: 'archer', seed: 3, level: 1, variant: 1, realm: 'cinderlands' },
  'cinderlands run 1-2 paladin:5': { cls: 'paladin', seed: 5, level: 2, realm: 'cinderlands', run: true },
};
const SECONDS = 900; // a level (4-10 minutes, #243) fits with room to spare; a stuck run still ends

/** FNV-1a over the summary's JSON, as tests/v8-golden.test.ts. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

const line = (r: LevelRun): string => {
  const s = r.summary;
  return `${r.cleared ? 'cleared' : 'fell'} wave ${s.wavesCleared} kills ${s.kills} level ${s.level} loadout ${r.loadout.join('+') || '-'} relics ${s.relicsFound?.length ?? 0} hash ${fnv(JSON.stringify(s))}`;
};

function golden({ cls, seed, level, variant = 0, realm = 'marches', run }: GoldenLevel): string {
  if (run) return simulateRealm(cls, seed, realm, 1, variant, SECONDS, level).map(line).join(' / ');
  return line(simulateLevel(cls, seed, realm, level, 1, variant, undefined, SECONDS));
}

// re-recorded for #221 (rule 9's tuning: the level step on enemies, epic head-start boons from level 11; gameplay changed on purpose),
// and again on release/0.11.0 with #217's Rivet Hammer in the starter pool (level 1's relic draws changed on purpose);
// re-recorded again for #218 (v0.11): the Archer's and the Angel's Steel class relics join their pools, so their level 1 draws (and those two
// runs) moved, gameplay changed on purpose, and the Angel's once more when Iron Halo's strike moved onto the cast; these seeds still fall on Marches level 7 on Knight, so its runs pin the head start, the loadout and the fight up to the fall;
// re-recorded for #237: a realm run's loadout is 3 slots at every level (level 7 had 4), so the three level 7 runs slot one relic fewer (gameplay changed on purpose)
// re-recorded for #238: no head start and no level-up inside a level; the bot plays its champion's build (level 1 at Marches level 1, 5 at level 7,
// the cap before the crown) against enemies scaled to that level (gameplay changed on purpose)
// re-recorded for #243: longer levels. The Marches' level 1 is waves 1-6 and level 7 waves 36-40 (were 1-5 and 31-40), a level's one boss
// wave is its last, its waves bring more or fewer foes over a longer time (WORLD.levelWaves) and the level step was tuned again
// (gameplay changed on purpose); these seeds still fall on level 7 on Knight
// re-recorded for #220: enemy scaling by champion level reads the pace at a level's end with a steeper curve, the level steps moved and
// the Marches' level 1 brings more foes (gameplay changed on purpose). A level 7 on its own, with a loadout and none of what a realm run
// carries, still falls, now in its first wave. New: the Iron Hold's level 1 and a realm run of its levels 1-2 (a fall is raised to play on);
// re-recorded for #230 (v0.12), on the merged code after #220: the Viking has a Flame class relic now, so the bot's taste for him (the families of his
// class relics, sim/levels tasteOf) takes Flame in and his Marches level 7 loadout leads with Salamander Scale, as the Paladin's and the Angel's do
// (gameplay changed on purpose);
// #232 (v0.12): new, the Cinderlands' level 1 and a realm run of its levels 1-2, recorded on its own level steps and wave lengths
// (config/world.ts levelStep.own, levelWaves.own). No other run moved: the Marches and the Iron Hold keep their numbers
// re-recorded for #249: the Iron Hold fields its shieldwall squads on every difficulty, Knight included, so the realm run's level 2 (waves
// 9-16) meets them, at REALMS.ironHold.fieldsWeight (its waves changed on purpose; this seed now falls in its last wave); the Marches' runs and the Iron Hold's level 1 (before the squad's wave 9) are unchanged
// re-recorded for #259: a level whose road features the Iron Shieldwall brings a squad of them for sure (logic/world featuredSquads), so the
// realm run's level 2 gets one on a wave from 9-11 (its waves changed on purpose; this seed now clears it); every other run is unchanged
// re-recorded for #262 (v0.13): the Cinderlands' level 2 eases on Knight and brings fewer foes (levelStep.own, levelWaves.own), so the
// realm run's level 2 changed on purpose (it still clears, on 490 kills, was 540); every other run is unchanged
// re-recorded for #279 (v0.13): Barrow Boots joins the starter commons and Soul Lantern leaves the open pool, so the three Marches
// level 7 runs (the Grave level) and the realm run's level 2 draw different relics on purpose; every other run is unchanged
const GOLDEN: Record<string, string> = {
  'marches 1 paladin:1': 'cleared wave 6 kills 215 level 1 loadout - relics 2 hash de859cbc',
  'marches 1 archer:2': 'cleared wave 6 kills 222 level 1 loadout - relics 3 hash 67f5b3b3',
  'marches 1 angel:4 variant 1': 'cleared wave 6 kills 230 level 1 loadout - relics 4 hash e3620c13',
  'marches 7 paladin:1': 'fell wave 35 kills 74 level 5 loadout salamanderScale+anvilHeart+berserkerTooth relics 4 hash dd817d12',
  'marches 7 angel:1': 'fell wave 35 kills 83 level 5 loadout salamanderScale+anvilHeart+berserkerTooth relics 4 hash 98747f81',
  'marches 7 viking:2 variant 1': 'fell wave 35 kills 110 level 5 loadout salamanderScale+anvilHeart+berserkerTooth relics 4 hash 944248fc',
  'iron hold 1 viking:1': 'cleared wave 8 kills 350 level 8 loadout jarlsTorc+anvilHeart+salamanderScale relics 6 hash 362abe41',
  'iron hold 1 archer:3 variant 1': 'fell wave 3 kills 120 level 8 loadout eagleFletching+anvilHeart+salamanderScale relics 5 hash ef72703d',
  'iron hold run 1-2 paladin:5': 'cleared wave 8 kills 363 level 8 loadout oathkeepersSeal+anvilHeart+salamanderScale relics 6 hash 165cac3b / cleared wave 16 kills 505 level 9 loadout - relics 3 hash 66558620',
  'cinderlands 1 viking:1': 'cleared wave 8 kills 356 level 8 loadout jarlsTorc+salamanderScale+anvilHeart relics 6 hash cdefd7c1',
  'cinderlands 1 archer:3 variant 1': 'fell wave 5 kills 222 level 8 loadout eagleFletching+salamanderScale+anvilHeart relics 5 hash b459822e',
  'cinderlands run 1-2 paladin:5': 'cleared wave 8 kills 371 level 8 loadout oathkeepersSeal+salamanderScale+anvilHeart relics 7 hash 953f535e / cleared wave 16 kills 492 level 9 loadout - relics 3 hash 4a8fc0f7',
};

describe('v0.10 golden level runs (#207)', () => {
  // each run blocks the worker for a second or more; yield between them (see tests/v8-golden.test.ts)
  beforeEach(() => new Promise((r) => setTimeout(r, 0)));
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000);
});
