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

## Changes on 29-09 (Jesse's playtest, [#234](https://github.com/Cyanida/last-bastion/issues/234))

Jesse played the Archer through Marches levels 1-5 on v0.10.0. The game looks good; the champion and level flow didn't work. Decided by Jesse in chat, all of these (rules 2-4 and 9 below are updated to match):

- **A · Short relic text** ([#235](https://github.com/Cyanida/last-bastion/issues/235)): one line per relic, readable at a glance, no text under 14 px; the full text lives in the compendium.
- **B · No screens before a level:** the head start and its queued picks go; a level starts straight in the fight (comes with E).
- **C · A champion screen that explains itself** ([#239](https://github.com/Cyanida/last-bastion/issues/239), [#240](https://github.com/Cyanida/last-bastion/issues/240)): a legendary visibly spans two slots, ⓘ explanations, tabs (Loadout, Build, Talents) and a first-visit tour.
- **D · No boss twice in a realm** ([#236](https://github.com/Cyanida/last-bastion/issues/236)).
- **E · Champions level up between levels, not during them** ([#238](https://github.com/Cyanida/last-bastion/issues/238), [#241](https://github.com/Cyanida/last-bastion/issues/241)): stat points and a talent point per champion level, spent on the level-cleared screen or the champion screen.
- **F · A realm is one run with checkpoints** ([#237](https://github.com/Cyanida/last-bastion/issues/237), [#242](https://github.com/Cyanida/last-bastion/issues/242)), with **longer levels** ([#243](https://github.com/Cyanida/last-bastion/issues/243)): what you pick up stays for the realm's later levels; levels take about 4-10 minutes.
- All of it goes into **v0.11.0**, before the Iron Hold's levels ([#219](https://github.com/Cyanida/last-bastion/issues/219)), so every realm is built on the new shape.

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
- **Champion levels** (29-09): a champion has a permanent level. XP from levels is banked as champion XP; each champion level gives 3 stat points (Strength, Dexterity, Focus, Vitality, mapped onto the class's own stats) and 1 talent point, spent on the level-cleared screen or the champion screen's Build and Talents tabs, and reset for free outside a run. Ability and utility tiers are bought with stat points (2 per tier). The cap is 5 + 5 per crown held; a replayed level gives a quarter of its first-clear XP. The talent plan's auto-spend goes: talent points are spent by hand.

### 3 · Levels

- **A realm is one run, split into its levels** (29-09; the Marches count as a realm). What the run gains in a level (relics picked up, their tiers, gold) stays for the rest of that realm's levels. The realm's last level ends the run; relics found in it don't enter the inventory, rewards do.
- **Every cleared level is a checkpoint:** the run is saved there and can be continued later from the realm road, or started over. One unfinished run per champion per realm. **Death restarts that level** from its checkpoint, same seed and same opening offers.
- **Wave splits** on the 40-wave scale: a relic realm 1–8, 9–16, 17–24, 25–32, 33–40; the Marches 1–6, 7–12, 13–18, 19–24, 25–30, 31–35, 36–40. A run always starts at wave 1: **there is no head start** and no build screen before a level.
- **No level-ups inside a level** (the Daily Trial keeps them): XP is banked as champion XP and spent between levels (rule 2).
- **A level runs on its own waves** ([#243](https://github.com/Cyanida/last-bastion/issues/243)): its one boss wave is its last. The 40-wave scale's boss waves inside a level (x5, x0) are plain waves, and an Act that ends inside a level moves on where you stand, with no Merchant and no fork. The Last Bastion keeps the scale.
- A level ends on the **realm's own boss** with a "level cleared" screen (XP, level-ups, points to spend, Continue), before any Merchant or route fork. Waves 31–40 are never the Usurper outside the Last Bastion.
- End bosses: level 1 a pool boss, level 2 the realm's first boss (reused), level 3 a new boss, level 4 the first boss as an elite with an extra phase, level 5 the new crown boss with 3 phases and minimum phase lengths. **No plain boss ends two levels of one realm**: pool bosses are drawn from those not used in it yet (the elite at level 4 counts as its own).

### 4 · Starting relics

- Before a realm run, fill its slots from the champion's inventory; they go in at level 1 and stay for the run (29-09). Slots: a relic realm 3, the Marches 3, the Last Bastion 5. Armorer's Choice and the Keepsake mastery rank each add +1 (up to 6).
- **At most 4 of one family.** A legendary takes 2 slots, at most 1 per loadout (2 in the Last Bastion). At most 2 class relics. No cursed relics. Both halves of a duo may be loaded.
- Starting tier: I; relics grow their tiers in the run as today.
- **Opening pick**: every level (also a continued one) starts with a pick of 1 from 3 relics of its realm's family (the Marches: the featured family), with a locked relic among them while any remain. It replaces Armorer's old offer.
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

- First-try clear rate on Knight with expected progress: about 95% at Marches level 1, 90% at realm level 1, 55–60% at realm level 5. Measured with the bot playing a realm as one run ([#220](https://github.com/Cyanida/last-bastion/issues/220)): 93%, 93% and 53%; the Cinderlands ([#232](https://github.com/Cyanida/last-bastion/issues/232)): 85% and 55%; the numbers are in BALANCE.md.
- Power index at each level's first wave within ±15% of a continuous run at that wave.
- A 6-set in most crown-level clears and Last Bastion wins, never before wave 10 in the Last Bastion. Every family's 6-set within ±15% of the class median.
- 1–2 duos per Last Bastion win, 3 or more in under 15%. Every relic 3–35% of damage or healing where picked. Relic moments per findable relic 0.4–0.6.
- Minutes (29-09, measured in the sim as a clear's median): a realm's level 1 4–6, its last level 7–10; the Marches' level 1 at least 4; a realm about 35 clean and 45 with retries, the Last Bastion 35–45. Tune wave length (foes per wave and their pace) in levels only. `WORLD.levelWaves` holds it ([#243](https://github.com/Cyanida/last-bastion/issues/243)); measured there: the Marches' level 1 4.2, the Iron Hold's level 1 4.6 and its last 8.5.
- Expected champion level: the Marches 1–8, ring 2 8–15, ring 3 15–22, ring 4 22–30, the Last Bastion 30.

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
7. **Jesse's playtest (29-09, [#234](https://github.com/Cyanida/last-bastion/issues/234)), before item 5:** short relic text ([#235](https://github.com/Cyanida/last-bastion/issues/235)); no boss twice in a realm ([#236](https://github.com/Cyanida/last-bastion/issues/236)); the realm run with checkpoints ([#237](https://github.com/Cyanida/last-bastion/issues/237), [#242](https://github.com/Cyanida/last-bastion/issues/242)); champion levels between levels ([#238](https://github.com/Cyanida/last-bastion/issues/238), [#241](https://github.com/Cyanida/last-bastion/issues/241)); the champion screen ([#239](https://github.com/Cyanida/last-bastion/issues/239), [#240](https://github.com/Cyanida/last-bastion/issues/240)); longer levels ([#243](https://github.com/Cyanida/last-bastion/issues/243)). The Marches move to the new shape too.

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
6. **The sound and music overhaul** (Jesse, 01-10): the whole of [#142](https://github.com/Cyanida/last-bastion/issues/142), the mixer that was planned for v0.16.0 included (buses with Settings sliders, a voice limit with priorities, variation, stereo, distinct sounds per class, enemy, boss, relic family and UI, ambience per arena), and [#140](https://github.com/Cyanida/last-bastion/issues/140): a theme of its own for every boss. Split into issues a builder finishes in one session; the mixer and the voice priorities come first.
7. **The champion redesigns by ThePaintingBunny** (Jesse, 01-10): the Paladin ([#245](https://github.com/Cyanida/last-bastion/issues/245)), the Viking ([#247](https://github.com/Cyanida/last-bastion/issues/247)), the Angel ([#268](https://github.com/Cyanida/last-bastion/issues/268)), the Necromancer ([#269](https://github.com/Cyanida/last-bastion/issues/269)) and the Archer ([#270](https://github.com/Cyanida/last-bastion/issues/270)). Appearance only, in the rig style of `tools/art/STYLE.md`; the hitboxes stay.
8. **The UI fit ([#272](https://github.com/Cyanida/last-bastion/issues/272))** (Jesse, 01-10): no text cut off and every back arrow fully visible, on every screen and window size.

**Done when** the Barrowvale can be crowned on Knight by every class within the targets, every class, enemy family, boss and relic family has its own sound, every boss its own theme, and the five redesigned champions read at a glance with their old hitboxes.

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
5. **A balance pass over every level and tier.** The sound mixer part of [#142](https://github.com/Cyanida/last-bastion/issues/142) moved to v0.13.0 (Jesse, 01-10).

**Done when** a save from every earlier version migrates in a test, test:perf holds in every arena, and the crash sweep finds no error.

### v1.0.0 – Phone & launch
*launch.* [#120](https://github.com/Cyanida/last-bastion/issues/120): the champion screen, the map and the roads at phone width.

1. **Phone layout for every new screen**, touch-first; levels of 4 to 10 minutes fit phone sessions.
2. **The iPhone app through TestFlight and the App Store**, once the Apple Developer account exists.
3. ~~**The sound overhaul ([#142](https://github.com/Cyanida/last-bastion/issues/142))**~~: moved to v0.13.0 with the mixer and the boss themes ([#140](https://github.com/Cyanida/last-bastion/issues/140)) (Jesse, 01-10).

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

Each of these is done when its realm can be crowned on Knight by every class within the targets. After that: items and sound ([#62](https://github.com/Cyanida/last-bastion/issues/62) potions, [#86](https://github.com/Cyanida/last-bastion/issues/86), [#89](https://github.com/Cyanida/last-bastion/issues/89), [#140](https://github.com/Cyanida/last-bastion/issues/140)), hidden subclasses ([#58](https://github.com/Cyanida/last-bastion/issues/58)), and a second arena per realm.

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
- ✓ ~~Every level is a short run~~ **A realm is one run with a checkpoint after every level** (29-09, replaces the short runs); death restarts that level.
- ✓ **Five levels per realm**, seven in the Marches; since 29-09 8 waves per realm level (the Marches 6, 6, 6, 6, 6, 5, 5).
- ✓ **The Last Bastion** is one 40-wave round with elite foes.
- ✓ **Champions** with an inventory and starting relics; one champion per class.
- ✓ **The commons** are a starter pool open to every run.
- ✓ **The Marches crown** gives a champion-specific rare.
- ✓ **A pool about twice the size**, a class relic for every champion in every realm, sets easy to max.
- ✓ **The 15% 6-set target is retired**; **preferred families are gone.**
- ✓ **Menus in a real game style**, after Kingdom Rush and Survivor.io.
- ✓ **The sound overhaul ships in 1.0** ([#142](https://github.com/Cyanida/last-bastion/issues/142), Jesse 29-09); since 01-10 all of it, the mixer included, in v0.13.0.
- ◆ **Slot rules**: 4 per family, a legendary costs 2 slots, 2 class relics at most, no cursed; one 6-set bonus per run; tier by position; an opening pick each level.
- ◆ **The champion-specific rare is a new signature relic**, so no realm gives it a second time.
- ◆ **Build order by reuse**: Steel, Flame, Grave, Frost, then Storm, Holy, Blood. 1.0 when five crowns can open the Last Bastion.
- ◆ **Higher crowns**: Knight picks one of the realm's two legendaries, Champion gives the other, Legend a title and a palette.
- ◆ **Both halves of a duo may be loaded**: it costs two slots of set progress, so it is a real choice.
- ◆ **The Classic mode goes**; the Daily Trial keeps today's run with a fixed pool; Oaths, Endless and Master live in the Last Bastion.
- ◆ **Existing saves**: a champion per class played, every picked relic kept, the Last Bastion open for a class with a win.
- ◆ **One arena per realm**, reusing today's and [#141](https://github.com/Cyanida/last-bastion/issues/141)'s where they fit; the Merchant and route forks only in the Last Bastion.
- ◆ **Rewards** pay only for waves played; first-clear rewards once; replays can't be farmed.
- ◆ ~~**Talents**: the champion keeps a talent plan and the head start spends along it.~~ Replaced on 29-09: talent points come with champion levels and are spent by hand.
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
- ◆ **Level rewards** (#192): a banked level counts the waves after its head start and the levels grown past it (class XP, tier records, the wave contract, whole Acts played); its gold cap is its length's share of a full run's (5 waves: 1/8). A clear goes on the champion's world progress there and then; applyRun returns what the first clear and crown pay, and the screens that come with the realm road offer the picks.
- ◆ **The relic pool** (#194): a run without a champion (the Daily Trial, the sims, and today's run until the map ships) keeps every relic its class can find; in the Marches the level's featured family is the realm's family (its pool, its locked relics); a locked relic is "among" the opening pick and a realm boss's options, so two can show; in a level the Keepsake's free common and Armorer's offer give way to the opening pick (both are slots now); the one 6-set bonus goes to the first family to hold six; the three deeds that unlocked Phoenix Feather, Soul Lantern and Stormcaller's Horn pay 3 extra Runes and a title (Phoenix-Touched, Lantern-Bearer; Five Banners keeps Banner-Bearer).
- ◆ **Slot rules in practice** (#195): the family cap counts relics, not slots (a legendary is one of its 4); a relic that breaks a rule is left out and the rest of the loadout still goes in, in order; a saved loadout is checked at the most slots (6) and cut to each level's slots when it starts; "tier by position" is the level's place in its realm (its relic tier), not the slot's.
- ◆ **The realm road** (#199): the road is the realm's own part of the painted map, a button on each painted flag; it opens on the first level not cleared, on the difficulty last chosen if the realm has it open. The panel's featured foes are the squads that first march in its waves (at most three; a level with none new shows the last ones in). Until the champion screen (#197) it fights with the class picked on the champion select, its saved loadout for the realm and its talent plan; the Loadout button and the "fell at wave N" note come with the champion screen.
- ◆ **The starter commons** (#196): two tuning passes left Berserker Tooth (0.9%) and Winter's Grasp (0.0%) far under 3%. Winter's Grasp stays as it is and the sim's share also credits damage dealt to an enemy while a relic's freeze holds it; Berserker Tooth gets a flat +10% attack speed (+15% at tier II) on top of its missing-HP part; Serrated Edge gets one more bleed stack.
- ◆ **The Iron Hold's first four Steel relics** (#217): Rivet Hammer (common: every 4th attack hit rivets for damage and an armor stack; awakened, it breaks armor and shields), Pavise (rare: blocks hits from the front, where you last struck), Reprisal Cuirass (rare: the hits that come at you, at full force, return on your next attack) and Heart of the Hold (the second Steel legendary: unfading armor stacks, 3 more, thorns per stack). Rivet Hammer joins the starter pool as a common; the sims hold each one from the start with `hold=<id>` to measure it (RELICS.md C2).
- ◆ **The Iron Hold's class relics and duo** (#218): the Angel's Iron Halo (Heavenly Radiance gives armor stacks and strikes for damage per stack held), the Necromancer's Legion Plate (minion hits give armor stacks and hit harder per stack held) and the Archer's Bodkin Points (every 3rd arrow hit adds part of itself again as damage no shield turns, and an armor stack); all three are rares, like every class relic. The new Steel duo is Iron Tithe, Steel + Blood (Reprisal Cuirass + Vampire Fang: a reprisal bleeds its target and heals you), not Steel + Flame, since Flame already sits in the 4 recipes a family may have (RELICS.md C3).
- ◆ **The Cinderlands' first three Flame relics** (#229): Flashpowder (rare: once a second your next hit sparks; an enemy at 2+ burn stacks flares, fire damage and a burn stack round it, any other is lit; awakened, a flare's own stacks set off one more link), Pitch Pot (rare: every 2 s it flings burning pitch at the nearest enemy and every burning enemy near you drips it, fire patches on the ground that set burns; awakened, a foe that dies in pitch bursts like a Pyre) and Crown of Cinders (the second Flame legendary: your attack hits light foes that aren't burning, and a burning foe's death passes its burn stacks and a burst to everything round it). Each lights its own first fire: fed only on burns other relics lit, all three read under 3% in the sims, whose runs mostly go Steel (RELICS.md C4).
- ◆ **The Barrowvale's first four Grave relics** (#279): Barrow Boots (common: walking over a corpse stomps it once, a shadow burst round it; awakened, the stomp curses), Plague Censer (rare: every 4th kill leaves plague ground that hurts and poisons foes, up to 3 patches; awakened, a foe that dies in it leaves its own), Sexton's Bell (rare: every 6 s the corpses near you rise as your skeletons, a thrall's rising corpse first, so it never rises against you; awakened, the toll curses) and Crown of Antlers (the second Grave legendary: each of your skeletons near you takes 5% off every hit, up to 3, and kills may raise a guard; awakened, 3 guards mend you). Soul Lantern leaves the open pool for the Barrowvale's crown: the Knight crown picks one of the two, the Champion crown gives the other. Barrow Boots joins the starter pool as a common (RELICS.md C6).
- ◆ **The Cinderlands' class relics and duo** (#230): the Viking's Surtr's Brand (every attack hit during Berserker Rage stokes his axe, up to 8 + Rage; when Rage ends the fire bursts out round him, damage per stoke and burn stacks; awakened, a full axe bursts at once) and the Necromancer's Bonefire (his skeletons burn: each sets the enemies next to it alight every 1.5 s; awakened, a skeleton he raises rises in a burst of fire); both are rares, like every class relic, and every champion now has a Flame one. The Cinderlands' duo is Baptism of Fire, Flame + Holy (Flashpowder + Blessed Water: a flare heals you for every enemy it catches). It is Flame's fifth recipe: with one duo a realm no family can stay at the 4 that RELICS.md A5 set for 12 duos, so the most is 5 from here on, and the partner is Holy, a family still at 3 (RELICS.md C5).
- ◆ **The Warden as the Marches' crown boss** (#202): he already fights three phases as an Act boss, so as the crown boss his third phase is his own, the Judgement: a second ring of stone inside the first with one gap, and three rings of force rolling out from him in place of the clock hands and the closing circle; seals every 6 s instead of 7.5, knights every other seal. Every crown boss holds each phase for its 12 s: until then its HP stops just above the next threshold, and after it just above the one after, so no blow carries it through a phase. The crown's signature relic comes as a one-card pick after the level's rare pick, before the results; closing the game on it keeps the relic (it is banked with the run).
- ◆ **The forge presses** (#211): the Iron Hold's own hazard, in its levels in the Great Keep only (a plain run there keeps just its braziers), on their own clock beside the braziers. Every 8 s a press marks the flagstone slabs round you, a line of three through yours (from wave 11 every other slam a cross of five), lowers its ram for 1.5 s and slams: 18 damage scaled with the wave like a foe's, to you if you still stand on a marked slab and three times that to the foes on them, like the braziers, so luring the horde under a press pays. One step aside always clears it.
- ◆ **Fire that spreads** (#224): the Cinderlands' own hazard, in its levels in the Ember Forge only (a plain run there keeps just its lava), on its own clock like the forge presses. Every 10 s (the first 10 s in) fire catches on the flagstone slab at the lava's bank nearest you, from wave 11 on two slabs at least 4 slabs apart, and creeps a slab every 0.8 s to where you stood when it caught, then round that spot, 5 slabs in all: it does not follow you, so a few steps off its path clear it, as one step clears a press. A slab kindles for 0.8 s first (a glowing rim, no harm), then burns 3 s: 8 fire a second scaled with the wave like a foe's to you and your minions, twice that to foes, like the lava, so a horde led over the trail pays. Past the bank it keeps to the floor, never along the lava. Plain fire, no burn stacks (those stay the Torchbearers' and the bosses'): with a stack a tick, or a longer trail (7 slabs, 4 s) that followed the champion, the bot lost a fifth or more of its level-1 clears; as built, 100 first tries on Knight clear 42 (95/25/20/60/10% by level) against 48 without it (95/45/25/60/15%).
- ◆ **The Iron Hold's shieldwall** (#213): the Iron Shieldwall's iron tower shield is always up, line or no line (the plain spearman's line rule is not his): a blow at his front, within about 70° either side of his facing, does 15% of itself and a shot from the front is stopped, as the shield bearer's is; from the side, from behind, or with no direction (areas, ticks) it lands in full. He turns toward you at most 1.8 radians (about 100°) a second, so stepping round him opens his side.
- ◆ **Thorns** (#214): the Iron Hold's shield bearers march as Thorn Bearers, the same shield, spiked. Only the champion's own blows count (his attack or an ability, projectiles included) and only when struck from within 100 px of the bearer's edge, so a ranged class that keeps its distance is never bitten; status and field ticks, relic procs, minions and the arena's hazards never set them off. A bite is 20% of the blow as it arrives (before his shield turns it), at most 5% of the champion's max HP, at most once per 0.35 s per bearer; armor, blocks and ward apply, and thorns never take the last HP.
- ◆ **Burn stacks on you** (#225): the Cinderlands' peasants march as Torchbearers (a torch for the pitchfork, 7 damage in place of 8). Each blow that lands leaves a burn stack, up to burn's 5, burning 1.2 fire a second per stack (scaled as every foe's status is); the stacks fall off one at a time, one 1.5 s after the last blow that fed them and one every 1.5 s after that, so stepping away puts it out in at most 7.5 s (a full burn deals about 27 before scaling). Any class's utility puts a Cinderlands burn out at once (stop, drop and roll), so every class has the same answer; a plain burn (the cultist's, the dragon's) is untouched and still goes all at once when its time runs out.
- ◆ **Bursts of fire when foes die** (#226): the Cinderlands' wolves hunt as Cinder Hounds (the wolf's body, leap and pack; a charred coat that burns). Where one dies, whatever felled it, a marked blast of fire stands for 0.8 s and then goes off: 52 px wide, a bite and a half of his (9 before scaling), to the champion and his minions only, so one step out of the mark clears it. He has no bleed (the burst takes its place), resists fire (x0.75) and fears frost (x1.25), the wolf's weakness turned round. Decided: the wolf, since he falls at your feet in packs from a realm's first level on (the knight is the Iron Hold's variant, a crossbowman falls out of reach, a Cultist bursts already); the blast spares other foes, so a pack does not clear itself; in the Cinder Colossus's heat (#228) his own, bigger blast takes the hound's place, one burst a death.
- ◆ **The Forgemaster** (#215): a realm level-3 boss fights three phases like an Act boss (its level ends on an Act's last wave), with no minimum phase time (that stays the crown boss's). He wears the Iron Knight's plate, 6 plates that break one per blow, reforged whole at each new phase; phase 1 his hammer in a marked arc, from phase 2 every other blow a checkerboard of forge presses round you (2 strokes, 3 in phase 3) and sparks after the hammer, in phase 3 molten slag where it lands. A realm's own boss is never drawn into another run.
- ◆ **Level tuning** (#221): rule 9's clear rates come from a level step on enemy HP and damage by a level's place in its realm (`WORLD.levelStep`, easing the first levels most, never below Squire on Knight; the Last Bastion keeps 1), and the head start's boons turn epic from level 11 on, where a continuous run holds about twice a loadout's relics. The level panel's Enemy HP includes the step.
- ◆ **The Iron King** (#216): the Iron Hold's crown boss teaches its three lessons, a phase each (every phase held its 12 s as the crown boss's). Phase 1 his plate, 8 plates that break one per blow, and his guard of two Iron Knights every third blow; phase 2 he casts off what is left of it and raises an iron tower shield (a blow at his front does 15%, a shot from the front is stopped; he turns 1.4 radians a second, slower than a shieldwall, so step round him) and every other blow rushes you down a marked line; phase 3 he throws the shield down and his thorns bite a blow struck within 100 px (15% of it, at most 4% of your max HP, once per 0.5 s: smaller and slower than a thorn bearer's, since a boss takes many blows). His other blows are the Decree: lines of marked iron from his edge outward, one straight at you (4 lines, 8 in phase 3).
- ◆ **Realm runs** (#237): a checkpoint is the run as it stood when the level was cleared (relics with their tiers, gold, the build, open picks), with HP refilled; it is stored with the champion, one per realm, on the tier it was started on. A death or a quit leaves the checkpoint as it was, so the level plays again on the same seed. With no run in progress a realm is fought from level 1 (a champion from v0.10 keeps its cleared levels and their rewards, but its next fight there is level 1); until the road's Continue / Start over ([#242](https://github.com/Cyanida/last-bastion/issues/242)) only level 1 and the level the run stands at can be fought, and a fight at level 1 replaces the run in progress. Test mode and the sim still start a later level with the old head start, as a tool.
- ◆ **The Ember Queen** (#227): the Cinderlands' level-3 boss fights three phases like the Forgemaster (no minimum phase time) and teaches the realm's fire without its new foes: she keeps to the middle distance, her Kindling marks spots round you (one on you; 3, 4, 5 by phase) that burst one after another and leave burning ground that stacks the burn, and her Ember volley is a fan of five fire bolts; from phase 2 every third blow is her Flare, closed rings of fire bursting outward from her, the near ring first (2 rings, 3 in phase 3: stand at her side or out of reach); each new phase she flares up at once, and in phase 3 her steps leave the ground burning. 1050 HP like the Warden, since she has no plate; she resists fire like the Forgemaster (half), so a fire build still hurts her.
- ◆ **The Cinder Colossus** (#228): the Cinderlands' crown boss teaches its three lessons, a phase each (every phase held its 12 s as the crown boss's). Phase 1 burn stacks: every hit of his, blow or touch, puts 2 stacks of the Cinderlands' burn on you (#225's: up to 5, one falls every 1.5 s, your utility puts it out), and his Slam is a fan of 3 marked lines of fire from his edge outward, the middle one at you. Phase 2 fire that spreads: every other blow (the first included) he kindles the ground, 3 marked embers, one on you and two round you, and each fire creeps outward away from him, forking once, a new patch every 1.1 s, 7 patches a seed (the Dragon's burning fields). Phase 3 bursts: a foe that falls within 380 px of him (a pulsing ring shows his heat) bursts into a marked blast of fire where it fell, 0.7 s later, and every third blow he calls a brood of 3 Cultists to fall there. Decided: his brood are Cultists (the base game's fire foe), since the Cinderlands' own foes (#225, #226) are built alongside him; a Cultist that blows itself up does not burst again.
- ◆ **The level-cleared screen** (#241): a cleared level ends on "Level cleared" in place of the results: the XP, the level up, then the build (a row per stat with − and +, the ability's and the utility's next upgrade for 2 points, a button to the talent tree), with "Continue to level N" as the main button and "Back to the map", which opens the realm's road (where Continue and Start over live), not the world map. The minus takes back only stat points no realm run has played with yet; upgrades and talents come back only with the free reset outside a run. A utility upgrade can be bought from champion level 2, where the utility unlocks. No build screen comes before a level; the Act's quest board still opens after the opening relic pick, since it is the level's own content and its quest foes wait on it.
- ◆ **The Iron Hold's rewards and theme** (#219): a keep-locked level's pick shows 1 of 2 of the champion's locked rares of the families it held at the end (those it held first), never a legendary (the crown's) or a class relic (level 3's); none: 2 Runes. The rewards with no choice (level 3's class relic, the Champion crown's other legendary, like the Marches' signature relic) are banked with the run and shown on one card; the Knight crown's pick is 1 of the 2 Steel legendaries, and a champion who closes the game on it gets the first one it lacks at the Champion crown. The realm's levels play a theme of their own, the Iron Hold (E minor, 72 BPM, anvil bells on beats 2 and 4, a choir under a horn), in place of the Great Keep's; a plain run there keeps the Keep's.
- ◆ **The Iron Hold on the realm run** (#219): its reward picks come before the level-cleared screen (the keep-locked pick, the class relic's card, the crown's legendaries), so Continue goes on with them banked; a keep-locked pick counts every relic the run held when the level ended, the ones from its earlier levels too; a level played again after Start over pays no second reward. The Legend crown's title is **Ironsworn** and its palette the **Iron colours** (cold dark steel), both for the whole account, banked with the run and named on the level-cleared screen; a realm that names neither (the Marches, until its own issue) gives none.
- ◆ **An elite end boss** (#219): a relic realm's level 4 ends on its first boss as an elite: one phase more on the same HP (`WORLD.eliteBoss`), named "…, Elite" in the fight and "Elite boss" on the level panel; no stat step, since enemy scaling is the balance issue's ([#220](https://github.com/Cyanida/last-bastion/issues/220)). The Warden's extra phase is his Judgement (the Marches crown's third phase), as his fourth, with no minimum phase time.
- ◆ **The Cinderlands' levels, rewards and theme** (#231): the realm runs on the Iron Hold's recipe and its shared code (#219), with Flame for Steel: levels 1, 2 and 4 keep 1 of 2 locked Flame rares of what the run held (none: 2 Runes), level 3 banks the champion's Flame class relic, the Knight crown picks 1 of Dragon's Tongue and Crown of Cinders, the Champion crown gives the other. The Legend crown's title is **Cinderborn** and its palette the **Cinder colours** (a dark ember red, where Gilded is bright gold), both for the whole account. The realm's levels play a theme of their own, the Cinderlands (B Phrygian dominant, 90 BPM in three: a harp flickering over an organ, a hand drum, a flute for the lead), in place of the Ember Forge's E Phrygian march; a plain run there keeps the Forge's.
- ◆ **The elite Grand Inquisitor** (#231): the Cinderlands' level 4 ends on him as an elite, three phases on the same HP (he has two as a plain boss). His extra phase is the Auto-da-fé: every pyre of his lines stays alight for 2.5 s where it lands (8 fire a second scaled like a foe's blow, and a stack of the Torchbearers' falling burn a tick, which your utility puts out), so his fan of three lines fences the floor into wedges until about his next cast, and that cast comes at once when the phase begins. No more lines, no more Cultists and no stat step than his second phase: the fire that stays is the phase, and enemy scaling is the balance issue's ([#232](https://github.com/Cyanida/last-bastion/issues/232)). Not a fan of five lines or a closing ring of pyres on top: the realm's spreading fire burns on the same floor, so one new thing is the more balanced choice (not measured: the sim's bot and the balance pass judge it).
- ◆ **The balance pass** (#220): rule 9's clear rates are measured with the bot playing a realm as one run, as a player does: a fall counts as that level's first try lost and the bot is raised where it fell to play the run on (a replay on the same seed would fall the same way). "Falling evenly between" is read for the Marches too: 95% at its level 1 down to 58% at its crown. Enemy scaling by champion level reads the pace as a level ends, with a steeper curve, so the early levels ease the most; the level step goes up from its floor on the late levels, which a run's carried relics made too easy; the Last Bastion keeps its first fit until v0.14.0. An elite end boss has 1.4 times the HP and hits 1.15 times as hard, on top of its extra phase. After two passes the targets are met on average (93%, 93%, 53%) but not per class: the bot's Archer crowns the Iron Hold on none of 8 first tries, reported in BALANCE.md.
- ◆ **The Cinderlands' balance pass** (#232): a relic realm can have level steps and wave lengths of its own (`WORLD.levelStep.own`, `WORLD.levelWaves.own`), in place of the one row every relic realm shared, so a realm is tuned on its own foes, hazard and bosses without retuning the ones before it; a realm with none keeps the shared row. The Cinderlands' crown level eases most (Enemy HP 200% on Knight, was 225%) and its levels 2–4 run longer. The Cinder Colossus hits for 18 (was 24), his fires burn 8 a second (10) and his burn 2.2 a stack (4): still two stacks a hit and the realm's hottest; his HP and his 12-second phases stay. The Ember Queen and the elite Grand Inquisitor keep their numbers: the bot, which dodges every marked blow, lost no first try to her and one in 40 to him whatever their HP or fire, and a number the bot can't feel is not tuned on the bot. After two passes the clear rates are 85, 88, 78, 63 and 55% against 90, 82, 73, 65 and 55–60%, all within the band, but not per class: the bot's Archer crowns the Cinderlands on none of 8 first tries, as in the Iron Hold, reported in BALANCE.md.
- ◆ **Squire eases a crown-capped champion** (#263): on Squire, foes in a realm level have 3% less HP and damage for each champion level the crown cap holds the champion below what that level expects (`capEase`, `capGap`), one rule for every realm in place of a number for one crown; Knight and up are unchanged. The Cinderlands' Squire crown went from 78% to 88% of first tries; the Archer stays at 3 of 8, the known Archer gap.
- ◆ **A crown boss's phases can't be skipped** (#264): once a phase's minimum time is up, a burst only ends that phase, and the next starts at the top of its share of the bar (67%, then 33%), for every crown boss (`crownHpFloor`); the 12 s minimum stays.
- ◆ **The Cinderlands on Knight** (#262): levels 2 and 4 ease through the realm's own level step (Enemy HP 235% and 230%, were 251% and 240%) and level 2 fields fewer foes at once (x1.2), not through the expected champion level, which every ring-2 realm shares. What costs a champion at the Marches crown's level is its level, not the level's numbers (BALANCE.md).
- ◆ **The Barrowvale's end bosses** (#281): the Plague Abbot ends level 1 as its pool boss, the Lich ends level 2 and level 4 as an elite, the new boss level 3 and the Barrow King the crown level.
- ✓ **28-09:** no approval gates that stop the build; releases stacked on each other's branches up to v1.0.0 (see the top).
- ✓ **29-09, Jesse's playtest ([#234](https://github.com/Cyanida/last-bastion/issues/234)):** short relic text; no build screens before a level; a champion screen that explains itself; no boss twice in a realm; champion levels with stat and talent points between levels, none inside a level; a realm is one run with checkpoints; levels of about 4–10 minutes. The head start, the per-level slot counts and the talent plan's auto-spend go. Numbers here (3 stat points a level, the level cap, the expected levels per ring) are ◆ starting values for the sim.
- ✓ **01-10:** the sound and music overhaul ([#142](https://github.com/Cyanida/last-bastion/issues/142), [#140](https://github.com/Cyanida/last-bastion/issues/140)), the five champion redesigns ([#245](https://github.com/Cyanida/last-bastion/issues/245), [#247](https://github.com/Cyanida/last-bastion/issues/247), [#268](https://github.com/Cyanida/last-bastion/issues/268)-[#270](https://github.com/Cyanida/last-bastion/issues/270)) and the UI fit ([#272](https://github.com/Cyanida/last-bastion/issues/272)) come into v0.13.0 (Jesse, in chat).
- ◆ **The overhaul's sounds** (#142): Jesse allowed recorded sound files (26-09), but the v0.13.0 overhaul is synthesized in code like today's sounds and music: the builders run unattended and can't vet a download's licence, and synthesis keeps the browser build small. The mixer and the cue plumbing take a recorded sample as well as a synth voice, so CC0 files can replace single sounds later without new code.

---

Built from four rounds of independent review against the repository at v0.8.2 (27697ec): the code, BALANCE.md, RELICS.md, ROADMAP.md, RELEASES.md and AGENTS.md, and a full health check on 28-09-2026 (CI green, 621 tests, play test 64/64, perf p95 16.8 ms against 34). Expected levels come from src/logic/formulas.ts. Relic counts come from src/config/relics.ts: 50 family relics (15 class relics), 6 cursed, 12 duos. Sprites are the game's own sheets; the map and the menus on the plan page are mockups of the target look, painted in code.
- ◆ **The Daily Trial and the Classic run** (#204): the trial opens once any champion holds the Marches crown (any tier), and a save that already took a trial keeps it open; while shut the title shows it locked with "Opens with the Marches crown". Its pool is every relic its class can find, and it has no loadout: no slots, so no Armorer's pick and no Keepsake common either. With the Classic run gone, "Take up arms" opens the champion select (colours and treasure stay there; arena, difficulty, curses, traits, Oath and seed went with the Classic run) and its button opens the champion screen. The save keeps the Classic settings (arena, tier, curses, traits, Oath) untouched for the Last Bastion, but no level or trial reads them. A trial's results go back to the title.
- ◆ **Champion levels** (#238): a champion level is worth five of the old run levels (five growths, three stat points of two rare boons each); a level costs 140 XP × the level, at most 840; XP past the cap is kept and becomes levels at the next crown; no level past 30; only a clear banks XP (a death restarts the level with none), and a replay is a level already cleared on any tier.
- ◆ **Spending** (#238): ability and utility tiers are bought in tier order (the second utility tier stays a mastery unlock); points are reset only while no realm run stands at a checkpoint; the account's permanent talent points (Keep, mastery, deeds) are the champion's to spend; a v7 talent plan becomes its talents, as far as its points reach; the utility ability unlocks at champion level 2.
- ◆ **Enemy scaling by champion level** (#238): enemy HP and damage follow the champion level a level expects (the ring's range spread over the realm's levels, held at the cap its opening crowns give: 5 from the Marches' level 5 on), against the pace the waves were tuned for. Keep and mastery start levels give their growth, not a level. The Last Bastion plays at the champion's level with no level-ups; its checkpoint at the end of each Act waits for its own release (v0.14.0).
- ◆ **Longer levels** (#243): a realm level runs on its own waves: only its last wave is a boss wave (the scale's x5 and x0 waves inside it are plain waves, so no boss comes twice in a realm and none stands right before the level's own), and an Act that ends inside a level moves on in the realm's arena with the next Act's theme and quest board, no Merchant and no fork; the Last Bastion keeps the 40-wave scale. Wave length is `WORLD.levelWaves`, per level: `foes` on the foes a wave brings and `pace` on the time they trickle in over (early levels get more foes, late levels a slower trickle), with a foe's XP divided by `foes` so a level pays what its waves pay at the pace. A champion level costs 180 XP × the level (was 140), fitted again to the Marches' longer levels: a level per level up to the cap of 5, and 8 at its crown. After two tuning passes the minutes are met and two clear rates are not (Marches level 1 75% against about 95%, the Iron Hold's level 5 30% against 55–60%) with the level step at its floor just over Squire's: reported in BALANCE.md, not tuned further.
- ◆ **A realm's own foes on every tier** (#249): the Iron Hold's levels field its shieldwall squads on Squire and Knight too (they are a Champion foe elsewhere); each keeps its own first wave, so the Iron Shieldwall marches from level 2 (wave 9) and level 1 stays the Iron Knight's. Below Champion such a squad comes at a quarter of its weight (`fieldsWeight`): at full weight it crowded out the Knight tier's lances and crusades and the Iron Hold's level 4 cleared 80% against 65%; at a quarter 78% and level 5 60%. The road's featured foes list only squads the chosen tier fields in that level, and the realm's own foes (its variants) come first, so every Iron Hold level on Squire names one.
- ◆ **Realms not built yet say so** (#258): `built` in `config/world.ts` marks a realm whose own foes, bosses and relics are in the game; an unbuilt realm stays open with its stand-ins (#191) and its road says they come in a later version. The champion screen's PLAY prefers a built realm. Each release that builds a realm flips its flag (the Barrowvale in v0.13.0).
- ◆ **A featured squad comes for sure** (#259): a level whose road features one of its realm's `fields` foes brings one squad of it on every tier, on a wave drawn per seed from the level's first three waves where the squad is fielded (the Iron Hold's levels 2-5: waves 9-11, 17-19, 25-27, 33-35), out of that wave's squad budget (it takes a rolled squad's place); any more come at `fieldsWeight`. On Knight levels 2-5 went from 73/73/75/55% to 85/78/70/50%, each within its band (BALANCE.md). Only `fields` foes: the realm's other own foes (Iron Knight, Thorn Bearer) come at full weight in squads and on their own, so they need no guarantee.
- ◆ **Squire is measured and eases a realm's later levels most** (#250): Squire keeps its tier numbers (HP and damage x1, where Knight is x1.45 and x1.25) and in a realm's levels also takes `realmEase`: enemy HP x0.85 at a realm's first level to x0.7 at its last, damage x0.85 to x0.75, even between. Decided over a Squire bonus to the champion level or its cap (the champion is one across tiers, and past the crown cap a level step that keeps rising was what held levels 3–5 up) and over a lower Squire tier (it would also ease the Daily Trial and plain runs). The Last Bastion keeps 1 until its own release. The bar, measured by the sim on Squire with a Squire player's progress: Squire 10 points over Knight's first-try clear rate on every level, every class but the Archer over half its tries (BALANCE.md).
- ◆ **The Barrow King** (#278): the Barrowvale's crown boss teaches its two lessons and one of his own, a phase each (every phase held its 12 s as the crown boss's). Every blow is his Reap, two rows of marked crescent swept at you. Phase 1 the dead rise unless trampled: every Reap opens 2 graves 120 px round you; step onto one within 3.2 s or one of his barrow guard climbs out (at most 6 standing). Phase 2 plague ground that lasts: no more graves, and every other Reap (the first included) leaves its ground plagued for 14 s, with poison. Phase 3 his guard: every other Reap opens 2 graves at his feet, and while one of his risen stands within 320 px of him a blow does him 60% less (GUARDED, a pale ring shows it): kill them, or trample their graves. Decided: the Barrow King: his risen are Armored Knights (the base game's, his old retinue), since the Barrowvale's own foes (#275, #276) are built alongside him; dull grave-green bronze, a bone death mask and a crown of antlers, so he reads neither as the Lich (skull, gold crown, robes) nor as the Plague Abbot.
- ◆ **The Gravedigger** (#277): the Barrowvale's level-3 boss fights three phases like the Forgemaster (no minimum phase time) and teaches the realm's two lessons with his own tools: his Digging flings marked clods round you (one on you; 2, 3, 4 by phase), each leaving an open grave that rises as a plain Peasant at 60% HP after 5, 4.5, 4 s unless you step on it; his spade strikes a marked arc in front of him; from phase 2 every third blow is his Rot, a marked line of plague ground towards you that poisons and lasts 14 s (the Abbot's 6). Each new phase calls every open grave up at once, and from phase 3 a risen grave leaves rot. Decided: the name the plan's placeholder gave him; a hunched dead sexton in a hide greatcoat and a sagging hat with an iron spade and a grave-lit lantern (not robed like the Lich and the Abbot, not plated like a champion); 1100 HP, a slow chaser; shadow x0.6, holy x1.3; his dead are plain Peasants, not the realm's variants (#275, #276), and at most 8 graves are open.
- ◆ **Plague ground that lasts** (#276): the Barrowvale's wolves hunt as Blight Hounds (the wolf's body, leap and pack; a rotting coat). Where one dies, whatever felled it, plague ground stays for 12 s (a Plague wave's pools 4, a plague cart's 6): 46 px wide, 0.6 of his blow a second as shadow (3.6 before scaling, against a Plague pool's 10), to the champion and his minions only. A hound falling within its radius of plague ground already standing renews that patch instead of laying another, and at most 6 stand at once (the oldest fades for a new one), so a pack dying in a heap fouls one patch and the ground never carpets the arena (the fields cap of 40 stays for everything else). He has no bleed (the ground takes its place) and shrugs off shadow (x0.75). Decided: the wolf, since he falls at your feet in packs from a realm's first level on, on every tier (so the realm needs no `fields` entry for him); where he dies, not where he walks, so the ground marks the fights you won and the lesson is to fight off it.
- ◆ **Corpses that rise unless you trample them** (#275): the Barrowvale's peasants march as Barrow Thralls (the peasant's body, blow and 22 HP; grey-green, soul-eyed, in a torn shroud). Where one falls its corpse lies soul-lit in a ring that closes over 4 s; then it rises where it lay with half its HP (11 before scaling) and the same blow, unless the champion walks over it first (within 10 px of his edge). A risen thrall stays down when it falls again, and a corpse taken by anything else (Raise Dead, a bone collector) never rises. Decided: the peasant, the realm's crowd from wave 1 on every tier, so every level teaches it; 4 s of a corpse's 10 lets a champion turn back for one but not for a whole crowd; rising once at half HP keeps a levy from doubling.
- ◆ **Grasping hands that hold** (#274): the Barrowvale's own hazard, in its levels in the Forsaken Graveyard only (a plain run there keeps its plain hands). On the graveyard's hazard clock, in place of its plain hands, every 7 s three graves are marked (from wave 11 four), one under you and the rest 70 to 170 px round you, each in its own third of the circle: an open pit with a headstone, a pair of hands clawing up in it. After 1.3 s the hands rise: 10 damage scaled with the wave like a foe's, and they hold you 1.2 s (you cannot walk; you still fight, and a dash or a blink still carries you out); a dodge, a shield or a block keeps the hold off with the blow. Foes on a grave take three times that and are held 2 s (a stun), so a horde led over the graves pays. Its flash card shows the first time graves are marked. Decided: the hands replace the graveyard's plain hands in the realm's levels rather than come on top of them, since both rise round you from the same ground; one grave always under you, like a press's slab, so standing still is what they punish.
