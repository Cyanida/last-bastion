# Relics (v0.7)

Two parts: **A0, the diagnosis** of the relic system as it stands in v0.6.0, measured with the sim; and **A0b, the design** of the
v0.7.0 rework, for approval before any of it is built ([#5](https://github.com/Cyanida/last-bastion/issues/5)).

## A0 · Diagnosis: relics in v0.6.0

**Method.** `scripts/relic-report.ts` plays 60 runs (5 classes × 6 seeds, fresh and maxed saves, Squire, courtyard; the balance bot takes the
first relic of every offer, as a player grabbing everything would) and reads what each relic did during **Act III** (waves 21-30) in the 40 runs
that finished it. Attribution: damage and healing a relic's own hook deals is credited to that relic exactly; a plain stat bonus (+damage,
+attack speed, armor, cooldown, pierce, minion attack speed) is credited its share of the bonus on every hit; burns and bleeds a relic applies
are credited their full expected damage when applied (an estimate). **Not measured** (they show 0%): chill and freeze (control, not damage),
Phoenix Feather's revive, cooldown and duration relics (Reliquary of Saints, Wolfskin Cloak), and hits that land after the relic's hook has
returned (Seraph's Halo's bolts). Reproduce:

```bash
npx vite-node scripts/relic-report.ts run viking 6 viking.json    # one process per class, in parallel
npx vite-node scripts/relic-report.ts merge paladin.json viking.json angel.json necromancer.json archer.json
```

### Runs

60 runs (paladin, viking, angel, necromancer, archer; fresh and maxed), 37 won, 40 finished Act III.

| | Relics held at the end | Tier-ups | Runs |
|---|---|---|---|
| Winning runs | 27.0 | 45.2 | 37 |
| All runs | 20.2 | 30.6 | 60 |

Where a winning run's relics came from (new relics, not tier-ups):

| Source | Relics per run | Share |
|---|---|---|
| elite | 17.76 | 65.8% |
| boss | 2.30 | 8.5% |
| merchant | 1.65 | 6.1% |
| event | 1.41 | 5.2% |
| start | 1.24 | 4.6% |
| strongbox | 1.22 | 4.5% |
| quest | 0.65 | 2.4% |
| lair | 0.59 | 2.2% |
| levelup | 0.19 | 0.7% |

### Contribution in Act III (waves 21-30, 40 runs)

Share of all damage dealt, all healing received and all damage the relic's armor turned away, averaged over the runs that held it through Act III.

| Relic | Rarity | Runs held | Damage | Healing | Mitigation | Best | Verdict |
|---|---|---|---|---|---|---|---|
| Bone Chime | rare | 4 | 41.4% | 0.0% | 0.0% | 41.4% | **carries** |
| Vampire Fang | common | 40 | 0.0% | 23.5% | 0.0% | 23.5% |  |
| Executioner's Hood | rare | 40 | 16.9% | 0.0% | 0.0% | 16.9% |  |
| Serrated Edge | rare | 40 | 16.3% | 0.0% | 0.0% | 16.3% |  |
| Iron Band | common | 40 | 0.0% | 0.0% | 15.3% | 15.3% |  |
| Sands of Chronos | legendary | 40 | 13.2% | 0.0% | 0.0% | 13.2% |  |
| Blood Pact | legendary | 40 | 12.3% | 0.0% | 0.0% | 12.3% |  |
| Hawkeye Quiver | rare | 5 | 11.0% | 0.0% | 0.0% | 11.0% |  |
| Rally Banner | common | 40 | 0.0% | 9.4% | 0.0% | 9.4% |  |
| Powder Keg | rare | 40 | 7.4% | 0.0% | 0.0% | 7.4% |  |
| Whetstone | common | 40 | 6.6% | 0.0% | 0.0% | 6.6% |  |
| Hex Doll | rare | 40 | 4.0% | 0.0% | 0.0% | 4.0% |  |
| Brimstone Oil | rare | 40 | 3.8% | 0.0% | 0.0% | 3.8% |  |
| Conqueror's Crown | legendary | 40 | 3.5% | 0.0% | 0.0% | 3.5% |  |
| Sentinel's Stance | rare | 40 | 1.7% | 0.0% | 2.8% | 2.8% | **dead weight** |
| Storm Pennant | rare | 40 | 2.4% | 0.0% | 0.0% | 2.4% | **dead weight** |
| War Horn | rare | 40 | 2.1% | 0.0% | 0.0% | 2.1% | **dead weight** |
| Grave Pact | rare | 40 | 1.9% | 0.0% | 0.0% | 1.9% | **dead weight** |
| Soul Lantern | legendary | 40 | 1.7% | 0.0% | 0.0% | 1.7% | **dead weight** |
| Shockwave Sigil | rare | 40 | 1.1% | 0.0% | 0.0% | 1.1% | **dead weight** |
| Echo Bell | rare | 40 | 0.7% | 0.0% | 0.0% | 0.7% | **dead weight** |
| Thorn Mail | common | 40 | 0.7% | 0.0% | 0.0% | 0.7% | **dead weight** |
| Swift Boots | common | 40 | 0.0% | 0.0% | 0.0% | 0.0% | **dead weight** |
| Lucky Coin | common | 40 | 0.0% | 0.0% | 0.0% | 0.0% | **dead weight** |
| Scholar's Tome | common | 40 | 0.0% | 0.0% | 0.0% | 0.0% | **dead weight** |
| Lodestone | common | 40 | 0.0% | 0.0% | 0.0% | 0.0% | **dead weight** |
| Frost Brand | rare | 40 | 0.0% | 0.0% | 0.0% | 0.0% | not measured (see Method) |
| Phoenix Feather | legendary | 40 | 0.0% | 0.0% | 0.0% | 0.0% | not measured (see Method) |
| Reliquary of Saints | rare | 11 | 0.0% | 0.0% | 0.0% | 0.0% | not measured (see Method) |
| Wolfskin Cloak | rare | 10 | 0.0% | 0.0% | 0.0% | 0.0% | not measured (see Method) |
| Seraph's Halo | rare | 10 | 0.0% | 0.0% | 0.0% | 0.0% | not measured (see Method) |

### How often the stacking rules bite (Act III)

- A soft cap cuts a relic total in **61.6%** of Act III ticks.
- Proc sharing (more than 3 on-hit or on-kill relics) is active in **79.2%** of Act III ticks.
- The per-wave relic healing cap is passed in **0.0%** of all waves.

### What it says

1. **There is no choice: a winning run holds the whole pool.** 27 relics at the end and 45 tier-ups on top. Two thirds arrive from elites
   (a 20% drop chance on the roughly 400 elites a winning run kills); bosses, the Merchant, events, quests and features together bring a
   third. By Act III every relic is held, so no single pick matters, which is exactly the playtest complaint ("relics feel worthless").
2. **Seventeen relics are dead weight** (under 3% of anything in Act III, five of them unmeasured rather than proven useless): the utility stat
   relics do nothing in a fight (Swift Boots, Lucky Coin, Scholar's Tome, Lodestone), the conditional stat relics barely register (War Horn,
   Sentinel's Stance, Conqueror's Crown), several procs are too small or too rare (Storm Pennant, Echo Bell, Shockwave Sigil, Thorn Mail),
   and the minion relics do little for classes without minions (Grave Pact, Soul Lantern).
3. **A few relics carry.** Bone Chime is 41% of a Necromancer's damage (minions inheriting attack speed); Vampire Fang is a quarter of all
   healing; Executioner's Hood, Serrated Edge, Iron Band, Sands of Chronos and Blood Pact each hold 12-17%. Only Bone Chime passes the
   rework's 35% ceiling.
4. **The stacking rules are always on.** Because everything is held, a soft cap is cutting some total in 62% of Act III and proc sharing is
   active in 79%: the rules meant for edge cases have become the normal state, and they flatten every new pick further. The per-wave relic
   healing cap never binds (0% of waves).

**For the rework.** Fewer, deliberate relics (the 12-16 relic moments of A2, no elite drops, no level-up cards), no plain stat relics, no
category soft caps or proc sharing (A6), and families that give a run an identity (A3). The Bone Chime lesson: minion inheritance is
powerful and belongs in a set bonus (Grave's Legion) or a class relic with a watchful number, not a flat multiplier.


## A2 · Relic moments (built)

Relics now come only at fixed moments (`RELIC_MOMENTS` in `config/relics.ts`): every wave boss (waves 5, 10, ... 35), lairs, strongboxes (until A8), a quest
whose reward is a relic, the Merchant between Acts (one relic moment a visit; none at the Merchant path's caravan) and Armorer's Choice at the
start. Elites drop gold instead, level-ups offer no relics, the cursed chest pays gold and a Rune shard, and the wandering peddler sells a
healing draught. Every moment is a pick of one from three with one reroll (two with Cursed Luck or on the Elite path) and a visible Skip that
pays run gold and a Rune shard. Offers roll from the player's own relic stream (split from the run seed), so a seed always offers the same.

Measured with the bot (maxed saves, 3 seeds per class, the bot buying at every Merchant): a winning run meets **16-19 moments**, of which 13-16
are free (7 bosses, 3-4 lairs, 2-3 quests, 1-2 strongboxes) and 3 bought. A player who does not buy every time lands in the 12-16 target;
A8 revisits the numbers once the new relics exist.

## A4 · Attunement (built)

No duplicates: a held relic is never offered again, and a relic grows only by attunement (`ATTUNEMENT` in `config/relics.ts`). Its bar fills
from the **work** it does (damage dealt through it as a share of the damage you dealt the wave before, healing, ward or damage prevented in max
HP, a status or armor stack it gives, a skeleton it raises, Grave relics also from corpses walked over with Charnel), at most 0.1 a wave, plus
0.03 per wave cleared and 0.002 per elite killed for every held relic. A full bar is a tier: II strengthens, III awakens. A tier-up flashes,
sounds, lands in the run log and emits `onRelicTier` (the hook for the 0.7.1 stinger). Evolution recipes ask for a relic attuned to tier II.

Credit now reaches every relic: a bolt or field a relic leaves behind stays that relic's damage (Seraph Halo, Scorched Earth), and utility counts
(chills, curses, ward, Blessed Water's share of a heal, Reliquary's cooldown cuts). Before that, 79% of relic-waves did no credited work; now 42%,
mostly relics whose condition was not met (Glacial Heart, Rally Banner at full HP).

Measured with the bot (maxed saves, one seed per class, 40 waves): a relic picked in Act I reaches tier II at wave 15/20/22 (p25/median/p75) and
tier III at wave 25/28/33; one picked in Act II needs 7/10/13 waves to tier II. A8 tunes the rates with the full sim.

## A5 · Duo relics (built)

The 12 duos below live in `DUOS` (`config/relics.ts`), their effects in `systems/relicFamilies/duos.ts` (Lightning Rod in the Shockwave Sigil,
Consecration's ward half in `gainWard`). A duo is **ready** when both source relics are held, neither feeds a formed duo and it is not formed
yet; ready duos queue in the order they completed. Each relic moment carries at most one, the first ready duo not already on a queued moment,
as a gold fourth card that takes the pick; a skipped duo comes back at the next moment, and a ready duo makes a moment even with nothing left to
find. A formed duo combines its two source relics into one (v0.7.5, below), shows in the HUD, the pause screen and the Relics results
(its damage and healing credited to it), lands in the run log and emits `onDuoFormed`. The pick screen says when a relic would complete a duo;
relic tooltips name their duo; the compendium shows each recipe as a hint until the duo is formed once (`save.duos`).

First measure (the first-pick bot, maxed saves, 10 runs): 2.5 duos a run, 3 or more in 5 of 10, above the target (1-2, 3+ under 15%). That bot
holds ~22 relics by wave 40 and takes every duo; A8 measures with the family-following bot and, if it stays high, offers fewer duos (no cap).

**v0.7.5 · A duo combines its two relics ([#96](https://github.com/Cyanida/last-bastion/issues/96)).** A duo used to be a third relic
that counted toward both its families, which made 6-sets far too easy. Now forming a duo turns its two source relics into one relic: both
their effects keep working and the duo's own effect joins them. The families keep the counts of the two sources (Emberheart and Storm Pennant
forming Wildfire stay Flame 1 and Storm 1); the duo adds none, so the 125% strength of a duo-completed 6 is gone with it. The duo takes the
higher tier of its two sources (and that tier's fuller bar) and attunes as one relic up to tier III: the work of either source or of the duo
fills one bar, and a tier-up raises both (`logic/relics.ts` `joinTiers`, `systems/relics.ts` `tierUp`). The relic bar, the build panel,
the Relics results (credit summed into the duo's row) and the Merchant show the duo instead of its sources, so a combined relic cannot be
sold, rerolled or reforged. Every class still reaches a 6-set: each of its three preferred families holds six relics it can find.
First measure (`sim -- relics 4`, 20 runs, 13 won): 6-sets in 7.7% of winning runs (was 41-65%, mostly completed with a duo), 1.00 duos a winning run, power index 2.04. Jesse's new target
(on #96): a 6-set in **about 15% of winning runs**, rarer than before but a noticeable power-up. Offers now lean 1.6× toward the families
you hold (`RELIC_MOMENTS.heldFamilyWeight`, was 1): 6-sets in 15.4% of winning runs, still 1.00 duos and a power index of 2.04 (BALANCE.md).
**v0.10 (#194, docs/road-to-the-crown.md rules 4 and 5):** the 15% target and the preferred families are retired. The lean is back to 1.0,
only one family reaches its 6-set bonus in a run (a second stops at its 4), and a champion's pool is the starter commons, its inventory and,
inside a realm, that realm's family (`logic/relics.ts` `championPool`, `familySets`).

## A7 · Keep, achievements, migration (built)

- **Keep (Chapel).** Reliquary Guard (elite relic drops, 3 ranks) now gives **one more reroll at every relic moment per rank**, 2 ranks at most;
  a third rank is handed back at v0.6's price (616 gold) with a one-time notice in the Keep. The Reliquary Vault (tier III, which attunement
  now gives everyone) becomes **a fourth option at wave-boss relic moments**. Armorer's Choice stays.
- **Achievements.** No v0.6 achievement asked for tiers or synergies, so nothing had to be migrated; earned ones stay earned. New:
  Six of a Kind (a 6-set in 1, 5 and 15 runs), Bound in Pairs (1, 2 and 3 duos in one run), The Awakening (1, 2 and 4 relics awakened in one run),
  read from new save counters (`sixSets`, `maxDuos`, `maxAwakened`).
- **Save format 6.** The compendium keeps every kept relic's count, moves Echo Bell to Thunder Drum and Hawkeye Quiver to Galeforce Quiver, drops
  the removed relics, and marks the 31 relics a v0.6 player could not know as "new in v0.7" until found. Discovered duos are saved (A5). The
  pre-migration save stays in the backups (A1).

## A8 · Balance (tuned; see BALANCE.md for the numbers)

`config/relics.ts` is the source of truth for every number; the tables below are the approved design, and A8 changed these:

- **Rules:**
  - Strongboxes pay gold and a Rune shard instead of a relic moment (Jesse, #13). A full run meets about 14 moments.
  - Offers no longer lean toward held families (the one-of-yours, one-new rule stays).
  - Legendary weight 10 → 2; class relics come half as often.
  - Duos are offered at wave-boss and lair moments.
  - Relic damage per level 0.09 → 0.18.
  - A relic's chill makes the enemy take 4% more damage per stack (Frost's measurable job).
- **Sets:**
  - Stoked: burn damage +3% per point of secondary stat (was 1%).
  - Arc: every 4th hit for full damage (every 3rd from 15 secondary; was every 5th for 60%).
  - Bloodlust: up to 50% (was 40%).
  - Open Wounds: +2 bleed stacks (was +1).
  - Spiked: 4 × armor % (was 2 ×).
- **Relics (I / II):**

  | Relic | Now | Was |
  |---|---|---|
  | Salamander Scale | +35% / 50% | 25% / 35% |
  | Brimstone Oil | 35% / 50% chance, burn power 0.5 | 25% / 35%, power 0.2 |
  | Emberheart | 20% / 25% per burning enemy | 6% / 8% |
  | Cinder Charm | 2 / 3 stacks | 1 / 2 |
  | Dragon's Tongue | every 6 / 4 s | 8 / 6 s |
  | Frost Brand | 35% / 50% chance, 2 chill | 25% / 35%, 1 chill |
  | Winter's Grasp | 3 / 5 chill | 2 / 3 |
  | Glacial Heart | 20% / 25%, 2 chilled enemies within 260 | 15% / 20%, 3 within 220 |
  | Everfrost Crown | 5 chill, a freeze | 3 |
  | Storm Pennant | 30% / 40% for 80% / 90% | 25% / 35% for 60% / 70% |
  | Quicksilver Spurs | 5% / 7% a stack | 2% / 3% |
  | Tempest Eye | chains 60% / 75% | 40% / 50% |
  | Thunder Drum | 150 / 220 | 30 / 45 |
  | Galeforce Quiver | chains 70% / 85% | 50% |
  | Serrated Edge | bleed power 0.6 | 0.1 |
  | Berserker Tooth | +1% attack speed per 1.5% / 1% missing HP, max 45% / 60% | per 3% / 2%, max 30% / 40% |
  | Gravedigger's Spade | 5% / 7% | 3% / 4% |
  | Deathmask | also a 20% chance on hit to curse (it had no curse of its own) | no curse |
  | Thorn Mail | 16× / 22× | 3× / 4× |
  | Anvil Heart | +1% damage per 1.5% / 1% armor | per 2% / 1.5% |
  | Shockwave Sigil | 60 / 90 | 30 / 45 |
  | Aegis of the Faithful | a stack per 3 / 2 Faith | per 5 / 4 |
  | Fire Arrows | +4% / 6% burn per Focus | 2% / 3% |
  | Guardian's Aegis | 5% ward every 15 / 12 s | 10% every 12 / 9 s |
  | Thermal Shock | the rest of the burn ×1.25 | ×2 |

- **Red Lightning**, as built in A5: a crit on a bleeding enemy chains to two more enemies.
- **Answered on #13 (Jesse): fewer relic moments.** Strongboxes no longer give a relic. 6-sets stay at about 65% of winning runs,
  mostly five pieces plus a duo; counting a duo as half a piece per family is offered for v0.7.1.

## B6 · Cursed relics (v0.7.2)

Jesse on #5: cursed relics are standalone, very rare, very strong, and carry a risk. `CURSED_RELICS` in `systems/relicFamilies/cursed.ts`, numbers
in `config/relics.ts` (`CURSED`, and the six entries at the end of `RELICS`).

- **No family.** `RelicDef.family` is optional and a cursed relic has none, with `cursed: true` instead. It counts toward no set, feeds no
  duo, and the family rule of an offer ignores it. Everything that reads a family (tooltips, cards, the compendium, the HUD, the bot)
  handles "none", and shows a cursed relic in purple (`CURSED.color`).
- **Offered by their own rule.** Cursed relics are never in the pool. At a wave-boss or lair moment, `CURSED.chance` (10%) of the time and at
  most once an Act per player (`RelicState.cursedAct`), one not held takes the **third card**. The other cards still follow the family rule.
  A reroll keeps the cursed card. With about 2.6 such moments an Act, that is roughly one Act in four, or one cursed offer in a full run.
- **The curse lifts on awakening.** They attune like any relic. Tier II strengthens the effect, and tier III lifts the curse.
- **A separate deed.** *Cursebearer* (Challenges): win carrying one, two and three cursed relics (title *the Accursed*). It is read from a
  new counter, `counters.cursedWin`, an entry in the existing counters: the save format stays 6, and an older save reads it as 0. The
  collection deeds (Curator, Devoted, Nothing Left to Find) count family relics only.
- **Sims.** The drafting bot takes a cursed relic whenever one is offered.

| Relic | Effect (I → II) | Curse | Awakened (III) |
|---|---|---|---|
| 🗡️ Hungering Blade | Every kill this wave: +2% → 3% damage (up to 60% → 90%) | 5 s in a fight without a kill: it takes 6% of your max HP (never below 1) | **Sated** |
| 🔔 Doom Bell | Every kill tolls: the dead burst for 25% → 35% of their max HP around them | The horde moves 15% faster | **Last Toll** |
| 🔱 Scepter of Ruin | Signature ability cooldown 45% → 55% shorter | Every cast costs 10% of your current HP (never below 1) | **Crowned in Ruin** |
| 🧿 Abyssal Eye | Enemies within 220 px take 40% → 55% more damage from your attacks and abilities | Enemies within 220 px deal 25% more to you | **Unblinking** |
| 🍷 Crimson Chalice | 3% → 4.5% of all the damage you deal heals you (under the relic healing cap) | Max HP cut to 70% (back when it awakens or is sold) | **Overflowing** |
| 🏴 Tyrant's Banner | Every elite slain: +4% → 6% damage and attack speed for the rest of the run (up to 60% → 90%) | 60% more elites | **Conqueror** |

**Measured.**

*Held from the start.* Fresh saves, the bot, 5 classes × 2 seeds, run to wave 25. Every cursed relic carries a run further than no relic (12.6 waves cleared) or than a strong family relic, Salamander Scale (11.4):

| | Hungering Blade | Doom Bell | Scepter of Ruin | Abyssal Eye | Crimson Chalice | Tyrant's Banner |
|---|---|---|---|---|---|---|
| Waves cleared | 16.4 | 16.0 | 17.0 | 15.1 | 17.6 | 17.4 |
| Share (damage or healing) | 16.5% | 13.1% | not measured (a cooldown cut) | 15.9% | 46.4% of healing | 26.9% |

*In the relic sim* (`sim -- relics 8`, maxed saves; the bot takes every cursed relic it is offered): 20 cursed relics were held at wave 20 across 33 runs. Tyrant's Banner reached 25% from wave 21 on, Crimson Chalice 23% and Hungering Blade 13%. Every A8 target still holds: 6-sets in 41% of winning runs, 1.10 duos, a power index of 2.04. Cursed relics sit above the family band (3-35%) on purpose. The Chalice's 46% share of healing is its lifesteal doing the healing, paid for with 30% of max HP.

## B7 · Reforge at the Merchant (v0.7.2)

Next to Reroll (a random relic of the same rarity, at the same tier), **Reforge** swaps a held relic for a random other relic of **its family**:
one the player can find and does not hold, weighted by rarity and drawn from the player's relic stream. The new relic keeps **half the
attunement**. A relic's attunement is (tier − 1) + its bar: 0 for a fresh tier I, 2 once awakened (an awakened relic's bar no longer counts).
Half of that goes over as tier plus bar (`logic/relics.ts` `halfAttunement`):

| Reforged | Attunement | Half | The new relic |
|---|---|---|---|
| Tier I, bar 60% | 0.6 | 0.3 | tier I, 30% |
| Tier II, empty | 1 | 0.5 | tier I, 50% |
| Tier II, bar 50% | 1.5 | 0.75 | tier I, 75% |
| Awakened (III) | 2 | 1 | tier II, empty |

It costs 30 gold (+35% an Act; `MERCHANT.reforge`). A cursed relic has no family, so it cannot be reforged. A relic combined into a duo is not
listed (v0.7.5). Reroll keeps the tier but not the family; Reforge keeps the family count but halves the attunement.

## C1 · Signature relics (v0.10, [#201](https://github.com/Cyanida/last-bastion/issues/201)) — for approval

One signature relic per champion, outside the families: the champion-specific rare the Marches crown gives (docs/road-to-the-crown.md,
decisions log: "the champion-specific rare is a new signature relic"). Numbers in `config/relics.ts` (`SIGNATURE`, the five entries at the end of
`RELICS`), behaviour in `systems/relicFamilies/signature.ts`.

- **Outside the families.** Rare, gold (`SIGNATURE.color`), `signature: true` and no family: it counts toward no set, feeds no duo, the
  family rule of an offer ignores it, and the Merchant cannot reforge it (like a cursed relic). Each is built on its class's signature ability.
- **Won once, with the Marches crown.** The first Marches crown on any tier (`config/world.ts`) puts it in the champion's inventory
  (`logic/champions.ts` `grantSignature`, applied when the run is banked). Save v7's `signature` flag says it is won; a save read with the
  flag set always has it in the inventory.
- **The pool follows the champion (#194).** It is never in a pool without a champion (the Daily Trial, the sims); once won, it is in the
  champion's pool in every realm like the rest of its inventory, and offered 3× as often until first picked.
- **Slot rules (#195).** It takes 1 slot and is not one of the 2 class relics, so a loadout may hold both class relics and the signature.
- **Collection deeds.** Like the cursed relics it stays out of Curator, Devoted and Nothing Left to Find: it is a crown's reward, not a find.
  The compendium lists the five under their own gold heading, and test mode offers the champion's own.

| Champion | Relic | Effect (I → II) | Awakened (III) |
|---|---|---|---|
| Paladin | ⚜️ Oathkeeper's Seal | Divine Shield keeps the blows it turns away (up to 100% of max HP). When it ends it strikes every enemy within 180 px for 40 plus 150% → 200% of what it kept (+5% per point of Faith) | **Sanctified**: the strike also wards you for 6% of max HP |
| Viking | 🪓 Jarl's Torc | During Berserker Rage your attacks cleave: 35% → 50% of each hit to every other enemy within 90 px of the target | **Saga's End**: every kill during Rage makes it last 0.3 s longer (up to 3 s a Rage) |
| Angel | 🌟 Dawnstar | Heavenly Radiance calls 3 → 4 beams of dawn on the strongest enemies within 360 px: 60 (+5 per point of Grace) holy damage around each (60 px) | **Morning Hymn**: every beam that lands heals 1% of max HP (under the relic healing cap) |
| Necromancer | 🏺 Phylactery | Raise Dead also raises 1 → 2 Bone Knights (120 HP, 14 damage) for 8 s | **Lich's Crown**: its Bone Knights burst for 30 shadow damage when they fall |
| Archer | 🦅 Eagle Fletching | Every Arrow Volley arrow has a 30% → 40% chance to strike again for 80% of its hit | **Deadeye**: the second strike hits for 120% |

Flat damage (the Seal's 40, the beams, the knights and their burst) grows with character level like every relic's
(`RELIC_DAMAGE_PER_LEVEL`). The Phylactery's knights last 8 s, the length of Raise Dead's cooldown, because relic skeletons count toward the
skeleton cap: a longer life would take the next cast's slots.

**Measured.** `npm run sim -- relics 4 signature` (the relic sim with every run holding its class's signature relic from the start; maxed
saves, 20 runs, 18 won). Share from wave 21 on, target 3-35%:

| Relic | Runs held at wave 20 | Share |
|---|---|---|
| ⚜️ Oathkeeper's Seal | 4 | 13.0% |
| 🌟 Dawnstar | 4 | 12.6% |
| 🦅 Eagle Fletching | 4 | 11.6% |
| 🪓 Jarl's Torc | 3 | 4.6% |
| 🏺 Phylactery | 4 | 3.3% |

All five sit inside the band, in the middle of the family rares (Salamander Scale 12.5%, Vampire Fang 12.4%), none near the 35% ceiling. The
Torc and the Phylactery read low for the same reason Bone Chime reads high: the share sees the Torc's cleave but not the longer Rage of Saga's
End, and the Phylactery's knights also soak hits the shares cannot see. The run's other targets hold as before (6-sets 16.7% of winning runs,
1.28 duos); the power index reads 1.73 with 4 runs a class, as the sim's small samples do.

## C2 · The Iron Hold's Steel relics (v0.11, [#217](https://github.com/Cyanida/last-bastion/issues/217))

Four of the Iron Hold's seven new Steel relics (docs/road-to-the-crown.md, "The Iron Hold" and v0.11.0 item 4): a common, two rares and
the family's second legendary. The Iron Hold teaches armor you break, shields that block from the front and thorns that hit back, and each
relic takes one of those lessons for the player. Numbers in `config/relics.ts` (the four entries after Ironhide), behaviour in
`systems/relicFamilies/steel.ts`, the pure rules (the front arc, the rivet count, what the cuirass keeps, the thorns per stack) in
`logic/relics.ts`. The class relics for the Angel, Necromancer and Archer and the new Steel duo are #218.

| Relic | Rarity | Effect (I → II) | Awakened (III) |
|---|---|---|---|
| 🔩 Rivet Hammer | common | Every 4th → 3rd attack hit drives a rivet: +22 → 28 damage (grows with level) and an armor stack | **Sunder**: a rivet breaks the armor or shield of the enemy it strikes (not a boss's) |
| 🚪 Pavise | rare | 25% → 35% chance to block a hit from an enemy in front of you (within 60° of where you last struck) | **Riposte**: a block from the front strikes the attacker for 3× the hit |
| 🦔 Reprisal Cuirass | rare | Every hit that comes at you, blocked or not, is kept at full force (up to 25% of max HP); your next attack hit adds 8× → 10× that as damage | **Vengeance**: the reprisal also strikes every enemy within 90 px of the target for 50% of it |
| 🏰 Heart of the Hold | legendary | Armor stacks never fade and you hold 3 more; a hit you take or block gives an armor stack, and the attacker takes 8 → 12 damage per stack you hold (grows with level) | **Iron Keep**: at full armor stacks, hits take 20% less damage |

- **Where they are found.** Rivet Hammer is a common, so it joins the starter pool: every run finds it from the start (16 commons now). The
  rares and the legendary are in the Iron Hold's pool (the realm's whole family) and, once kept, in the champion's inventory; the runs
  without a champion (the Daily Trial, the sims) find all four. Heart of the Hold is the second Steel legendary, so the Iron Hold's Knight
  crown ("pick 1 of 2 Steel legendaries") offers it beside Unbreakable.
- **Slot rules.** Heart of the Hold takes 2 slots and is the loadout's one legendary; all four count toward the 4 Steel relics a loadout may
  hold.
- **The front** is where you last struck (the way a player faces in a fight), so the Pavise guards the foe you fight and not the one behind
  you. A block counts as work for Bulwark, Thorn Mail's Briar Plate and Heart of the Hold like any other block.
- **Reprisal Cuirass keeps the hit's full force**, before armor, ward or a block: kept after armor, it read 0.6% in the sim, as a maxed save
  takes little of what comes at it.

**Measured.** `npm run sim -- relics 3 hold=<id>` (new: every run holds the named relic from the start; maxed saves, 15 runs each, 14 won).
Share from wave 21 on, target 3-35%:

| Relic | Runs held at wave 20 | Share |
|---|---|---|
| 🚪 Pavise | 14 | 24.3% |
| 🏰 Heart of the Hold | 14 | 13.8% |
| 🦔 Reprisal Cuirass | 14 | 6.5% |
| 🔩 Rivet Hammer | 14 | 5.8% |

All four sit inside the band. The Pavise stands with Tower Shield (17-21% in the same runs), the other blocker; the first tuning (30% → 40%)
read 29.7%, close to the ceiling, so it came down. Rivet Hammer's first numbers (16 → 20 damage) read 4.2% and were raised. Heart of the
Hold's share counts only its thorns and Iron Keep: the armor of its extra, unfading stacks is not credited to it. The power index stayed in
its band in every run (1.80-2.00).

## C3 · The Iron Hold's Steel class relics and duo (v0.11, [#218](https://github.com/Cyanida/last-bastion/issues/218))

The other three of the Iron Hold's seven new Steel relics: class relics for the three champions who had none in Steel (the Paladin has
Aegis of the Faithful, the Viking Ironhide), and the realm's duo. Numbers in `config/relics.ts` (after Heart of the Hold, and the last duo),
behaviour in `systems/relicFamilies/steel.ts` (Iron Tithe lives in Reprisal Cuirass's hook, where the reprisal happens, as Lightning Rod
lives in the Shockwave Sigil), the pure rules (Radiance's stacks, the per-stack bonus, the bodkin count and share) in `logic/relics.ts`.

| Relic | Rarity | Effect (I → II) | Awakened (III) |
|---|---|---|---|
| 💫 Iron Halo *(Angel)* | rare | Heavenly Radiance gives 1 + Grace/5 → 4 armor stacks and strikes everything it hits for 6 → 8 damage per armor stack you hold (grows with level) | **Aureole**: Radiance heals 5% more per armor stack you hold |
| ⛓️ Legion Plate *(Necromancer)* | rare | Every 6th → 4th minion hit gives you an armor stack; minion hits deal 3% → 4% more per armor stack you hold | **Iron Legion**: skeletons you raise wear plate, 50% more HP |
| 📌 Bodkin Points *(Archer)* | rare | Every 3rd arrow hit is a bodkin: 40% → 60% of the hit again, +2% per Focus, that no shield turns, and an armor stack | **Armor-Piercer**: at full armor stacks every arrow hit is a bodkin |
| ⚖️ Iron Tithe *(duo)* | Steel + Blood | Reprisal Cuirass + Vampire Fang: a reprisal opens 3 bleed stacks on its target (10% of it per second each) and heals you 3% of its damage | (the duo's tier awakens both sources) |

- **Each champion's lesson.** The Iron Hold teaches armor you break, shields that block from the front and thorns that hit back. The Angel
  stands in the horde to cast Radiance, so her relic arms her as she casts and turns the armor into holy damage; the Necromancer's armor
  comes from his legion and feeds it back; the Archer's bodkin is the arrow that goes through what a shield would turn (a bodkin is relic
  damage with no direction, so no shield's front turns it; the arrow itself still has to reach the foe).
- **Where they are found.** A class relic is in the Iron Hold's pool only for its class; level 3 unlocks it (the plan's rule "level 3
  unlocks your class relic of that family"), and once kept it is in the champion's inventory. Runs without a champion find it as any other
  class relic. It counts toward the 2 class relics and the 4 Steel relics a loadout may hold.
- **Iron Tithe pairs Steel with Blood.** Flame (the forge's own family) already sits in 4 recipes, the most a family may have (A5, "spread
  evenly"); Blood had 3. The reprisal is the hit paid back, the tithe takes it in blood, and the bleed is what Vampire Fang heals from, so
  the two sources feed each other. Both halves are open to every class.

**Measured.** `npx vite-node scripts/relic-report.ts run <class> <runs> <out> hold=<id>` for the class that owns each relic (6 runs each)
and `hold=reprisalCuirass,vampireFang` for the duo (4 Paladin and 4 Viking runs), maxed saves, 26 runs, 26 won. Share from wave 21 on, target 3-35%:

| Relic | Runs held at wave 20 | Share |
|---|---|---|
| ⚖️ Iron Tithe (with its two sources) | 8 | 26.0% |
| 💫 Iron Halo | 6 | 4.2% |
| ⛓️ Legion Plate | 6 | 12.6% |
| 📌 Bodkin Points | 6 | 7.8% |

All four sit inside the band on their first numbers. A duo's row counts its two sources' work as its own (#96), so Iron Tithe's 26% is the
cuirass's reprisals, the fang's leech and the tithe's bleed and heal together; the cuirass read 9.3% in the runs where it stood alone. The power index
read 2.04 (Act II 1.86, Act III 2.25), inside its band.
Iron Halo was measured again after its strike moved onto the cast itself: it used to strike from Radiance's hits, which land before the
cast gives its stacks, so it only ever struck with stacks from elsewhere (the 18.1% first read was that, in maxed builds full of Steel);
now each cast strikes everything in Radiance's radius once, with the stacks it just gave (6 Angel runs, 6 won).

## C4 · The Cinderlands' Flame relics (v0.12, [#229](https://github.com/Cyanida/last-bastion/issues/229))

Three of the Cinderlands' five new Flame relics (docs/road-to-the-crown.md, "The Cinderlands" and v0.12.0 item 4): two rares and the
family's second legendary. The Cinderlands teach fire that spreads over the floor, burn stacks on you and bursts of fire when foes die; each
relic takes one of those for the player, and each does something the Flame relics before it do not: a burst from a hit (Salamander Scale only
multiplies the hit), fire that comes from the burning foes themselves (Ember Mantle's and Salamander Scale's fire comes from you or from a
kill at full stacks) and a burn that passes on whole (Cinder Charm throws one ember, Pyre only explodes). Numbers in `config/relics.ts` (the
three entries after Radiant Brand), behaviour in `systems/relicFamilies/flame.ts`, the pure rules (when a hit flares, which foes drip pitch,
what the leap passes on) in `logic/relics.ts`. The class relics for the Viking and the Necromancer and the new duo are separate issues.

| Relic | Rarity | Effect (I → II) | Awakened (III) |
|---|---|---|---|
| 🧨 Flashpowder | rare | Once every 1 → 0.7 s your next hit (attack or ability) sparks: an enemy at 2+ burn stacks flares, 32 → 40 fire damage (grows with level) and a burn stack to every enemy within 100 px; any other catches 2 burn stacks | **Chain Reaction**: enemies a flare brings up to 3 burn stacks flare too (one link) |
| 🛢️ Pitch Pot | rare | Every 2 → 1.5 s you fling burning pitch at the nearest enemy within 360 px, and every burning enemy that near drips it, nearest first: a fire patch at their feet for 3 s (8 damage per second, grows with level) that sets a burn stack; up to 4 → 6 patches, never one on another | **Tar Pit**: an enemy that dies in burning pitch bursts into fire (a Pyre explosion) |
| 🎇 Crown of Cinders | legendary | Your attack hits set an enemy that isn't burning alight (1 burn stack, 4 per second, grows with level). When a burning enemy dies its fire leaps on: every enemy within 110 → 140 px catches its burn stacks (at its burn's power) and takes 12 → 16 fire damage (grows with level) | **Conflagration**: the fire leaps up to 200 px and adds 1 more burn stack |

- **Where they are found.** None is a common, so none joins the starter pool. All three are in the Cinderlands' pool (the realm's whole
  family) and, once kept, in the champion's inventory; the runs without a champion (the Daily Trial, the sims) find all three. The Marches'
  Flame level offers its rares in order, so a champion who owns Salamander Scale and Ember Mantle is offered Flashpowder and Pitch Pot there.
  Crown of Cinders is the second Flame legendary, so the Cinderlands' Knight crown ("pick 1 of 2 Flame legendaries") offers it beside
  Dragon's Tongue.
- **Slot rules.** Crown of Cinders takes 2 slots and is the loadout's one legendary; all three count toward the 4 Flame relics a loadout may
  hold.
- **Each lights its own first fire.** First built to feed only on burns other relics lit, all three read 2.3-2.8% in the sims (the bot's
  runs mostly go Steel: 8 of 12 6-sets), so each now starts a fire itself: the powder lights what it can't flare yet, the pot flings its
  pitch at the nearest foe, the crown's attacks light foes that aren't burning.
- **Decided: Flashpowder has one clock for all enemies**, not one per enemy: with Inferno (every hit burns) a clock per enemy would flare on
  nearly every hit in a crowd. **Decided: a flare's own burn stacks can set off Chain Reaction once**, never a second link, so a crowd goes up
  in a ring of bursts and not a runaway. **Decided: the Crown passes on the dead foe's stacks at the burn's own power**, not a fixed one, so
  it spreads whatever built the burn; the burns it passes on are the Crown's work from then on.
- **Burn stacks on you** are the realm's foes' lesson; no relic here reads them, because a relic that only works in the Cinderlands would sit
  under 3% everywhere else (the shares below are measured in a plain run).

**Measured.** `npm run sim -- relics 3 hold=<id>` (every run holds the named relic from the start; maxed saves, 15 runs each;
measured again on release/0.12.0 with the Ember Forge and the Torchbearers in). Share from wave 21 on, target 3-35%:

| Relic | Runs held at wave 20 | Share |
|---|---|---|
| 🎇 Crown of Cinders | 15 | 7.5% |
| 🛢️ Pitch Pot | 14 | 7.3% |
| 🧨 Flashpowder | 13 | 4.5% |

All three sit inside the band. Their first versions, which only fed on burns other relics lit, read 2.3% (Flashpowder, at 3+ stacks),
2.5% (Pitch Pot) and 2.8% (Crown of Cinders); lighting their own first fire lifted the pot and the crown into the band, and Flashpowder
read 3.0% at 20 → 26 damage in 90 px, so it went to 32 → 40 in 100 px. The power index stayed in its band in every run (2.02-2.14).

## C5 · The Cinderlands' Flame class relics and duo (v0.12, [#230](https://github.com/Cyanida/last-bastion/issues/230))

The other two of the Cinderlands' five new Flame relics: class relics for the two champions who had none in Flame (the Paladin has Radiant
Brand, the Angel Sunfire Censer, the Archer Fire Arrows), and the realm's duo. Numbers in `config/relics.ts` (after Crown of Cinders, and
the last duo), behaviour in `systems/relicFamilies/flame.ts` (Baptism of Fire lives in Flashpowder's flare, where the flare happens, as
Iron Tithe lives in the cuirass's reprisal), the pure rules (the stokes and their cap, the burn a skeleton sets, what a flare heals) in
`logic/relics.ts`.

| Relic | Rarity | Effect (I → II) | Awakened (III) |
|---|---|---|---|
| ☄️ Surtr's Brand *(Viking)* | rare | During Berserker Rage every attack hit stokes your axe (up to 8 + Rage stokes). When Rage ends the fire bursts out: 24 → 32 fire damage per stoke (grows with level) and 2 burn stacks to every enemy within 170 px | **Twilight**: at full stokes the fire bursts out at once, and the count starts again |
| 🪵 Bonefire *(Necromancer)* | rare | Your skeletons burn: every 1.5 → 1 s each sets the enemies within 90 px of it alight, a burn stack (8 damage per second, grows with level, +4% per Soul Power) | **Balefire**: a skeleton you raise rises in a burst of fire, 24 fire damage (grows with level) and 2 burn stacks to every enemy within 110 px |
| ⛲ Baptism of Fire *(duo)* | Flame + Holy | Flashpowder + Blessed Water: a flare heals you 1% of your max HP for every enemy it catches (up to 4) | (the duo's tier awakens both sources) |

- **Each champion's lesson.** The Cinderlands teach burn stacks, fire that spreads over the floor and bursts of fire. The three Flame class
  relics before these all read "the ability's hits add burn stacks"; Berserker Rage and Raise Dead hit nothing themselves, so these two
  take the realm's lessons instead. The Viking's Rage is a stretch of fast blows, so his relic stores them and lets them go as one burst
  when Rage ends (his other class relics work during Rage: chains, bleeds, armor stacks; this one pays at its end, and a Rage with no hit
  gives nothing). The Necromancer's fire walks with his legion: it spreads wherever the skeletons stand, a stack from each one near an
  enemy, which is not Lich Lantern's chill on their hits (no hit is needed, and standing among the horde is enough).
- **Where they are found.** A class relic is in the Cinderlands' pool only for its class; level 3 unlocks it (the plan's rule "level 3
  unlocks your class relic of that family"), and once kept it is in the champion's inventory. Runs without a champion find it as any other
  class relic. It counts toward the 2 class relics and the 4 Flame relics a loadout may hold. Every champion now has a Flame class relic.
- **Decided: Surtr's Brand counts hits, not swings, up to 8 + Rage**, so a Rage in a crowd fills it in a few swings and a duel takes the
  whole Rage; the cap keeps a crowd from making the burst endless. Twilight lets a full axe burst during Rage, so the awakened relic is
  the one that rewards the crowd.
- **Decided: Balefire bursts only for the skeletons Raise Dead raises**, once each, as they rise; a relic's skeleton (Soul Lantern's, the
  Legion's) burns like the others but rises without a burst, so kills that raise skeletons cannot chain bursts.
- **Decided: Baptism of Fire pairs Flame with Holy, Flame's fifth recipe.** A5's "no family in more than 4 recipes" was written for 12
  duos; with one duo a realm (the plan: 19 in all, 38 family places over 7 families) no family can stay at 4. Iron Tithe could still
  avoid it (Steel had 3); the Cinderlands' duo is about fire, Flame had 4, so the most a family may sit in is now 5
  (`tests/v7-duos.test.ts`), and Holy, one of the two families still at 3, is the partner. Flashpowder is the realm's own relic and
  Blessed Water a starter common, so both halves are open to every class; the water makes the duo's heal stronger and, awakened
  (Baptism), each flare's heal washes a status off.

**Measured.** `npx vite-node scripts/relic-report.ts run <class> <runs> <out> hold=<id>` for the class that owns each relic (6 runs each)
and `hold=flashpowder,blessedWater` for the duo (4 Paladin and 4 Viking runs), maxed saves, 20 runs, 18 won. Share from wave 21 on, target 3-35%:

| Relic | Runs held at wave 20 | Share |
|---|---|---|
| ⛲ Baptism of Fire (its own heal) | 8 | 9.5% |
| ☄️ Surtr's Brand | 5 | 5.6% |
| 🪵 Bonefire | 5 | 4.3% |

All three sit inside the band. Surtr's Brand and the duo did on their first numbers; in the duo's runs Flashpowder itself read 6.5%
(4.5% alone, C4). Bonefire first read 2.4% (a stack every 2 → 1.5 s within 70 px, 4 damage per second) and 3.6% at 90 px and 6 damage, so
it went to every 1.5 → 1 s and 8 damage. Its share is lowest in the runs that reach Flame's 6-set (1.4% and 1.9%): there every hit burns,
the stacks are full without it, and a burn's ticks go to the relic that fed it last. The power index read 1.99 over the 20 runs (Act II
1.80, Act III 2.23), inside its band; the Necromancer's own runs read 1.72 (the bot underrates him, AGENTS.md).
The sim's bot takes its taste in families from a class's class relics (`sim/levels.ts` `tasteOf`), so the Viking and the Necromancer now
lean toward Flame in its loadouts too; the Viking's golden Marches level 7 run slots Salamander Scale first for it and clears the level.

## C6 · The Barrowvale's Grave relics (v0.13, [#279](https://github.com/Cyanida/last-bastion/issues/279))

Four of the Barrowvale's eight new Grave relics (docs/road-to-the-crown.md, "The Barrowvale" and v0.13.0 item 4): a common, two rares and
the family's second legendary. The Barrowvale teaches corpses that rise unless you trample them and plague ground that lasts; each relic
takes one of those for the player: a trample that hurts (Barrow Boots), plague ground of your own (Plague Censer), the dead rising for you
and not against you (Sexton's Bell), and the Barrow King's own guard (Crown of Antlers). Numbers in `config/relics.ts` (the four entries
after Deathmask), behaviour in `systems/relicFamilies/grave.ts`, the pure rules (which corpses are stomped, when the censer lays, which
corpses the bell raises, what the guard takes off) in `logic/graveRelics.ts`. The class relics and the new duo are #280.

| Relic | Rarity | Effect (I → II) | Awakened (III) |
|---|---|---|---|
| 👢 Barrow Boots | common | Walking over a corpse stomps it once: 30 → 38 shadow damage (grows with level) to every enemy within 85 px | **Grave Stomp**: a stomp curses what it hits (1 stack) |
| 🧪 Plague Censer | rare | Every 4 → 3 kills, plague ground spreads where the last enemy fell, for 8 s: 10 → 13 shadow damage per second (grows with level), and it poisons (up to 3 → 4 patches) | **Blight Bloom**: an enemy that dies in your plague ground leaves plague ground of its own |
| 🛎️ Sexton's Bell | rare | Every 6 → 4.5 s the bell tolls: up to 3 → 4 corpses within 180 px rise as skeleton allies (60 HP, 16 damage) for 10 s, a corpse about to rise against you first | **Death Toll**: each toll curses every enemy within its reach (2 stacks) |
| 🦌 Crown of Antlers | legendary | Your skeletons are your barrow guard: you take 5% → 7% less damage for each within 200 px (up to 3). Kills have an 8% → 12% chance to raise a guard (60 HP, 10 damage, 12 s; up to 3 → 4) | **Court of Bones**: while 3+ guards stand near you, you mend 1% of your max HP every second |

- **Where they are found.** Barrow Boots is a common, so it joins the starter pool: every run finds it from the start. The rares and the
  legendary are in the Barrowvale's pool (the realm's whole family) and, once kept, in the champion's inventory; the runs without a
  champion (the Daily Trial, the sims) find all four. The Marches' Grave level offers its rares in order, so a champion who owns Hex Doll and
  Grave Pact is offered Plague Censer and Sexton's Bell there.
- **Soul Lantern moves to the Barrowvale's crown** (docs/road-to-the-crown.md, section 8): it leaves `RELIC_POOL.open`, so a champion's run
  finds it only in the Barrowvale or once it is in the inventory. Crown of Antlers is the second Grave legendary, so the Knight crown ("pick
  1 of 2 Grave legendaries") offers the two, and the Champion crown gives the one not picked. Phoenix Feather and Stormcaller's Horn stay
  open until their realms ship.
- **Slot rules.** Crown of Antlers takes 2 slots and is the loadout's one legendary; all four count toward the 4 Grave relics a loadout may
  hold.
- **Decided: a corpse is stomped once**, then stays a corpse (for Raise Dead, the Spade, Charnel and the bell), and the stomp counts any
  corpse, not only a rising one, so the boots work in every arena; a rising corpse the boots stomp is trampled as before.
  **Decided: the bell waits for a corpse**: with none in reach its clock stays ready and it tolls on the next one, so a toll never comes up
  empty; a thrall's rising corpse it raises is gone, so it never rises against you. **Decided: the guard is every skeleton of yours**
  (Raise Dead's, the relics', the sets'), not only the crown's, but never a quest's or an evolution's unit; the cut stops at 3 guards, so a
  full Necromancer army counts no more than three.

**Measured.** `npm run sim -- relics 3 hold=<id>` (every run holds the named relic from the start; maxed saves, 15 runs each). Share from
wave 21 on, target 3-35%:

| Relic | Runs held at wave 20 | Share | Won | Power index |
|---|---|---|---|---|
| 🦌 Crown of Antlers | 14 | 8.2% | 14 | 1.65 |
| 🛎️ Sexton's Bell | 14 | 4.8% | 12 | 1.81 |
| 🧪 Plague Censer | 14 | 3.7% | 13 | 1.70 |
| 👢 Barrow Boots | 13 | 3.6% | 12 | 1.93 |

All four sit inside the band. The first numbers read under it: Barrow Boots 1.5% (16 → 20 damage in 70 px, a corpse within 16 px of your
edge), Sexton's Bell 1.7% (every 8 → 6 s, 2 → 3 skeletons of 40 HP and 8 damage for 8 s) and Plague Censer 3.2% (7 → 9 damage per
second in 55 px), so the boots stomp harder and wider, the bell tolls more often for more and stronger skeletons, and the censer's ground
hurts more. Crown of Antlers' share counts only the damage its guard takes off, not its own guards' hits. The power index read under its
1.8-2.2 band in the Crown's and the censer's runs (1.65 and 1.70): holding a Grave relic from the start turns the family-following bot
toward Grave, the family whose skeletons and curses it credits least. The realm's balance pass (v0.13.0 item 5) measures the Barrowvale
as a whole.

## C7 · The Barrowvale's Grave class relics and duo (v0.13, [#280](https://github.com/Cyanida/last-bastion/issues/280))

Four of the Barrowvale's eight new Grave relics: class relics for the four champions who had none in Grave (the Necromancer has Bone Chime),
and the realm's duo. Numbers in `config/relics.ts` (after Bone Chime, and the last duo), behaviour in `systems/relicFamilies/grave.ts` and
the duo in `systems/relicFamilies/duos.ts`, the pure rules (how many of the dead answer, which corpses, the bone burst, what a champion walks
over) in `logic/relics.ts`.

| Relic | Rarity | Effect (I → II) | Awakened (III) |
|---|---|---|---|
| ☠️ Ossuary Seal *(Paladin)* | rare | When Divine Shield ends the dead answer: up to 1 + Faith/5 → Faith/4 corpses within 220 px rise as skeletons for 10 s (60 HP, 16 damage, grows with level) | **Sworn Dead**: while the shield holds, every enemy that strikes it is cursed (2 stacks) |
| 🍺 Draugr's Mead *(Viking)* | rare | Every enemy you strike down during Berserker Rage rises as a draugr, a skeleton that fights for 10 s (up to 2 + Rage/5 → Rage/4 at once; 60 HP, 20 damage, grows with level) | **Einherjar**: when Rage ends your draugr howl, 30 shadow damage (grows with level) to every enemy within 80 px of each |
| 🕊️ Last Rites *(Angel)* | rare | Heavenly Radiance lays the corpses within its radius to rest (up to 4 + Grace/4 → Grace/3), and none of them rises again: each heals you 3% → 4% of your max HP | **Psychopomp**: every corpse laid to rest curses the enemies within 90 px of it (2 stacks) |
| 🩻 Wightbone Arrows *(Archer)* | rare | Arrow Volley calls on the dead under it: every corpse in its area bursts in bone and shadow, 20 → 28 damage (grows with level, +3% per Focus) to every enemy within 70 px | **Barrow Wights**: enemies your signature ability kills rise as skeletons for 10 s (up to 3) |
| 🍖 Barrow Feast *(duo)* | Grave + Blood | Hex Doll + Berserker Tooth: walking over a corpse devours it (it never rises): it heals you 1.5% of your max HP and curses every enemy within 100 px (1 stack) | (the duo's tier awakens both sources) |

- **Each champion's lesson.** The Barrowvale teaches corpses that rise unless you trample them. Grave's relics raise skeletons, curse or
  feed on corpses; these four take the corpses each champion leaves in his own way, through his ability. The Paladin's shield is a stand,
  so the dead stand with him when it drops. The Viking's Rage is a slaughter, so its kills get up and fight on beside him. The Angel's
  Radiance is the last rite: it lays the dead round her to rest, a heal for each, and a Barrow Thrall's corpse laid to rest never rises.
  The Archer's Volley falls where the dead lie, so the corpses under it burst. Each counts its dead with the secondary stat (1 + Faith/5,
  2 + Rage/5, 4 + Grace/4, Focus in the burst's damage).
- **Where they are found.** A class relic is in the Barrowvale's pool only for its class; level 3 unlocks it, and once kept it is in the
  champion's inventory. It counts toward the 2 class relics and the Grave relics a loadout may hold. Every champion now has a Grave class
  relic.
- **Decided: the corpse relics take the corpses they use** (Ossuary Seal, Last Rites and Wightbone Arrows; Barrow Feast too): a corpse
  raised, laid to rest or burst is gone, so Raise Dead, Gravedigger's Spade and a second relic cannot use it again, and a rising one never
  rises. Draugr's Mead raises from the kill itself and leaves the corpse.
- **Decided: Draugr's Mead raises only from attack kills during Rage**, never a boss, so the draugr are the Viking's blows and not the
  relics' bursts; the cap (2 + Rage/5 at once) keeps a crowd from flooding the arena.
- **Decided: Barrow Feast pairs Grave with Blood.** Grave sat in 3 recipes, so the Barrowvale's duo is Grave's; Flame is at the 5 that
  C5 set as the most, and Blood (at 4, with no Grave duo yet) is the partner: it feeds on the dead. Hex Doll and Berserker Tooth were the
  two free sources (neither in a recipe) and both are open to every class; the duo is the realm's lesson made a habit, trample the dead.
  The new Grave relics of #279 are left to the realms' later duos.

**Measured (a first look, not a full pass).** `npx vite-node scripts/relic-report.ts run <class> 3 <out> hold=<id>` for each relic's class and
`hold=hexDoll,berserkerTooth` for the duo (Viking), maxed saves, 15 runs. Share from wave 21 on, target 3-35%. First numbers: Ossuary Seal 3.3%,
Wightbone Arrows 3.3%, Draugr's Mead 1.1%, Last Rites 0.4%, Barrow Feast 34.1%. So the seal's skeletons hit 12 -> 16, the draugr went to 60 HP,
20 damage and 10 s, Last Rites to 4 + Grace/4 corpses and 3% -> 4% a corpse, and the feast's heal 2% -> 1.5%; then: Ossuary Seal 4.0%,
Barrow Feast 26.8%, Draugr's Mead 2.0%, Last Rites 0.3%. Wightbone Arrows stays at 20 -> 28 (26 put the Archer's golden seed 2027 down before
the first Act boss). **Open:** Draugr's Mead and Last Rites still read under 3% on 3 runs each; Last Rites' share is healing against the
Angel's own Radiance heals, so it needs a larger sample (or a share measured on what it stops rising) before its numbers move again.

## A0b · The new relic list (approved, revision 2)

**Revision 2** follows Jesse's review on [#5](https://github.com/Cyanida/last-bastion/issues/5): every class gets **three preferred families**, shown
at character select; a preferred family can be **maxed with straight family pieces**, any other family only reaches a straight 4-set and needs a
duo for its 6, **which then works at increased strength** (rarity is strength); every family now has 5 relics any class can find (Flame and Frost gained one each); the
Necromancer's third class relic moved to Holy (Crypt Key became Hallowed Bones). The names stay. Cursed relics (0.7.1) stay standalone, very rare,
very strong and risky, outside the families. An alternative structure Jesse suggested (core element families and rarer families) is sketched at
the end for comparison.

### How it fits together

- **Seven families**, each with one core mechanic. Every relic uses or feeds its family's mechanic; set bonuses at **2, 4 and 6** relics
  held change how you play. Every family has **5 relics any class can find**, plus the class relics of the classes that prefer it.
- **Preferred families.** Every class prefers three families, and its three class relics are one in each. So in a preferred family a class
  can find **6 straight pieces** (5 + its class relic) and max the family; in any other family it finds 5, which gives the 2 and 4 bonuses, and
  the 6 needs a duo piece (a duo counts for both its families). **A 6-set completed with a duo works at 125% strength** (all its numbers):
  the rarer route is the stronger one. *(v0.7.5, #96: a duo no longer counts toward families, so a 6 needs six relics of the family: see A5.)*
  The class select shows each class's preferred families, and the compendium shows which relics your class can find.
- **50 relics**: 35 that any class can find and 15 class relics (3 per class, one in each preferred family). Rarity sets how often a relic
  is offered (common, rare, legendary), not how many you can hold: there are no duplicates.
- **Attunement** (A4): a relic grows by doing its work. **Tier II** strengthens the numbers; **tier III awakens** it: an extra behavior with its own
  name. Numbers below are tier I → tier II.
- **12 duos** (A5): hold the two named source relics and a gold fourth card can offer the duo at a relic moment. A duo combines its two relics
  into one (v0.7.5); the families keep their counts.
- *Scaling* marks a number that grows with the class's secondary stat (Faith, Rage, Grace, Soul Power, Focus: "S" below).
- New mechanics the list needs, each small and reusable: **ward** (a shield that absorbs damage before HP, the Holy family's), **armor stacks**
  (Steel: +3% armor each, 5 max, they fade 4 s after the last one was gained), **block** (Steel: a blocked hit does no damage), **lightning strike**
  (Storm: a small area hit where a bolt lands). Burn, chill and freeze, bleed, curse, corpses and skeletons already exist.

### Families and set bonuses

| Family | Core mechanic | Damage | Preferred by | 2 | 4 | 6 |
|---|---|---|---|---|---|---|
| 🔥 Flame | Burn stacks and fire bursts | Fire | Paladin, Angel, Archer | **Stoked**: burns stack one higher (6), and burn damage +1% per S | **Pyre**: burning enemies explode on death for 20% of their max HP (+1% per S) | **Inferno**: all your damage adds a burn stack, and every 2 s each burning enemy spreads a stack to its nearest neighbour |
| ❄️ Frost | Chill → freeze → shatter | Frost | Angel, Necromancer, Archer | **Biting Cold**: chill builds 50% faster | **Shatter**: frozen enemies shatter when killed, 30% of their max HP (+1% per S) to enemies around them | **Rimewalker**: you leave a frost trail that chills, and an enemy that touches you freezes for 0.6 s (each enemy at most every 3 s) |
| ⚡ Storm | Chains and speed | Physical (lightning visuals) | Archer, Viking | **Arc**: every 5th hit chains to a second enemy for 60% (every 4th from 15 S) | **Thunderstrike**: crits call a lightning strike (50% of the hit, small area) | **Tempest**: chains jump 50% further, and 10 kills within 5 s reset your utility cooldown |
| 🩸 Blood | Bleed, and HP for power | Physical | Viking | **Open Wounds**: every bleed you apply adds one stack more | **Bloodlust**: +1% damage per 2% HP missing (max 40%), and killing a bleeding enemy heals 1% max HP | **Blood Magic**: while your signature ability cools down you can cast it anyway by paying 20% of your current HP (once per cooldown) |
| ✨ Holy | Healing, ward and blessing | Holy | Paladin, Angel, Necromancer | **Blessed**: healing also grants ward equal to 25% of the heal (ward up to 15% max HP, +1% per S) | **Radiance**: overhealing becomes a holy pulse around you, twice the overheal as damage | **Communion**: your ward's maximum doubles, and your heals and ward also reach your minions and nearby allies at full strength |
| 💀 Grave | Corpses, summons and curse | Shadow | Necromancer | **Charnel**: corpses last twice as long, and walking over one adds attunement to your Grave relics | **Undying Host**: every 10th kill raises a skeleton for you, whatever your class (max 3, +1 per 10 S) | **Legion**: your minions' hits trigger your on-hit relic effects |
| 🛡️ Steel | Armor stacks, block, thorns | Physical | Paladin, Viking | **Bulwark**: blocking or taking a hit gives an armor stack (max 5, +1 per 10 S) | **Spiked**: thorns: an enemy that hits you takes 2× your armor % × the hit back (on top of Thorn Mail) | **Juggernaut**: at full armor stacks your next attack releases them all as a shockwave (damage per stack, knockback) |

### The relics

Tier I → tier II, then the awakening at tier III. "Suits" is where a relic shines; every relic works for every class unless it names one.

#### 🔥 Flame (9 + 5 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Brimstone Oil | common | Attacks have a 25% → 35% chance to add a burn stack (20% of the hit per second) | **Hellfire**: ability hits add 2 burn stacks | Archer, Angel |
| Emberheart | common | +60% → 80% damage for each burning enemy within 250 px (max 5) | **Kindled**: while 5 or more burning enemies are near, every hit adds a burn stack | any |
| Salamander Scale | rare | Enemies at 3+ burn stacks take 25% → 35% more damage from you | **Scorched Earth**: an enemy that dies at full burn stacks leaves a fire patch for 3 s that adds burn stacks | Paladin, Viking |
| Cinder Charm | common | A burning enemy you kill throws an ember at the nearest enemy: 1 → 2 burn stacks | **Ember Storm**: the ember splits in three | any |
| Ember Mantle *(v0.10, #200)* | rare | Every 1.5 → 1 s, enemies within 120 px of you catch fire: 1 burn stack | **Firewalk**: you leave a trail of fire (6 damage per second, for 2 s) | Viking, Paladin |
| Dragon's Tongue | legendary | Every 8 → 6 s your next attack also breathes a cone of fire: 3 → 4 burn stacks | **Wyrmfire**: the cone detonates every burn it touches for its remaining damage at once | Archer, Paladin |
| Flashpowder *(v0.12)* | rare | Once every 1 → 0.7 s your next hit sparks: an enemy at 2+ burn stacks flares, 32 → 40 fire damage (grows with level) and a burn stack to every enemy within 100 px; any other catches 2 burn stacks | **Chain Reaction**: enemies a flare brings up to 3 burn stacks flare too (one link) | any |
| Pitch Pot *(v0.12)* | rare | Every 2 → 1.5 s you fling burning pitch at the nearest enemy, and every burning enemy near you drips it: a fire patch at their feet for 3 s (8 damage per second, grows with level) that sets a burn stack (up to 4 → 6 patches) | **Tar Pit**: an enemy that dies in burning pitch bursts into fire (a Pyre explosion) | Paladin, Viking |
| Crown of Cinders *(v0.12)* | legendary | Your attack hits set an enemy that isn't burning alight (1 burn stack). When a burning enemy dies its fire leaps on: every enemy within 110 → 140 px catches its burn stacks and takes 12 → 16 fire damage (grows with level) | **Conflagration**: the fire leaps up to 200 px and adds 1 more burn stack | any |
| Fire Arrows *(Archer)* | rare | Arrow Volley arrows each add a burn stack; burn damage +2% → 3% per Focus | **Rain of Cinders**: the Volley's area keeps burning for 3 s | Archer |
| Sunfire Censer *(Angel)* | rare | Heavenly Radiance adds 1 + Grace/6 → Grace/4 burn stacks to everything it hits | **Solar Flare**: enemies killed by Radiance burst into fire (a Pyre explosion) | Angel |
| Radiant Brand *(Paladin)* | rare | Divine Shield's burst adds 2 + Faith/5 → Faith/4 burn stacks | **Pillar of Dawn**: while the shield holds, burning enemies touching you take their burn damage again every second | Paladin |
| Surtr's Brand *(Viking, v0.12)* | rare | During Berserker Rage every attack hit stokes your axe (up to 8 + Rage stokes). When Rage ends the fire bursts out: 24 → 32 fire damage per stoke (grows with level) and 2 burn stacks to every enemy within 170 px | **Twilight**: at full stokes the fire bursts out at once, and the count starts again | Viking |
| Bonefire *(Necromancer, v0.12)* | rare | Your skeletons burn: every 1.5 → 1 s each sets the enemies within 90 px of it alight, a burn stack (8 damage per second, grows with level, +4% per Soul Power) | **Balefire**: a skeleton you raise rises in a burst of fire, 24 fire damage (grows with level) and 2 burn stacks to every enemy within 110 px | Necromancer |

#### ❄️ Frost (5 + 3 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Frost Brand | common | Attacks have a 90% → 100% chance to chill (1 chill) | **Hoarfrost**: chilled enemies deal 20% less damage | Archer, Angel |
| Winter's Grasp | common | Your signature ability chills everything it hits (5 → 7 chill) | **Deep Freeze**: enemies your ability freezes stay frozen 1 s longer | any |
| Shatterglass | rare | Your hits on frozen enemies always crit, with +25% → 40% crit damage | **Splinter**: a crit on a frozen enemy sprays 3 ice shards that chill | Archer, Viking |
| Glacial Heart | rare | While 3 or more chilled enemies are near you, you take 15% → 20% less damage | **Cold Blood**: every freeze near you gives +20% attack speed for 2 s | any |
| Everfrost Crown | legendary | Every 10 → 7 s a frost nova around you chills everything within 200 px (3 chill) | **Blizzard**: the nova leaves a freezing field for 3 s | any |
| Rimebow *(Archer)* | rare | Crits chill (2 chill); chill +3% → 4% per Focus | **Frozen Volley**: Arrow Volley freezes what it hits for 0.5 s | Archer |
| Frostward Halo *(Angel)* | rare | Heavenly Radiance chills (2 chill) and heals 15% → 20% more per frozen enemy near you (max 3) | **Winter Grace**: freezing an enemy near you grants ward (2% max HP) | Angel |
| Lich Lantern *(Necromancer)* | rare | Skeletons' hits chill (1 chill, +1 per 15 → 10 Soul Power) | **Frost Legion**: skeletons burst in a frost nova when they expire | Necromancer |

#### ⚡ Storm (5 + 2 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Storm Pennant | common | Attacks have a 25% → 35% chance to chain to another enemy for 60% → 70% | **Thunderhead**: chains jump twice | Archer, Viking |
| Quicksilver Spurs | common | Every chain or crit gives +2% → 3% attack and movement speed for 4 s (max 10 stacks) | **Blur**: at 10 stacks your utility cools down 50% faster | any |
| Tempest Eye | rare | +10% → 15% crit chance; crits chain to another enemy for 40% → 50% | **Eye of the Storm**: chain hits can crit | Archer, Angel |
| Thunder Drum | rare | Using your ability sounds a thunderclap: 30 → 45 damage around you (grows with level), chaining from every enemy hit | **Rolling Thunder**: the thunderclap sounds again 1 s later | any |
| Stormcaller's Horn | legendary | Every 15 → 12 kills, a lightning strike hits the toughest enemy near you (3× your hit) | **Skyfury**: the strike chains to 3 more enemies | any |
| Galeforce Quiver *(Archer)* | rare | Arrows pierce one more enemy per 4 → 3 Focus, and a pierced enemy is chained to | **Gale Shot**: every 10th arrow is a lightning bolt that chains 5 times | Archer |
| Stormborn Pelt *(Viking)* | rare | During Berserker Rage every 4th → 3rd hit chains; Rage × 1% chain damage | **Thunder God**: kills during Rage extend it by 0.03 s × Rage (up to double) | Viking |

#### 🩸 Blood (5 + 1 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Serrated Edge | common | Crits open 7 → 8 bleed stacks (100% of the hit per second each) | **Haemorrhage**: +20% crit damage against bleeding enemies | Archer, Viking |
| Butcher's Hook | common | Bleeding enemies are slowed 15% → 20% and take 15% → 20% more damage from your attacks | **Gutting**: a bleeding enemy you kill passes its bleed to 2 enemies near it | Viking, Paladin |
| Berserker Tooth | rare | +10% → 15% attack speed, and +1% more per 0.1% → 0.08% of HP missing (max 80% → 100%) | **Last Blood**: below 25% HP, every bleed you apply is doubled | Viking |
| Vampire Fang | rare | Hits on bleeding enemies heal 3% → 5% of the damage (under the relic healing cap) | **Thirst**: below half HP, doubled | any melee |
| Blood Pact | legendary | +40% → 55% damage, but max HP is cut by 25% → 20% | **Covenant**: under half HP, kills restore 1% max HP | any |
| Wolfskin Cloak *(Viking)* | rare | During Berserker Rage your hits add a bleed stack; +1 per 15 → 10 Rage | **Blood Frenzy**: bleeding enemies you kill during Rage give 5% attack speed for the rest of it (max 25%) | Viking |

#### ✨ Holy (5 + 3 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Rally Banner | common | Heal 12% → 18% max HP at the start of every wave | **Hymn**: the heal also grants that much ward | any |
| Blessed Water | common | Your healing is 20% → 30% stronger | **Baptism**: every heal also cleanses one status (poison, bleed, curse, chill) | Paladin, Angel |
| Guardian's Aegis | rare | Every 12 → 9 s gain ward equal to 10% max HP | **Faithful**: while warded, +15% damage | any |
| Halo of Mercy | rare | Kills have a 8% → 12% chance to drop a mercy orb (heals 5% max HP) | **Grace**: orbs also grant that much ward | any |
| Phoenix Feather | legendary | Once per run, rise from death with 50% → 100% HP | **Rebirth**: rising sets everything near you ablaze with holy fire | any |
| Reliquary of Saints *(Paladin)* | rare | Every hit you take shaves 0.02 → 0.03 s × Faith off Divine Shield's cooldown | **Martyr's Relic**: Divine Shield also grants ward equal to 1% max HP per Faith when it ends | Paladin |
| Seraph's Halo *(Angel)* | rare | Heavenly Radiance also fires 4 + Grace × 0.8 → 6 + Grace light bolts | **Choir of Light**: the bolts heal you for 1% max HP each when they hit | Angel |
| Hallowed Bones *(Necromancer)* | rare | Skeletons you raise carry a ward of 20% → 30% of their HP, and a skeleton that expires heals you 1% max HP (+0.1% per Soul Power) | **Sanctified Legion**: skeletons' hits heal you for 0.5% of the damage | Necromancer |

#### 💀 Grave (9 + 5 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Soul Lantern | legendary | Kills have a 10% → 15% chance to raise a skeleton ally (max 4 → 6) | **Lantern of the Lost**: skeletons burst in shadow when they expire | any |
| Hex Doll | rare | Your signature ability curses what it hits: 1 → 2 stacks (+12% damage taken per stack, max 3) | **Voodoo**: a cursed enemy that dies passes its curse to the nearest enemy | any |
| Grave Pact | rare | Your ability blesses your minions for 7 → 10 s (+30% damage, they mend); with no minions it raises one skeleton for that long | **Unholy Pact**: blessed minions' hits curse | Necromancer, any |
| Gravedigger's Spade | common | +3% → 4% damage for every corpse within 150 px (max 5) | **Exhume**: every 20 s the oldest corpse near you rises as a skeleton | any |
| Deathmask | common | Cursed enemies deal 15% → 20% less damage | **Mark of the Grave**: a cursed enemy you kill leaves a corpse that bursts in shadow after 1 s | any |
| Barrow Boots *(v0.13)* | common | Walking over a corpse stomps it once: 30 → 38 shadow damage (grows with level) to every enemy within 85 px | **Grave Stomp**: a stomp curses what it hits | any |
| Plague Censer *(v0.13)* | rare | Every 4 → 3 kills, plague ground spreads where the last enemy fell, for 8 s: 10 → 13 shadow damage per second (grows with level), and it poisons (up to 3 → 4 patches) | **Blight Bloom**: an enemy that dies in your plague ground leaves plague ground of its own | any |
| Sexton's Bell *(v0.13)* | rare | Every 6 → 4.5 s up to 3 → 4 corpses within 180 px rise as skeleton allies for 10 s, a corpse about to rise against you first | **Death Toll**: each toll curses every enemy within its reach | Necromancer, any |
| Crown of Antlers *(v0.13)* | legendary | You take 5% → 7% less damage for each of your skeletons within 200 px (up to 3); kills have an 8% → 12% chance to raise a guard (up to 3 → 4) | **Court of Bones**: while 3+ guards stand near you, you mend 1% of your max HP every second | any |
| Bone Chime *(Necromancer)* | rare | Minions inherit 50% → 70% of your attack speed, plus 2% → 3% per Soul Power | **Death Knell**: every 20th minion hit tolls the chime: a shadow burst around that minion | Necromancer |
| Ossuary Seal *(Paladin, v0.13)* | rare | When Divine Shield ends, up to 1 + Faith/5 → Faith/4 corpses within 220 px rise as skeletons for 10 s | **Sworn Dead**: while the shield holds, every enemy that strikes it is cursed (2 stacks) | Paladin |
| Draugr's Mead *(Viking, v0.13)* | rare | Every enemy you strike down during Berserker Rage rises as a draugr for 10 s (up to 2 + Rage/5 → Rage/4 at once) | **Einherjar**: when Rage ends every draugr howls, 30 shadow damage within 80 px | Viking |
| Last Rites *(Angel, v0.13)* | rare | Heavenly Radiance lays the corpses within its radius to rest (up to 4 + Grace/4 → Grace/3), each healing 3% → 4% max HP | **Psychopomp**: each corpse laid to rest curses the enemies within 90 px (2 stacks) | Angel |
| Wightbone Arrows *(Archer, v0.13)* | rare | Every corpse in Arrow Volley's area bursts, 20 → 28 damage within 70 px (+3% per Focus) | **Barrow Wights**: enemies your ability kills rise as skeletons for 10 s (up to 3) | Archer |

#### 🛡️ Steel (9 + 5 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Tower Shield | common | 10% → 14% chance to block a hit | **Shield Wall**: a block knocks the attacker back and stuns it for 0.5 s | any |
| Thorn Mail | common | Enemies that hit you take 3× → 4× that damage back | **Briar Plate**: blocked hits are thrown back too | Paladin, Viking |
| Anvil Heart | rare | +1% damage per 2% → 1.5% armor you have | **Forgefire**: at full armor stacks your hits stagger (a short slow) | Paladin, Viking |
| Shockwave Sigil | rare | Taking damage releases a shockwave (30 → 45 damage, grows with level; every 4 → 3 s) | **Quake Plate**: the shockwave gives an armor stack per enemy it hits | any |
| Unbreakable | legendary | Once every 30 → 20 s, a hit that would take more than 25% of your HP is blocked | **Adamant**: after it blocks, +50% armor for 4 s | any |
| Aegis of the Faithful *(Paladin)* | rare | When Divine Shield ends you gain armor stacks: 1 per 5 → 4 Faith | **Consecrated Steel**: while at full armor stacks, Divine Shield's burst is 50% larger | Paladin |
| Ironhide *(Viking)* | rare | Berserker Rage gives an armor stack every 2 → 1.5 s | **Unstoppable**: during Rage, blocked hits heal 2% max HP | Viking |
| Rivet Hammer *(v0.11)* | common | Every 4th → 3rd attack hit drives a rivet: +22 → 28 damage (grows with level) and an armor stack | **Sunder**: a rivet breaks the armor or shield of the enemy it strikes (not a boss's) | any |
| Pavise *(v0.11)* | rare | 25% → 35% chance to block a hit from an enemy in front of you (within 60° of where you strike) | **Riposte**: a block from the front strikes the attacker for 3× the hit | any |
| Reprisal Cuirass *(v0.11)* | rare | Every hit that comes at you, blocked or not, is kept at full force (up to 25% of max HP); your next attack hit adds 8× → 10× that as damage | **Vengeance**: the reprisal also strikes every enemy within 90 px of the target for 50% of it | any |
| Heart of the Hold *(v0.11)* | legendary | Armor stacks never fade and you hold 3 more; a hit you take or block gives an armor stack, and the attacker takes 8 → 12 damage per stack you hold (grows with level) | **Iron Keep**: at full armor stacks, hits take 20% less damage | any |
| Iron Halo *(Angel, v0.11)* | rare | Heavenly Radiance gives 1 + Grace/5 → 4 armor stacks and strikes everything it hits for 6 → 8 damage per armor stack you hold (grows with level) | **Aureole**: Radiance heals 5% more per armor stack you hold | Angel |
| Legion Plate *(Necromancer, v0.11)* | rare | Every 6th → 4th minion hit gives you an armor stack; minion hits deal 3% → 4% more per armor stack you hold | **Iron Legion**: skeletons you raise wear plate, 50% more HP | Necromancer |
| Bodkin Points *(Archer, v0.11)* | rare | Every 3rd arrow hit is a bodkin: 40% → 60% of the hit again, +2% per Focus, that no shield turns, and an armor stack | **Armor-Piercer**: at full armor stacks every arrow hit is a bodkin | Archer |

### Duo relics (15)

Hold both source relics and a duo can be offered (a gold fourth card, it takes the moment's pick). A duo combines its two source relics into
one relic with both their effects and its own, attuning as one up to tier III; the families keep the two relics' counts (v0.7.5, #96). Each
source relic can feed only one formed duo.

| Duo | Families | Source relics | Effect |
|---|---|---|---|
| **Thermal Shock** | Flame + Frost | Brimstone Oil + Frost Brand | A burning enemy that freezes takes the rest of its burn damage twice, at once |
| **Wildfire** | Flame + Storm | Emberheart + Storm Pennant | Chains copy the burn stacks of the enemy they jump from |
| **Boiling Blood** | Flame + Blood | Salamander Scale + Serrated Edge | Enemies that burn and bleed take both ticks 50% faster |
| **Funeral Pyre** | Flame + Grave | Dragon's Tongue + Gravedigger's Spade | Fire that touches a corpse detonates it (a Pyre explosion) |
| **Hailstorm** | Frost + Storm | Everfrost Crown + Thunder Drum | Chains chill; a chain that hits a frozen enemy jumps twice more |
| **Rime Dead** | Frost + Grave | Winter's Grasp + Soul Lantern | Skeletons' hits chill, and frozen enemies you kill rise as skeletons |
| **Glacier Plate** | Frost + Steel | Shatterglass + Tower Shield | A block freezes the attacker |
| **Red Lightning** | Storm + Blood | Tempest Eye + Butcher's Hook | Chains add a bleed stack, and a crit on a bleeding enemy chains to two more enemies (built: Tempest Eye already chains every crit, so "always chain" gave nothing) |
| **Lightning Rod** | Storm + Steel | Stormcaller's Horn + Shockwave Sigil | The shockwave calls a lightning strike on every enemy it hits |
| **Martyr's Covenant** | Blood + Holy | Blood Pact + Guardian's Aegis | 30% of the damage you take comes back as ward over 3 s |
| **Requiem** | Holy + Grave | Halo of Mercy + Deathmask | Cursed enemies always drop a mercy orb |
| **Consecration** | Holy + Steel | Rally Banner + Thorn Mail | Ward you gain also gives an armor stack, and a block heals 2% max HP |
| **Iron Tithe** *(v0.11)* | Steel + Blood | Reprisal Cuirass + Vampire Fang | A reprisal opens 3 bleed stacks on its target (10% of it per second each) and heals you 3% of its damage |
| **Baptism of Fire** *(v0.12)* | Flame + Holy | Flashpowder + Blessed Water | A flare heals you 1% of your max HP for every enemy it catches (up to 4) |
| **Barrow Feast** *(v0.13)* | Grave + Blood | Hex Doll + Berserker Tooth | Walking over a corpse devours it: it heals you 1.5% of your max HP and curses every enemy within 100 px |

### Rules check

| Rule (A3, A5, Jesse's review) | Check | Result |
|---|---|---|
| Every relic has exactly one family | 50 relics, each listed once under one family | ✔ |
| Each family has 5-7 relics | Counted per class, which is what a player meets: a preferred family has 6, any other 5. Counting every class's class relics too: Flame 8, Frost 8, Storm 7, Blood 6, Holy 8, Grave 6, Steel 7 | ✔ per class (the three 8s only count relics no single class can all find) |
| Every relic uses or feeds its family's core mechanic | Flame: burn stacks or a fire burst. Frost: chill, freeze or shatter. Storm: chains, chaining crits, speed from chains. Blood: bleed or HP for power. Holy: healing or ward. Grave: corpses, skeletons or curse. Steel: armor stacks, block or thorns. The old plain stat relics are gone (below) | ✔ |
| Every class has 3 class relics, each in a family, tied to its ability or secondary stat | Paladin: Radiant Brand (Flame), Reliquary of Saints (Holy), Aegis of the Faithful (Steel). Viking: Stormborn Pelt (Storm), Wolfskin Cloak (Blood), Ironhide (Steel). Angel: Sunfire Censer (Flame), Frostward Halo (Frost), Seraph's Halo (Holy). Necromancer: Lich Lantern (Frost), Bone Chime (Grave), Hallowed Bones (Holy). Archer: Fire Arrows (Flame), Rimebow (Frost), Galeforce Quiver (Storm) | ✔ |
| Every class has at least two families that suit it well | Three preferred families each, where it can max the set: Paladin Flame, Holy, Steel. Viking Blood, Storm, Steel. Angel Flame, Frost, Holy. Necromancer Frost, Holy, Grave. Archer Flame, Frost, Storm | ✔ |
| No family is useless for any class | Every family has 5 relics any class can find and reaches a straight 4-set for everyone; at least three relics per family work for every class ("any" rows); Grave's minion-dependence is covered by Undying Host, Soul Lantern, Exhume and Grave Pact's fallback skeleton | ✔ |
| A 6-set without 6 straight pieces is adjusted | Outside its preferred families a class needs a duo piece for the 6; such a 6-set works at 125% strength (rarity is strength) | ✔ |
| Set bonuses scale with the secondary stat where it fits | Stoked, Pyre, Arc, Shatter, Blessed, Undying Host, Bulwark scale with S; the rest are rules, not numbers | ✔ |
| At least 12 duos, each from two specific relics of two different families | 12 duos, 24 distinct source relics, all findable by every class | ✔ |
| No family in more than 4 duo recipes, every family in at least 2 | Flame 4, Frost 4, Storm 4, Blood 3, Holy 3, Grave 3, Steel 3 (with the realms' duos: Blood 4 and Steel 4 since Iron Tithe, Holy 4 and Flame 5 since Baptism of Fire; the most is 5 from v0.12 on, C5; Grave 4 and Blood 5 since Barrow Feast, C7) | ✔ |
| Each relic feeds at most one formed duo | Every source relic appears in exactly one recipe | ✔ |

### What leaves, what stays

- **Removed**: the plain stat relics (Whetstone, Swift Boots, Lucky Coin, Scholar's Tome, Lodestone, Iron Band), the conditional stat relics
  (War Horn, Sentinel's Stance, Conqueror's Crown, Executioner's Hood), Sands of Chronos, Powder Keg (its explosion becomes Flame's Pyre),
  Hawkeye Quiver (becomes Galeforce Quiver), all 12 synergies and 4 clashes (replaced by duos), the stacking soft caps and proc sharing (A6).
- **Kept and reworked into a family**: Brimstone Oil, Frost Brand, Serrated Edge, Storm Pennant, Vampire Fang, Blood Pact, Rally Banner,
  Phoenix Feather, Soul Lantern, Hex Doll, Grave Pact, Thorn Mail, Shockwave Sigil, Echo Bell (as Thunder Drum), and the class relics
  Reliquary of Saints, Wolfskin Cloak, Seraph's Halo, Bone Chime.
- **Compendium migration** (A7): a kept relic keeps its discovered state; a removed one maps onto its successor where there is one (Powder Keg →
  Pyre is a set bonus, so no successor; Hawkeye Quiver → Galeforce Quiver; Echo Bell → Thunder Drum); everything new is marked new.
- **Achievements** (A7): the relic achievements move to the new system (a 6-set, 3 duos in one run, awaken 4 relics in one run).

### Review log

**Revision 1** (2026-09-23): the first list. **Jesse's review** (on #5): 6-sets that need a duo are harder to get, so adjust the 6's strength
when there are not 6 straight family pieces; consider core element families with more relics plus rarer families with fewer set bonuses; show
at character select which families suit a class, with all families open to all classes but the preferred ones able to max (Paladin: Flame,
Holy, Steel); the names are fine; cursed relics standalone, very rare, very strong, with a risk.

**Revision 2** (this one): preferred families (three per class, one class relic in each, shown at character select and in the compendium);
a straight 6-set only in preferred families, otherwise a duo completes the 6 at 125% strength; 5 findable relics in every family (+Cinder Charm,
+Glacial Heart); Crypt Key replaced by Hallowed Bones (Necromancer, Holy).

**Approved** by Jesse on #5 (2026-09-23): revision 2, with one change: "rarity should equal strength", so a 6-set completed with a duo is
**stronger** than a straight 6-set of the same family, not weaker (125%). The element alternative is not taken.
