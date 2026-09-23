# Balance notes

## v0.6: the balance pass (the Keep, the bot, the class spread, the Squire tier)

**The Keep sells options, not power.** Before the rework a maxed save reached 4.1x the depth of a fresh one (v0.4 notes below).
The Armory's four damage tracks (+35% damage when maxed) became three sidegrades, and HP, speed and Veteran Levies were cut short
(`config/economy.ts`, refunds in `logic/save.ts` `LEGACY_META`). Since a win now ends the run at wave 40, depth is measured with
`npm run sim -- deep`: wins march on into Endless (up to 60 minutes). With the reworked Keep and v0.5's numbers, 4 seeds per cell:

| Class | Fresh (avg wave) | Fresh wins | Maxed (avg wave) | Maxed wins |
|---|---|---|---|---|
| Paladin | 44.0 | 3/4 | 63.5* | 4/4 |
| Viking | 42.3 | 3/4 | 67.5 | 4/4 |
| Angel | 58.5 | 3/4 | 66.8 | 4/4 |
| Necromancer | 26.0 | 1/4 | 43.8 | 3/4 |
| Archer | 11.3 | 0/4 | 56.0 | 4/4 |
| **All** | **36.4** | | **59.5** | |

Maxed / fresh: **1.63x**, inside the 1.5-2x target (* every run hit the 60-minute cap, so the true ratio is a little higher).

**The bot kites now.** The Archer and the Necromancer are the strongest classes for human players and were the weakest for the
bot, which backed straight away from every crowd (into walls) and only loosed the Volley at 220 px of its 520. It now circles the
crowd while fleeing (`ORBIT` in `sim/bot.ts`; 0, 0.9, 1.5, 2.5 and 4 tried, more tangent was better) and casts at the ability's
reach. Over 20 fresh seeds (runs cut at 8 minutes) the share past the Act I Dragon became Paladin 12, Viking 13, Angel 17,
Necromancer 9, Archer 13 (v0.5: about 1 in 16 for the Archer).

**The Squire tier was too easy past the Dragon** (a playtest question, and the bot agreed): a fresh run either died at wave 10 or
won, in about 30 minutes, and the winners marched on into Endless to wave 50-76. A slightly steeper Act III (trial A: HP slopes
0.05 / 0.13 / 0.10) changed nothing; what did was a clearly steeper Act II onward. Fresh and maxed, 6 seeds per cell, wins stop the run
(the last two columns with every change below, the bot's gate routing included):

| | v0.5 numbers, fresh wins | v0.6, fresh wins | v0.6, maxed wins | v0.6, winning minutes (fresh / maxed) |
|---|---|---|---|---|
| Paladin | 3/6 | 4/6 | 6/6 | 40-45 / 32-37 |
| Viking | 5/6 | 5/6 | 5/6 | 29-32 / 24-28 |
| Angel | 5/6 | 2/6 | 6/6 | 31 / 26-30 |
| Necromancer | 0/6 | 0/6 | 3/6 | - / 24-27 |
| Archer | 0/6 | 0/6 (avg wave 10.5 -> 12.7) | 5/6 | - / 23-26 |

- `WAVES.hp.slopes` 0.05 / 0.11 / 0.05 -> **0.05 / 0.16 / 0.14** and `WAVES.dmg.slopes` 0.03 / 0.06 / 0.03 -> **0.03 / 0.08 / 0.07**
  (Act III's slope also holds for Act IV). Enemy HP at wave 30 is about 45% higher, at wave 40 about 35%. Act I is untouched: the
  Dragon stays the first wall, and fresh bots now also die after it.
- **Archer base HP 80 -> 95** (the Angel's): the fresh Archer died in Act I. Its damage is untouched, since players already find it strong.
- **The Usurper's base HP 4000 -> 3000, the Royal Flames' 700 -> 520.** He spawns with the wave's multiplier, which rose about 35% at
  wave 40, and his fight was tuned by phase lengths (below): with the old numbers a fresh Paladin went 149 s without anything new at wave 40.
- **The bot walks through gates to its target** (`via` in `sim/bot.ts`, shared with the quest goals). A maxed Paladin stood 400 s pressed
  against a wing's wall during the ward, out of reach of the last two Royal Flames, and died there. This made the melee bots stronger again
  (the fresh Viking wins 5 of 6 once past the Dragon).
- The maxed Necromancer dies to the Lich at wave 15 on one of the bot's two build paths and wins every run on the other: that is the bot's
  talent path, not the class.

`npm run sim -- pacing 3` with everything in:

| Class | Setup | Minutes | Wave | Act I | Act II | Act III | Act IV | Won | Longest stretch |
|---|---|---|---|---|---|---|---|---|---|
| Paladin | fresh | 39.1 | 40.0 | 6.8 | 9.3 | 10.3 | 12.6 | 3/3 | 85 s |
| Paladin | maxed | 32.2 | 40.0 | 6.3 | 7.8 | 8.2 | 9.8 | 3/3 | 78 s |
| Viking | fresh | 20.0 | 28.0 | 5.3* | 6.9* | 7.3* | 9.6* | 2/3 | 78 s |
| Viking | maxed | 25.9 | 40.0 | 4.9 | 6.0 | 6.7 | 8.3 | 3/3 | 70 s |
| Angel | fresh | 28.4 | 39.0 | 6.1 | 6.8 | 7.8 | 9.5* | 1/3 | 72 s |
| Angel | maxed | 27.4 | 40.0 | 5.2 | 6.4 | 7.0 | 8.8 | 3/3 | 69 s |
| Necromancer | fresh | 18.2 | 28.0 | 4.8* | 6.2* | 7.2* | 8.1* | 1/3 | 64 s |
| Necromancer | maxed | 20.3 | 33.0 | 4.9 | 5.8* | 6.6* | 7.8* | 2/3 | 58 s |
| Archer | fresh | 6.7 | 12.3 | 5.3* | - | - | - | 0/3 | 45 s |
| Archer | maxed | 22.8 | 40.0 | 4.4 | 5.5 | 5.8 | 7.0 | 3/3 | 52 s |

**No run breaks the 90-second rule** (the longest stretch averages 58 s fresh, 57 s maxed). A winning run takes 23-45 minutes, most of them
25-40; maxed ranged classes are the quickest (they kill fastest), a fresh Paladin the slowest.

**The class spread.** The spec's target is 15%. Maxed, four classes win 5-6 runs in 6 and the Necromancer 3 (on one of the bot's two
build paths, above). Fresh, the melee classes lead (Viking 5/6, Paladin 4/6, Angel 2/6). The Necromancer and the Archer stay behind *on the bot* fresh; weighing the playtests over the bot (they are
the strongest for people), they get no damage buff. A better yardstick for them needs a bot that flanks shield bearers and uses minions
as a wall; that is future work, not a reason to buff them for people.

**Where the Squire stands for 0.6.0.** Fresh bots win 11 runs in 30 (v0.5 numbers: 13) and die after the Dragon as well as at it; maxed bots
win 25 in 30. A fresh Viking that gets past wave 10 still nearly always wins: no playtest called the melee classes too strong, so they are
left alone until the next round of playtests says otherwise. A player who finds the Squire easy has the higher tiers and, after a win, the
Oath ladder.

## v0.6: routes, and where the Squire tier stands now

The bot takes the first route offered (the fork is seeded, so the sims stay reproducible). `npm run sim -- pacing 3` after increment 6:

| Class | Setup | Minutes | Wave | Act I | Act II | Act III | Act IV | Won | Longest stretch |
|---|---|---|---|---|---|---|---|---|---|
| Paladin | fresh | 27.2 | 30.0 | 7.3* | 9.5* | 9.9* | 11.2* | 2/3 | 63 s |
| Paladin | maxed | 30.8 | 40.0 | 5.8 | 7.0 | 8.2 | 9.7 | 3/3 | 74 s |
| Viking | fresh | 28.9 | 40.0 | 5.7 | 6.8 | 7.3 | 9.1 | 3/3 | 78 s |
| Viking | maxed | 25.2 | 40.0 | 4.8 | 5.6 | 6.7 | 8.0 | 3/3 | 68 s |
| Angel | fresh | 6.6 | 11.3 | 6.0* | - | - | - | 0/3 | 31 s |
| Angel | maxed | 27.1 | 40.0 | 5.3 | 6.5 | 6.7 | 8.6 | 3/3 | 68 s |
| Necromancer | fresh | 5.0 | 10.0 | - | - | - | - | 0/3 | 28 s |
| Necromancer | maxed | 18.6 | 30.7 | 4.7 | 5.9* | 6.7* | 7.7* | 2/3 | 45 s |
| Archer | fresh | 3.1 | 7.0 | - | - | - | - | 0/3 | 29 s |
| Archer | maxed | 24.5 | 40.0 | 4.5 | 5.5 | 6.2 | 8.2 | 3/3 | 59 s |

No run breaks the 90-second rule. The trend since the baseline is plain: **once a melee character gets past the Act I Dragon, the
Squire tier no longer stops it**. A fresh Viking won 3 runs in 3, a fresh Paladin 2 in 3; maxed runs won 14 in 15 in 18-31 minutes. The
Last Stand, the evolutions and the routes each add power on top of v0.5's. That matches the playtest question "is the Squire too
easy?": yes, now. It is increment 7's job (the Keep's stat ranks become sidegrades, which takes power out of maxed runs, and the Oath
ladder gives a win somewhere to go) and the final balance pass's (the Squire tier's numbers, and the class spread: the fresh ranged
bots still die early, though human players find the Necromancer and the Archer the strongest).

## v0.6: evolutions

**Within reach?** The spec's bar is that every run has a build-defining evolution within reach. The bot takes the gold card whenever it
comes (4 seeds per class, 40-minute cap): **every maxed run got at least one** (the first between minutes 2 and 16, often a second one
later), and **9 of 20 fresh runs** did (minutes 4 to 10). The fresh runs that missed mostly died before wave 7, before three talent points
or a second copy of a relic could come together; a run that gets going reaches one. Requirements lean on the ability upgrades (levels 5,
10 and 15) and a tier II relic or a branch's second row, so the keystone recipes are the late ones.

Their power is not tuned yet: the final balance pass measures runs with and without them. The per-evolution tests only prove each one
does its own thing and nothing else does (tests/v6-evolutions.test.ts).

## v0.6: telegraphs, patterns, the perfect dodge and the Last Stand

**The Last Stand is worth a lot at the first wall.** The Act I Dragon gate for fresh bots (8 seeds per class, 40 runs): **16/40 pass with
the Last Stand, 10/40 without** (v0.5: about 20%). One caught killing blow, 5 seconds untouchable and a faster ability is often the Dragon
dead. Runs that pass then go deep: fresh Paladins, Vikings and Angels now reach waves 21-32 on average and some of them beat the Usurper.
That is a real easing of the early game, on top of the playtest note that the Squire tier may already be too easy. It stays as the
spec asks, and three things answer it: the Oaths (increment 7) can take it away, the meta rework (increment 7) makes maxed runs weaker,
and the final balance pass re-tunes the Squire tier with all of it in place.

`npm run sim -- pacing 3` after this increment (Squire, courtyard):

| Class | Setup | Minutes | Wave | Act I | Act II | Act III | Act IV | Won | < 5 enemies | Longest stretch |
|---|---|---|---|---|---|---|---|---|---|---|
| Paladin | fresh | 19.8 | 21.0 | 7.8* | 10.8* | 11.9* | 12.1* | 1/3 | 17% | 62 s |
| Paladin | maxed | 33.8 | 40.0 | 5.6 | 8.0 | 8.2 | 9.5* | 2/3 | 25% | 174 s |
| Viking | fresh | 23.1 | 31.7 | 5.7 | 7.3* | 7.3* | 9.1* | 2/3 | 22% | 65 s |
| Viking | maxed | 27.1 | 40.0 | 4.9 | 6.5 | 6.7 | 8.9 | 3/3 | 24% | 71 s |
| Angel | fresh | 20.8 | 28.7 | 6.0* | 7.3* | 7.2* | 9.2* | 2/3 | 25% | 54 s |
| Angel | maxed | 27.2 | 40.0 | 5.3 | 6.6 | 6.8 | 8.5 | 3/3 | 25% | 53 s |
| Necromancer | fresh | 5.0 | 10.0 | - | - | - | - | 0/3 | 27% | 28 s |
| Necromancer | maxed | 19.1 | 31.7 | 4.7 | 6.4* | 6.0* | 7.5* | 2/3 | 25% | 42 s |
| Archer | fresh | 3.1 | 7.0 | - | - | - | - | 0/3 | 28% | 29 s |
| Archer | maxed | 19.4 | 30.7 | 4.6 | 6.5* | 6.6* | 8.5* | 2/3 | 26% | 44 s |

One run in 30 breaks the 90-second rule: a maxed Paladin whose Usurper fight had a 406-second phase. The fight is not quiet (he attacks
every few seconds), but the Paladin's low damage makes a phase drag; that is the class-spread work in increment 7.

**Patterns** only start in Act III, so Acts I-II play as before. **Perf**: the outlines, resist marks and shot halos add no measurable
frame time (an A/B with them switched off gave the same numbers); the local perf test was noisy while this was measured (the committed
increment 3 build failed it the same way at that moment), so CI's run is the check.

## v0.6: stragglers and the 90-second rule

The tail of every wave was the dead time: after the last spawn, the last few enemies (often a crossbowman keeping his distance, or a
ballista across the map) held the wave open until the 60-second overtime ran out, which is where the 85-second stretches with nothing
new came from. Now the last `WAVES.stragglers.count` (4) weak enemies get 5 seconds, then come straight at the player 1.6× faster, and a
structure left alone gives up. Elites and bosses are never stragglers. Boss phases and the Usurper's flames count as beats.

`npm run sim -- pacing 3` (Squire, courtyard; * = not every run finished that Act; a win ends on wave 40):

| Class | Setup | Minutes | Wave | Act I | Act II | Act III | Act IV | Won | < 5 enemies | Longest stretch |
|---|---|---|---|---|---|---|---|---|---|---|
| Paladin | fresh | 5.1 | 8.3 | - | - | - | - | 0/3 | 23% | 42 s |
| Paladin | maxed | 32.3 | 40.0 | 5.6 | 8.3 | 8.4 | 10.0 | 3/3 | 19% | 76 s |
| Viking | fresh | 14.3 | 20.3 | 5.9* | 6.7* | 7.7* | 10.4* | 1/3 | 22% | 52 s |
| Viking | maxed | 18.9 | 30.0 | 4.8* | 6.1* | 6.3* | 8.5* | 2/3 | 23% | 54 s |
| Angel | fresh | 6.1 | 10.0 | 6.3* | 7.4* | - | - | 0/3 | 32% | 36 s |
| Angel | maxed | 27.3 | 40.0 | 5.3 | 6.8 | 6.7 | 8.5 | 3/3 | 25% | 58 s |
| Necromancer | fresh | 4.0 | 8.3 | - | - | - | - | 0/3 | 28% | 28 s |
| Necromancer | maxed | 17.1 | 30.0 | 4.7* | 5.9* | 5.6* | 7.1* | 2/3 | 25% | 46 s |
| Archer | fresh | 2.6 | 6.3 | - | - | - | - | 0/3 | 29% | 30 s |
| Archer | maxed | 19.0 | 30.7 | 4.6 | 6.7* | 6.4* | 7.8* | 2/3 | 25% | 46 s |

- **No run breaks the 90-second rule** (0 of 30; before this change 5 of 15 maxed runs did, all in the Usurper fight, which had no beats).
- Quiet time (fewer than 5 enemies alive) fell from 25-36% to 19-32%, and every Act got shorter.
- A winning maxed run now takes **27-32 minutes**, a little under the 30-40 target. Maxed is the fully upgraded Keep, which increment 7
  makes weaker on purpose (sidegrades instead of stat ranks); the run length gets checked again after that, in the final balance pass.

## v0.6: the Usurper

**The fight.** Base HP 4000 (×6.5 at wave 40: about 26,000), three Royal Flames of 700 (about 4,600 each; since the balance pass 3000 and 520 under a steeper Act IV, about the same totals). HP turned out to be the wrong
knob: late characters kill in bursts (a revived fresh Viking carries ~19 relics at tier II by wave 40, the Necromancer's skeletons took
the Usurper from 20,000 to 0 in three seconds), so raising his HP from 3500 to 5500 changed the fight time by almost nothing, and only the
weak-damage Paladin would have paid for it. Instead **every phase has a minimum length** (`FINAL.usurper.minPhase`: 20 s for the first; he
cannot fall before 25 s of the last), enforced by an HP floor on the enemy (`Enemy.hpFloor`). Phase 2 needs none: the flames are spread
across the hall and take their time.

Time from wave 40's start to his fall, with the minimums (2 seeds each; "fresh" = no Keep, revived on death like the wall probe):

| | Paladin | Viking | Angel | Necromancer | Archer |
|---|---|---|---|---|---|
| fresh, revived | 117 s / 398 s (1 death) | 73 s / 92 s | 75 s / 88 s | 71 s / 93 s (1 death) | 74 s / 71 s (2 deaths each) |
| maxed | 85 s, and one death to him | 76 s / 106 s | 73 s | 70 s / 68 s | died to him |

He is the deadliest boss in the game: he killed 2 of the 8 maxed bots that reached him (the bot stands in quake rings). Maxed runs reach
him after **26-36 minutes**, so a winning run takes 28-38: inside the 30-40 minute target. The Paladin is the outlier on fight length
(low damage by design): that is the class-spread work in increment 7, not his HP.

**The bot had to learn the fight.** It used to drop everything and flee whenever it stood near a marked zone, and a ranged bot never
walked toward a target out of reach. Under the ward's burning pitch that meant it never reached a Royal Flame. An A/B on the same seeds
showed the obvious fix (always advance, sidestepping zones) makes Act I **65% slower** (8.1 minutes against 4.6-5.2 for a maxed Viking):
pushing into a crowd through marked ground plays worse than backing off and letting the crowd bunch up. So the bot now advances through
marked ground only when nothing is close, or while a boss is warded; ranged classes close in on targets out of reach; and nothing
auto-targets a warded enemy (players' auto-attacks included). With that the maxed Viking's Acts take 4.4-4.7 / 5.5-6.2 / 6.0-6.3 minutes,
at or below the baseline.

## v0.6: the run as it stood (measured before any v0.6 change)

**How a run goes (v0.5).** You pick a champion, an arena, a difficulty, curses and a trait. Act I starts in that arena with only the core
open and a quest board (take two of three). An Act is 10 waves. Waves 3 and 8 are lighter "breathers" that always bring an event, waves 4 and 9 are
heavier, wave 5 brings a boss from the arena's rotation (its death opens the next wing), and wave 10 is the Act boss (the Dragon, then the
Warden, in turn). The Merchant comes next, then the next arena with a new theme and a new board. Each Act scales one thing: Act I the count,
Act II stats and elites, Act III composition and commanders. Past wave 30 HP and damage grow quadratically and heals fade. **Runs had no
ending**: they went on until death or "End run".

**How long it takes** (`npm run sim -- pacing 4`, Squire, courtyard, 4 runs per cell, the 45-minute sim cap; * = not every run finished that Act):

| Class | Setup | Minutes | Wave | Act I | Act II | Act III | Act IV | Time with < 5 enemies | Longest stretch with nothing new |
|---|---|---|---|---|---|---|---|---|---|
| Paladin | fresh | 17.0 | 18.5 | 7.4* | 10.8* | 9.6* | 12.1* | 23% | 56 s |
| Paladin | maxed | 45.0 | 49.0 | 6.0 | 9.0 | 9.0 | 10.1 | 20% | 85 s |
| Viking | fresh | 25.5 | 30.3 | 5.8* | 8.4* | 7.5* | 10.6* | 25% | 63 s |
| Viking | maxed | 34.4 | 44.5 | 4.9* | 6.9* | 6.9* | 8.4* | 26% | 69 s |
| Angel | fresh | 13.0 | 15.3 | 7.0* | 10.9* | 9.9* | 9.7* | 29% | 47 s |
| Angel | maxed | 45.0 | 50.0 | 5.7 | 8.1 | 9.1 | 11.1 | 34% | 85 s |
| Necromancer | fresh | 5.0 | 9.3 | 6.3* | - | - | - | 32% | 47 s |
| Necromancer | maxed | 25.3 | 31.8 | 5.1* | 8.4* | 9.1* | 11.1* | 39% | 65 s |
| Archer | fresh | 3.0 | 6.0 | - | - | - | - | 34% | 29 s |
| Archer | maxed | 26.1 | 31.5 | 5.1 | 7.5* | 10.4* | 9.9* | 38% | 66 s |

What it says:
- **Four Acts already take 30-40 minutes** for a run that gets through them (Act I 5-7 minutes, the later Acts 7-12 each). The Usurper at the
  end of Act IV gives v0.6 its 30-40 minute run without stretching anything.
- **No run broke the 90-second rule**, but late waves come close: the 85-second stretches are waves 37-54 where the last stragglers hold the wave open
  until the 60-second overtime runs out (`WAVES.overtime`). That is the straggler fix (increment 3).
- **A fifth to two fifths of the time fewer than 5 enemies are alive**: the tail of every wave, plus breaks. Also increment 3.
- The bot's class spread is unchanged from v0.5 (Archer and Necromancer weakest for the bot, strongest for human players; see the v0.6 spec notes).

## v0.5: quests, the bigger map, sacred treasures

The v0.5 balance pass was scoped to the new content and the tail: the maxed/fresh gap and the class spread are v0.6's job (it reworks the
Keep's stat ranks into sidegrades and targets the Archer), so this section records the state it hands over.

**What the new content did.** Quests (their rewards, and the wings they open) made Act I stronger, most of all for the melee bot, which walks
to objectives and fights there. Ablation on 6 fresh Viking runs (average wave): baseline 27.2, no quests 8.0, no wing features 12.3,
no events 19.3, no breather pacing 27.2, all of it off 7.2 (v0.4's level). "Wave reached" is bimodal: a run either dies at the Act I Dragon
or, having passed it, runs deep. So the useful metric is the **gate**: how many fresh runs kill the Dragon. Over 16 seeds per class about
20% pass (Viking 5-7, Angel 4-7, Paladin 2-4, Necromancer 0-1, Archer 0-1 out of 16). Allowing only one quest in Act I changed nothing
measurable (16/80 against 15/80), so the board stays at two. A fifth of fresh bot runs beating the Dragon is fine ("beating it fresh is a
very good run"); the per-class gap is the v0.6 class-spread item.

**What was wrong, and fixed.**
- *Enemies stuck behind walls.* The first map build let enemies steer straight at the player; anything spawned in a wing pressed against the
  wall between it and the core. Late waves were mostly stuck, which is why deep runs looked immortal. Enemies, minions, the caravan and the monk
  now route through the right gate (`waypoint` in `logic/regions.ts`: the regions form a star, so the next gate is always known). Real
  pathfinding around obstacles is on the v0.6 list.
- *The tail.* Past wave 30 HP now grows with 0.03 × (w − 30)² (was 0.012) and damage with 0.012 × (w − 30)² (was 0.005), and every heal
  is 4% weaker per wave past 30 (down to 15%: `WAVES.healFalloff`), because sustain scales with the huge late kill counts.
- *The talent tree.* The Library's level caps the rows; a fresh save now opens three rows (the keystones need the Library's first level), and
  the tree screen shows a locked row as locked (it used to look open and ignore the click).

### Simulation, v0.5 (Squire, courtyard, 6 runs per cell; maxed = every Keep rank, mastery 25, the class's treasure at tier III)

| Class | Fresh: avg wave (min-max) | Maxed: avg wave (min-max) | Ratio |
|---|---|---|---|
| Paladin | 14.7 (4-44) | 48.7 (46-52) | 3.32 |
| Viking | 23.5 (5-51) | 48.7 (6-58) | 2.07 |
| Angel | 11.7 (3-46) | 49.3 (44-56) | 4.23 |
| Necromancer | 8.5 (4-12) | 23.2 (2-54) | 2.73 |
| Archer | 6.5 (2-10) | 33.5 (11-54) | 5.15 |
| **All** | **13.0** | **40.7** | **3.14** |

The XP pace still holds: fresh runs that get there are level 12 / 16 / 20-21 / 24 / 28 at waves 10 / 15 / 20 / 25 / 30 (target 11 / 14.8 /
18.5 / 21.3 / 24). **Most maxed runs end at the sim's 45-minute cap, not in death** (wave 46-58 at 45 minutes, level 40-47): a fully developed
character outgrows the enemies, and the tail only catches it around wave 60. That is the v0.6 finding to act on: its Keep rework (sidegrades,
not power) and the Act IV ending (the Usurper) give runs a length, where the tail alone cannot.

**Economy** (`npm run sim -- economy`): the Keep is fully raised after **run 40** (target 40-60). Achievement tiers and quest Runes mean
Runes are no longer the bottleneck late; gold is. It sits at the fast end of the target; v0.6's Keep rework re-runs it.

## v0.4: the XP curve and one scaling axis per Act

Playtest feedback: level-ups slow down late while enemies keep multiplying. Two causes, both fixed in config.

### The XP curve (`config/game.ts`, `config/waves.ts`, `logic/formulas.ts`)

- **Cost per level is linear**: `xpToNext(L) = 12·L` (12 at level 1, 108 at level 9, 240 at level 20, 336 at level 28). The v0.3 curve
  was `4·L^1.3`: the first levels were nearly free (level 6 for 88 XP) and the pace then fell away wave after wave.
- **Enemy XP scales with the wave and the Act.** The director already buys a growing budget every wave (raw XP on the field goes from about 60 at
  wave 5 to 330 at wave 35, close to linear), so with a linear cost the pace would be *flat*: one level a wave for ever. The Act factor
  `enemyXpMult(w) = actDecay^(act-1)` (0.55) is what makes the pace slide. Each cleared wave also pays `clearFrac` (10%) of the next level at the expected pace.
- **Target pace is in config**: `WAVES.pace.levelsPerWave = [1.0, 0.75, 0.55]` per Act. `expectedLevel(wave)` sums it; `catchUpMult` gives a player
  below that level +15% XP per level behind, capped at +60%, and never a penalty above it. The constants were fitted numerically against the
  director's real waves (`tests/v4-xp.test.ts` feeds a run every unit `directWave` would spawn and asserts the level stays within 1.5 of the target at waves 10, 20 and 30).
- **The sim reports it**: `npm run sim` prints the level at the end of waves 5..30 per class against the expected level; `npm run sim -- probe` gets every class to wave 30.

### One scaling axis per Act

| Act | Axis | What grows | What does not |
|---|---|---|---|
| **I** (1-10) | count | `enemyCount` ramps from 9 to about 60 by wave 9 | HP +5%/wave, damage +3%/wave, elites 3% -> 6% |
| **II** (11-20) | stats + elites | HP +11%/wave, damage +6%/wave, elite chance climbs 2.2x faster (9% -> 18%), two-affix elites | count creeps by 1.2 a wave |
| **III** (21+) | composition | the director pays +0.8 per head (pricier units), squads +30% chance and +20% budget share, commanders | HP +5%/wave, damage +3%/wave again; elites capped at 22% |
| beyond 30 | the tail | HP and damage gain a quadratic term (`beyondQuad`) so every run ends | |

| wave | 1 | 5 | 9 | 12 | 15 | 19 | 22 | 25 | 29 | 35 | 40 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| enemies | 9 | 12 | 54 | 63 | 26 | 71 | 75 | 31 | 83 | 36 | 38 |
| director budget (XP) | 12 | 19 | 95 | 132 | 59 | 174 | 240 | 104 | 295 | 139 | 152 |
| HP x | 1.00 | 1.20 | 1.40 | 1.67 | 2.00 | 2.44 | 2.65 | 2.80 | 3.00 | 3.60 | 4.75 |
| damage x | 1.00 | 1.12 | 1.24 | 1.39 | 1.57 | 1.81 | 1.93 | 2.02 | 2.14 | 2.44 | 2.97 |
| elite chance | 0 | .04 | .06 | .09 | .13 | .18 | .21 | .22 | .22 | .22 | .22 |
| enemy XP x | 1.00 | 1.00 | 1.00 | 0.55 | 0.55 | 0.55 | 0.30 | 0.30 | 0.30 | 0.17 | 0.17 |
| expected level | 1 | 5 | 9 | 11.8 | 14 | 17 | 19.1 | 20.7 | 22.9 | 26.2 | 29 |
| XP to next level | 12 | 60 | 108 | 144 | 168 | 204 | 228 | 252 | 276 | 312 | 348 |

(waves 5, 15, 25 and 35 are boss waves: the escort is 40% of a normal wave.) Late-run power is supposed to come from the talent tree and the sacred treasures, not from the XP curve.

### Wall probe, v0.4 (Squire, courtyard, fresh, 3 runs per class)

The basic bot dies in Act I far too often to say anything about waves 15-30, so `npm run sim -- probe` revives it on death (full HP, three seconds of
invulnerability, at the spot of the arena farthest from the crowd: reviving in place just died again and measured the probe, not the game) and counts
deaths per band of five waves instead of "wave reached". A wall would show as a band where deaths jump and stay up, or a boss wave that never ends.

| class | | 1-5 | 6-10 | 11-15 | 16-20 | 21-25 | 26-30 |
|---|---|---|---|---|---|---|---|
| *expected* | level | 6.0 | 11.0 | 14.8 | 18.5 | 21.3 | 24.0 |
| Paladin | deaths | 0.3 | 1.7 | 1.3 | 1.0 | 2.0 | 2.0 |
| | minutes | 2.5 | 4.2 | 5.7 | 5.7 | 7.8 | 7.9 |
| | level | 5.0 | 10.0 | 14.7 | 18.7 | 22.3 | 25.7 |
| Viking | deaths | 0.3 | 3.3 | 4.3 | 2.7 | 11.0 | 3.7 |
| | minutes | 2.0 | 4.4 | 5.1 | 5.2 | 9.5 | 6.3 |
| | level | 5.0 | 10.7 | 14.7 | 18.0 | 21.7 | 24.7 |
| Angel | deaths | 0.0 | 1.3 | 4.3 | 7.3 | 7.0 | 3.3 |
| | minutes | 2.0 | 3.1 | 5.1 | 5.7 | 5.6 | 5.6 |
| | level | 5.0 | 10.7 | 15.0 | 19.3 | 22.3 | 25.7 |
| Necromancer | deaths | 0.0 | 1.7 | 4.7 | 4.3 | 5.0 | 5.3 |
| | minutes | 2.4 | 3.0 | 4.4 | 4.4 | 4.3 | 4.4 |
| | level | 5.0 | 11.0 | 15.0 | 19.0 | 22.3 | 25.3 |
| Archer | deaths | 0.0 | 2.7 | 6.7 | 10.7 | 12.0 | 13.3 |
| | minutes | 2.1 | 2.6 | 4.1 | 4.9 | 4.9 | 5.1 |
| | level | 5.0 | 11.3 | 15.3 | 19.3 | 22.7 | 25.7 |

(deaths and minutes are totals over the five waves of the band, averaged over runs; level is the level at the end of the band.)

Reading it: **levels track the target within about one level all the way to wave 30** (one behind at wave 5, where waves are tiny; one ahead
at wave 30). **Deaths do not jump and stay up anywhere between waves 11 and 30.** The Paladin and Necromancer are flat; the Viking's 11 deaths in
21-25 are the wave-25 boss (a melee bot chasing a boss it cannot catch, known since v0.3: the "minutes" column shows the same fight taking 4-5 minutes);
the Angel peaks in 16-25 and falls again. The Archer climbs slowly from 1.3 to 2.7 deaths a wave: the bot cannot kite and the Archer's class bias
is the heaviest in the roster (shields and flankers). That is a class-balance item for the balance pass (spread between classes), not a wall.

### Simulation after the scaling rework (Squire, courtyard, 6 runs per cell)

| Class | Fresh: avg wave (min-max) | Maxed: avg wave (min-max) | Ratio |
|---|---|---|---|
| Paladin | 12.0 (5-35) | 20.8 (10-35) | 1.74 |
| Viking | 8.2 (5-10) | 10.7 (5-16) | 1.31 |
| Angel | 8.0 (5-10) | 12.3 (10-17) | 1.54 |
| Necromancer | 7.5 (5-10) | 9.2 (5-10) | 1.22 |
| Archer | 7.2 (5-8) | 8.8 (7-11) | 1.23 |
| **All** | **8.6** | **12.4** | **1.44** |

Fresh runs land where v0.3 left them (7.7 then), the maxed / fresh ratio is up from 1.34 to 1.44, and the level column of the pace report reads
5 / 10 / 15 / 19 / 23 / 27 at waves 5 / 10 / 15 / 20 / 25 / 30 for the one class that gets there. Runs that pass the Dragon now go deep (a fresh Paladin
reached wave 35; the count plateau and the gentle Act III stat slope are what make Act II-III survivable at all), which is what the talent tree
and the treasures are meant to build on. The spread between classes is 1.67x, worse than v0.3's 1.24x, and that is the balance pass's job (section 9).

### After talents and the utility abilities (increment 4)

The same 6-run sim with the bot spending talent points down one branch and casting the utility: fresh runs 9.0 (Paladin 14.0, the rest 7.3-8.2),
**maxed runs 36.9** (Viking 56.5, Angel 52.5, Paladin 38.5, Necromancer 27.2, Archer 9.7), ratio 4.1. A blink or a leap is exactly what the
bot lacked against a crowd, and a maxed save survives the Dragon often enough to reach the gentle Acts. That is the late power the tree was meant
to add, and far more of it than the 1.5-2x target; the balance pass (section 9) will steepen the tail past wave 30 and look at the utility cooldowns
before the classes. The spread between fresh classes is 1.9x, the Archer still last.

## v0.4: Runes and the Keep

Playtest feedback: the Keep is emptied after a single good run, and cross-run progression feels thin. The Keep is now six buildings
(`config/economy.ts` BUILDINGS): a building's level caps its tracks, raising it costs gold, **Runes** and a deed (an achievement). Gold buys the
base ranks; the top ranks cost Runes too. Runes come only from Act bosses (1 / 1 / 2, at most 4 a run), quests and treasure steps (increments 7-8),
achievement tiers (increment 6) and salvaged relics (ten shards to a Rune). Class mastery is 25 named ranks (about 40 runs of one class to the top:
`MASTERY_XP_TOTAL * (rank/25)^1.5`), the account level is every rank added up.

Three caps keep one run from buying everything: gold from curses and the Daily Trial is capped per day (600 / 400, +200 per Toll Gate rank), and
a run banks at most twice `runGoldCap` (1200, +400 per rank) with the same diminishing curve as relic stacking past it. Without that last cap the
economy sim banked 54,000 gold from one wave-60 run.

**`npm run sim -- economy`** plays one save run after run (classes in turn, deeds earned as they come, everything bought greedily). The whole Keep
costs 60,754 gold and 92 Runes; with the costs scaled 1.6x from the first draft it is **fully raised after run 43** (target 40-60). Runes are the
bottleneck from run 20 on (56 of 82 ranks bought, 8 of 18 building levels, 0 Runes in hand), which is the intended shape; quests and achievement
tiers will add Rune income later, and the balance pass re-runs this.

## v0.4: relics without a cap

The cap is gone; a duplicate raises a relic a tier (three tiers, `config/relics.ts` has every relic's tier 2 and 3 numbers). What keeps that
from running away is a set of stacking rules, all in `RELIC_STACKING`:

| Rule | What it does | Where you see it |
|---|---|---|
| **Category sums** | Plain mods of a kind add up: Whetstone +12% and Blood Pact +50% are +62% damage, not ×1.68. Conditional bonuses (Sentinel's charge, the War Horn, the Crown) join the same sum. | HUD stats panel: "Relics: damage +62%" |
| **Soft caps** | Face value up to the cap (damage +100%, attack speed +60%, armor +30%, speed +50%, cooldown cut 50%, gold +150%, XP +100%), then diminishing returns: the excess never adds more than half the cap again. | the panel shows the effective value and the raw sum struck through |
| **Proc sharing** | Past three on-hit relics, every on-hit proc's chance is scaled by 3/N (the same for on-kill). | "On hit procs ×0.60" |
| **Healing per wave** | Relic healing (Vampire Fang, Rally Banner) passes the same soft cap per wave, at 100% of max HP. The sustain stack was what made a relic build immortal. | "Relic healing (wave) 130% ~~210%~~" |
| **Proc depth 2** | A relic may react to a relic's damage (a keg blast that kills feeds the Fang) but not to *that* reaction (the second blast does not blast again). | |
| **Drops** | The share of new relics in a drop is `max(0.25, 1 - 0.09 × held)`: late drops are mostly upgrades. Top-tier relics are never offered again. | the offer screen says "a relic you already carry grows a tier stronger" |

Synergies are twelve pairs that do something extra together, and four clashes that only warn; every card and tooltip lists them (`SYNERGIES`).

### Relic power index

`npm run sim -- relics` plays fresh runs with no relics at all, with a run's haul (12 pickups by the drop rules, upgrades included, from wave 1),
and with every relic in the pool at tier 3 (the absurd upper bound), and reports the ratio of waves reached. The target was about 1.5 for the haul.

| Class | No relics | Haul (12 pickups) | Index | Every relic at III | Index |
|---|---|---|---|---|---|
| Paladin | 8.3 | 26.3 | 3.16 | 57.0 | 6.84 |
| Viking | 7.0 | 11.7 | 1.67 | 62.7 | 8.95 |
| Angel | 7.3 | 8.3 | 1.14 | 48.3 | 6.59 |
| Necromancer | 8.7 | 17.0 | 1.96 | 56.7 | 6.54 |
| Archer | 7.7 | 11.0 | 1.43 | 45.0 | 5.87 |
| **All** | | | **1.87** | | **6.96** |

(Squire, courtyard, 3 runs per cell; the tier-3 runs stop at the 45-minute cap rather than dying.)

The haul index sits above the target, and the single-relic ablation says why: the Dragon at wave 10 is a gate this bot never passes without relics
(no-relic runs end at waves 5-8), and any single tier-3 relic gets it exactly to wave 10, where it dies. A build that gets past the Dragon then runs
deep, because Acts II and III scale on one axis each. "Wave reached" is therefore bimodal, and no cap on relic numbers moves it much: what was
tightened (the category sums, the healing cap, relic damage per level 0.12 -> 0.09) took the haul from 2.5 to 1.9 (three classes are at or under 1.7; the Paladin, whose Divine Shield plus any sustain makes him the tankiest, is at 3.2), and the rest is the gate.
The balance pass (section 9) revisits this with the talent tree in place, and with the bot able to kite a boss the index will read the game rather than the gate.

## v0.3: Acts, squads and the director

### Intended difficulty per Act (Squire, no Keep upgrades)

| Act | Waves | Arena | What it should feel like |
|---|---|---|---|
| **I — The Levy** | 1-10 | the arena you picked | Waves 1-4 teach the class. Squads with a bannerman arrive from wave 4: learn to kill the commander first. The mid-Act boss (wave 5, from the arena's own rotation) is the first check, as in v0.2. Waves 6-9 add modifiers, assassins, shieldwalls and engineers; a fresh character usually dies here. **The Act boss (wave 10: the Dragon) is the gate.** Beating it fresh is a very good run. |
| **II** | 11-20 | the next arena | Reached by developed saves, or by a fresh run that found a build. Two-affix elites, cavalry lances, crusader lines with chaplains, siege towers. The Merchant before it is the first real "this run or the Keep?" decision. The Warden ends it. |
| **III+** | 21+ | cycles on | Borrowed time: quadratic enemy scaling wins. Only maxed saves with a relic build get here on Squire; this is what Knight and above are for. |

The spawn director buys each wave from a budget (`config/director.ts`): `enemyCount(wave) x costPerHead(wave)`, enemies cost their XP value.
It tilts the mix by class (an Archer sees shields and flankers, a Necromancer sees corpse thieves and blasts), by wave modifier and by the Act's theme,
and applies a **mild rubber band**: up to +30% elite chance for a player who keeps clearing fast at high HP, up to -15% budget for one who is struggling.
It is deliberately mild, because it squeezes exactly the gap that permanent upgrades are supposed to open.

Curses are the opt-in way up: each adds +10% to +30% gold and class XP, and they stack additively (`config/curses.ts`).

### Simulation, v0.3 (Squire, courtyard, 10 runs per cell)

`npm run sim` plays full runs with everything live: the director, squads and commanders, status effects, armor, Act bosses, the Merchant (the bot heals and buys a relic, it never saves for the Keep).

| Class | Fresh: avg wave (min-max) | Maxed: avg wave (min-max) | Ratio |
|---|---|---|---|
| Paladin | 8.8 (6-10) | 12.1 (9-22) | 1.37 |
| Viking | 7.8 (6-10) | 8.1 (5-10) | 1.04 |
| Angel | 7.3 (2-10) | 12.3 (5-25) | 1.68 |
| Necromancer | 7.5 (5-10) | 10.2 (9-13) | 1.36 |
| Archer | 7.1 (5-9) | 8.7 (5-11) | 1.23 |
| **All** | **7.7** | **10.3** | **1.34** |

Spread between classes (fresh): 1.24x, better than v0.2's 1.39x. On Knight the ratio is 1.53 (4.3 -> 6.6).

**The maxed / fresh ratio is 1.34x, below the 1.5-2x target.** The cause is visible in the min-max columns: almost every run, fresh or maxed, ends at or before wave 10.
The Act I boss is a harder gate than v0.2's wave-10 Warlord, and the basic bot fights it badly (melee bots chase a ranged, flying boss through its own fire; nobody uses the arena).
Tuning done so far, all in config: Dragon HP 1500 -> 850, breath halved per orb, a single burn strip instead of a double one, fire fields and burn stacks weakened, ballista damage 24 -> 15,
bone collector growth halved, class biases against Archer and Paladin reduced, rubber band elite bonus 0.6 -> 0.3, director cost growth 0.07 -> 0.05 per wave.
Each step moved the ratio by a few hundredths inside a run-to-run noise of about +-0.1, so further blind tuning against this bot is not worth much.
What to do next, in order: (1) play it: a human who dodges the strip and kills commanders should find Act I fair; (2) if maxed humans also stall at wave 10, lower `dragon.hp` and `specialMult` further rather than touching the classes;
(3) teach the bot to kite bosses, so the yardstick measures the game and not the bot.

Other things the diagnostics showed and that were fixed: shield bearers were halving undirected area damage (only frontal hits should be reduced), damage-over-time below 0.5 per tick was being dropped instead of carried over,
and standing in the Dragon's fire stacked burn to absurd values.

---

# v0.2 notes (kept for reference; the caps and the power budget below still apply)

All numbers live in `src/config/`. This file says what they are *supposed* to achieve, and what the
headless simulation says they currently achieve.

## Intended power curve

| Stretch | Without Keep upgrades (Squire) | What should be happening |
|---|---|---|
| Waves 1-4 | Comfortable | Learn the class, first 3-4 boons. Elites start at wave 4 (3% per enemy). |
| **Wave 5, first boss** | **The first real check.** | A run that took random boons and ignores telegraphs ends here. Ability tier 1 arrives at level 5, right around this fight, and the boss pays out the first guaranteed relic choice. |
| Waves 6-9 | Hard | Wave modifiers begin (35% of waves), knights and cultists join, then shield bearers and priests. A fresh character with one relic and one ability tier is expected to die somewhere in here. |
| Wave 10, second boss | A good fresh run | Reaching it at all unlocks the Graveyard. Beating it is a strong fresh run. |
| Waves 11-15 | Needs a build | Cavalry, two-affix elites, tier 2 (level 10). Clearing wave 15 unlocks the next difficulty: that is the goal a *developed* save is meant to reach, not a fresh one. |
| 15+ | Borrowed time | Enemy HP and damage grow quadratically (`WAVES.hp.quad`, `WAVES.dmg.quad`), so every build eventually loses, including sustain builds. |

### What permanent upgrades should do

A fully upgraded Keep plus mastery rank 5 is budgeted at roughly **+20% effective HP, +30-35% damage output, +25% XP,
2 extra rerolls, 1 extra relic slot and a free common relic**. Target: **1.5-2x as many waves on the same tier, never 10x.**
The rest of the long-term curve is carried by the difficulty tiers: a maxed character on *Knight* should do about as well
as a fresh character on *Squire*.

Things that exist specifically to keep that ceiling in place:

- `GAME.maxAttackRate` (4.5/s): attack-speed boons multiply, and with knockback on every swing that made melee untouchable.
- `GAME.armorCap` (75%) and `GAME.leechCapPerHit` (2% max HP): mitigation and lifesteal otherwise outgrow enemy damage.
- The ability cooldown does not tick while the ability is active, so duration stacking (Faith, Rage, Wolfskin Cloak) can never reach 100% uptime.
- `WAVES.overtime` (60 s): after the last spawn of a wave the next wave arrives anyway (never during a boss). No stalemates, no safe farming of a single straggler.
- Relic damage scales with character level (`RELIC_DAMAGE_PER_LEVEL`), not with attack stats, so proc relics stay useful without multiplying with everything else.

### Economy

A fresh Squire run banks roughly 100-350 gold (wave 6-10). The whole Keep costs 10,967 gold, of which 4,000 is the
seventh relic slot: dozens of runs on Squire, far fewer on higher tiers (gold x1.6 / x2.5 / x4). Gold spent on paid rerolls
during a run is gold not banked, and starting gold (War Chest) is never counted as earned.

## Simulation

```bash
npm run sim -- [runs per cell = 6] [tier = 0..3] [arena = courtyard|graveyard|keep]
```

`src/sim/bot.ts` plays headlessly: melee wades in while above 40% HP, ranged kites, both step out of telegraphs and
sidestep shots, the ability is used on cooldown, boons are picked by a fixed priority, the first relic on offer is always taken and
ability-upgrade branches alternate per seed (A, B, A, B...). **It is a yardstick, not a good player**: it has no
target priority (priests!), no positioning plan for bosses and never uses obstacles. A human should beat these numbers by a few waves; what matters is the
spread between classes and the maxed / fresh ratio.

### Results: Squire, courtyard, 8 runs per cell

| Class | Fresh: avg wave (min-max) | Maxed: avg wave (min-max) | Ratio |
|---|---|---|---|
| Paladin | 7.5 (5-10) | 16.5 (7-30) | 2.20 |
| Viking | 5.8 (5-8) | 10.6 (5-15) | 1.85 |
| Angel | 8.0 (4-11) | 19.3 (8-47) | 2.41 |
| Necromancer | 7.0 (5-9) | 15.6 (8-30) | 2.23 |
| Archer | 7.1 (5-9) | 8.4 (5-10) | 1.18 |
| **All** | **7.1** | **14.1** | **1.99** |

Spread between classes (fresh): 1.39x.

### Results: Knight, courtyard, 4 runs per cell

| Class | Fresh | Maxed | Ratio |
|---|---|---|---|
| Paladin | 5.0 | 9.5 | 1.90 |
| Viking | 3.5 | 5.3 | 1.50 |
| Angel | 6.0 | 12.5 | 2.08 |
| Necromancer | 4.8 | 8.8 | 1.84 |
| Archer | 5.0 | 6.8 | 1.35 |
| **All** | **4.8** | **8.6** | **1.76** |

So a maxed character on Knight (8.6) lands a little above a fresh one on Squire (7.1): the tiers absorb the permanent power, as intended.

### What the simulation changed

The first pass was far off, and the fixes are all in config or one-liners:

| Finding | Fix |
|---|---|
| Every fresh run died at the first boss, mostly to contact damage | Boss contact cooldown 0.9 s -> 1.3 s, Black Knight charge x2 -> x1.7, boss HP cut earlier in v0.1 |
| Maxed Paladin / Angel reached wave 60 and the 45-minute cap (ratio 6x) | Quadratic enemy damage, steeper quadratic HP, attack-rate cap, armor cap 80% -> 75% |
| Viking with Undying + Wolfskin was effectively immortal | Cooldown pauses while the ability is active; leech cap per hit |
| Reliquary of Saints gave near-permanent Divine Shield when hit often | 0.04 s -> 0.02 s per Faith per hit |
| One run stalled for 30 minutes on a single unkillable straggler | Wave overtime |
| Viking, Archer, Necromancer lagged; Angel led | Viking HP/armor/regen/damage up and Rage cooldown 20 -> 13 s; Archer HP 70 -> 80, pierce 1, volley 16 -> 20; skeletons 45 -> 60 HP and 9 -> 11 damage; Radiance heal 20 -> 13 and cooldown 14 -> 16 s |

### Known outliers

- **Archer scales worst with the Keep (1.18x)** for the bot: it dies to burst (boss charges, cavalry), which more stats barely help and which the bot dodges poorly. Expect a human to get far more out of 205 move speed. Watch this one with real play data before buffing.
- **Variance is high for sustain classes when maxed** (Angel 8-47): runs that survive to tier 3 upgrades snowball for a while before the quadratic scaling catches them. If that feels wrong in play, raise `WAVES.dmg.quad` before touching the classes.
- Relic and ability-upgrade *combinations* are not searched by the bot (it takes the first relic offered). Expect stronger synergies than these averages show.
