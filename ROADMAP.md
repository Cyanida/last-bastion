# Roadmap to 1.0

Release rules: [RELEASES.md](RELEASES.md). Live progress: the [Last Bastion Roadmap board](https://github.com/users/Cyanida/projects/2) and the pinned **🔨 Now building** issue.
Each section below is one release, with its [milestone](https://github.com/Cyanida/last-bastion/milestones).

| Version | Theme | Status |
|---|---|---|
| v0.6.0 | A run with an ending | released 2026-09-23 |
| v0.7.0 | Relic rework | released 2026-09-23 |
| v0.7.1 | Hotfix: the end of a run | in progress |
| v0.7.2 | Music & convenience | in progress |
| v0.8.0 | Co-op foundation | backlog |
| v0.9.0 | Online co-op | backlog |
| v0.10.0 | Co-op polish | backlog |
| v1.0.0 | Stable co-op | backlog |

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

**Out of scope.** Cursed relics and the Merchant's Reforge (0.7.2). Music. Any networking or a second player.

**Exit criteria.**
- No relic below 3% or above 35% contribution in the builds where it is picked.
- A 6-set in about a third of winning runs; 1-2 duos per winning run on average, 3 or more in under 15%.
- Every class reaches a 4-set in at least two families in the sim; relic power index about 1.8-2.2x a no-relic run.
- A v0.6.0 save migrates without loss (backup kept); the Daily Trial stays deterministic; tests and the perf test pass.
- Released through the pipeline; the updater from 0.6 works; Pages deployed.

## v0.7.1 – Hotfix

[Milestone](https://github.com/Cyanida/last-bastion/milestone/7) · [#55](https://github.com/Cyanida/last-bastion/issues/55): the results and victory screens did not open after a run with a set bonus or a duo. A patch release, so the Music & convenience release (planned as 0.7.1) ships as 0.7.2.

## v0.7.2 – Music & convenience

[Milestone](https://github.com/Cyanida/last-bastion/milestone/2) · Track B

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

## v0.8.0 – Co-op foundation

[Milestone](https://github.com/Cyanida/last-bastion/milestone/3) · no networking yet

**Goal.** Turn the single-player simulation into a multi-player one that runs identically from commands, so a second player can be added without touching game rules again.

**Scope.**
1. ([#24](https://github.com/Cyanida/last-bastion/issues/24)) ARCHITECTURE.md: the current structure and a migration plan to a multi-player simulation.
2. ([#25](https://github.com/Cyanida/last-bastion/issues/25)) Command layer: all input (keyboard, gamepad, touch, bot) becomes player commands with a player id and a tick.
3. ([#26](https://github.com/Cyanida/last-bastion/issues/26)) Simulation/view separation: no DOM, audio, storage or wall clock in the simulation, enforced by a lint rule or test.
4. ([#27](https://github.com/Cyanida/last-bastion/issues/27)) Serializable state: snapshot, restore, a state hash, a replay test.
5. ([#28](https://github.com/Cyanida/last-bastion/issues/28)) Multi-player state: 1-4 players with per-player systems, and a view per local viewpoint.
6. ([#29](https://github.com/Cyanida/last-bastion/issues/29)) Co-op rules: enemy scaling per player; shared XP with slow-motion level-up picks and a timer; instanced relic drops; downed and revive; per-player rewards and profiles.
7. ([#30](https://github.com/Cyanida/last-bastion/issues/30)) Bot ally as a real player type.
8. ([#31](https://github.com/Cyanida/last-bastion/issues/31)) Loopback transport: two windows on one machine with simulated latency and loss.

**Out of scope.** Real networking, lobbies, signaling (0.9).

**Exit criteria.** Single-player is unchanged (tests, sims and the Daily Trial give the same results), and a 2-window loopback run completes an Act.

## v0.9.0 – Online co-op

[Milestone](https://github.com/Cyanida/last-bastion/milestone/4)

**Goal.** Play together over the internet.

**Scope.**
1. ([#32](https://github.com/Cyanida/last-bastion/issues/32)) WebRTC transport behind the transport interface.
2. ([#33](https://github.com/Cyanida/last-bastion/issues/33)) A small free-tier signaling service and a TURN fallback for carrier-grade NAT.
3. ([#34](https://github.com/Cyanida/last-bastion/issues/34)) Lobby with an invite code, ready state, class pick, and a version check that blocks mismatches.
4. ([#35](https://github.com/Cyanida/last-bastion/issues/35)) Host-authoritative snapshots with delta compression, client-side prediction of your own movement, interpolation of others.
5. ([#36](https://github.com/Cyanida/last-bastion/issues/36)) A network overlay (ping, loss, snapshot size) in the perf overlay.
6. ([#37](https://github.com/Cyanida/last-bastion/issues/37)) A network test with players from different homes and networks.

**Out of scope.** Host migration and reconnect (0.10 and 1.0), co-op achievements.

**Exit criteria.** A 2-player online run across two households completes Act II.

## v0.10.0 – Co-op polish

[Milestone](https://github.com/Cyanida/last-bastion/milestone/5)

**Goal.** Make co-op feel finished: tuned, communicative and robust when someone leaves.

**Scope.**
1. ([#38](https://github.com/Cyanida/last-bastion/issues/38)) Tune co-op scaling and revive from playtest data.
2. ([#39](https://github.com/Cyanida/last-bastion/issues/39)) Shared quests, events and the Merchant in co-op.
3. ([#40](https://github.com/Cyanida/last-bastion/issues/40)) Co-op achievements.
4. ([#41](https://github.com/Cyanida/last-bastion/issues/41)) Pings and markers, and spectating while downed.
5. ([#42](https://github.com/Cyanida/last-bastion/issues/42)) Host migration, or a graceful end when the host leaves.
6. ([#43](https://github.com/Cyanida/last-bastion/issues/43)) Structured playtest sessions with run logs from all players.

**Out of scope.** Reconnect mid-run and the save format freeze (1.0).

**Exit criteria.** Structured playtests with 3-4 players complete full runs with shared quests and the Merchant; a host leaving migrates or ends the run cleanly for everyone.

## v1.0.0 – Stable co-op

[Milestone](https://github.com/Cyanida/last-bastion/milestone/6)

**Goal.** A stable 1.0: co-op that survives real networks, and saves that never break.

**Scope.**
1. ([#44](https://github.com/Cyanida/last-bastion/issues/44)) Reconnect after a dropped connection mid-run.
2. ([#45](https://github.com/Cyanida/last-bastion/issues/45)) Freeze the save format, with a migration test suite from every earlier version.
3. ([#46](https://github.com/Cyanida/last-bastion/issues/46)) The perf budget holds with 4 players and 250 enemies, on desktop and on a recent phone.
4. ([#47](https://github.com/Cyanida/last-bastion/issues/47)) A crash and desync sweep: a full 4-player run to victory with no desync.
5. ([#48](https://github.com/Cyanida/last-bastion/issues/48)) Write down the 1.0 scope, and move everything beyond it to 1.x.

**Exit criteria.** Everything in [RELEASES.md](RELEASES.md) under "1.0.0 is released only when".
