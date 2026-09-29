import { beforeEach, describe, expect, it } from 'vitest';
import { ACTS } from '../src/config/acts';
import type { ClassId } from '../src/config/classes';
import type { RunOptions } from '../src/game';
import { simulateRun } from '../src/sim/bot';

/**
 * v0.8 step 0 (ARCHITECTURE.md): golden runs. The bot plays each class on two fixed seeds, plus a run with Keep upgrades, a curse,
 * an Oath and the second bot variant, and the run summary must match the stored values. Every seed is one the bot takes past the first
 * Act boss (#115), so the boss, the Merchant and the route fork are in each run; if a change makes one die short of the boss, pick
 * another seed for it and re-record. The co-op refactor (#25-#31) must keep single-player identical, so a change here means a random
 * draw moved.
 * Update GOLDEN only in a commit that says why (a balance change, never a refactor).
 * Re-recorded for #101 (v0.8): Squire no longer fields Mirror Knights, Hound Masters, spearmen or siege towers, so its waves changed on purpose.
 * Re-recorded for #126 (v0.8): the Bone Colossus is capped and no longer eats the skeletons, so both Necromancer runs changed on purpose.
 * Re-recorded for #125 (v0.8 balance pass): the Necromancer's HP and skeletons and six relics' numbers changed on purpose.
 * Re-recorded for #169 (v0.8.3): a quest-gated boss now still draws once its quest is done, even if the quest itself has since
 * lingered off the tracker; seed 98765's Act I board (monk, elite, camps) is all quest-gated kinds, so its five runs changed on purpose.
 * Re-recorded for #173 (v0.8.3): Anvil Heart and Adamant now count talent armor too, so paladin's seed 98765 run (Bulwark branch,
 * +armor talents) plays out differently on purpose.
 * Re-recorded for #182 (v0.8.3): an enemy's bolt now carries its shooter, so its hit poisons, curses and draws thorns like a blow;
 * every run with ranged enemies changed on purpose, and paladin:1234 (now short of the boss) became paladin:5.
 * Re-recorded for #182: a burning or poisoned field no longer sets its status on you when a shield, ward, block or dodge stops its damage.
 * Re-recorded for #182: a side elite's split copies no longer hold the wave open (paladin:98765 and angel:1234 meet one).
 * Re-recorded for #182: the Aegis of Dawn's dome now lasts exactly as long as the shield (paladin:7 meta evolves it).
 * Re-recorded for #182 (merge of its three parts): with enemy bolts carrying their shooter and delayed actions dropped at a new Act,
 * archer:5 plays out a little differently on purpose; each part alone left it unchanged.
 * Re-recorded for #194 (v0.10): relic offers no longer lean 1.6x toward held families (1.0), so viking:98765, its curse run and
 * paladin:7 meta draw different relics on purpose.
 * Re-recorded for #196 (v0.10): Emberheart, Frost Brand, Serrated Edge and Berserker Tooth are stronger, so every run that meets them
 * plays out differently on purpose; paladin:5 (now dead at wave 6) became paladin:9 and archer:5 variant 1 (now falls at the Act boss)
 * became archer:13 variant 1.
 * Re-recorded for #200 (v0.10, on the merged code after #196): Ember Mantle, a new Flame rare, joins every class's pool on top of #196's
 * tuned starter commons, so viking:98765, its curse run, angel:1234 and both Necromancer runs draw different relics on purpose (the same
 * five runs #200 changed alone); #196's seed changes (paladin:9, archer:13 variant 1) still reach the Act boss and stand.
 */

interface GoldenRun { cls: ClassId; seed: number; opts?: RunOptions; variant?: number }
const RUNS: Record<string, GoldenRun> = {
  'paladin:9': { cls: 'paladin', seed: 9 }, // #182: 1234 now dies before the Act boss; #196: so does 5
  'paladin:98765': { cls: 'paladin', seed: 98765 },
  'viking:98765': { cls: 'viking', seed: 98765 },
  'viking:5': { cls: 'viking', seed: 5 },
  'angel:1234': { cls: 'angel', seed: 1234 },
  'angel:98765': { cls: 'angel', seed: 98765 },
  'necromancer:1234': { cls: 'necromancer', seed: 1234 },
  'necromancer:5': { cls: 'necromancer', seed: 5 },
  'archer:2027': { cls: 'archer', seed: 2027 }, // #100: 2026 dies before the Act boss
  'archer:5': { cls: 'archer', seed: 5 },
  'paladin:7 meta': { cls: 'paladin', seed: 7, opts: { meta: { hp: 3, moveSpd: 3, startLevel: 1, startGold: 5, pickup: 5, xp: 5, talentPoint: 2, rerolls: 2, utilityCd: 3 } } },
  'viking:98765 curse': { cls: 'viking', seed: 98765, opts: { curses: ['ironHorde'] } },
  'angel:98765 oath 3': { cls: 'angel', seed: 98765, opts: { oath: 3 } },
  'archer:13 variant 1': { cls: 'archer', seed: 13, variant: 1 }, // #196: seed 5 now falls at the Act boss
};
const SECONDS = 720; // past the first Act boss, so the Merchant and the route fork are in it

/** FNV-1a over the summary's JSON: catches any difference the listed fields miss. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

function golden({ cls, seed, opts = {}, variant = 0 }: GoldenRun): string {
  const r = simulateRun(cls, seed, opts, variant, SECONDS);
  expect(r.wave, 'the bot must reach the first Act boss on this seed').toBeGreaterThanOrEqual(ACTS.length);
  return `wave ${r.wavesCleared} kills ${r.kills} level ${r.level} gold ${r.gold} relics ${r.relicsFound?.length ?? 0} hash ${fnv(JSON.stringify(r))}`;
}

// v0.8 #99 + #100 + #101: re-recorded on release/0.8.0 because boss draws, boss relic families and the Squire enemy roster changed on purpose
const GOLDEN: Record<string, string> = {
  'paladin:9': 'wave 15 kills 636 level 17 gold 2511 relics 6 hash 90cf3d22',
  'paladin:98765': 'wave 15 kills 609 level 16 gold 2498 relics 7 hash 66d27dc9',
  'viking:98765': 'wave 18 kills 751 level 18 gold 3226 relics 7 hash 4e07099',
  'viking:5': 'wave 18 kills 676 level 18 gold 3636 relics 7 hash bb2efac8',
  'angel:1234': 'wave 19 kills 795 level 19 gold 3616 relics 7 hash d415d65b',
  'angel:98765': 'wave 16 kills 719 level 18 gold 3540 relics 7 hash d5c6635c',
  'necromancer:1234': 'wave 21 kills 846 level 20 gold 4310 relics 8 hash 5a6add30',
  'necromancer:5': 'wave 19 kills 752 level 19 gold 3242 relics 7 hash f34eeb26',
  'archer:2027': 'wave 9 kills 301 level 10 gold 883 relics 4 hash 48aea908',
  'archer:5': 'wave 9 kills 263 level 11 gold 869 relics 4 hash 5254d592',
  'paladin:7 meta': 'wave 16 kills 612 level 18 gold 2374 relics 7 hash d3995b55',
  'viking:98765 curse': 'wave 18 kills 815 level 18 gold 3846 relics 7 hash 33d1476c',
  'angel:98765 oath 3': 'wave 13 kills 527 level 14 gold 2529 relics 5 hash b4058e85',
  'archer:13 variant 1': 'wave 20 kills 966 level 20 gold 4419 relics 7 hash df881b25',
};

describe('v0.8 golden runs', () => {
  // each run blocks the worker for seconds; yield between them, or vitest's 60 s worker RPC times out over the whole file
  beforeEach(() => new Promise((r) => setTimeout(r, 0)));
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000); // a few seconds alone, much longer next to the other files
});
