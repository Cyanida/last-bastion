# Architecture

> **Co-op is dropped (25-09-2026).** Jesse and his brothers decided that Last Bastion is a polished single-player game on PC and phone
> ([ROADMAP.md](ROADMAP.md)).
> - **What stays:** the steps that are done (the golden runs, commands, the pure simulation, save/restore/replay, and #113/#114). They
>   give single-player save-and-resume (the phone, v0.9) and exact replays.
> - **What's cancelled:** the multi-player steps (#28-#31, and the networking after them). The text below keeps them for the record.
>   "The plan" now ends where the groundwork ends.

How Last Bastion is built today, and the step-by-step plan that turns the single-player simulation into one that runs 1-4 players
from commands (v0.8.0, [ROADMAP.md](ROADMAP.md)). Written for [#24](https://github.com/Cyanida/last-bastion/issues/24) and brought up to date
for [#116](https://github.com/Cyanida/last-bastion/issues/116). It names files and functions rather than line numbers; sections 3
and 5 say which steps are done.

## 1. The model we are moving to

- **One simulation, many views.** A run is a `Game` that only changes through `step(g, commands)`. Screens, cameras, particles, sound
  and music are views that read the `Game` and never write it.
- **Everything a player does is a command** with a player id and a tick: movement and aim every tick, and every choice (level-up,
  relic, shrine, shop, route, victory) as a discrete command. The keyboard, the gamepad, touch, the bot and later the network all
  produce the same commands.
- **Deterministic on one engine.** The same seed and the same commands give the same state hash. This is what replays, the Daily
  Trial, the tests and the balance sims rely on.
- **Host-authoritative online (0.9).** Floating-point results (`Math.hypot`, `Math.sin`, `**`) are not guaranteed to match across JS
  engines, so online play does not use lockstep. The host runs the simulation from everyone's commands and sends snapshots; clients
  predict their own movement (#35). The loopback transport in 0.8 (#31) already works this way, with full snapshots and no deltas.
- **Single-player stays the same, bit for bit.** A 1-player run with the same seed draws the same random numbers in the same order
  as today. Every step below ends with the golden-run test (step 0) still green.

## 2. The code today

As of `release/0.8.0` after #25, #26 and #27 (steps 0-3 below). Multi-player state (#28) has not landed yet: there is still one
`g.player`.

### Loop and screens

- `src/main.ts` runs a fixed 60 Hz step with an accumulator (`DT`, `MAX_STEPS = 5`, then time is dropped) and renders once per
  frame without interpolation. `pumpGamepad()` runs once per frame.
- `tick()` in main.ts is `step(game, [intentCommand(game, sampleInput(game))])` → `afterStep(game)`. The simulation only ticks while
  the screen state (`'menu' | 'playing' | 'choice' | 'paused' | 'results'`, a module variable) is `'playing'`.
- Choices are `pending*` flags on `Game` (`pendingLevelUps`, `pendingAbilityTiers`, `pendingUtilityTiers`, `pendingShrine`,
  `pendingBoard`, `pendingShop`, `pendingMerchant`, `pendingRoute`, `victory === 'pending'`, `player.relics.offers`). `afterStep`
  calls `hasChoice` and `openChoice`, which show a screen. Its buttons build a `Choice` and call `choose(g, choice)`, which is
  `step(g, [choiceCommand(g, choice)], false)`: the choice is checked against its open screen, recorded in `g.replay` and applied at
  once, and no time passes (the simulation is paused while a screen is open, so nothing can run in between) (#113).

### State

- `createGame(classId, seed, opts)` (src/game.ts) builds one `Game` (src/core/types.ts). It holds everything: entities, the RNG
  streams, input, timers, waves, the map, quests, events, the choice queue, counters, the run log and the tick counter `g.tick`.
  The seed is a required argument; main.ts passes `Date.now()` for a normal run.
- **One player**, `g.player: Player`. About 365 `g.player` uses in `src/`, 108 of them `const p = g.player` aliases. Evolutions,
  abilities, game.ts, main.ts, combat, the bot and relics are the heaviest.
- **Already per player:** `player.relics: RelicState`, with its own RNG stream (`relicStream(seed, 0)` in src/logic/relics.ts) and,
  since #27, the relic state that used to live in module WeakMaps (`raw`, `warded`, `streak`). Many functions already take a
  `p: Player`, most of them in `relicCore.ts`, `relicContext.ts` and the relic family modules.
- **Player-scoped but on `Game`:** `input`, `gold`, `pendingLevelUps`, `pendingAbilityTiers`, `pendingUtilityTiers`, `talentPoints`,
  `talentRowCap`, `utilityTiers`, `talentModsCache`, `trait`, `trait2`, `palette`, `rerolls`, `banishes`, `bannedStats`,
  `evolutions`, `treasure`, `chain`, `lastStand`, `prey`, `baseMods`, and many `g.vars` keys (`'ability.held'`, `'shield.up'`, …).
- **Entities** are plain arrays (`enemies`, `minions`, `projectiles`, `zones`, `fields`, `pickups`, `corpses`, `barriers`, `squads`)
  compacted in place. None has an id; they point at each other directly (`Enemy.healer`, `Enemy.squad`, `Zone.owner`,
  `Squad.target`, `Projectile.hit`, `Quest.foes`, `g.prey`, `Chain.guardian`). The snapshot copes with that (see below).
- **Deferred actions** are data: `g.timers` holds `{ t, kind, a }`, and `timer(kind, fn)` in src/entities/hazards.ts registers a
  named handler and returns the function that schedules it. `runTimer` looks the handler up by kind.

### Update order

`updateGame` (game.ts): time and the enemy spatial hash → `g.timers` → player timers and mods (relics, talents, treasures, ability
and dodge passives, healing) → movement, ability, utility, attack → squads, statuses, enemies, enemy physics, minions, projectiles,
zones, fields, pickups → arena, regions, quests, events, effects → compaction, run log, barriers and corpses, spawning.

### Input and commands

- `src/input/index.ts` keeps module-level device state (keys, mouse, touch, the first connected gamepad) and `pollInput()` merges the
  three devices into one `Intent` (src/input/mapping.ts). Discrete actions (pause, mute, pick 1-9) go through `onAction`.
- `sampleInput` (main.ts) reads the devices and resolves aim to a world point with the camera and auto-aim (`densestCluster`,
  `resolveAim` in src/logic/aim.ts). It returns a world-space intent; `intentCommand(g, intent)` wraps it in a `Command`.
- **src/sim/commands.ts** holds `Command` (`{ tick, player }` plus `kind: 'intent'` with an `intent`, or `kind: 'choice'` with a
  `Choice`, one variant per choice screen), `applyChoice(g, choice)` and `step(g, commands, advance = true)`. `step` refuses a
  command whose tick isn't the current one or whose player isn't in the run, and a choice whose screen isn't open; it records every
  accepted choice in `g.replay`, applies it, then (when `advance`) sets `g.input` from the intent (a tick without one keeps the last
  intent), counts `g.tick` and runs `updateGame`. Only `step` writes `g.input`, and only `step` calls `applyChoice` (#113).
- The level-up hand is dealt once from `g.rng` on first read (`levelHand(g)`) and kept until a pick, banish or reroll, so a replayed
  `levelUp` command names a card by its index.
- Systems still read `g.input` directly: movement, abilities, evolutions, utility, and the Blood and Flame relic families. The
  renderer reads `g.input.showAim`.

### Randomness and time

- Seeded `mulberry32` (src/core/math.ts) streams keep their state in `.s`, so they serialize (#27). The shared `g.rng` has about 59
  uses in 23 files (enemy AI, bosses, spawning, events, crits, level-up rolls); then the per-player relic stream, `waveRng(seed,
  wave)` for the director, quest boards and regions, and per-place streams for quests, events, regions, routes, arenas, the daily,
  contracts and music.
- `Math.random` is only in cosmetics: `src/systems/effects.ts` (particles and text jitter, written into `g.particles`/`g.texts`),
  the renderer's shake and lightning, music and the audio noise buffer.
- No wall clock in the simulation: tests/v8-pure-sim.test.ts enforces it (see below). The profiler and `today()` in the save and
  daily code are outside it.

### Simulation and view

- **src/sim/view.ts** is the simulation's only way out to the device (#26). `view` has four hooks, `sfx`, `begin`, `end` and
  `particleBudget`, which do nothing until main.ts plugs in the audio, the perf timers and the quality setting
  (`Object.assign(simView, …)`). The 22 simulation files that play a sound import `sfx` from `sim/view`, not `core/audio`. Tests, the
  bot and a future server run silent and untimed.
- **Enforcement:** tests/v8-pure-sim.test.ts follows every value import from `src/game.ts`, `src/systems`, `src/sim` and
  `src/entities` and fails on device code (`core/audio`, `core/music`, `core/storage`, `core/platform`, `core/pwa`, `core/perf`,
  `core/quality`, `ui/`, `render/`, `input/`, `main`) or on `document`, `window`, `localStorage`, `navigator`, `performance.now`,
  `requestAnimationFrame`, `AudioContext`, `Date.now` or `new Date`.
- **Effects:** systems write particles, float text, rings and shake into `Game` through `effects.ts`. The particle count follows
  `view.particleBudget()`. No simulation code reads them back; they are in the snapshot for the renderer but left out of the hash.
- **Events:** `src/core/events.ts` is a global synchronous bus. Systems register listeners at import and emit from combat, AI,
  spawning and relics. Payloads carry no player: abilities route every event to `g.player` (`addListener` in
  src/systems/abilities.ts). main.ts listens for the music stingers (`STINGERS`); they have not moved to a cue list.
- **Module state outside `Game`:** scratch arrays, object pools (particles, texts, hazard projectiles), the timer handler registry,
  and one WeakMap left in the simulation: `chargeHits` in src/systems/aiHelpers.ts (who a charging enemy has already hit).
- **Rendering** (`src/render/renderer.ts`) reads the `Game`; its only writes are sprite caches (`e.spr ??=`, `t.img ??=`). One
  camera, `cameraFor(g, view)`, follows `g.player`.

### Snapshot, save, bot and tests

- **src/sim/snapshot.ts** (#27): `snapshot(g)` turns the whole `Game` into plain JSON and `restore(data)` turns it back. Instead of
  entity ids it numbers every object the first time the walk meets it and writes `{ '@': n }` on a second meeting, so shared
  references come back shared. Config definitions are stored by table and key, random streams by their state, the spatial hash as
  empty and render caches as null; any other function in the state throws. `hashState(g)` is FNV-1a (`hashSeed`) over the
  snapshot's JSON with the cosmetics (particles, texts, render caches) left out.
- The save (src/logic/save.ts, `SAVE_VERSION = 6`) is **meta progression only**; there is no mid-run save. A run is banked at its
  end: `summarizeRun` → `applyRun` → `storeSave` (src/core/storage.ts keeps 3 backups).
- `src/sim/bot.ts` is the balance bot. `botInput` returns an intent, `botChoose` answers choices through `step` (and can
  record them as commands), and `botStep` calls `step`. `simulateRun` and `probeRun` drive it; `npm run sim` (scripts/simulate.ts)
  and the balance, golden and replay tests use them. `npm run test:perf` drives `window.__lb` in a real browser.
- The co-op tests: tests/v8-golden.test.ts (step 0), tests/v8-commands.test.ts (#25), tests/v8-pure-sim.test.ts (#26) and
  tests/v8-state.test.ts (#27: streams, snapshot and restore, timers, relic state, and a full Act replayed from recorded commands
  to the same hash, also after a mid-Act restore).

## 3. What stands in the way

| Blocker | Where | Fixed in | Status |
|---|---|---|---|
| Devices write one `g.input`; choices are UI callbacks outside the tick | main.ts `sampleInput`, `openChoice`; bot.ts | #25 | done: commands and `step` |
| Sound and particles are triggered from inside systems | `sfx()` in 22 files, effects.ts | #26 | done: sounds leave through the `g.out` cue list (#114); stingers still on the event bus |
| Cosmetic `Math.random` and quality-dependent particle counts live in `Game` | effects.ts | #26 | done: still in `Game`, left out of the hash |
| Closures in `g.timers`, RNG closures, WeakMaps keyed by `Player`, entity references without ids | hazards.ts, math.ts, relic families, types.ts | #27 | done: timers and streams are data, relic WeakMaps moved to `RelicState`, the snapshot relinks references (`chargeHits` in aiHelpers.ts is still a WeakMap) |
| One `g.player`, and player state spread over `Game` and `g.vars` | about 365 `g.player` sites | #28 | open |
| Events carry no player | events.ts, abilities.ts `addListener` | #28 | open |
| One camera following `g.player`; aim resolved through that camera | renderer.ts `cameraFor`, main.ts | #28 | open |
| Player-scoped rolls (crits, level-up offers) draw from the shared `g.rng` | combat, level-ups | #28 | open |
| Enemy count, XP, relic drops, death and rewards assume one player | spawning, director, pickups, relics, game over | #29 | open |

## 4. The target shape

The plan as written for #24. Step 3 landed in a different shape (no `g.nextId`); section 5 says how.

```
devices / bot / network ──► Command[] ──► step(g, commands) ──► Game ──► views (one per local viewpoint)
                                                 │                         camera, HUD, particles, sfx, music
                                                 └──► g.out: this tick's cues (sound, effect, stinger) ─┘
```

- **`Command`** (src/sim/commands.ts): `{ tick, player, kind: 'intent', moveX, moveY, aimX, aimY, ability, utility, showAim }` or
  `{ tick, player, kind: 'choice', choice: … }`, one variant per choice screen. Aim is already in world space: the client resolves it
  with its own camera, and the command records the result, so the view never reaches into the simulation.
- **`step(g, commands)`** applies the choice commands, sets each player's intent, then runs `updateGame`. A player with no command
  this tick keeps their last intent (what a dropped packet does online).
- **Players:** `g.players: Player[]` (1-4), each with its own input, choice queue, gold, talents, traits, evolutions, relics and a
  `p.vars` for the player-scoped `g.vars` keys. Shared run state (enemies, waves, map, quests, events, the run log) stays on `Game`.
- **Views:** a `View` per local viewpoint with its own camera, HUD and cosmetic particles. Sound and effects come from `g.out`, a list
  of cues the simulation appends each tick and the views drain. `g.out` is not part of the snapshot or the hash.
- **Randomness:** `Rng` becomes a state object (`{ s: number }` plus pure functions), so it serializes. Player-scoped rolls use
  `rngFor(g, p)`, which returns `g.rng` for player 0 (so a 1-player run draws exactly as today) and the player's own stream
  (`hashSeed("player:${seed}:${index}")`) for players 1-3.
- **Snapshot:** every entity gets a numeric `id` from `g.nextId`; references become ids in the snapshot and are relinked on restore.
  Timers become data (`{ at, kind, args }`) with a registry of handlers by kind. The hash is FNV-1a over the snapshot's JSON.

## 5. Migration steps

Each step is one PR, lands on the release branch (`release/0.8.0`), and keeps single-player identical. The order follows the
dependencies; it matches the issue numbers except that the golden test comes first.

### Step 0: golden runs (first commit of #25)

**Status: done** (tests/v8-golden.test.ts).

A test that plays `simulateRun` for each class on two fixed seeds and compares the run summary (waves, kills, level, gold, damage
totals) with stored values. Today's replay tests only compare a run with itself in the same build; this one catches a refactor that
changes a single random draw. Stored values change only in a commit that says why (a balance change, never a refactor).

### Step 1: command layer (#25)

**Status: done.** One difference from the plan: a choice screen's answer is a `step` that doesn't advance time
(`step(g, [cmd], false)`), not queued for the next ticking `step`, because the simulation is paused while a screen is open (#113). The bot records its choices as commands for the replay test.

1. Add `Command` and `step(g, commands)`; `sampleInput` builds an intent command for player 0 instead of writing `g.input`.
2. Turn each choice screen's callback into a choice command, queued and applied at the start of the next `step`. The screens stay;
   only the call path changes.
3. The bot (`botInput`, `botChoose`) returns commands; `botStep` calls `step`.
4. Add `g.tick` (an integer counter next to `g.time`).
5. Done when: the golden runs are unchanged, the game plays the same, and nothing but `step` writes `g.input`.

### Step 2: simulation/view separation (#26)

**Status: done (#26, #114).** Sounds leave through `g.out`, a cue list the simulation appends to; main.ts plays it after each step
and each frame (`playCues` in src/sim/view.ts), and a ticking `step` empties it first. The other view hooks (`begin`, `end`,
`particleBudget`) stay in src/sim/view.ts. The music stingers still come from the event bus. Particles and
texts stay in `Game`, left out of the hash. The enforcement test (tests/v8-pure-sim.test.ts) follows imports and needs no allow-list.

1. `sfx(name)` inside `systems/` becomes a cue in `g.out`; main.ts plays the cues after each step. The music stingers move from the
   event bus to cues as well.
2. `effects.ts` keeps its API but becomes cosmetic output: particles and texts move off the snapshot path (a `g.fx` that is excluded
   from the snapshot and hash, or into the view). The `Math.random` jitter stays cosmetic.
3. The `createGame` seed becomes a required argument; the callers pass `Date.now()`.
4. Enforcement test: a vitest test that scans `src/game.ts`, `src/systems/`, `src/logic/`, `src/entities/` and `src/sim/` for
   imports of `core/audio`, `core/music`, `render/`, `ui/`, `input/`, `core/storage` and for `window`, `document`, `localStorage`,
   `performance`, `Date.now`, `new Date(`, `Math.random`, `requestAnimationFrame` and `setTimeout`. It fails on any hit outside an
   explicit allow-list (the profiler, `today()` for the daily).
5. Done when: the enforcement test passes, and the game sounds and looks the same.

### Step 3: serializable state (#27)

**Status: done, in a different shape.** No `g.nextId` or entity ids: `snapshot` numbers objects as it walks the state and
relinks shared references on restore. Timers are `{ t, kind, a }` with handlers registered by `timer(kind, fn)`. The replay test
is in tests/v8-state.test.ts.

1. `Rng` as a state object; the relic, wave and place streams become serializable too.
2. Entity ids and `g.nextId`; `snapshot(g)` and `restore(data)` swap references for ids and back.
3. `g.timers` as data with a handler registry; the 11 `after()` and direct-push call sites move to named timer kinds.
4. The Frost, Holy and Storm WeakMaps move into the player's relic state.
5. `hashState(g)`.
6. Tests: snapshot → restore → hash round trip; and the replay test from the issue: record a bot run's commands for a full Act,
   replay them on a fresh `Game`, compare hashes every 60 ticks. Restoring mid-run and continuing gives the same final hash.
7. Done when: the replay test is green for a full Act.

### Step 4: multi-player state (#28)

**Status: open.**

1. `g.players` with `g.player` kept as a getter for `g.players[0]` while the sites move over, file by file, heaviest first
   (evolutions, abilities, combat, relics, treasures, bosses, acts, utility, enemy AI). The getter goes when the count reaches 0.
2. Player-scoped `Game` fields and `g.vars` keys move to `Player`; `createGame` takes a list of `{ classId, trait, palette }`.
3. Event payloads carry `player` (or `null` for run-wide events); listeners route to that player instead of `g.player`.
4. Targeting: enemy AI and squads pick the nearest living player (`Squad.target` already allows any target).
5. `rngFor(g, p)` for crits, level-up offers and other player rolls.
6. Views: `cameraFor(g, view, p)`; main.ts renders one view per local player (split screen for two local players, the layout is
   #1's call) and the HUD takes a player.
7. Done when: the golden runs are unchanged, and a test runs two bot players in one `Game` through several waves.

### Step 5: co-op rules (#29)

**Status: open.**

Pure rules in `src/logic/coop.ts` with numbers in `src/config/coop.ts`, each unit tested: enemy HP and count scaling per player;
shared XP with a level-up pick per player, slow motion and a timer that picks for you; relic offers per player from their own stream
(already per player); downed, revive and a run that ends when everyone is down; per-player rewards in `summarizeRun(g, p)`. With one
player every rule is a no-op, so the golden runs stay unchanged. The pause screen only pauses when all players are local.

### Step 6: bot ally (#30)

**Status: open.**

The bot becomes a player type: `botCommands(g, p)` issues the same commands a human does, for any slot. A 1 human + 1 bot run
completes an Act (a test with two bot slots stands in for the human).

### Step 7: loopback transport (#31)

**Status: open.**

1. A `Transport` interface (`send`, `onMessage`, `close`) and a `LoopbackTransport` over `BroadcastChannel`, with simulated latency
   and loss.
2. The host window runs `step` with its own commands and the ones it received; it sends a full snapshot a few times a second and the
   `g.out` cues every tick. The client window sends its commands and renders the latest snapshot. Prediction and delta compression
   are 0.9 (#35).
3. Done when: the 0.8 exit criterion holds: a 2-window loopback run completes an Act, and single-player is unchanged (tests, sims
   and the Daily Trial).

## 6. Rules for new code from now on

- Take a `p: Player` instead of reading `g.player`.
- Don't call `sfx()` or write effects from logic that decides outcomes; keep the decision pure and the cue separate.
- Draw player rolls from the player's stream, run rolls from `g.rng`; never `Math.random` in the simulation.
- No closures or object references in state that must survive a snapshot: ids and data.
