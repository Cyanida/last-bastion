# Balance notes

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
