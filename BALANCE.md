# Balance notes

## v0.12: the Cinderlands' balance pass (#232)

The release's last issue: every class through every level of the Cinderlands on Knight, against rule 9, with the bot playing the
realm as one run (`simulateRealm`, #220). The Marches and the Iron Hold were not retuned: no Cinderlands change touches their numbers.

**The sim says where a first try fell.** A level's row now holds the wave of the fall, whether the end boss stood then, and how long
the boss stood (`src/sim/levels.ts` `fellWave`, `fellBoss`, `bossSeconds`); `npm run sim -- levels` prints them as an "End bosses"
table. That is how the elite Grand Inquisitor, the Ember Queen and the Cinder Colossus were measured.

**The Cinderlands have level steps and wave lengths of their own** (`WORLD.levelStep.own`, `WORLD.levelWaves.own` in
`src/config/world.ts`; `logic/world.ts` reads a realm's own where it has them, a relic realm's otherwise). Until now every relic
realm shared one row, so easing the Cinder Colossus's level would have retuned the Iron King's.

**Tuned** (two passes):
- **The level step**: HP x0.77, 0.77, 0.83, 0.99, 0.95 and damage x0.85, 0.84, 0.98, 1.12, 0.95 (a relic realm's: 0.77, 0.77, 0.83,
  0.99, 1.07 and 0.92, 0.86, 0.93, 1.12, 1.23). Level 1 eases (burn stacks and the spreading fire cost first tries the Iron Hold's
  level 1 does not), level 3 hits a little harder, and the crown level eases most.
- **Wave length**: levels 2-4 bring foes x1.3, 1.25, 1.05 over a trickle x1.65, 1.7, 2 (a relic realm's: 1.2, 1.1, 0.95 over 1.5,
  1.5, 1.8): the realm ran 29 minutes clean against 35.
- **The Cinder Colossus** (`config/enemies.ts`, `config/damage.ts`): damage 18 (was 24), his fires 8 a second (was 10), his burn 2.2
  a stack (was 4; still two stacks a hit, and still the realm's hottest). His HP (1200) and his three 12-second phases stay: the bot
  already fells him in 39-41 s, 36 s being the least a crown boss stands. (Pass 1: damage 21, burn 2.8, the crown level's step
  HP x1 and damage x1.1, level 3 alone longer; it moved the crown level from 30% to 40%.)
- **Left alone: the Ember Queen and the elite Grand Inquisitor.** Pass 1 tried her on HP 1500 and damage 26 (1050, 22) and his
  Auto-da-fé's pyres on 3 s at 10 a second (2.5 s, 8): neither cost the bot one more first try, so pass 2 put both back. Against the
  bot they are not what a level is lost on (below); numbers a bot can't feel are not tuned on the bot.

What the level panel shows on Knight (Enemy HP): 335, 251, 237, 240, 200% (were 335, 251, 237, 240, 225%, the Iron Hold's).

`npm run sim -- levels 8 1 cinderlands`: 40 first tries a level on Knight (paladin, viking, angel, necromancer, archer; 8 seeds
each). First-try clear rate and a clear's median minutes. Target: about 90% at level 1 and 55-60% at level 5, falling evenly between.

| Level | Waves | Target | Before | Pass 1 | Pass 2 (now) |
|---|---|---|---|---|---|
| Cinderlands 1 | 1-8 | 90% | 83%, 4.6 | 85%, 4.7 | 85%, 4.7 |
| Cinderlands 2 | 9-16 | 82% | 80%, 5.2 | 80%, 5.2 | 88%, 5.4 |
| Cinderlands 3 | 17-24 | 73% | 88%, 5.4 | 80%, 6.0 | 78%, 5.9 |
| Cinderlands 4 | 25-32 | 65% | 68%, 6.1 | 68%, 6.2 | 63%, 6.9 |
| Cinderlands 5 | 33-40 | 55-60% | 30%, 7.6 | 40%, 7.5 | 55%, 7.5 |

Per class, first tries cleared of 8 (before -> pass 2):

| Level | Paladin | Viking | Angel | Necromancer | Archer |
|---|---|---|---|---|---|
| Cinderlands 1 | 8 -> 8 | 7 -> 7 | 8 -> 8 | 7 -> 7 | 3 -> 4 |
| Cinderlands 2 | 7 -> 7 | 6 -> 8 | 8 -> 8 | 8 -> 8 | 3 -> 4 |
| Cinderlands 3 | 8 -> 8 | 6 -> 5 | 8 -> 8 | 8 -> 6 | 5 -> 4 |
| Cinderlands 4 | 8 -> 7 | 4 -> 4 | 8 -> 8 | 6 -> 6 | 1 -> 0 |
| Cinderlands 5 (the crown) | 6 -> 6 | 1 -> 5 | 4 -> 7 | 1 -> 4 | 0 -> 0 |
| All five | 37 -> 36 of 40 | 24 -> 29 | 36 -> 39 | 30 -> 31 | 12 -> 12 |

The end bosses, measured (first tries lost of 40: in the waves before the boss / with the boss on the floor; the median seconds the
boss stood, from its arrival to the level's end):

| Level | End boss | Before | Pass 1 | Pass 2 (now) |
|---|---|---|---|---|
| Cinderlands 1 | a pool boss | 6 / 1, 30 s | 5 / 1, 31 s | 5 / 1, 31 s |
| Cinderlands 2 | the Grand Inquisitor | 7 / 1, 30 s | 7 / 1, 28 s | 4 / 1, 29 s |
| Cinderlands 3 | the Ember Queen | 5 / 0, 30 s | 8 / 0, 33 s | 9 / 0, 34 s |
| Cinderlands 4 | the Grand Inquisitor, Elite | 12 / 1, 34 s | 13 / 0, 32 s | 14 / 1, 36 s |
| Cinderlands 5 | the Cinder Colossus (crown) | 12 / 16, 41 s | 13 / 11, 39 s | 11 / 7, 39 s |

| Target (rule 9) | Before | Pass 2 | |
|---|---|---|---|
| About 90% at realm level 1 | 83% | 85% | 5 points under, within the band |
| 55-60% at realm level 5 | 30% | 55% | met |
| Falling evenly between | level 3 88% against 73%, level 5 30% against 57% | widest: level 2 88% against 82%, level 3 78% against 73% | within 20% |
| A realm's level 1 takes 4-6 minutes | 4.6 | 4.7 | met |
| A realm's last level takes 7-10 minutes | 7.6 | 7.5 | met |
| A realm in about 35 minutes clean, 45 with retries | 29.3 / 45.4 | 30.8 / 39.5 | clean met (within 5), with retries half a minute short |
| A 6-set in most crown-level clears | 100% | 100% | met |
| Relic moments per findable relic 0.4-0.6 (the realm played through) | 0.39 | 0.39 | just outside, as the Iron Hold's 0.38 |
| Power at a level's first wave within 15% of a continuous run | 0 of 4 levels | 0 of 4 levels | not comparable (#220) |

What the numbers say, and what is left after two passes (the plan's gate rule: reported, not tuned further):
- **The Archer crowns the Cinderlands on none of 8 first tries, and clears level 4 on none** (4 of 8 at levels 1-3), against 4-8 of 8
  for the other four at every level: 12 of 40 first tries, where the Paladin clears 36, the Angel 39, the Necromancer 31 and the
  Viking 29. It is the Iron Hold's finding again (0 of 8 at the Iron King), and the pass did not move it: easing the crown level
  lifted the Viking (1 -> 5), the Angel (4 -> 7) and the Necromancer (1 -> 4) and left the Archer at 0. The bot underrates the
  Archer (AGENTS.md), but two realms in a row say the same: it needs the Archer itself looked at (v0.15.0's classes, or a
  hand-played check of the Cinder Colossus), not a level step. Without the Archer the other four clear 69% of their crown tries.
- **The Cinder Colossus was the one boss that decided a level**: he felled 16 of the 28 first tries that reached him, now 7 of 29.
- **The Ember Queen fells no first try and the elite Inquisitor one in 40.** The bot loses levels 1-4 in their waves (burn stacks
  from Torchbearers, the spreading fire, Cinder Hounds' bursts), and meets each boss with the floor cleared: it dodges every marked
  blow, so a boss whose lessons are all marked costs it nothing, whatever her HP. Their clear rates sit within the band through the
  waves. Whether the Queen and the Auto-da-fé are too mild for a player is a hand-played question the sim can't answer.
- The per-level rates carry about 8 points of noise at 40 tries: levels 2 (6 points over) and 3 (5 over) are inside it.

The golden level runs (tests/v10-level-golden.test.ts) gained the Cinderlands' level 1 and a realm run of its levels 1-2; no other
run moved. `npm run test:perf` has an Ember Forge scene: a Cinderlands level in its own arena, 250 foes (141 of them Torchbearers
and Cinder Hounds), its fire spreading over the floor (up to 8 slabs alight at once), p95 16.7 ms.

## v0.11: the Iron Hold's balance pass (#220)

The release's last issue: every class through every level of the Marches and the Iron Hold on Knight, against rule 9.

**The bot now plays a realm as a player does** (`src/sim/levels.ts simulateRealm`, which `npm run sim -- levels` runs). Until now it
played each level on its own: a later level started with the 3-relic loadout and the bot's build, and none of what a realm run carries
(#237). It did spend its champion's stat points, ability tiers and talent points (`botBuild`), but it entered the Marches' level 7 with 4
relics where a run holds 18. Now one run goes from level 1 to the crown: each level goes on from the checkpoint of the one before
(relics at their tiers, gold, the build), the champion banks each clear's XP and the bot spends its points before the next level. A
fall counts as that level's first try lost; the bot is raised where it fell and plays the level out, so the run reaches the later levels
as a player's retry does. That alone moved the Marches' levels 2-7 from 0-25% to 60-90%, and showed the late levels as too easy, not
too hard.

**Tuned** (two passes), in `src/config/champion.ts` and `src/config/world.ts`:
- **Enemy scaling by champion level** (`CHAMPION.scaling`, `logic/championLevels championStep`): the pace is read at the level's end
  (`at` 1, was midway), a run level's strength is 0.2 (`perRunLevel`, was 0.12) and a champion's run levels count 0.9 each (`worth`,
  was 0.8). The early levels, whose waves span the most pace levels, ease the most. The Marches: x0.45, 0.58, 0.67, 0.75, 0.82, 0.75,
  0.69 (were 0.74, 0.72, 0.74, 0.78, 0.82, 0.74, 0.69); the Iron Hold: x2.81, 2.10, 1.84, 1.56, 1.36 (were 2.95, 2.06, 1.74, 1.47,
  1.28). The Last Bastion keeps its first fit (`scaling.finale`) until its own release.
- **The level step** (`WORLD.levelStep`), up from its floor where a run's relics made a level too easy: the Marches HP x0.89, 0.72,
  0.74, 0.82, 0.88, 1.1, 0.93 and damage x1.02, 0.82, 0.84, 0.93, 1, 1.25, 1.06 (were 0.72 and 0.82 throughout); a relic realm HP
  x0.77, 0.77, 0.83, 0.99, 1.07 and damage x0.92, 0.86, 0.93, 1.12, 1.23 (were 0.75, 0.8, 0.75, 0.72, 0.72 and 0.9, 0.88, 0.84, 0.82,
  0.82). Level 1 steps up only to stay where it was: champion scaling eases it most.
- **The elite end boss** (`WORLD.eliteBoss`): HP x1.4 and damage x1.15 on top of its extra phase (it had its plain self's numbers).
- **The Marches' level 1** brings foes x1.6 over a trickle x2.8 (`WORLD.levelWaves`, were 1.5 and 2.5): eased, it ran 3.9 minutes.

What the level panel shows on Knight (Enemy HP): the Marches 59, 60, 72, 89, 105, 119, 93% (were 77, 75, 77, 81, 86, 78, 72%); the Iron
Hold 335, 251, 237, 240, 225% (were 343, 256, 203, 164, 143%).

`npm run sim -- levels 8 1 marches,ironHold`: 40 first tries a level on Knight (paladin, viking, angel, necromancer, archer; 8 seeds
each; "before" and "the bot as a run" 4 seeds, 20 tries). First-try clear rate and a clear's median minutes. Target: about 95% at the
Marches' level 1, 90% at a realm's level 1 and 55-60% at its last, falling evenly between.

| Level | Waves | Target | Before (levels on their own) | The bot as a run, nothing tuned | Pass 1 | Pass 2 (now) |
|---|---|---|---|---|---|---|
| Marches 1 | 1-6 | 95% | 75%, 4.2 | 75%, 4.2 | 90%, 3.9 | 93%, 4.2 |
| Marches 2 | 7-12 | 89% | 5%, 4.2 | 65%, 4.4 | 68%, 4.5 | 75%, 4.3 |
| Marches 3 | 13-18 | 83% | 25%, 6.4 | 70%, 4.3 | 78%, 4.4 | 78%, 4.3 |
| Marches 4 | 19-24 | 77% | 10%, 6.8 | 75%, 5.2 | 85%, 5.2 | 78%, 5.0 |
| Marches 5 | 25-30 | 70% | 15%, 7.4 | 75%, 5.2 | 85%, 5.2 | 65%, 5.3 |
| Marches 6 | 31-35 | 64% | 10%, 6.6 | 90%, 4.6 | 92%, 4.6 | 74%, 4.6 |
| Marches 7 | 36-40 | 58% | 0% | 60%, 5.1 | 79%, 5.2 | 59%, 5.2 |
| Iron Hold 1 | 1-8 | 90% | 95%, 4.6 | 95%, 4.6 | 85%, 4.6 | 93%, 4.6 |
| Iron Hold 2 | 9-16 | 82% | 75%, 6.1 | 80%, 5.5 | 80%, 5.7 | 78%, 5.6 |
| Iron Hold 3 | 17-24 | 73% | 75%, 7.4 | 85%, 6.0 | 83%, 5.8 | 70%, 5.8 |
| Iron Hold 4 | 25-32 | 65% | 70%, 8.0 | 90%, 6.7 | 93%, 6.7 | 78%, 7.1 |
| Iron Hold 5 | 33-40 | 55-60% | 30%, 8.5 | 85%, 7.8 | 78%, 7.8 | 53%, 8.2 |

Per class, first tries cleared of 8 (pass 2):

| Level | Paladin | Viking | Angel | Necromancer | Archer |
|---|---|---|---|---|---|
| Marches 1 | 8 | 8 | 7 | 8 | 6 |
| Marches 2 | 5 | 7 | 8 | 5 | 5 |
| Marches 3 | 4 | 7 | 8 | 7 | 5 |
| Marches 4 | 5 | 7 | 8 | 6 | 5 |
| Marches 5 | 5 | 5 | 8 | 4 | 4 |
| Marches 6 | 5 of 7 | 7 | 8 | 5 | 4 |
| Marches 7 (the crown) | 4 of 7 | 5 | 8 | 4 | 2 |
| Iron Hold 1 | 8 | 8 | 8 | 8 | 5 |
| Iron Hold 2 | 6 | 8 | 8 | 7 | 2 |
| Iron Hold 3 | 4 | 6 | 8 | 8 | 2 |
| Iron Hold 4 | 7 | 7 | 7 | 8 | 2 |
| Iron Hold 5 (the crown) | 5 | 4 | 8 | 4 | 0 |

| Target (rule 9) | Before | Pass 2 | |
|---|---|---|---|
| First-try clear about 95% at Marches level 1 | 75% | 93% | met |
| About 90% at realm level 1 (Iron Hold) | 95% | 93% | met |
| 55-60% at realm level 5 (Iron Hold) | 30% | 53% | 2 points under |
| Falling evenly between | Marches 2-7 0-25% | widest: Marches 2 75% against 89%, Marches 6 74% against 64%, Iron Hold 4 78% against 65% | within 20%, Iron Hold 4 at it |
| The Marches' level 1 takes at least 4 minutes | 4.2 | 4.2 | met |
| A realm's level 1 takes 4-6 minutes (Iron Hold) | 4.6 | 4.6 | met |
| A realm's last level takes 7-10 minutes (Iron Hold) | 8.5 | 8.2 | met |
| A realm in about 35 minutes clean, 45 with retries (Iron Hold) | 36.0 / 53.4 | 32.2 / 42.1 | met |
| A 6-set in most crown-level clears | Marches 7 no clears, Iron Hold 5 17% | Marches 7 22%, Iron Hold 5 100% | the Marches missed |
| Relic moments per findable relic 0.4-0.6 (a realm played through) | Marches 0.45, Iron Hold 0.43 | 0.66, 0.38 | both just outside |
| Power at a level's first wave within 15% of a continuous run | 1 of 10 levels | 1 of 10 levels | not comparable |

Still missed after two passes (the plan's gate rule: reported, not tuned further):
- **The Archer at the Iron Hold's crown: 0 first tries of 8** (2 of 8 at levels 2-4, 2 of 8 at the Marches' crown), against 4-8 of 8
  for the other four. The average sits on the target, the spread between the classes does not: the bot's Angel clears 55 of 56
  first tries past the Marches' level 1, its Archer 27 of 96. The bot underrates the Archer (AGENTS.md), but a level step cannot
  close a gap between classes; it needs the Archer itself looked at (v0.15.0's classes, or a hand-played check of the Iron King).
- **A 6-set in most Marches crown clears: 22%.** Each Marches level features another family, so a run ends on 18 relics spread over
  seven families.
- **Power against a continuous run** no longer measures anything in a relic realm: a level-8 champion walks into wave 1 (+698%).
  In the Marches a champion held at level 5 stands 35-44% under a run's level-up power at levels 5-7, and its carried relics (13-18
  against 8-13) make up for it; the clear rates are the measure.
- The per-level rates carry about 8 points of noise at 40 tries, so Marches 2 (75% against 89%) and Marches 6 and Iron Hold 4 (10-13
  points over) are the ones a later pass should look at first.

The golden level runs (tests/v10-level-golden.test.ts) were re-recorded, with the Iron Hold's level 1 and a realm run of its levels
1-2 added. `npm run test:perf` has a fortress scene: an Iron Hold level in the Great Keep, 250 foes (138 of them the realm's own)
under its forge presses, p95 16.8 ms.

## v0.11: longer levels (#243)

Jesse's playtest (#234): level 1 was over in two minutes. A relic realm's five levels are 8 waves each (1-8, 9-16, 17-24, 25-32, 33-40; were
5, 5, 10, 10, 10) and the Marches' seven 6, 6, 6, 6, 6, 5, 5 (1-6, 7-12, 13-18, 19-24, 25-30, 31-35, 36-40; were 5 each and 10). Rule 9's
targets, as a clear's median minutes on Knight: a realm's level 1 4-6, its last level 7-10, the Marches' level 1 at least 4.

- **A level runs on its own waves** (`logic/world ownWaves`, `bossWaveIn`): its one boss wave is its last. The scale's boss waves inside a
  level (x5, x0) are plain waves with their full host, and an Act that ends inside a level moves on with no Merchant and no fork. The
  Last Bastion, the Daily Trial and a plain run keep the 40-wave scale (the v0.8 golden runs did not move).
- **Wave length, in levels only** (`WORLD.levelWaves`, `logic/world levelWaves`): `foes` multiplies the foes a wave brings (the director's
  budget) and `pace` the time they trickle in over. The Marches: foes 1.5, 0.9, 0.9, 0.9, 0.9, 0.8, 0.8 and pace 2.5, 2, 2, 2, 2, 2.2, 2.2;
  a relic realm: foes 1.6, 1.2, 1.1, 0.95, 0.9 and pace 2, 1.5, 1.5, 1.8, 2.2. Early levels, which a champion walks through, get more
  foes; late levels get a slower trickle, which lengthens a level and eases it. A foe's XP is divided by `foes`, so a level pays what
  its waves pay at the pace.
- **The level step** (`WORLD.levelStep`), tuned again: the Marches HP x0.72 and damage x0.82 on every level (were 0.85-0.9); a relic realm
  HP x0.75, 0.8, 0.75, 0.72, 0.72 and damage x0.9, 0.88, 0.84, 0.82, 0.82 (were 0.7, 0.85, 0.9, 0.9, 0.9 and 0.85, 0.9, 0.9, 0.9, 0.9).
  0.72 and 0.82 are its floor: a level on Knight stays harder than on Squire (145% x 0.72 = 104%, 125% x 0.82 = 103%).
- **Champion XP** (`CHAMPION.xp.perLevel`): 180 x the level (was 140), at most 840. The Marches' levels pay 252, 612, 768, 816, 864, 822
  and 912 XP at the pace (were 180 to 1734), so a first pass still gives a level per level up to the cap of 5, and level 8 at the crown
  (the level the Iron Hold's first level expects).

`npm run sim -- levels 4 1 marches,ironHold`: 20 first tries a level on Knight (paladin, viking, angel, necromancer, archer; 4 seeds
each), a level on its own with expected progress. Clear rate and a clear's median minutes; "new shape" is the new splits and boss
rule with nothing tuned:

| Level | Before (release/0.11.0) | New shape | Pass 1 | Pass 2 (now) |
|---|---|---|---|---|
| Marches 1 | 85%, 2.8 (waves 1-5) | 75%, 3.4 | 80%, 3.5 | 75%, 4.2 |
| Marches 2 | 20%, 3.8 (6-10) | 0% | 5%, 5.0 | 5%, 4.2 |
| Marches 3 | 30%, 4.8 (11-15) | 10%, 6.8 | 25%, 6.7 | 25%, 6.4 |
| Marches 4 | 20%, 5.6 (16-20) | 10%, 6.8 | 15%, 6.3 | 10%, 6.8 |
| Marches 5 | 10%, 5.5 (21-25) | 5%, 6.9 | 20%, 6.9 | 15%, 7.4 |
| Marches 6 | 5%, 6.2 (26-30) | 0% | 0% | 10%, 6.6 |
| Marches 7 | 0% (31-40) | 0% | 0% | 0% |
| Iron Hold 1 | 100%, 1.9 (1-5) | 100%, 3.2 | 95%, 4.0 | 95%, 4.6 |
| Iron Hold 2 | 90%, 2.6 (6-10) | 65%, 5.9 | 65%, 5.9 | 75%, 6.1 |
| Iron Hold 3 | 70%, 6.3 (11-20) | 75%, 6.4 | 55%, 6.8 | 75%, 7.4 |
| Iron Hold 4 | 60%, 7.9 (21-30) | 45%, 7.1 | 50%, 6.9 | 55%, 8.3 |
| Iron Hold 5 | 35%, 8.7 (31-40) | 20%, 6.9 | 35%, 7.7 | 30%, 8.5 |

| Target | Before | Pass 2 | |
|---|---|---|---|
| The Marches' level 1 takes at least 4 minutes | 2.8 | 4.2 | met |
| A realm's level 1 takes 4-6 minutes (Iron Hold) | 1.9 | 4.6 | met |
| A realm's last level takes 7-10 minutes (Iron Hold) | 8.7 | 8.5 | met |
| A realm in about 35 minutes clean, 45 with retries (Iron Hold) | 28.8 / 40.1 | 36.0 / 56.1 | clean met |
| First-try clear about 95% at Marches level 1 | 85% | 75% | missed by 21% |
| About 90% at realm level 1 (Iron Hold) | 100% | 95% | met |
| 55-60% at realm level 5 (Iron Hold) | 35% | 30% | missed by 45% |

Pass 1: the level step eased (the Marches to HP 0.72-0.75 and damage 0.82), foes up on the first levels (the Marches 1.3, a realm 1.5,
1.2, 1.1) and the pace stretched 1.3-1.5. It moved the minutes little: a small wave's trickle is 4 seconds, so stretching it by half adds
next to nothing, and the time goes into the fight. Pass 2: the numbers above (more foes and a trickle 2-2.5 times as long on the first
levels, fewer foes and a slower trickle on the late ones).

Still missed after two passes (the plan's gate rule: reported, not tuned further): Marches level 1 at 75% and the Iron Hold's level 5 at
30%, with the level step at its floor just over Squire's. Neither was met before this issue either (85%, 35%; 20 tries a level put about
10 points of noise on each). The Marches past level 1 stay the hard end, as #238 noted: 0-25% before and after, with a champion held at
level 5 from level 5 to the crown against waves 25-40 (enemy scaling's `worth` and the expected champion levels are #238's levers, not
this issue's). The golden level runs (tests/v10-level-golden.test.ts) were re-recorded.

## v0.11: champion levels (#238)

No level-up inside a level any more: a champion keeps one level all level long, and enemies scale to the champion level a level expects.
In `src/config/champion.ts`:
- **A champion level** is worth 5 of the old run levels (`runLevels`: five times the class's growth), gives 3 stat points (each two rare
  boons of its stat: +10 attack stat, +80 HP, +32% of base attack speed, +6 secondary) and a talent point; an ability or utility tier
  costs 2 stat points. The cap is 5 + 5 per crown, at most 30.
- **Champion XP**: a level costs 140 × the level, at most 840. The Marches' levels pay 180, 480, 558, 726, 639, 729 and 1734 XP at the
  pace, so a first pass gives a level per level up to the cap of 5 and level 9 at the crown; a replay banks a quarter.
- **Enemy scaling** (`scaling`, `logic/championLevels championStep`, folded into a level's tier with the ring step and the level step):
  enemy HP and damage × the expected champion's strength over that of the player the waves were tuned for (the pace's level midway
  through them), strength being 1 + 0.12 per run level and a champion's run levels counting 0.8 each. The Marches: ×0.77, 0.78, 0.81,
  0.85, 0.89, 0.81, 0.71 (expected level 1, 2, 3, 4, 5, 5, 5); the Iron Hold: ×3.35, 2.55, 2.01, 1.55, 1.30 (expected level 8, 9, 10, 10, 10).

Measured with the bot on Knight, 12 first tries a level (paladin, viking, angel, archer, 3 seeds each), a level on its own with expected
progress as `npm run sim -- levels` plays it; before is release/0.11.0 with the head start and in-level level-ups:

| Level | Before | After |
|---|---|---|
| Marches 1 | 12/12 | 11/12 |
| Marches 2 | 4/12 | 4/12 |
| Marches 4 | 5/12 | 3/12 |
| Marches 7 | 1/12 | 0/12 |
| Iron Hold 1 | 12/12 | 12/12 |
| Iron Hold 3 | 6/12 | 8/12 |
| Iron Hold 5 | 5/12 | 5/12 |

A first fit, not a tuning pass: `worth` 1 (no discount) cleared no Marches level 4 and 2/12 of Iron Hold 5. The Marches' late levels
(a level-5 champion at waves 16-40, the cap before the crown) stay the hard end; the release's balance issue tunes every level on these
numbers. The golden level runs (tests/v10-level-golden.test.ts) were re-recorded.

## v0.10: two tuning passes toward rule 9 (#221)

`npm run sim -- levels 6 1 marches,ironHold,lastBastion` (30 first tries a level on Knight with expected progress, as #207). Changed, in
`src/config/world.ts`:
- **A level step on enemies** (`WORLD.levelStep`, new; `logic/world levelStep`, folded into a level run's tier with the ring step and shown
  in the level panel's Enemy HP): the Marches HP and damage ×0.85 on level 1 and ×0.9 on levels 2-7; a relic realm HP ×0.8 / 0.85 / 0.9 /
  0.9 / 0.9 and damage ×0.85 / 0.9 / 0.9 / 0.9 / 0.9 by level. The Last Bastion keeps 1. On Knight every level stays above Squire.
- **Late head-start boons** (`WORLD.headStart.lateRarity`, `lateFrom`): the levels from 11 on give epic boons (was rare), so a head start
  keeps up with a run that played those waves and holds twice the relics. A trial with every boon epic put Marches 2-3 at +19-22% power.

| Target (rule 9) | Before | Pass 1 | Pass 2 |
|---|---|---|---|
| First-try clear about 95% at Marches level 1 | 80% | 97% | 97% |
| About 90% at realm level 1 (Iron Hold) | 57% | 80% | 80% |
| 55-60% at realm level 5 (Iron Hold) | 33% | 57% | 57% |
| Power within ±15% of a continuous run | 4/10 levels; widest Marches 6 -21% | 10/10; widest Marches 6 -8% | 10/10; widest Marches 6 -8% |
| A 6-set in most crown-level clears | Marches 7 0%, Iron Hold 5 40% | Marches 7 0%, Iron Hold 5 35% | Marches 7 0%, Iron Hold 5 35% |
| Last Bastion (6-set in wins, before wave 10, duos, minutes) | 88%, 30%, 1.38 / 13%, 28.7 | unchanged (no level step, no head start) | unchanged |
| Relic moments per findable relic | Marches 0.50, Iron Hold 0.45 | 0.61, 0.51 | 0.62, 0.51 |
| A 5-wave / 10-wave level, minutes | 4.0 / 9.4 | 3.8 / 9.0 | 3.8 / 8.9 |
| A realm clean / with retries (Iron Hold) | 32.6 / 50.9 | 31.7 / 39.9 | 31.7 / 39.8 |

Per level, clear rate (before -> pass 1): Marches 80->97%, 20->50%, 23->27%, 17->47%, 17->47%, 23->47%, 13->13%; Iron Hold 57->80%,
33->57%, 47->63%, 67->77%, 33->57%. Power gap: Marches +5, -3, -6, 0, -8, -6%; Iron Hold +5, -3, -4, -7%.

**Pass 2** (measured again before it on the merged branch: the pass 1 numbers, unchanged): realm level 1 HP ×0.7 (was 0.8), and the
Marches levels 3 and 7 HP and damage ×0.85 (was 0.9). On Knight realm level 1 still sits above Squire (145% × 0.7 = 102%).

Per level, clear rate (pass 1 -> pass 2): Marches 97->97%, 50->50%, 27->30%, 47->47%, 47->47%, 47->47%, 13->13%; Iron Hold 80->80%,
57->57%, 63->63%, 77->77%, 57->57%. Realm level 1 did not move: its falls are the bot's archer on 3 seeds in 6 and one angel, all at
wave 5's mid-Act boss, where a lighter HP step changes little (the bot underrates the Archer, AGENTS.md). Marches level 7 stays at 13%.

Still missed after two passes (the plan's gate rule: reported, not tuned further): realm level 1 80% vs about 90% (11% under, within the
20% the plan accepts); and, not moved by this issue's levers, a 6-set in crown-level clears (Marches 7 0%, Iron Hold 5 35% vs most), the
Last Bastion's 6-set before wave 10 (30% of runs vs none) and its length (28.7 minutes vs 35-45), the Marches' relic moments (0.62 vs
0.4-0.6) and a realm's clean time (Iron Hold 31.7 vs about 35 minutes).

## v0.10: realm levels and the plan's rule 9 targets (#207)

The targets for the Road to the Crown ([docs/road-to-the-crown.md](docs/road-to-the-crown.md), rule 9), measured by `npm run sim -- levels`
(`src/sim/levels.ts`, `scripts/level-report.ts`). Each run is a **first try on Knight with expected progress**: the champion has first-cleared
every earlier level (and crowned the realms that open this one), the bot taking the first option of each reward; no Keep ranks and no
mastery, so the Keep's extra slots and levels are headroom on top. The bot fills the level's slots from that inventory under the slot rules
(`botLoadout`: its signature relic, then one family toward a set, the featured family first). The Iron Hold stands in for "a relic realm"
(its arena and bosses are not built yet, so it plays in the Great Keep with pool bosses). **Power** is a static index,
sqrt(basic attack damage per second × effective HP), at the level's first wave, against a continuous Knight run revived on death at that
wave; relic procs and sets are not in it.

Measured on release/0.10.0 after #200 (`npm run sim -- levels 6 1 marches,ironHold,lastBastion`, 30 first tries a level, 959 s). No tuning
yet: this is the baseline the release's balance pass works from.

| Target (rule 9) | Measured | Missed by |
|---|---|---|
| First-try clear about 95% at Marches level 1 | 80% | 15 points |
| About 90% at realm level 1 | 57% (Iron Hold) | 33 points |
| 55-60% at realm level 5 | 30% (Iron Hold) | 25 points |
| Power at a level's first wave within ±15% of a continuous run | 4 of 10 levels (Marches 2-3, Iron Hold 2-3); Marches 4 -16%, 5 -15%, 6 -21%, 7 -20%, Iron Hold 4 -18%, 5 -21% | up to 6 points past the band |
| A 6-set in most crown-level clears | Marches 7 0%, Iron Hold 5 33% | Marches 7 by 50+ points; Iron Hold 5 by 17+ |
| A 6-set in most Last Bastion wins | 88% | met |
| No 6-set before wave 10 in the Last Bastion | 30% of runs have one | 30% |
| 1-2 duos per Last Bastion win; 3+ in under 15% | 1.38; 13% | met |
| Relic moments per findable relic 0.4-0.6 (a realm played through) | Marches 0.50, Iron Hold 0.45 | met |
| A 5-wave level about 4 minutes, a 10-wave level 8-10 | 4.0 (2.2-5.7) and 9.3 (7.7-10.1) on average | met on average |
| A realm about 35 minutes clean, 45 with retries | Iron Hold 32.6 / 53.0 | retries 8 minutes over |
| The Last Bastion 35-45 minutes | 28.7 (a win) | 6 minutes under |
| Every family's 6-set within ±15% of the class median; every relic 3-35% | not in this table: `npm run sim -- relics 3 loadout` | |

Per level (clear rate, then minutes of a clear): Marches 80% 2.6, 20% 3.9, 23% 4.8, 17% 5.7, 17% 4.8, 23% 5.1, 13% 10.1; Iron Hold 57% 2.2,
33% 3.2, 47% 7.7, 67% 9.3, 30% 10.1; the Last Bastion 27% 28.7. The fresh Knight bot is the weak point: past Marches level 1 it clears about
a fifth of the Marches levels, and a plain Knight run by it rarely passes wave 10. The head start falls behind the continuous run from wave
16 on: by then the continuous run has picked about twice the relics (5.6-11.5 against a loadout of 3-5), and its level-up cards beat the
head start's fixed boons. In the Last Bastion a 5-slot loadout of one family plus the opening pick makes a 6-set before wave 10 in 30% of runs.

`npm run sim -- relics [runs] loadout` runs the relic tables on the Last Bastion with the bot's loadout (maxed saves, 6 slots). A 1-run
smoke on the same code: 2 of 5 won, both at a 6-set, power index 4.23 (a loadout's relics deal their share from wave 1, so the index is
far over the 1.8-2.2 a run from zero reads).

## v0.10: the starter commons (#196)

Target: every starter common 3-35% of what it does where held (`npm run sim -- relics 8`, 40 runs, maxed saves; "Contribution from wave 21 on").
Changed in `src/config/relics.ts` (tier I / II):
- **Emberheart** +30% / 40% -> +60% / 80% damage per burning enemy.
- **Frost Brand** 35% / 50% chance, 3 chill -> 90% / 100% chance, 1 chill (a chill that builds up to the freeze instead of freezing on the second proc).
- **Serrated Edge** 3 / 4 bleed stacks at 60% -> 7 / 8 stacks at 100% of the hit per second (pass 3 added the seventh / eighth stack).
- **Berserker Tooth** +1% attack speed per 1% / 0.75% of HP missing (max 60% / 75%) -> a flat +10% / 15% (pass 3, `flat`), and +1% more
  per 0.1% / 0.08% missing (max 80% / 100%), so it works at full HP too.
- **Winter's Grasp** unchanged (pass 1 tried 3 / 4 chill: 0.2%, and lost the freeze, so it went back to 5 / 7). Pass 3 changed what the share
  measures instead: the damage an enemy takes while a relic's freeze holds it counts for that relic (`frozenHit.<relic>` in `g.vars`, read by
  `scripts/relic-report.ts`), as a chill's extra damage and a Shatter already did.

| Pass | Won | Power index (Acts II-III) | Emberheart | Frost Brand | Serrated Edge | Berserker Tooth | Winter's Grasp |
|---|---|---|---|---|---|---|---|
| Before | 35 | 1.86 | 2.5% | 1.1% | 2.1% | 0.3% | 0.0% |
| Pass 1 | 33 | 1.89 | 5.0% | 2.4% | 2.9% | 1.0% | 0.2% |
| Pass 2 | 34 | 1.90 | 4.5% | 3.4% | 2.9% | 0.9% | 0.0% |
| Pass 3 | 34 | 1.85 | 4.7% | 4.9% | 2.9% | 2.6% | 7.6% |

Pass 3 (8 / 11 / 9 / 11 / 6 runs holding each at wave 20): every set target still holds (6-set 11.8%, 1.56 duos, 3+ duos 11.8%, power
index Act II 1.64, Act III 2.14). Emberheart, Frost Brand and Winter's Grasp are in the band. **Serrated Edge (2.9%) and Berserker Tooth
(2.6%) stay just under 3%**, which is accepted: the bot is rarely hurt, so Berserker Tooth's missing-HP part still reads near zero, and
more bleed stacks moved Serrated Edge no further than pass 1 did.
The golden runs (`tests/v8-golden.test.ts`) were re-recorded for these changes.

## v0.8: the balance pass (#125)

Measured on release/0.8.0 with every other v0.8 change in (the boss pool #99, arena families #100, enemy tiers #101, the capped Bone Colossus
#126, the Usurper's 8 s last phase #127). Changed, in `src/config` only:
- **Necromancer**: HP 85 -> 100, HP growth 5 -> 6, 3 skeletons a cast (was 2): the candidate values from B8 (v0.7.3). Capping the Colossus
  (#126) took the maxed bot from wave 32 (v0.7.3) to about 18.
- **Thorn Mail** 16× -> 20× (tier II 22× -> 28×), **Emberheart** +20% -> +30% per burning enemy (tier II 25% -> 40%), **Serrated Edge**
  3 bleed stacks (tier II 4), **Frost Brand** 3 chill, **Winter's Grasp** 5 chill (tier II 7), **Berserker Tooth** +1% attack speed per 1% HP
  missing up to 60% (tier II per 0.75%, up to 75%).

**Classes.** `npm run sim` (6 runs a cell) and `npm run sim -- pacing` (4 runs a cell), maxed:

| | `sim` maxed avg wave (range) | `sim` maxed wins | `pacing` maxed wave | `pacing` maxed wins | `relics 8` wins |
|---|---|---|---|---|---|
| Paladin, before | 35.8 (15-40) | 5/6 | 40.0 | 4/4 | 8/8 |
| Viking, before | 40.0 (40-40) | 6/6 | 40.0 | 4/4 | 8/8 |
| Angel, before | 40.0 (40-40) | 6/6 | 40.0 | 4/4 | 8/8 |
| Archer, before | 40.0 (40-40) | 5/6 | 40.0 | 3/4 | 4/8 |
| Necromancer, before | 20.8 (6-40) | 2/6 | 17.8 | 1/4 | 5/8 |
| **Necromancer, after** | **34.3 (6-40)** | **4/6** | **31.5** | **2/4** | **7/8** |

`npm run sim -- deep` (3 runs a cell) before: maxed Paladin 64.7, Viking 55.0, Angel 71.7, Archer 50.7, Necromancer 10.3. The Archer is
left alone: maxed it reaches wave 40 like the top three, and the bot underrates it (README, Simulation). Fresh runs are seed noise at 6 runs
(the fresh Necromancer read 20.7 before and 12.5 after, ranges 10-40 and 4-30).

**Relics.** `npm run sim -- relics 8` (40 runs, maxed saves):

| | Won | 6-set in winning runs | Duos a winning run | 3+ duos | Power index (Acts II-III) | Held relics under 3% (8+ runs) |
|---|---|---|---|---|---|---|
| Before | 33 | 12.1% | 1.39 | 9.1% | 1.81 (1.56 / 2.17) | Thorn Mail 2.8%, Emberheart 2.2%, Frost Brand 1.5%, Serrated Edge 1.5%, Winter's Grasp 0.4%, Berserker Tooth 0.3% |
| After | 34 | 11.8% | 1.32 | 5.9% | 1.84 (1.57 / 2.23) | Emberheart 2.8%, Serrated Edge 1.7%, Frost Brand 1.2%, Berserker Tooth 0.3%, Winter's Grasp 0.3% |

Every set target is met. Thorn Mail moved into the band (3.6%). Frost Brand, Winter's Grasp and Berserker Tooth hardly moved: their work is
control (chill, attack speed while hurt) that the share cannot see, as in v0.7. Over 35%: Bone Chime (69%), Hallowed Bones (48%), both in
1 run of 40, and Guardian's Aegis (35.4%, was 28.8%, unchanged numbers), whose ward is credited when gained; none is changed on this data.

**Bosses.** No one-ability kills: the resolve (#95) holds. In `relics 8` the fastest boss fight was 7.2 s (before 7.3 s), 31 of 298 fights
under 10 s (before 33 of 299), Act and mid-Act medians 16-28 s, and the Usurper 43.9 s at the fastest (median 60 s). Nothing changed.

**Pacing.** `npm run sim -- pacing` before: 0 of 40 runs break the 90 s rule; maxed winning runs take 24-34 minutes.

The golden runs (`tests/v8-golden.test.ts`) are re-recorded for these changes.

## v0.7.5: a duo combines its two relics (#96)

A duo no longer counts as a third relic for both its families (RELICS.md), so 6-sets fell from 41-65% of winning runs to 7.7%. Jesse's
target (on #96): **a 6-set in about 15% of winning runs**, rarer than before but a noticeable power-up. Offers now lean 1.6× toward the
families you hold (`RELIC_MOMENTS.heldFamilyWeight` in `config/relics.ts`, was 1).

| `npm run sim -- relics 4` (20 runs) | 6-sets in winning runs | Duos a winning run | 3+ duos | Power index (Acts II-III) |
|---|---|---|---|---|
| Duo combines, lean 1 | 7.7% | 1.00 | | 2.04 |
| Duo combines, lean 1.6 | 15.4% (Flame 2, Holy 2, Frost 1, Steel 1) | 1.00 | 7.7% | 2.04 (Act II 1.60, Act III 2.98) |

## v0.7.5: a boss's resolve (#95)

A playtest (#93) had the Usurper die about 10 seconds in to one Volley from a 6 Flame / 6 Storm build. Bosses now have **resolve**
(`BOSS_RESOLVE` in `config/damage.ts`, `throughResolve` in `logic/status.ts`): up to 15% of a boss's max HP lands in full at once, that
allowance refills at 10% a second, damage past it does 25% of itself, and no burst takes more than 35%. Status ticks (burn, bleed, poison)
count too: they were how the relic builds melted bosses. Ordinary fights stay under the allowance, so they don't change.

`npm run sim -- relics 3` (maxed saves, the family-following bot, 15 runs), with the new boss-fight table (seconds from a boss's arrival to
its death):

| | Boss fights | Under 10 s | Fastest | Fastest Usurper | Runs won |
|---|---|---|---|---|---|
| Before | 99 | 31 | 1.1 s | 20.2 s | 9 |
| After | 97 | 11 | 7.2 s | 70.8 s | 8 |

The Act bosses' medians went from 14-20 s to 18-29 s. Fresh runs (`npm run sim -- 3`, and the fresh bot fights logged one by one) barely
fill the allowance: a fresh boss fight ends with the resolve under 5% loaded, so their wave spread is seed noise, not the resolve. A first try
at 6% a second did cost fresh runs their close wave-5 fights; that is why the allowance is this wide.

## v0.7.3: the class spread (B8, #22)

`npm run sim -- deep 6` per class (`SIM_CLASS`, one process each), on v0.7.3 with the Archer's aim fix (#59) and the Paladin's shield floor (#53).
Wins go on into Endless:

| Class | Fresh, avg wave (range) | Maxed, avg wave (range) | Fresh wins past wave 10 | v0.6: fresh wins / maxed wins |
|---|---|---|---|---|
| Angel | 39.5 (6-70) | 67.8 (50-87) | 3/4 | 2/6 / 6/6 |
| Viking | 36.5 (7-59) | 51.8 (40-59) | 3/5 | 5/6 / 5/6 |
| Paladin | 22.2 (5-66) | 66.3 (59-74) | 1/3 | 4/6 / 6/6 |
| Archer | 14.5 (6-25) | 46.3 (40-55) | 0/4 | 0/6 / 5/6 |
| Necromancer | 9.3 (5-13) | 32.0 (12-64) | 0/2 | 0/6 / 3/6 |

**The brief's checks.** A fresh Viking past wave 10 wins 3 of 5, not "nearly always" (v0.6: 5 of 6 once past the Dragon). The Necromancer
and the Archer are not 15% above the median: with the bot they are well below it (fresh median 22.2).

**No class values changed.** This bot is a poor yardstick for exactly these two classes: human players find the Archer and the Necromancer
the strongest, and the bot finds them the weakest (README, Simulation).
Raising them on the bot's numbers alone would push against what players report, and there are no playtest run logs yet to set against it.

What did change:
- **The Archer's real counter (#59).** Aim now looks past a front-facing shield and a reflecting mirror, and shields and mirrors wear down.
  In `deep`: fresh 9.2 -> 14.5, maxed 30.5 -> 46.3.
- **The Paladin's shield uptime (#53)** is capped near 50% (it was up to 96% in Acts III-IV). The Paladin still wins every maxed run.

Candidate values for the Necromancer (HP 85 -> 100, 3 skeletons) and the Archer (HP 95 -> 105, damage 12 -> 13) are on the branch
`wip/b8-class-values`, ready if playtests show the bot is right.

## v0.7: relics (A8)

`npm run sim -- relics [runs]` (scripts/relic-report.ts, one process per class in parallel): maxed saves, and a bot that drafts sensibly.
It takes a duo when one is offered, otherwise a relic of the family it holds most (at the start, one its class prefers), and 15% of the
time another card. It reports winning-run numbers and every relic's share from wave 21 on. Final state, 8 runs per class (40 runs, 26 won):

| Target (the v0.7 brief) | Measured | |
|---|---|---|
| About 12-16 relic moments in a full run | 14.1 (7 bosses, 3 Merchant buys, 2.5 lairs, 1.6 quests) | ✔ |
| 1-2 duos a winning run | 1.31 | ✔ |
| 3+ duos in under 15% of winning runs | 3.8% | ✔ |
| Every class at a 4-set in two or more families | 4-6 families per class | ✔ |
| Relic power index 1.8-2.2 | 1.72 over Acts II-III (Act II 1.49, Act III 2.09) | ✘ (close) |
| A 6-set in about a third of winning runs | 65% (5 of 22 straight, 17 completed with a duo) | ✘ |
| No relic under 3% or over 35% where it is held | 12 under, 3 over | ✘ |

**The power index** is 1 / (1 - the relics' share of the damage dealt). Plain bonuses are credited their share, and procs, duos, set
bonuses and relic skeletons their own damage, so relics adding +100% read as 2.0. It climbs as a build grows, so the target is read over
Acts II-III, with each Act shown separately. Act II builds are small (5-7 relics at tier I). Raising relic damage per level moved it
little, and making attunement faster would break the brief's "tier II in Act II, tier III in Act III".

**Jesse's decision (#13): fewer relic moments.** Strongboxes pay gold and a Rune shard instead of a relic moment. A full run went from
about 17 moments to 14, and relics under 3% from 21 to 12. 6-sets stayed at about 65%, because most of them are five family pieces
plus that family's duo, which the number of moments hardly changes. Counting a duo as half a piece per family (option 2 on #13) would
be the fix for that; it is offered for v0.7.1.

**What moved the numbers:**
- **Attribution.** A relic's burn, bleed, curse, chill and freeze remember that relic: their ticks, the extra damage a curse or chill causes,
  and a freeze's Shatter are that relic's work. The same goes for relic bolts, fields and skeletons. Set bonuses are credited to their
  family. Before this, burn relics credited an estimate up front (so shares could pass 100%), and ward counted against damage taken alone.
- **Offers.** No lean toward held families (was 2×): the one-of-yours, one-new rule is enough. Legendaries are weighted 2 (was 10) and
  class relics come half as often. Duos come at wave-boss and lair moments.
- **Power.** Relic damage per level 0.09 -> 0.18. Weak relics and set bonuses raised, and a few strong ones trimmed; the full list is in
  RELICS.md (A8).

**Still outside the per-relic band.**
- Under 3%: conditional or control relics whose effect the shares cannot see (Frost Brand, Winter's Grasp, Glacial Heart, Berserker Tooth,
  Aegis of the Faithful, Glacier Plate), and class relics seen in 1-3 runs (Seraph's Halo, Fire Arrows, Stormborn Pelt).
- Over 35%: Bone Chime (the Necromancer's minions, 1 run), Thermal Shock (3 runs) and Guardian's Aegis. The Aegis's ward is credited
  when it is gained, so its share reads high.

**Classes (maxed, this bot):** Paladin 8/8, Viking 8/8, Angel 7/8, Necromancer 2/8, Archer 1/8 (v0.6: 6/6, 5/6, 6/6, 3/6, 5/6). The
Archer's result swung between 1/8 and 4/8 across passes with the bot's talent path. Both are for B8, the class balance check in v0.7.1.

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
cannot fall before 8 s of the last; 25 s until #127 in v0.8, which only taught players to walk away until it ran out), enforced by an HP floor on the enemy (`Enemy.hpFloor`). Phase 2 needs none: the flames are spread
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
| Waves 11-15 | Needs a build | Cavalry, two-affix elites, tier 2 (level 10). Knight is open from the start (#203); a developed save is meant to clear wave 15 on Squire, not a fresh one. |
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
