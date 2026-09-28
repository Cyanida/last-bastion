# Roadmap

Release rules: [RELEASES.md](RELEASES.md). Live progress: the [Last Bastion Roadmap board](https://github.com/users/Cyanida/projects/2) and the pinned **🔨 Now building** issue.
Each section below is one release, with its [milestone](https://github.com/Cyanida/last-bastion/milestones).
From v0.8.3 on, the roadmap is **Road to the Crown** ([docs/road-to-the-crown.md](docs/road-to-the-crown.md)), the plan Jesse approved on 28-09-2026: champions, a world map, the Marches, seven relic realms and the Last Bastion as the finale. The releases up to v1.0.0 are built one after another, each on a branch that starts from the one before it. A **Gate** in a scope marks where the builder shows Jesse what it made; since 28-09 it posts that for him and carries on without waiting.

| Version | Theme | Status |
|---|---|---|
| v0.6.0 | A run with an ending | released 2026-09-23 |
| v0.7.0 | Relic rework | released 2026-09-23 |
| v0.7.1 | Music & convenience (the results-screen hotfix shipped first as v0.7.1; the rest as v0.7.2) | released 2026-09-24 |
| v0.7.3 | Fixes & class balance | released 2026-09-24 |
| v0.7.4 | Fixes & polish | released 2026-09-24 |
| v0.7.5 | Aiming & fixes | released 2026-09-25 |
| v0.7.6 | Quest fixes | released 2026-09-25 |
| v0.8.0 | Balance, relics & bosses | released 2026-09-26 |
| v0.8.1 | Characters | released 2026-09-26 |
| v0.8.2 | Art & animation | released 2026-09-26 |
| v0.8.3 | Fixes from the 28-09 check | planned |
| v0.9.0 | The new look | planned |
| v0.10.0 | Champions & the Marches | planned |
| v0.11.0 | The Iron Hold | planned |
| v0.12.0 | The Cinderlands | planned |
| v0.13.0 | The Barrowvale | planned |
| v0.14.0 | The Frozen Pass & the Last Bastion | planned |
| v0.15.0 | Classes & roster | planned |
| v0.16.0 | Polished PC | planned |
| v1.0.0 | Phone & launch | planned |
| v1.1.0 | The Stormspire | after 1.0 |
| v1.2.0 | The Hallowed Reach | after 1.0 |
| v1.3.0 | The Crimson Fields | after 1.0 |
| Ideas | not planned yet (the inbox) | – |

**Co-op is dropped** (25-09-2026): see [the last section](#co-op-dropped).

## v0.7.0 – Relic rework

[Milestone](https://github.com/Cyanida/last-bastion/milestone/1) · Track A

**Goal.** Relics come at a handful of meaningful moments, runs build toward families, relics grow and awaken, duos are worth chasing, and the results screen shows which relics carried the run. Relic state lives per player and every relic choice is an action any player could take, so the system is ready for co-op in 0.8.

**Scope.**
- A0 ([#4](https://github.com/Cyanida/last-bastion/issues/4)) Diagnosis: RELICS.md on how relics perform today (sources, per-relic contribution, how often soft caps and proc sharing bite).
- A0b ([#5](https://github.com/Cyanida/last-bastion/issues/5)) Design review: the complete new relic list (families, class relics, duos, set bonuses) in RELICS.md, approved by Jesse before A3-A5.
- A1 ([#6](https://github.com/Cyanida/last-bastion/issues/6)) Save safety: the last 3 pre-migration saves kept under a separate key; "Restore previous version" in Settings.
- A2 ([#7](https://github.com/Cyanida/last-bastion/issues/7)) Relic moments: relics only from bosses, lairs, strongboxes, quests, the Merchant and the run start (about 12-16 a run); pick 1 of 3 with Skip and one reroll; offers mix held and new families; a pick screen that shows the relic's effect on your build; a seeded relic RNG stream per player.
- A3 ([#8](https://github.com/Cyanida/last-bastion/issues/8)) Seven families (Flame, Frost, Storm, Blood, Holy, Grave, Steel) with 2/4/6 set bonuses that change how you play; 3 class relics per class; a family HUD row.
- A4 ([#9](https://github.com/Cyanida/last-bastion/issues/9)) Attunement: no duplicates; relics grow by doing work, tier II strengthens, tier III awakens with a named behavior.
- A5 ([#10](https://github.com/Cyanida/last-bastion/issues/10)) Duo relics: at least 12, from two families each, offered as a gold fourth card; replace the passive synergies and clashes.
- A6 ([#11](https://github.com/Cyanida/last-bastion/issues/11)) Rules and visibility: no plain stat relics, no category soft caps or proc sharing, proc icons, family-colored numbers, a Relics tab on the results screen and in the run log.
- A7 ([#12](https://github.com/Cyanida/last-bastion/issues/12)) The Keep's relic tracks repurposed with refunds, relic achievements updated, the compendium migrated.
- A8 ([#13](https://github.com/Cyanida/last-bastion/issues/13)) Balance with `sim -- relics` against the targets below.
- A9 ([#14](https://github.com/Cyanida/last-bastion/issues/14)) Release, with an automated check that latest.yml, the installer name and the version match the tag, and a manual updater test in the README.

**Out of scope.** Cursed relics and the Merchant's Reforge (0.7.1). Music. Any networking or a second player.

**Exit criteria.**
- No relic below 3% or above 35% contribution in the builds where it is picked.
- A 6-set in about a third of winning runs; 1-2 duos per winning run on average, 3 or more in under 15%.
- Every class reaches a 4-set in at least two families in the sim; relic power index about 1.8-2.2x a no-relic run.
- A v0.6.0 save migrates without loss (backup kept); the Daily Trial stays deterministic; tests and the perf test pass.
- Released through the pipeline; the updater from 0.6 works; Pages deployed.

## v0.7.1 – Music & convenience

[Milestone](https://github.com/Cyanida/last-bastion/milestone/2) · Track B

Shipped first, on 2026-09-23: [#55](https://github.com/Cyanida/last-bastion/issues/55), a hotfix for v0.7.0 (the results and victory screens did not open after a run with a set bonus or a duo), tagged v0.7.1. A tag is used only once, so the Music & convenience release is tagged v0.7.2.

**Goal.** Quiet, per-arena gameplay music that builds a little in fights and never gets in the way, plus conveniences: a What's new screen, a glossary, a hidden test mode, and the relic additions that build on 0.7.0.

**Scope.**
- B1 ([#15](https://github.com/Cyanida/last-bastion/issues/15)) Gameplay music: procedural WebAudio, one theme per arena (66-96 BPM, seeded motifs), at most three adaptive layers plus a boss layer, bar-aligned changes, crossfades; music and effects volumes, "Music during runs"; a voice budget and a lookahead scheduler within the perf budget.
- B2 ([#16](https://github.com/Cyanida/last-bastion/issues/16)) What's new: shown once after an update, built from the top CHANGELOG entry, also on the title screen.
- B3 ([#17](https://github.com/Cyanida/last-bastion/issues/17)) Glossary: one list of game terms, underlined in tooltips, a page in the pause menu and the Keep.
- B4 ([#18](https://github.com/Cyanida/last-bastion/issues/18)) Test mode and jukebox: hidden (tap the version 5 times, or `?dev=1`); start anywhere with any class, level and talents; a jukebox for every theme and layer; test runs never pay or count.
- After 0.7.0: B5 ([#19](https://github.com/Cyanida/last-bastion/issues/19)) relic stingers, glossary terms and test-mode relics; B6 ([#20](https://github.com/Cyanida/last-bastion/issues/20)) six cursed relics; B7 ([#21](https://github.com/Cyanida/last-bastion/issues/21)) Merchant Reforge; B8 ([#22](https://github.com/Cyanida/last-bastion/issues/22)) class balance check.

**Out of scope.** No new core systems and no save format change (it is a patch release). No audio files.

**Exit criteria.**
- Music plays in every arena, layers change on bar boundaries, and the perf test (with music) stays within budget, also on phones.
- What's new, the glossary and test mode work; test runs never grant rewards (unit tested).
- The class spread report is in BALANCE.md; tests and the perf test pass; released with the updater check.

## v0.7.3 – Fixes & class balance

[Milestone](https://github.com/Cyanida/last-bastion/milestone/8) · a patch release

**Goal.** Fix what playtests found and finish the class balance check.

**Scope.**
1. ([#52](https://github.com/Cyanida/last-bastion/issues/52)) A crash at wave 22 walking to a merchant (reported on v0.6.0; the Merchant and the peddler changed in v0.7).
2. ([#53](https://github.com/Cyanida/last-bastion/issues/53)) The Paladin can keep Divine Shield up all the time.
3. ([#54](https://github.com/Cyanida/last-bastion/issues/54)) "Necromancer" runs off its class card on the class select.
4. ([#59](https://github.com/Cyanida/last-bastion/issues/59)) The redirect enemy and the shield-block enemy hard-counter the Archer (auto-target keeps shooting the blocker).
5. ([#22](https://github.com/Cyanida/last-bastion/issues/22)) The class balance check: sim -- deep per class, candidate Necromancer and Archer values (branch `wip/b8-class-values`).

**Out of scope.** New systems (those are feature releases).

## v0.7.4 – Fixes & polish

[Milestone](https://github.com/Cyanida/last-bastion/milestone/10) · a patch release

**Goal.** Small self-contained fixes and polish before v0.8.0.

**Scope.**
1. ([#63](https://github.com/Cyanida/last-bastion/issues/63)) The Paladin can detonate Divine Shield early, for a weaker burst.
2. ([#68](https://github.com/Cyanida/last-bastion/issues/68)) The Dragon redrawn from the side.

**Out of scope.** New systems (those are feature releases).

## v0.7.5 – Aiming & fixes

[Milestone](https://github.com/Cyanida/last-bastion/milestone/17) · a patch release, from the 25-09 playtest ([#93](https://github.com/Cyanida/last-bastion/issues/93)) and code review

**Goal.** Manual aiming and the fixes found in the playtest and the code review, before v0.8.0.

**Scope.**
1. ([#81](https://github.com/Cyanida/last-bastion/issues/81)) An Aim setting: your basic attacks go where you point.
2. ([#92](https://github.com/Cyanida/last-bastion/issues/92)) The Archer against mirror knights; thrown-back arrows wear the mirror down.
3. ([#95](https://github.com/Cyanida/last-bastion/issues/95)) Bosses last a real fight instead of dying to one ability.
4. ([#96](https://github.com/Cyanida/last-bastion/issues/96)) A duo combines its two relics into one; offers lean toward your families (6-set in about 15% of winning runs).
5. ([#97](https://github.com/Cyanida/last-bastion/issues/97)) The run music plays without stuttering.
6. ([#105](https://github.com/Cyanida/last-bastion/issues/105)) Save import shows shared text as text only.
7. ([#106](https://github.com/Cyanida/last-bastion/issues/106)) Startup with site data blocked; an error no longer freezes the game.
8. ([#107](https://github.com/Cyanida/last-bastion/issues/107)) The web version never stays on a stale page after two quick releases.
9. ([#108](https://github.com/Cyanida/last-bastion/issues/108)) Phoenix Feather, a boss's relic moment, Blood Pact and Rebirth do what they say.
10. ([#109](https://github.com/Cyanida/last-bastion/issues/109)) Gallows gold and the Daily Trial gold cap.
11. ([#110](https://github.com/Cyanida/last-bastion/issues/110)) Esc goes back to the pause menu from Talents, the Glossary and Treasures.
12. ([#111](https://github.com/Cyanida/last-bastion/issues/111)) Chains, charges, fields, Blood Tide, assassins, arena zones and the gamepad as designed.
13. ([#112](https://github.com/Cyanida/last-bastion/issues/112)) Late-Act slams fire as designed; enemy damage over time follows the difficulty.

**Out of scope.** New systems (those are feature releases).

## v0.7.6 – Quest fixes

[Milestone](https://github.com/Cyanida/last-bastion/milestone/21) · a patch release, from playtest feedback

**Goal.** The monk escort quest can be won.

**Scope.**
1. ([#119](https://github.com/Cyanida/last-bastion/issues/119)) The monk has more health, slows instead of stopping near enemies, and enemies prefer the player over him.

**Out of scope.** New systems (those are feature releases).

## v0.8.0 – Balance, relics & bosses

[Milestone](https://github.com/Cyanida/last-bastion/milestone/3) · the next release

**Goal.** Every fight reads clearly and is worth fighting:
- classes and relics in balance;
- bosses that are real fights;
- a card that explains each new thing you meet;
- a HUD you can read at a glance, on a PC and on a phone.

**Scope.**
1. ([#123](https://github.com/Cyanida/last-bastion/issues/123)) The HUD reworked so it reads at a glance, with a text size setting.
2. ([#124](https://github.com/Cyanida/last-bastion/issues/124)) Flash cards: a card the first time you meet an enemy, a boss or a new mechanic, once per player, with a collection to look them up again.
3. ([#98](https://github.com/Cyanida/last-bastion/issues/98)) Relic cards that are easier to read.
4. ([#99](https://github.com/Cyanida/last-bastion/issues/99)) A bigger boss pool, with rare, strong and quest-gated bosses.
5. ([#100](https://github.com/Cyanida/last-bastion/issues/100)) Bosses or arenas that only drop certain relic families, so rerolls can't force a build.
6. ([#127](https://github.com/Cyanida/last-bastion/issues/127)) The Usurper's last phase is a fight, not a wait.
7. ([#126](https://github.com/Cyanida/last-bastion/issues/126)) The Necromancer's giant skeleton stays strong without ending every fight.
8. ([#128](https://github.com/Cyanida/last-bastion/issues/128)) The wandering merchant sells something worth buying at full health.
9. ([#101](https://github.com/Cyanida/last-bastion/issues/101)) New enemy types unlock over the difficulties.
10. ([#79](https://github.com/Cyanida/last-bastion/issues/79)) The harder difficulties unlock faster.
11. ([#117](https://github.com/Cyanida/last-bastion/issues/117)) The remaining balance numbers move into `src/config`, and dead code goes.
12. ([#125](https://github.com/Cyanida/last-bastion/issues/125)) The balance pass, last: classes, relics and bosses measured and tuned.

**Already on the release branch:** the groundwork built for co-op, kept for single-player (#25-#27, #113-#116):
- a run can be saved mid-wave, restored and replayed exactly;
- every screen answer is checked and logged;
- sounds leave through a cue queue;
- stronger tests.

**Out of scope.** The phone app (0.9). New classes, items and the Keep (0.10-0.12).

**Exit criteria.**
- The balance targets in BALANCE.md are met.
- No boss dies to a single ability, in the sims or in the playtests.
- Every enemy, boss and mechanic has a card.
- The HUD reads at phone width at every text size (checked by the play test).

## v0.8.1 – Characters

[Milestone](https://github.com/Cyanida/last-bastion/milestone/24) · a patch release, built from the v0.8.0 tag

**Goal.** Every character reads at a glance, and a flash card shows you who it's about.

**Scope.**
1. ([#138](https://github.com/Cyanida/last-bastion/issues/138)) Every champion and enemy redrawn at double resolution, so each design has room for detail. This merges #135 and #136.
2. ([#133](https://github.com/Cyanida/last-bastion/issues/133)) Flash cards show the enemy itself on the card, and a spotlight picks it out in the arena.
3. ([#134](https://github.com/Cyanida/last-bastion/issues/134)) The Viking's Dread Howl stuns nearby enemies instead of making them flee.

## v0.8.2 – Art & animation

[Milestone](https://github.com/Cyanida/last-bastion/milestone/25) · a patch release, built on v0.8.1

**Goal.** The game looks as good as it plays. Every character, enemy, boss and arena is redrawn as detailed, shaded pixel art that moves,
in the style of the Paladin prototype Jesse approved ([preview](docs/art/paladin-prototype.gif)). It replaces the v0.8.1 redraw, which read
as too cartoonish.

**Scope.**
1. ([#155](https://github.com/Cyanida/last-bastion/issues/155)) The art pipeline. It comes first, because the other four depend on it:
   - a rig tool that draws shaded, animated sprites in code;
   - animation states in the game: idle, walk, attack, hurt and death;
   - the size check, with the camera zoomed out if the arena feels crowded;
   - a style guide and a gallery;
   - the Paladin, the first sprite converted.
2. ([#156](https://github.com/Cyanida/last-bastion/issues/156)) The five champions, with their attacks, abilities, projectiles and the
   Necromancer's skeletons.
3. ([#157](https://github.com/Cyanida/last-bastion/issues/157)) Every foe, commander and siege engine.
4. ([#158](https://github.com/Cyanida/last-bastion/issues/158)) Every boss, with an animation for each of its attacks.
5. ([#159](https://github.com/Cyanida/last-bastion/issues/159)) The four arenas: floors, walls, obstacles, hazards and everything on the
   ground. They grow if the size check asks for it.

**Out of scope.** New content (classes, enemies, arenas), the HUD and menus, and sound. Later releases draw their new art with this pipeline:
- the Wizard (#66);
- skins (#137);
- skeleton archers (#83);
- the themed arenas (#141);
- the Keep as a castle (#67).

**Exit criteria.**
- Nothing in the game is still drawn as a letter grid.
- Every sprite plays its animations in the gallery and in the game, and each attack matches its wind-up or telegraph.
- The golden runs are unchanged, the balance targets hold after any camera or arena change, and `npm run test:perf` holds.

## v0.8.3 – Fixes from the 28-09 check

[Milestone](https://github.com/Cyanida/last-bastion/milestone/26) · a patch release, built on v0.8.2

**Goal.** Every bug the check confirmed, and the docs brought up to date.

**Scope.**
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

## v0.9.0 – The new look

[Milestone](https://github.com/Cyanida/last-bastion/milestone/27) · a feature release

**Goal.** Every menu in the Kingdom Rush / Survivor.io style, drawn in code; the Keep as a castle.

**Scope.**
1. **Menus: an art direction prototype** (UI kit: frames, bevelled buttons, ribbons, rarity frames, currency pills, tab bar, icon atlas) and one restyled screen. **Gate:** Jesse approves it, as with the Paladin prototype ([#155](https://github.com/Cyanida/last-bastion/issues/155)).
2. **Menus: the UI kit in code**: CSS components, an icon atlas rendered by the rig (tools/art/ui), a UI section in tools/art/STYLE.md.
3. **Title, champion select ([#65](https://github.com/Cyanida/last-bastion/issues/65)), Settings, results, compendium, glossary and flash cards in the new look.**
4. **The Keep: drawn as a castle whose buildings grow with its upgrades ([#67](https://github.com/Cyanida/last-bastion/issues/67))**, the account's hub in the new look.
5. **World map: a map painter prototype.** The rig paints terrain per family (grass and fields, grey mountains, basalt and lava, barrows and mist, snow and pines, storm cliffs, golden fields, red battlefields), dirt roads, castles, clouds. **Gate:** Jesse approves the look.
6. **Play checks for every restyled screen**, at 1280×720 and phone landscape; before and after screenshots.

**Done when** no screen is left in the old style, test:perf holds, and both gates are passed.

## v0.10.0 – Champions & the Marches

[Milestone](https://github.com/Cyanida/last-bastion/milestone/22) · a feature release

**Goal.** The engine, the save and the first realm: the map is in the game from here on.

**Scope.**
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

## v0.11.0 – The Iron Hold

[Milestone](https://github.com/Cyanida/last-bastion/milestone/23) · a feature release

**Goal.** The first relic realm, and the recipe for every one after it.

**Scope.**
1. **Iron Hold: the Great Keep as a fortress**, with wings (forge, armory, barracks) and its hazard: forge presses that slam marked tiles.
2. **Foes: armor you break, shields that block from the front, thorns that hit back**: realm variants of the knight, shieldwall and shield bearer, each with a flash card.
3. **Bosses: the Forgemaster (level 3) and the Iron King (crown, 3 phases).** The Warden comes back at level 2 and as an elite at level 4. **Gate:** Jesse plays the Iron King before release.
4. **Relics: 7 new Steel relics**: 1 common, 2 rares, a second legendary, class relics for the Angel, the Necromancer and the Archer; one new Steel duo.
5. **The realm: five levels, rewards, crown and a music theme.**
6. **Balance and checks**: every class through every level on Knight; a golden run; play checks; test:perf in the fortress.

**Done when** the Iron Hold can be crowned on Knight by every class within the targets.

## v0.12.0 – The Cinderlands

[Milestone](https://github.com/Cyanida/last-bastion/milestone/28) · a feature release

**Goal.** [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Ember Forge; fire that spreads.

**Scope.**
1. **Cinderlands: the Ember Forge ([#141](https://github.com/Cyanida/last-bastion/issues/141))** with lava channels and fire that spreads over the floor.
2. **Foes: burn stacks on you, bursts of fire when foes die**, with flash cards.
3. **Bosses: the Ember Queen (level 3) and the Cinder Colossus (crown).** The Grand Inquisitor at level 2 and 4. **Gate:** Jesse plays the crown boss.
4. **Relics: 5 new Flame relics**: 2 rares, a second legendary, class relics for the Viking and the Necromancer; one new duo.
5. **The realm, balance and checks** as in v0.11.

**Done when** the Cinderlands can be crowned on Knight by every class within the targets.

## v0.13.0 – The Barrowvale

[Milestone](https://github.com/Cyanida/last-bastion/milestone/29) · a feature release

**Goal.** The dead rise; Soul Lantern finds its crown.

**Scope.**
1. **Barrowvale: the Forsaken Graveyard** with its grasping hands; the Drowned Fen ([#141](https://github.com/Cyanida/last-bastion/issues/141)) comes later as a second arena.
2. **Foes: corpses that rise unless you trample them, plague ground that lasts**, with flash cards.
3. **Bosses: the Barrow King (crown) and one new level-3 boss.** The Lich and the Plague Abbot return. **Gate:** Jesse plays the Barrow King.
4. **Relics: 8 new Grave relics**: 1 common, 2 rares, a second legendary (Soul Lantern moves to this crown), class relics for the Paladin, Viking, Angel and Archer; one new duo.
5. **The realm, balance and checks** as in v0.11.

**Done when** the Barrowvale can be crowned on Knight by every class within the targets.

## v0.14.0 – The Frozen Pass & the Last Bastion

[Milestone](https://github.com/Cyanida/last-bastion/milestone/30) · a feature release

**Goal.** Ring 3 opens, and five crowns open the finale.

**Scope.**
1. **Frozen Pass: [#141](https://github.com/Cyanida/last-bastion/issues/141)'s arena** with thin ice that cracks into open water.
2. **Foes: chill that stacks on you until you freeze, foes that shatter**, with flash cards.
3. **Bosses: the Rime Witch (level 3) and the Frost Jötun (crown).**
4. **Relics: 6 new Frost relics**: 1 common, 2 rares, a second legendary, class relics for the Paladin and the Viking; one new duo.
5. **The Last Bastion: one 40-wave round with elite foes**: the finale settings, 5 slots, no Armorer's Choice or Merchant relic buys; Oaths and Endless move here; Master ([#131](https://github.com/Cyanida/last-bastion/issues/131)) on Legend; elite bosses ([#152](https://github.com/Cyanida/last-bastion/issues/152)) on Champion and Legend; veteran saves with a win get it open. **Gate:** Jesse plays a full finale.
6. **Balance and checks**, including the finale's power budget of about 15–16 relics per win.

**Done when** the Frozen Pass can be crowned on Knight by every class within the targets, the Last Bastion hits its clear-rate and power targets in the sim, and Jesse has played a full finale.

## v0.15.0 – Classes & roster

[Milestone](https://github.com/Cyanida/last-bastion/milestone/5) · a feature release

**Goal.** The Wizard, and what champions wear.

**Scope.**
1. **The Wizard ([#66](https://github.com/Cyanida/last-bastion/issues/66))**: a sixth champion that unlocks with 3 crowns ([#64](https://github.com/Cyanida/last-bastion/issues/64)), a signature relic, and class relics for every realm built so far (the rest arrive with their realms). **Gate:** the Wizard's design.
2. **Skins ([#137](https://github.com/Cyanida/last-bastion/issues/137)) as crown rewards** and **real recolours ([#164](https://github.com/Cyanida/last-bastion/issues/164))**.
3. **The Necromancer's skeleton archers ([#83](https://github.com/Cyanida/last-bastion/issues/83)).** Hidden subclasses ([#58](https://github.com/Cyanida/last-bastion/issues/58)) move after 1.0.

**Done when** the Wizard can crown the Marches and every realm built so far on Knight within the targets, and every skin and recolour renders from the rig.

## v0.16.0 – Polished PC

[Milestone](https://github.com/Cyanida/last-bastion/milestone/6) · a feature release

**Goal.** The old v0.12 scope, with the map in it.

**Scope.**
1. **The save format frozen ([#45](https://github.com/Cyanida/last-bastion/issues/45))**, with realm progress in it and a migration test from every earlier version.
2. **The perf budget in every realm arena ([#46](https://github.com/Cyanida/last-bastion/issues/46))**, with a 30 fps option.
3. **A crash sweep ([#47](https://github.com/Cyanida/last-bastion/issues/47))**: every realm crowned and the Last Bastion won on PC without an error.
4. **The 1.0 scope written down ([#48](https://github.com/Cyanida/last-bastion/issues/48))**: the Marches, four relic realms, the Last Bastion.
5. **A balance pass over every level and tier**, and the sound mixer part of [#142](https://github.com/Cyanida/last-bastion/issues/142).

**Done when** a save from every earlier version migrates in a test, test:perf holds in every arena, and the crash sweep finds no error.

## v1.0.0 – Phone & launch

[Milestone](https://github.com/Cyanida/last-bastion/milestone/4) · a launch release

**Goal.** [#120](https://github.com/Cyanida/last-bastion/issues/120): the champion screen, the map and the roads at phone width.

**Scope.**
1. **Phone layout for every new screen**, touch-first; levels of 4 to 10 minutes fit phone sessions.
2. **The iPhone app through TestFlight and the App Store**, once the Apple Developer account exists.

**Done when** the play test plays a level at 390 px wide by touch, from the map to the crown, with no sideways scroll on any new screen.

## v1.1.0 – The Stormspire

[Milestone](https://github.com/Cyanida/last-bastion/milestone/31) · after 1.0

**Goal.** Lightning that chains into you; Stormcaller's Horn finds its crown. 7 new relics.

**Scope.**
1. **A storm peak arena, chained lightning, fast rushers and wind; the Storm Caller and the Thunder Roc; 1 common, 2 rares, a second legendary, class relics for the Paladin, Angel and Necromancer; one duo.**

## v1.2.0 – The Hallowed Reach

[Milestone](https://github.com/Cyanida/last-bastion/milestone/32) · after 1.0

**Goal.** [#141](https://github.com/Cyanida/last-bastion/issues/141)'s Sunken Cathedral; wards and healers; Phoenix Feather finds its crown. 6 new relics.

**Scope.**
1. **Ward-bearers that make squads untouchable, healers you must reach first; the Ward-Keeper and the Fallen Saint; 1 common, 2 rares, a second legendary, class relics for the Viking and Archer; one duo.**

## v1.3.0 – The Crimson Fields

[Milestone](https://github.com/Cyanida/last-bastion/milestone/33) · after 1.0

**Goal.** Bleed on you; the map is complete. 8 new relics.

**Scope.**
1. **A battlefield arena, bleed on the player, foes that grow stronger as they bleed; the Butcher and the Crimson Baron; 1 common, 2 rares, a second legendary, class relics for the Paladin, Angel, Necromancer and Archer; one duo.**

Each of these is done when its realm can be crowned on Knight by every class within the targets. After that: items and sound ([#62](https://github.com/Cyanida/last-bastion/issues/62) potions, [#86](https://github.com/Cyanida/last-bastion/issues/86), [#89](https://github.com/Cyanida/last-bastion/issues/89), [#140](https://github.com/Cyanida/last-bastion/issues/140), the rest of [#142](https://github.com/Cyanida/last-bastion/issues/142)), hidden subclasses ([#58](https://github.com/Cyanida/last-bastion/issues/58)), and a second arena per realm.

## Ideas – not planned yet

[Milestone](https://github.com/Cyanida/last-bastion/milestone/9) · the inbox

New ideas wait here until Jesse gives them a release. Some planned work waits here for after 1.0: hidden subclasses ([#58](https://github.com/Cyanida/last-bastion/issues/58)), potions ([#62](https://github.com/Cyanida/last-bastion/issues/62)), the shield relic ([#86](https://github.com/Cyanida/last-bastion/issues/86)), breakable objects ([#89](https://github.com/Cyanida/last-bastion/issues/89)), boss themes ([#140](https://github.com/Cyanida/last-bastion/issues/140)) and the sound overhaul ([#142](https://github.com/Cyanida/last-bastion/issues/142); its mixer part is in v0.16.0).

## Co-op (dropped)

Co-op was the plan for v0.8-v1.0 until 25-09-2026. That day Jesse and his brothers dropped it, because the game is heading to a polished single-player game on PC and phone, where co-op adds little.
- Its issues (#1, #2, #28-#44) are closed as not planned.
- The groundwork built for it stays in v0.8, because single-player uses it (save and resume, replays).
- [ARCHITECTURE.md](ARCHITECTURE.md) describes that groundwork.
