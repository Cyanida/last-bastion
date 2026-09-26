# Roadmap to 1.0

Release rules: [RELEASES.md](RELEASES.md). Live progress: the [Last Bastion Roadmap board](https://github.com/users/Cyanida/projects/2) and the pinned **🔨 Now building** issue.
Each section below is one release, with its [milestone](https://github.com/Cyanida/last-bastion/milestones).

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
| v0.8.2 | Art & animation | planned |
| v0.9.0 | Classes & roster | planned |
| v0.10.0 | Items, arenas & sound | planned |
| v0.11.0 | The Keep & Master difficulty | planned |
| v0.12.0 | Polished PC game | planned |
| v1.0.0 | Phone & launch | planned |
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

## v0.9.0 – Classes & roster

[Milestone](https://github.com/Cyanida/last-bastion/milestone/5)

**Scope.**
- ([#64](https://github.com/Cyanida/last-bastion/issues/64)) Unlockable classes.
- ([#65](https://github.com/Cyanida/last-bastion/issues/65)) The character select, improved.
- ([#66](https://github.com/Cyanida/last-bastion/issues/66)) A new class: the Wizard.
- ([#83](https://github.com/Cyanida/last-bastion/issues/83)) The Necromancer's Raise Dead upgrade: skeleton archers.
- ([#58](https://github.com/Cyanida/last-bastion/issues/58)) Hidden subclasses.
- ([#137](https://github.com/Cyanida/last-bastion/issues/137)) Real skins: a different design per class, drawn on v0.8.1's new art.

## v0.10.0 – Items, arenas & sound

[Milestone](https://github.com/Cyanida/last-bastion/milestone/22)

**Scope.**
- ([#62](https://github.com/Cyanida/last-bastion/issues/62)) Potions: carry up to 3 and drink them when you need them.
- ([#86](https://github.com/Cyanida/last-bastion/issues/86)) A relic that puts a shield in front of you.
- ([#89](https://github.com/Cyanida/last-bastion/issues/89)) Breakable objects in the arena, with small rewards inside.
- ([#141](https://github.com/Cyanida/last-bastion/issues/141)) 3 or 4 new themed arenas, each with its own look, hazard, relic families and music.
- ([#142](https://github.com/Cyanida/last-bastion/issues/142)) A sound overhaul: distinct sounds per class, enemy, boss and relic, stereo and a proper mixer.

## v0.11.0 – The Keep & Master difficulty

[Milestone](https://github.com/Cyanida/last-bastion/milestone/23)

**Scope.**
- ([#67](https://github.com/Cyanida/last-bastion/issues/67)) The Keep drawn as a castle of buildings that grow with its upgrades.
- ([#131](https://github.com/Cyanida/last-bastion/issues/131)) A hidden Master difficulty above Legend. Its unlock rule and reward wait for Jesse's answers.

## v0.12.0 – Polished PC game

[Milestone](https://github.com/Cyanida/last-bastion/milestone/6)

**Goal.** The PC game is polished before it goes to the phone.

**Scope.**
1. ([#60](https://github.com/Cyanida/last-bastion/issues/60)) A tutorial that introduces the mechanics one at a time, built on the flash cards.
2. ([#45](https://github.com/Cyanida/last-bastion/issues/45)) The save format frozen, with a migration test from every earlier version.
3. ([#46](https://github.com/Cyanida/last-bastion/issues/46)) The perf budget holds on a PC, with a 30 fps option.
4. ([#47](https://github.com/Cyanida/last-bastion/issues/47)) A crash sweep: full runs to victory on PC, without a crash or an error.
5. ([#48](https://github.com/Cyanida/last-bastion/issues/48)) The 1.0 scope written down, with every release before it checked against it.

## v1.0.0 – Phone & launch

[Milestone](https://github.com/Cyanida/last-bastion/milestone/4)

**Goal.** The polished game comes to the phone, and launches.

**Scope.** ([#120](https://github.com/Cyanida/last-bastion/issues/120)):
- the phone layout, and save and resume a run;
- the iPhone app through TestFlight and the App Store, once the Apple Developer account exists;
- the perf budget and crash-free full runs on a recent phone.

**Exit criteria.** Everything in [RELEASES.md](RELEASES.md) under "1.0.0 is released only when".

## Ideas – not planned yet

[Milestone](https://github.com/Cyanida/last-bastion/milestone/9) · the inbox

New ideas wait here until Jesse gives them a release. Everything open today is planned before 1.0.

## Co-op (dropped)

Co-op was the plan for v0.8-v1.0 until 25-09-2026. That day Jesse and his brothers dropped it, because the game is heading to a polished single-player game on PC and phone, where co-op adds little.
- Its issues (#1, #2, #28-#44) are closed as not planned.
- The groundwork built for it stays in v0.8, because single-player uses it (save and resume, replays).
- [ARCHITECTURE.md](ARCHITECTURE.md) describes that groundwork.
