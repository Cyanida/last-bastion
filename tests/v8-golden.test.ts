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
 * Re-recorded for #210 (v0.11): the Great Keep's wings are rooms with fixed features (the forge's fires, the armory's strongbox, the
 * chapel's shrine, the barracks' lair), so the four runs that reach the keep meet different wings on purpose.
 * Re-recorded for v0.11 (merge of #210 and #212 on release/0.11.0, after #200 and #196 came in from release/0.10.0): the Great Keep's
 * fixed wing rooms on top of the v0.10 relic changes move these runs' draws on purpose; each run still reaches the first Act boss.
 * Re-recorded for #217 (v0.11): four new Steel relics (Rivet Hammer, a starter common, plus Pavise, Reprisal Cuirass and Heart of the
 * Hold) join the relic pool, so every run's relic draws moved on purpose (archer:5 alone draws none of them); every seed still reaches the Act boss.
 * Re-recorded for #217 on the merged code (after #196, #197, #200, #201, #205, #210 and #212 came into release/0.11.0): the four Steel
 * relics on top of Ember Mantle, the tuned commons and the Great Keep's wing rooms move every run but archer:5 on purpose; each run
 * still reaches the first Act boss.
 * Re-recorded for #218 (v0.11): the Steel class relics of the Angel, the Necromancer and the Archer join their pools and Iron Tithe
 * (Reprisal Cuirass + Vampire Fang) joins the duos, so the runs of those three classes draw different relics on purpose; every seed still
 * reaches the first Act boss.
 * Re-recorded for #229 (v0.12, on the merged code after #223, #225, #235, #236 and #239 came into release/0.12.0): Flashpowder, Pitch Pot
 * and Crown of Cinders, three new Flame relics, join every class's pool, so seven runs draw different relics on purpose (both paladin:9
 * and paladin:7 meta, angel:1234, the oath run, necromancer:1234 and both plain Archer runs); every seed still reaches the first Act boss.
 * Re-recorded for #230 (v0.12): the Flame class relics of the Viking and the Necromancer join their pools and Baptism of Fire
 * (Flashpowder + Blessed Water) joins the duos, so viking:5 and both Necromancer runs draw different relics on purpose; every seed still
 * reaches the first Act boss.
 * Re-recorded for #273 (v0.13): the Forsaken Graveyard's wings are places with fixed features (the crypts' grave gas, the sexton's
 * strongbox, the broken chapel's shrine, the old barrows' lair) and two crypts stand in its core, so the eight runs that reach the
 * graveyard meet different wings on purpose; every seed still reaches the first Act boss.
 * Re-recorded for #280 (v0.13): the Grave class relics of the Paladin, the Viking, the Angel and the Archer join their pools and Barrow
 * Feast (Hex Doll + Berserker Tooth) joins the duos, so angel:1234, both plain Archer runs and paladin:7 meta draw different relics on
 * purpose; every seed still reaches the first Act boss.
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
  'paladin:9': 'wave 14 kills 554 level 15 gold 1658 relics 4 hash 20c5e54b',
  'paladin:98765': 'wave 16 kills 678 level 17 gold 2527 relics 6 hash 78d645b4',
  'viking:98765': 'wave 18 kills 779 level 18 gold 3243 relics 6 hash faeda437',
  'viking:5': 'wave 9 kills 268 level 11 gold 807 relics 4 hash 4a712663',
  'angel:1234': 'wave 21 kills 961 level 20 gold 4526 relics 8 hash 4e64d1e0',
  'angel:98765': 'wave 18 kills 755 level 19 gold 3667 relics 6 hash f349e96a',
  'necromancer:1234': 'wave 11 kills 360 level 13 gold 1383 relics 5 hash 5bf60068',
  'necromancer:5': 'wave 19 kills 722 level 19 gold 3552 relics 7 hash b6c83a99',
  'archer:2027': 'wave 21 kills 998 level 20 gold 4277 relics 9 hash 5c9b0561',
  'archer:5': 'wave 21 kills 886 level 20 gold 4478 relics 9 hash ad39d2ac',
  'paladin:7 meta': 'wave 15 kills 607 level 18 gold 2358 relics 8 hash 136dfffa',
  'viking:98765 curse': 'wave 18 kills 768 level 18 gold 4824 relics 6 hash 9ef70d33',
  'angel:98765 oath 3': 'wave 17 kills 760 level 18 gold 4177 relics 6 hash 6321eee7',
  'archer:13 variant 1': 'wave 21 kills 998 level 20 gold 4389 relics 7 hash f9dde4b9',
};

describe('v0.8 golden runs', () => {
  // each run blocks the worker for seconds; yield between them, or vitest's 60 s worker RPC times out over the whole file
  beforeEach(() => new Promise((r) => setTimeout(r, 0)));
  for (const [name, run] of Object.entries(RUNS))
    it(`${name} plays exactly as before`, () => {
      expect(golden(run)).toBe(GOLDEN[name]);
    }, 120_000); // a few seconds alone, much longer next to the other files
});
