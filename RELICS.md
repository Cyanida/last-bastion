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
find. A formed duo counts toward both families (a 6 completed with it works at 125%), shows in the HUD, the pause screen and the Relics results
(its damage and healing credited to it), lands in the run log and emits `onDuoFormed`. The pick screen says when a relic would complete a duo;
relic tooltips name their duo; the compendium shows each recipe as a hint until the duo is formed once (`save.duos`).

First measure (the first-pick bot, maxed saves, 10 runs): 2.5 duos a run, 3 or more in 5 of 10, above the target (1-2, 3+ under 15%). That bot
holds ~22 relics by wave 40 and takes every duo; A8 measures with the family-following bot and, if it stays high, offers fewer duos (no cap).

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
  the rarer route is the stronger one.
  The class select shows each class's preferred families, and the compendium shows which relics your class can find.
- **50 relics**: 35 that any class can find and 15 class relics (3 per class, one in each preferred family). Rarity sets how often a relic
  is offered (common, rare, legendary), not how many you can hold: there are no duplicates.
- **Attunement** (A4): a relic grows by doing its work. **Tier II** strengthens the numbers; **tier III awakens** it: an extra behavior with its own
  name. Numbers below are tier I → tier II.
- **12 duos** (A5): hold the two named source relics and a gold fourth card can offer the duo at a relic moment. A duo counts toward both families.
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

#### 🔥 Flame (5 + 3 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Brimstone Oil | common | Attacks have a 25% → 35% chance to add a burn stack (20% of the hit per second) | **Hellfire**: ability hits add 2 burn stacks | Archer, Angel |
| Emberheart | common | +6% → 8% damage for each burning enemy within 250 px (max 5) | **Kindled**: while 5 or more burning enemies are near, every hit adds a burn stack | any |
| Salamander Scale | rare | Enemies at 3+ burn stacks take 25% → 35% more damage from you | **Scorched Earth**: an enemy that dies at full burn stacks leaves a fire patch for 3 s that adds burn stacks | Paladin, Viking |
| Cinder Charm | common | A burning enemy you kill throws an ember at the nearest enemy: 1 → 2 burn stacks | **Ember Storm**: the ember splits in three | any |
| Dragon's Tongue | legendary | Every 8 → 6 s your next attack also breathes a cone of fire: 3 → 4 burn stacks | **Wyrmfire**: the cone detonates every burn it touches for its remaining damage at once | Archer, Paladin |
| Fire Arrows *(Archer)* | rare | Arrow Volley arrows each add a burn stack; burn damage +2% → 3% per Focus | **Rain of Cinders**: the Volley's area keeps burning for 3 s | Archer |
| Sunfire Censer *(Angel)* | rare | Heavenly Radiance adds 1 + Grace/6 → Grace/4 burn stacks to everything it hits | **Solar Flare**: enemies killed by Radiance burst into fire (a Pyre explosion) | Angel |
| Radiant Brand *(Paladin)* | rare | Divine Shield's burst adds 2 + Faith/5 → Faith/4 burn stacks | **Pillar of Dawn**: while the shield holds, burning enemies touching you take their burn damage again every second | Paladin |

#### ❄️ Frost (5 + 3 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Frost Brand | common | Attacks have a 25% → 35% chance to chill | **Hoarfrost**: chilled enemies deal 20% less damage | Archer, Angel |
| Winter's Grasp | common | Your signature ability chills everything it hits (2 → 3 chill) | **Deep Freeze**: enemies your ability freezes stay frozen 1 s longer | any |
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
| Serrated Edge | common | Crits open 2 → 3 bleed stacks (10% of the hit per second each) | **Haemorrhage**: +20% crit damage against bleeding enemies | Archer, Viking |
| Butcher's Hook | common | Bleeding enemies are slowed 15% → 20% and take 15% → 20% more damage from your attacks | **Gutting**: a bleeding enemy you kill passes its bleed to 2 enemies near it | Viking, Paladin |
| Berserker Tooth | rare | +1% attack speed per 3% → 2% of HP missing (max 30% → 40%) | **Last Blood**: below 25% HP, every bleed you apply is doubled | Viking |
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

#### 💀 Grave (5 + 1 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Soul Lantern | legendary | Kills have a 10% → 15% chance to raise a skeleton ally (max 4 → 6) | **Lantern of the Lost**: skeletons burst in shadow when they expire | any |
| Hex Doll | rare | Your signature ability curses what it hits: 1 → 2 stacks (+12% damage taken per stack, max 3) | **Voodoo**: a cursed enemy that dies passes its curse to the nearest enemy | any |
| Grave Pact | rare | Your ability blesses your minions for 7 → 10 s (+30% damage, they mend); with no minions it raises one skeleton for that long | **Unholy Pact**: blessed minions' hits curse | Necromancer, any |
| Gravedigger's Spade | common | +3% → 4% damage for every corpse within 150 px (max 5) | **Exhume**: every 20 s the oldest corpse near you rises as a skeleton | any |
| Deathmask | common | Cursed enemies deal 15% → 20% less damage | **Mark of the Grave**: a cursed enemy you kill leaves a corpse that bursts in shadow after 1 s | any |
| Bone Chime *(Necromancer)* | rare | Minions inherit 50% → 70% of your attack speed, plus 2% → 3% per Soul Power | **Death Knell**: every 20th minion hit tolls the chime: a shadow burst around that minion | Necromancer |

#### 🛡️ Steel (5 + 2 class)

| Relic | Rarity | Effect (I → II) | Awakened (III) | Suits |
|---|---|---|---|---|
| Tower Shield | common | 10% → 14% chance to block a hit | **Shield Wall**: a block knocks the attacker back and stuns it for 0.5 s | any |
| Thorn Mail | common | Enemies that hit you take 3× → 4× that damage back | **Briar Plate**: blocked hits are thrown back too | Paladin, Viking |
| Anvil Heart | rare | +1% damage per 2% → 1.5% armor you have | **Forgefire**: at full armor stacks your hits stagger (a short slow) | Paladin, Viking |
| Shockwave Sigil | rare | Taking damage releases a shockwave (30 → 45 damage, grows with level; every 4 → 3 s) | **Quake Plate**: the shockwave gives an armor stack per enemy it hits | any |
| Unbreakable | legendary | Once every 30 → 20 s, a hit that would take more than 25% of your HP is blocked | **Adamant**: after it blocks, +50% armor for 4 s | any |
| Aegis of the Faithful *(Paladin)* | rare | When Divine Shield ends you gain armor stacks: 1 per 5 → 4 Faith | **Consecrated Steel**: while at full armor stacks, Divine Shield's burst is 50% larger | Paladin |
| Ironhide *(Viking)* | rare | Berserker Rage gives an armor stack every 2 → 1.5 s | **Unstoppable**: during Rage, blocked hits heal 2% max HP | Viking |

### Duo relics (12)

Hold both source relics and a duo can be offered (a gold fourth card, it takes the moment's pick). A duo counts toward both families; each
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
| No family in more than 4 duo recipes, every family in at least 2 | Flame 4, Frost 4, Storm 4, Blood 3, Holy 3, Grave 3, Steel 3 | ✔ |
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
