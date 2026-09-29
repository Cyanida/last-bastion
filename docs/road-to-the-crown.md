# Road to the Crown: the build plan

Approved by Jesse on 28-09-2026. This is the plan from v0.8.3 to v1.0.0 and after, as the builders follow it: the world, the menus, the rules, the relics, the releases in order, the builder brief and the decisions log. [ROADMAP.md](../ROADMAP.md) lists the releases; the umbrella issue is [#153](https://github.com/Cyanida/last-bastion/issues/153). Numbers are starting values for the sim, not promises. When this plan and the code disagree, the code facts win: adjust BALANCE.md or RELICS.md and say so on the issue.

## Changes on 28-09 (Jesse, in chat)

- **Nobody waits for Jesse.** The approval gates below no longer stop the build.
  - At a gate, the builder posts what it made on the issue for Jesse to look at when he likes: preview images committed under `docs/review/` and linked, and the sim output.
  - Then it carries on.
  - If Jesse comments later, that comment is acted on first in the next run.
- **Open design questions don't stop the build either.** Where this plan leaves something open, the builder:
  - picks the most balanced option that fits the plan;
  - notes it on the issue as "🤖 Decided: ...";
  - adds it to the decisions log at the end of this file, marked ◆.
- **Stacked release branches, up to v1.0.0.** Each release branch starts from the previous release's branch, not from main:
  - `patch/0.8.3` starts from the v0.8.2 tag, `release/0.9.0` from `patch/0.8.3`, `release/0.10.0` from `release/0.9.0`, and so on up to `release/1.0.0`;
  - so a release is built while the one before it still waits for Jesse's merge;
  - each release still gets its own `ready to merge` pull request into main, and Jesse merges them in version order, whenever he likes.
- **A release's "done when" never waits on Jesse.** Where it names a gate or something Jesse plays (a crown boss, a full finale), the builder posts it for him, and the release counts as done without waiting.
- **After v1.0.0 the builder stops.** The realms after 1.0 (v1.1.0 to v1.3.0) wait for Jesse's go.

## The world

### The Marches
Ring 1 · open from the start · 7 levels

- **Arena:** The Castle Courtyard
- **Teaches:** Marked attacks and the perfect dodge, commanders, and one relic family per level
- **Bosses:** Today's pool; the Warden with a third phase as the crown boss
- **Rewards:** A rare pick per level, one per family; the champion's signature relic at the crown
- **Relics:** One new Flame rare, five signature relics

### The Iron Hold
Ring 2 · opens with the Marches crown · 5 levels

- **Arena:** The Great Keep, as a fortress
- **Teaches:** Armor you break, shields that block from the front, thorns that hit back
- **Bosses:** The Warden; new: the Forgemaster, the Iron King
- **Rewards:** Steel rares, your class relic, the Steel legendaries
- **Relics:** 7 new: 1 common, 2 rares, a legendary, class relics for the Angel, Necromancer and Archer

### The Barrowvale
Ring 2 · opens with the Marches crown · 5 levels

- **Arena:** The Forsaken Graveyard, later the Drowned Fen
- **Teaches:** Corpses that rise unless you trample them, plague ground that lasts
- **Bosses:** The Lich, the Plague Abbot; new: the Barrow King
- **Rewards:** Grave rares, your class relic, the Grave legendaries (Soul Lantern moves here)
- **Relics:** 8 new: 1 common, 2 rares, a legendary, class relics for the Paladin, Viking, Angel and Archer

### The Cinderlands
Ring 2 · opens with the Marches crown · 5 levels

- **Arena:** [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Ember Forge
- **Teaches:** Fire that spreads, burn stacks on you, bursts of fire when foes die
- **Bosses:** The Grand Inquisitor; new: the Ember Queen, the Cinder Colossus
- **Rewards:** Flame rares, your class relic, the Flame legendaries
- **Relics:** 5 new: 2 rares, a legendary, class relics for the Viking and Necromancer

### The Frozen Pass
Ring 3 · opens with 2 crowns · 5 levels

- **Arena:** [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Frozen Pass
- **Teaches:** Chill that stacks on you until you freeze, thin ice, foes that shatter
- **Bosses:** New: the Rime Witch, the Frost Jötun
- **Rewards:** Frost rares, your class relic, the Frost legendaries
- **Relics:** 6 new: 1 common, 2 rares, a legendary, class relics for the Paladin and Viking

### The Stormspire
Ring 3 · opens with 2 crowns · 5 levels

- **Arena:** A storm peak (new)
- **Teaches:** Lightning that chains between foes and into you, fast rushers, wind that pushes
- **Bosses:** New: the Storm Caller, the Thunder Roc
- **Rewards:** Storm rares, your class relic, the Storm legendaries (Stormcaller's Horn moves here)
- **Relics:** 7 new: 1 common, 2 rares, a legendary, class relics for the Paladin, Angel and Necromancer

### The Hallowed Reach
Ring 4 · opens with 4 crowns · 5 levels

- **Arena:** [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Sunken Cathedral
- **Teaches:** Ward-bearers that make squads untouchable, healers you must reach first
- **Bosses:** New: the Ward-Keeper, the Fallen Saint
- **Rewards:** Holy rares, your class relic, the Holy legendaries (Phoenix Feather moves here)
- **Relics:** 6 new: 1 common, 2 rares, a legendary, class relics for the Viking and Archer

### The Crimson Fields
Ring 4 · opens with 4 crowns · 5 levels

- **Arena:** A battlefield (new)
- **Teaches:** Bleed on you, foes that grow stronger as they bleed
- **Bosses:** New: the Butcher, the Crimson Baron
- **Rewards:** Blood rares, your class relic, the Blood legendaries
- **Relics:** 8 new: 1 common, 2 rares, a legendary, class relics for the Paladin, Angel, Necromancer and Archer

### The Last Bastion
Ring 5 · opens with 5 crowns, one from ring 3 · a 40-wave finale

- **Arena:** The Last Bastion
- **Teaches:** Everything, with elite foes
- **Bosses:** Four Acts of bosses, then the Usurper
- **Rewards:** The win; Oaths, Endless and Master live here
- **Relics:** None of its own; 5 starting slots

## The new look (menus)

Two references, one rule. **Kingdom Rush** for the map: painted terrain, dirt roads, level flags with crowns, locked land under clouds, a level scroll with the fight button. **Survivor.io** for the champion: the hero on a pedestal with its slots around it, rarity-coloured frames, a currency bar on top, a big button at the bottom, a tab bar. Everything in Last Bastion's night palette, and everything drawn in code.

The mockups on the plan page show:
- **The champion screen:** the champion on a pedestal, three slots on each side, set chips, the next level and a big green PLAY or RESTART button, the inventory, and a tab bar (Map, Champion, Keep, Relics, Deeds).
- **The realm road with the level panel:**
  - a ribbon with the level name;
  - tier crowns (Squire, Knight, Champion, Legend);
  - the head-start level, slots, enemy HP and minutes;
  - the featured foes and the end boss;
  - the first-clear rewards, a "fell at wave N" note, and Loadout and FIGHT! buttons.

- **Frames.** Dark wood with a brass inner line and brass rivets, parchment for anything you read. No flat rectangles.
- **Buttons.** Chunky, bevelled, with a pressed state: gold for the main action, green for go, dark wood for the rest. One main button per screen.
- **Rarity frames.** Every relic icon sits in a frame of its rarity. (common, rare, legendary, class, signature)
- **The map.** Painted terrain per family, dirt roads with a dark edge, flags with numbers and crowns, clouds over sealed land, ribbons for names.
- **Type.** Cinzel at 800 and 900 for buttons, ribbons and numbers; Alegreya Sans for text; the blackletter only on the title. No new font files.
- **Made in code.** CSS for frames and buttons; the rig in tools/art renders the icon atlas, the map terrain and the props. No hand-made images, as AGENTS.md requires.

## The rules

Everything here is decided: by Jesse, or as the most balanced option where he left it open (marked in the decisions log at the bottom). Numbers are starting values; the sim tunes them against the targets in the last card.

### 1 · The world

- **The Marches** (start, 7 levels), **seven relic realms** (one per family, 5 levels each), **the Last Bastion** (the finale).
- Ring 2 opens with the Marches crown: the Iron Hold (Steel), the Cinderlands (Flame), the Barrowvale (Grave). Ring 3 at 2 crowns: the Frozen Pass (Frost), the Stormspire (Storm). Ring 4 at 4 crowns: the Hallowed Reach (Holy), the Crimson Fields (Blood).
- The Last Bastion opens at 5 crowns, one of them from ring 3.
- Every realm shows on the map from the first release, under clouds, with what opens it. Thresholds are data, so they hold while realms are still being built.
- One arena per realm to start: the Castle Courtyard (Marches), the Great Keep (Iron Hold), [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Ember Forge (Cinderlands), the Forsaken Graveyard (Barrowvale), [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Frozen Pass, a storm peak (new), [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Sunken Cathedral (Hallowed Reach), a battlefield (new); the Last Bastion stays.

### 2 · Champions

- **One champion per class.** A champion is a class with a name, a map of its own, crowns per tier, an inventory, saved loadouts and a talent plan.
- Class mastery, sacred treasures, wins, Oaths and Endless records stay per class, which is now per champion.
- The Keep, deeds, titles and the compendium stay shared by the account.
- Screens: Champions (pick or create) → the champion screen (home: inventory, slots, crowns, PLAY) → world map → realm road → level panel.

### 3 · Levels

- Every level is its **own short run** on a 40-wave scale. Relic realm: waves 1–5, 6–10, 11–20, 21–30, 31–40. The Marches: 1–5, 6–10, 11–15, 16–20, 21–25, 26–30, 31–40.
- **Head start** at the first wave: the game's expected level there (1, 6, 11, 15, 18, 21, 24 at waves 1, 6, 11, 16, 21, 26, 31), the ability and utility tier picks queued as picks, the missing level-up boons as one stat bundle, talent points spent along the champion's talent plan.
- A level ends on the **realm's own boss** with a "level cleared" state, before any Merchant or route fork. Waves 31–40 are never the Usurper outside the Last Bastion. A mid-Act start opens the wings that would be open by then.
- **Death restarts that level**, same seed and same opening offers until it is cleared. Cleared levels can be replayed. No mid-level save needed.
- End bosses: level 1 a pool boss, level 2 the realm's first boss (reused), level 3 a new boss, level 4 the first boss as an elite with an extra phase, level 5 the new crown boss with 3 phases and minimum phase lengths.

### 4 · Starting relics

- Before a level, fill its slots from the champion's inventory. Slots: realm levels 1–5 get 1, 2, 3, 4, 5; the Marches 1, 1, 2, 2, 3, 3, 4; the Last Bastion 5. Armorer's Choice and the Keepsake mastery rank each add +1 (up to 6).
- **At most 4 of one family.** A legendary takes 2 slots, at most 1 per loadout (2 in the Last Bastion). At most 2 class relics. No cursed relics. Both halves of a duo may be loaded.
- Starting tier: I on realm levels 1–3 and Marches 1–4, II on realm levels 4–5 and Marches 5–7, I in the Last Bastion.
- **Opening pick**: every level starts with a pick of 1 from 3 relics of its realm's family (the Marches: the featured family), with a locked relic among them while any remain. It replaces Armorer's old offer.
- Only one 6-set bonus per run; a second family stops at its 4 bonus. Family lean in offers drops from 1.6 to 1.0.

### 5 · Relics and rewards

- **Starter pool**: every common is open to every run from the start (15 now, 21 when the realms add theirs).
- Outside a realm you find the starter pool plus the champion's inventory. Inside a realm, also the realm's whole family, locked or not. Realm boss moments always include one locked relic of the family.
- **The Marches**: each level features one family (Steel, Flame, Blood, Storm, Frost, Holy, Grave) and its clear gives a pick of 1 of 2 rares of that family. The crown gives the champion's **signature relic** (new, one per champion, outside the families).
- **A relic realm**: levels 1, 2 and 4 let you keep one locked relic of the family you held when it ended (none held: Runes). Level 3 unlocks your class relic of that family. The Knight crown lets you pick 1 of the family's 2 legendaries, the Champion crown gives the other, the Legend crown a title and a palette.
- A newly unlocked relic gets 3× offer weight until you first pick it.
- Preferred families are gone: from the rules, the class select and the tests. The bot keeps its own draft heuristic.

### 6 · The Last Bastion

- One 40-wave round like today's run: four Acts, the Merchant (no relic buys), route forks, the Usurper at wave 40, bank or Endless.
- **Elite foes**: at least two affixes per elite, an elite cap of 0.35 instead of 0.22, 1.5× the elite chance. No Armorer's Choice. About 15–16 relics per win.
- Oaths, Endless and Master ([#131](https://github.com/Cyanida/last-bastion/issues/131), on Legend) live here; elite bosses with an extra phase ([#152](https://github.com/Cyanida/last-bastion/issues/152)) on Champion and Legend.
- The Daily Trial stays today's 40-wave run with a fixed pool and no loadout, open after the Marches crown. The separate Classic mode goes.

### 7 · Difficulty

- Squire (easy) and Knight (normal) open from the start. Champion opens for a realm when its crown is won on Knight, Legend when won on Champion. The campaign is tuned on Knight.
- Ring step on enemy HP ×1.00 / 1.07 / 1.14 / 1.21 / 1.28 and damage ×1.00 / 1.04 / 1.08 / 1.12 / 1.16 for rings 1–4 and the finale. One tier step always outweighs the whole ladder.
- Levels decide which enemies appear (they teach); tiers only change stats, elite affixes and boss variants. This replaces [#79](https://github.com/Cyanida/last-bastion/issues/79)'s unlock rule and [#101](https://github.com/Cyanida/last-bastion/issues/101)'s enemy types per tier.

### 8 · Economy, deeds, saves

- A run counts only the waves actually played (a start wave on the game). Clears and deaths pay gold and class XP for those waves; a level's first-clear reward comes once. Per-run gold caps scale with level length. The Keep's pacing target is stated in hours.
- Deeds "in one run" and Six of a Kind count in the Last Bastion only; wave and Act deeds count played waves.
- Phoenix Feather, Soul Lantern and Stormcaller's Horn move to their realm crowns (Holy, Grave, Storm); until a realm ships they stay open to all. Their deeds pay Runes and a title instead.
- Save v7: `save.champions`. Every class a v6 save has played becomes a champion with every family relic it has picked in its inventory; a class with a win gets the Last Bastion open once it ships. Armorer's Choice and Keepsake become +1 slot, Veteran Levies +1 level on top of the head start.

### 9 · Balance targets for the sim

- First-try clear rate on Knight with expected progress: about 95% at Marches level 1, 90% at realm level 1, 55–60% at realm level 5.
- Power index at each level's first wave within ±15% of a continuous run at that wave.
- A 6-set in most crown-level clears and Last Bastion wins, never before wave 10 in the Last Bastion. Every family's 6-set within ±15% of the class median.
- 1–2 duos per Last Bastion win, 3 or more in under 15%. Every relic 3–35% of damage or healing where picked. Relic moments per findable relic 0.4–0.6.
- Minutes: a 5-wave level about 4, a 10-wave level 8–10, a realm about 35 clean and 45 with retries, the Last Bastion 35–45.

## Relics

Each family grows to 3 commons, 4 rares, 2 legendaries and one class relic per champion: 14 per family, about 98, plus 5 signature relics and the 6 cursed. The new ones arrive with their realm's release, and each realm adds one duo. The Wizard later adds 7 class relics and a signature.

Per realm, the new relics are listed under "The world" above and in each release below. Today's 50 family relics and their families are in `src/config/relics.ts` and RELICS.md.

## The releases, in order

Eleven releases to the full map, 1.0 after the eighth. Each release lists its issues in build order and when it is done. Issue titles follow AGENTS.md: the thing, then what changes for a player. Approval gates are the points where the builder shows Jesse what it made. Since 28-09 it posts them and carries on (see the top).

### v0.8.3 – Fixes from the 28-09 check
*patch.* Every bug the check confirmed, and the docs brought up to date.

1. **Plague Cart: visible while it crosses the arena.** Speed 0 gives a NaN walk frame (src/logic/animation.ts:89).
2. **Foes: no flicker to the idle frame between sim ticks** (src/render/renderer.ts:149).
3. **Art: no frame cut off at its sheet cell.** Grow the cells or keep poses inside; add a test that no opaque pixel touches a cell border (tools/art/rig.ts:131; worst: robed boss deaths, the Warlord's swings, the Dragon's fire, the Viking's death).
4. **Performance: the sprite frame cache has a bound**; the test gallery no longer takes about 500 MB (src/render/sprites.ts:1309).
5. **Bosses: a quest-gated boss still comes when its quest was finished early** (src/systems/spawning.ts:90).
6. **Aim: the right stick aims again after the mouse moved** (src/main.ts:609).
7. **Offline: a failed update check no longer shows the error dialog** (src/core/pwa.ts:23).
8. **Text size: Larger keeps the desktop layout on a desktop window** (src/main.ts:764).
9. **Relics: Anvil Heart and Adamant count talent armor**; **Blood Pact with Crimson Chalice keeps max HP right when either tiers up.**
10. **Save import: asks first, keeps a backup, never stores a duplicate backup** (src/core/storage.ts).
11. **Class select: family names readable on the cards**; **phone: the level-up heading clears the HUD banner**; **the peddler is drawn from a rigged sheet.**
12. **Tooling: play and perf tests stop their preview server on Linux; release notes list the release's own pull request; branch cleanup removes merged issue branches.**
13. **Docs: ROADMAP.md, README (asset rule, structure, scripts) and ARCHITECTURE.md (co-op dropped) match the code and this plan.**
14. **The remaining low items from the check** as one issue: enemy DoT and heal tiers, bolt owners, field statuses through shields, split children of side elites, timers across Acts, the Aegis dome, relic crediting of delayed damage, the relic moment size in one place, Gutting through Last Blood, the Merchant reroll stream, seed-wipe on class select, update status in Settings, compendium Esc, HUD caches across runs, DPR changes, dead code.

**Done when** every fix has a test or a play check, all checks are green, and [#67](https://github.com/Cyanida/last-bastion/issues/67) has moved to v0.9.0.

### v0.9.0 – The new look
*feature · 2 gates.* Every menu in the Kingdom Rush / Survivor.io style, drawn in code; the Keep as a castle.

1. **Menus: an art direction prototype** (UI kit: frames, bevelled buttons, ribbons, rarity frames, currency pills, tab bar, icon atlas) and one restyled screen. **Gate:** Jesse approves it, as with the Paladin prototype ([#155](https://github.com/Cyanida/last-bastion/issues/155)).
2. **Menus: the UI kit in code**: CSS components, an icon atlas rendered by the rig (tools/art/ui), a UI section in tools/art/STYLE.md.
3. **Title, champion select ([#65](https://github.com/Cyanida/last-bastion/issues/65)), Settings, results, compendium, glossary and flash cards in the new look.**
4. **The Keep: drawn as a castle whose buildings grow with its upgrades ([#67](https://github.com/Cyanida/last-bastion/issues/67))**, the account's hub in the new look.
5. **World map: a map painter prototype.** The rig paints terrain per family (grass and fields, grey mountains, basalt and lava, barrows and mist, snow and pines, storm cliffs, golden fields, red battlefields), dirt roads, castles, clouds. **Gate:** Jesse approves the look.
6. **Play checks for every restyled screen**, at 1280×720 and phone landscape; before and after screenshots.

**Done when** no screen is left in the old style, test:perf holds, and both gates are passed.

### v0.10.0 – Champions & the Marches
*feature · save v7, 1 gate.* The engine, the save and the first realm: the map is in the game from here on.

1. **World: realms and levels as data.** src/config/world.ts (realms, rings, what opens them, arena, levels with wave ranges, slots, featured family, end bosses, rewards) and src/logic/world.ts (unlocks, slots, rewards, crowns, tier rules), with tests.
2. **Levels: a level runner with a real head start.** One headStart(g, wave) in src/systems, shared with test mode: expectedLevel(startWave − 1), queued ability and utility picks, a boon stat bundle, talents along the plan. A start wave on the game; the realm's arena and boss; "level cleared" before any Merchant; wings open by the start wave; slotted relics added after growth with a new source; Armorer's roll sees held relics.
3. **Levels: rewards count only the waves played.** summarizeRun and applyRun use the start wave; first-clear rewards once; gold caps scaled by length.
4. **Save v7: champions** in the release branch: champions keyed by class, inventory, loadouts, talent plan, levels and crowns per tier, signature relic; the v6 migration; a format-7 fixture; Keep refunds or repurposes (Armorer's Choice and Keepsake +1 slot, Veteran Levies +1 level).
5. **Relics: the pool follows the champion.** An explicit pool (starter commons, inventory, the realm family inside a realm); the opening pick; boss moments with a locked relic; 3× weight for new unlocks; family lean 1.0; one 6-set bonus per run; preferred families removed; the three achievement relics handled.
6. **Relics: the slot rules** (4 per family, legendary 2 slots, 2 class relics, no cursed, tier by position).
7. **Relics: every starter common between 3% and 35%** (Emberheart, Serrated Edge, Frost Brand, Winter's Grasp and Berserker Tooth are under today).
8. **Champions: the champion screen** in the new look: the champion on a pedestal, the slots around it, set chips, the inventory, the talent plan, PLAY and Restart.
9. **Map: the world map and the realm road** from the painter, every realm under clouds, the level panel with tier crowns, head start, slots, featured foes, rewards and FIGHT.
10. **The Marches: seven levels.** The Castle Courtyard, one featured family per level, a rare pick of 1 of 2 per level (plus one new Flame rare), the Warden with a third phase as the crown boss, the signature relic pick. Levels 1 and 2 are the tutorial ([#60](https://github.com/Cyanida/last-bastion/issues/60)) on flash cards.
11. **Relics: five signature relics**, one per champion, outside the families. **Gate:** RELICS.md entries approved by Jesse.
12. **Difficulty: Squire and Knight open, Champion and Legend per realm**, the ring step; the knight deed updated.
13. **Daily Trial: a fixed pool and no loadout**, open after the Marches crown. The Classic mode goes.
14. **Deeds: "in one run" and Six of a Kind count in the Last Bastion; wave deeds count waves played.**
15. **Test mode: start any realm level** through headStart.
16. **Bot and sim: levels and loadouts.** The bot fills slots and plays levels; `npm run sim -- levels`; a loadout mode in relic-report; BALANCE.md targets; golden runs for Marches levels 1 and 7.
17. **Play checks**: new champion, slot picking and its rules, the map, the realm road, a cleared level, a death and its restart, the Marches crown pick.

**Done when** a new save plays the Marches from the champion screen to its crown, the sims hit the targets, the play test and test:perf are green, and a v6 save migrates without losing a relic.

### v0.11.0 – The Iron Hold · Steel
*feature · 1 gate.* The first relic realm, and the recipe for every one after it.

1. **Iron Hold: the Great Keep as a fortress**, with wings (forge, armory, barracks) and its hazard: forge presses that slam marked tiles.
2. **Foes: armor you break, shields that block from the front, thorns that hit back**: realm variants of the knight, shieldwall and shield bearer, each with a flash card.
3. **Bosses: the Forgemaster (level 3) and the Iron King (crown, 3 phases).** The Warden comes back at level 2 and as an elite at level 4. **Gate:** Jesse plays the Iron King before release.
4. **Relics: 7 new Steel relics**: 1 common, 2 rares, a second legendary, class relics for the Angel, the Necromancer and the Archer; one new Steel duo.
5. **The realm: five levels, rewards, crown and a music theme.**
6. **Balance and checks**: every class through every level on Knight; a golden run; play checks; test:perf in the fortress.

**Done when** the Iron Hold can be crowned on Knight by every class within the targets.

### v0.12.0 – The Cinderlands · Flame
*feature · 1 gate.* [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Ember Forge; fire that spreads.

1. **Cinderlands: the Ember Forge ([#141](https://github.com/Cyanida/last-bastion/issues/141))** with lava channels and fire that spreads over the floor.
2. **Foes: burn stacks on you, bursts of fire when foes die**, with flash cards.
3. **Bosses: the Ember Queen (level 3) and the Cinder Colossus (crown).** The Grand Inquisitor at level 2 and 4. **Gate:** Jesse plays the crown boss.
4. **Relics: 5 new Flame relics**: 2 rares, a second legendary, class relics for the Viking and the Necromancer; one new duo.
5. **The realm, balance and checks** as in v0.11.

**Done when** the Cinderlands can be crowned on Knight by every class within the targets.

### v0.13.0 – The Barrowvale · Grave
*feature · 1 gate.* The dead rise; Soul Lantern finds its crown.

1. **Barrowvale: the Forsaken Graveyard** with its grasping hands; the Drowned Fen ([#141](https://github.com/Cyanida/last-bastion/issues/141)) comes later as a second arena.
2. **Foes: corpses that rise unless you trample them, plague ground that lasts**, with flash cards.
3. **Bosses: the Barrow King (crown) and one new level-3 boss.** The Lich and the Plague Abbot return. **Gate:** Jesse plays the Barrow King.
4. **Relics: 8 new Grave relics**: 1 common, 2 rares, a second legendary (Soul Lantern moves to this crown), class relics for the Paladin, Viking, Angel and Archer; one new duo.
5. **The realm, balance and checks** as in v0.11.

**Done when** the Barrowvale can be crowned on Knight by every class within the targets.

### v0.14.0 – The Frozen Pass & the Last Bastion
*feature · 1 gate.* Ring 3 opens, and five crowns open the finale.

1. **Frozen Pass: [#141](https://github.com/Cyanida/last-bastion/issues/141)'s arena** with thin ice that cracks into open water.
2. **Foes: chill that stacks on you until you freeze, foes that shatter**, with flash cards.
3. **Bosses: the Rime Witch (level 3) and the Frost Jötun (crown).**
4. **Relics: 6 new Frost relics**: 1 common, 2 rares, a second legendary, class relics for the Paladin and the Viking; one new duo.
5. **The Last Bastion: one 40-wave round with elite foes**: the finale settings, 5 slots, no Armorer's Choice or Merchant relic buys; Oaths and Endless move here; Master ([#131](https://github.com/Cyanida/last-bastion/issues/131)) on Legend; elite bosses ([#152](https://github.com/Cyanida/last-bastion/issues/152)) on Champion and Legend; veteran saves with a win get it open. **Gate:** Jesse plays a full finale.
6. **Balance and checks**, including the finale's power budget of about 15–16 relics per win.

**Done when** the Frozen Pass can be crowned on Knight by every class within the targets, the Last Bastion hits its clear-rate and power targets in the sim, and Jesse has played a full finale.

### v0.15.0 – Classes & roster
*feature · 1 gate.* The Wizard, and what champions wear.

1. **The Wizard ([#66](https://github.com/Cyanida/last-bastion/issues/66))**: a sixth champion that unlocks with 3 crowns ([#64](https://github.com/Cyanida/last-bastion/issues/64)), a signature relic, and class relics for every realm built so far (the rest arrive with their realms). **Gate:** the Wizard's design.
2. **Skins ([#137](https://github.com/Cyanida/last-bastion/issues/137)) as crown rewards** and **real recolours ([#164](https://github.com/Cyanida/last-bastion/issues/164))**.
3. **The Necromancer's skeleton archers ([#83](https://github.com/Cyanida/last-bastion/issues/83)).** Hidden subclasses ([#58](https://github.com/Cyanida/last-bastion/issues/58)) move after 1.0.

**Done when** the Wizard can crown the Marches and every realm built so far on Knight within the targets, and every skin and recolour renders from the rig.

### v0.16.0 – Polished PC
*feature · save freeze.* The old v0.12 scope, with the map in it.

1. **The save format frozen ([#45](https://github.com/Cyanida/last-bastion/issues/45))**, with realm progress in it and a migration test from every earlier version.
2. **The perf budget in every realm arena ([#46](https://github.com/Cyanida/last-bastion/issues/46))**, with a 30 fps option.
3. **A crash sweep ([#47](https://github.com/Cyanida/last-bastion/issues/47))**: every realm crowned and the Last Bastion won on PC without an error.
4. **The 1.0 scope written down ([#48](https://github.com/Cyanida/last-bastion/issues/48))**: the Marches, four relic realms, the Last Bastion.
5. **A balance pass over every level and tier**, and the sound mixer part of [#142](https://github.com/Cyanida/last-bastion/issues/142).

**Done when** a save from every earlier version migrates in a test, test:perf holds in every arena, and the crash sweep finds no error.

### v1.0.0 – Phone & launch
*launch.* [#120](https://github.com/Cyanida/last-bastion/issues/120): the champion screen, the map and the roads at phone width.

1. **Phone layout for every new screen**, touch-first; levels of 4 to 10 minutes fit phone sessions.
2. **The iPhone app through TestFlight and the App Store**, once the Apple Developer account exists.

**Done when** the play test plays a level at 390 px wide by touch, from the map to the crown, with no sideways scroll on any new screen.

---

**1.0.** The releases below come after 1.0 and wait for Jesse's go.

### v1.1.0 – The Stormspire · Storm
*after 1.0 · 1 gate.* Lightning that chains into you; Stormcaller's Horn finds its crown. 7 new relics.

1. **A storm peak arena, chained lightning, fast rushers and wind; the Storm Caller and the Thunder Roc; 1 common, 2 rares, a second legendary, class relics for the Paladin, Angel and Necromancer; one duo.**

### v1.2.0 – The Hallowed Reach · Holy
*after 1.0 · 1 gate.* [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Sunken Cathedral; wards and healers; Phoenix Feather finds its crown. 6 new relics.

1. **Ward-bearers that make squads untouchable, healers you must reach first; the Ward-Keeper and the Fallen Saint; 1 common, 2 rares, a second legendary, class relics for the Viking and Archer; one duo.**

### v1.3.0 – The Crimson Fields · Blood
*after 1.0 · 1 gate.* Bleed on you; the map is complete. 8 new relics.

1. **A battlefield arena, bleed on the player, foes that grow stronger as they bleed; the Butcher and the Crimson Baron; 1 common, 2 rares, a second legendary, class relics for the Paladin, Angel, Necromancer and Archer; one duo.**

Each of these is done when its realm can be crowned on Knight by every class within the targets. After that: items and sound ([#62](https://github.com/Cyanida/last-bastion/issues/62) potions, [#86](https://github.com/Cyanida/last-bastion/issues/86), [#89](https://github.com/Cyanida/last-bastion/issues/89), [#140](https://github.com/Cyanida/last-bastion/issues/140), the rest of [#142](https://github.com/Cyanida/last-bastion/issues/142)), hidden subclasses ([#58](https://github.com/Cyanida/last-bastion/issues/58)), and a second arena per realm.

## The builder brief

**Road to the Crown: build plan for Last Bastion (approved by Jesse, 28-09-2026)**

You are the main AI for Last Bastion (github.com/Cyanida/last-bastion). This plan replaces ROADMAP.md from v0.8.3 on. It is Jesse's go for everything listed here. AGENTS.md still governs how you work: release branches, one ready-to-merge pull request per release, tests, play checks, sims, no hand-made asset files.

1. **Set up, once.** On the v0.8.3 patch branch: rewrite ROADMAP.md to the releases in this plan, update [#49](https://github.com/Cyanida/last-bastion/issues/49), and comment the plan on [#153](https://github.com/Cyanida/last-bastion/issues/153) (the campaign idea it implements). Create these milestones: v0.9.0 – The new look, v0.10.0 – Champions & the Marches, v0.11.0 – The Iron Hold, v0.12.0 – The Cinderlands, v0.13.0 – The Barrowvale, v0.14.0 – The Frozen Pass & the Last Bastion, v0.15.0 – Classes & roster, v0.16.0 – Polished PC, v1.0.0 – Phone & launch (exists), v1.1.0 – The Stormspire, v1.2.0 – The Hallowed Reach, v1.3.0 – The Crimson Fields. Retire or rename the milestones this replaces.
2. **Move the existing issues**: [#67](https://github.com/Cyanida/last-bastion/issues/67) → v0.9.0; [#65](https://github.com/Cyanida/last-bastion/issues/65) → v0.9.0; [#60](https://github.com/Cyanida/last-bastion/issues/60) → v0.10.0 (the Marches tutorial); [#79](https://github.com/Cyanida/last-bastion/issues/79) and [#101](https://github.com/Cyanida/last-bastion/issues/101) are superseded by v0.10.0 (close with a link); [#141](https://github.com/Cyanida/last-bastion/issues/141) is split over the realm releases (close with a link); [#131](https://github.com/Cyanida/last-bastion/issues/131) and [#152](https://github.com/Cyanida/last-bastion/issues/152) → v0.14.0; [#64](https://github.com/Cyanida/last-bastion/issues/64), [#66](https://github.com/Cyanida/last-bastion/issues/66), [#83](https://github.com/Cyanida/last-bastion/issues/83), [#137](https://github.com/Cyanida/last-bastion/issues/137), [#164](https://github.com/Cyanida/last-bastion/issues/164) → v0.15.0; [#58](https://github.com/Cyanida/last-bastion/issues/58) → after 1.0; [#45](https://github.com/Cyanida/last-bastion/issues/45)–[#48](https://github.com/Cyanida/last-bastion/issues/48) → v0.16.0; [#120](https://github.com/Cyanida/last-bastion/issues/120) stays in v1.0.0; [#62](https://github.com/Cyanida/last-bastion/issues/62), [#86](https://github.com/Cyanida/last-bastion/issues/86), [#89](https://github.com/Cyanida/last-bastion/issues/89), [#140](https://github.com/Cyanida/last-bastion/issues/140), [#142](https://github.com/Cyanida/last-bastion/issues/142) → after 1.0 (the mixer part of [#142](https://github.com/Cyanida/last-bastion/issues/142) in v0.16.0); [#153](https://github.com/Cyanida/last-bastion/issues/153) closes when v0.10.0 ships.
3. **File the new issues** of each release before you start it, with the Idea template, the titles as written in the roadmap, and the item text as the body, plus "Part of the Road to the Crown plan ([#153](https://github.com/Cyanida/last-bastion/issues/153))".
4. **Build the releases in order**, each on its release branch, and the issues in the listed order. Every issue gets a test for its logic, a play check in scripts/play-test.mjs for anything a player sees, a sim before and after for balance, and before/after screenshots for visuals.
5. **Approval gates**: stop, post screenshots, sim output or a playable build on the issue with question-for-jesse and a handoff note on [#49](https://github.com/Cyanida/last-bastion/issues/49), and wait. Gates: the menu art prototype, the map painter prototype, the signature relics' RELICS.md entries, every realm's crown boss, the Wizard's design, the full Last Bastion, and any sim target missed by more than 20%.
6. **A release is done** when every issue is closed, every check is green and its "done when" holds. Then open the one ready-to-merge pull request into main. Jesse merges; release per RELEASES.md.
7. **When the plan and the code disagree**, the code facts win: adjust the numbers in BALANCE.md or RELICS.md and say so on the issue. When the plan doesn't decide something about design, ask; don't guess. Numbers in this plan are starting values for the sim, not promises.

*As changed on 28-09 (see the top): gates don't stop the build, open questions are decided and logged, releases are stacked, and the build stops after v1.0.0.*

## Decisions log

✓ is Jesse's decision. ◆ is the balanced default chosen where he left it open; he can change any of them before its release is built.

- ✓ **Realms are relic families**; the medieval Marches is the start; the Last Bastion is the finale.
- ✓ **Every level is a short run** on the 40-wave scale; death restarts that level.
- ✓ **Five levels per realm** (1–5, 6–10, 11–20, 21–30, 31–40), seven in the Marches.
- ✓ **The Last Bastion** is one 40-wave round with elite foes.
- ✓ **Champions** with an inventory and starting relics; one champion per class.
- ✓ **The commons** are a starter pool open to every run.
- ✓ **The Marches crown** gives a champion-specific rare.
- ✓ **A pool about twice the size**, a class relic for every champion in every realm, sets easy to max.
- ✓ **The 15% 6-set target is retired**; **preferred families are gone.**
- ✓ **Menus in a real game style**, after Kingdom Rush and Survivor.io.
- ◆ **Slot rules**: 4 per family, a legendary costs 2 slots, 2 class relics at most, no cursed; one 6-set bonus per run; tier by position; an opening pick each level.
- ◆ **The champion-specific rare is a new signature relic**, so no realm gives it a second time.
- ◆ **Build order by reuse**: Steel, Flame, Grave, Frost, then Storm, Holy, Blood. 1.0 when five crowns can open the Last Bastion.
- ◆ **Higher crowns**: Knight picks one of the realm's two legendaries, Champion gives the other, Legend a title and a palette.
- ◆ **Both halves of a duo may be loaded**: it costs two slots of set progress, so it is a real choice.
- ◆ **The Classic mode goes**; the Daily Trial keeps today's run with a fixed pool; Oaths, Endless and Master live in the Last Bastion.
- ◆ **Existing saves**: a champion per class played, every picked relic kept, the Last Bastion open for a class with a win.
- ◆ **One arena per realm**, reusing today's and [#141](https://github.com/Cyanida/last-bastion/issues/141)'s where they fit; the Merchant and route forks only in the Last Bastion.
- ◆ **Rewards** pay only for waves played; first-clear rewards once; replays can't be farmed.
- ◆ **Talents**: the champion keeps a talent plan and the head start spends along it.
- ◆ **The found bugs ship first**, as v0.8.3; the Keep castle moves into the new look.
- ◆ **Rarity frame colours** (#184): common stone, rare blue, legendary orange (as today), class green, signature gold with a glow.
- ◆ **World progress** (#190): a crown on any tier counts toward opening realms; levels open in order per tier, and a clear on a higher tier counts for the lower ones; a first-clear reward is paid once, on any tier.
- ◆ **Crown rewards** (#190): a relic realm's Squire crown gives no legendary, Knight the pick of 1 of its 2 legendaries, Champion the other, Legend a title and a palette. The Marches' signature relic comes with its first crown on any tier.
- ◆ **The Marches' featured families** (#190), levels 1-7: Steel, Flame, Blood, Storm, Frost, Holy, Grave. Levels 1-6 end on a pool boss; level 7 is the Warden as crown boss.
- ◆ **Unnamed bosses** (#190): the Barrowvale's level-1 boss is the Plague Abbot and its level-3 boss "the Gravedigger"; first bosses where the plan names none: Frozen Pass the Frost Lich, Stormspire the Warlord, Hallowed Reach the Heretic, Crimson Fields the Headsman.
- ◆ **Small rules** (#190): a crown boss phase lasts at least 12 s; a level cleared with no family relic held pays 2 Runes in place of a locked relic; "the family you held" means every family among the relics held at the end; the Last Bastion's opening pick draws from any family.
- ◆ **The head start** (#191): its level is the pace's level once the wave before is cleared, rounded (1, 6, 11, 15, 19, 21, 24; 19 where the table above says 18, since the pace is 18.5 there); the Keep's and mastery's start levels stay on top. Each skipped level gives one boon of a bundle cycling the class's attack stat, HP, attack speed and its secondary stat, at rare strength (about what the best of three rolled cards is worth).
- ◆ **Wings by the start wave** (#191): a start past the Act's mid-Act boss opens the one wing that boss opens; quest wings are not counted.
- ◆ **A realm boss not built yet** (#191) is stood in for by the usual draw, and a wave-40 draw outside the Last Bastion is an Act boss, never the Usurper. A realm arena not built yet falls back to the chosen arena. The elite boss's and crown boss's extra phases come with their content issues.
- ◆ **Save v7** (#193): a v6 save counts relic picks for the whole account, so every class it played becomes a champion holding every relic the account picked (less other classes' class relics and the cursed ones); its last logged run's talents become its talent plan; a class with a win gets the Last Bastion open by a flag, not a crown. Loadouts are kept per realm (a level with fewer slots takes the first ones). The Keep ranks stay bought and change meaning (no refund); the Seasoned mastery rank adds a head-start level like Veteran Levies. Relics found in a run don't enter the inventory; rewards do.
- ◆ **Difficulty outside a realm** (#203): a run with no realm opens Champion with a win on Knight and Legend with a win on Champion; a save keeps every tier it already opened. The knight deed ("Dubbed a Knight") counts the highest tier won (Knight, Champion, Legend), since Knight being open earns nothing.
- ◆ **Slot rules in practice** (#195): the family cap counts relics, not slots (a legendary is one of its 4); a relic that breaks a rule is left out and the rest of the loadout still goes in, in order; a saved loadout is checked at the most slots (6) and cut to each level's slots when it starts; "tier by position" is the level's place in its realm (its relic tier), not the slot's.
- ✓ **28-09:** no approval gates that stop the build; releases stacked on each other's branches up to v1.0.0 (see the top).

---

Built from four rounds of independent review against the repository at v0.8.2 (27697ec): the code, BALANCE.md, RELICS.md, ROADMAP.md, RELEASES.md and AGENTS.md, and a full health check on 28-09-2026 (CI green, 621 tests, play test 64/64, perf p95 16.8 ms against 34). Expected levels come from src/logic/formulas.ts. Relic counts come from src/config/relics.ts: 50 family relics (15 class relics), 6 cursed, 12 duos. Sprites are the game's own sheets; the map and the menus on the plan page are mockups of the target look, painted in code.
