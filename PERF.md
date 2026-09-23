# Performance notes (v0.4)

Playtest complaint: frame drops during wave modifiers, Fog and Blood Moon in particular.

## Tools

- **F3** in a run (or Settings → Performance overlay) shows frame / update / render time, the p95 and max of the last 300 frames,
  entity counts (enemies, projectiles, particles, ground effects, zones, damage numbers), the number of canvas draw calls,
  and the eight heaviest sections of the frame (`core/perf.ts`; sections are timed with `begin()`/`end()` in `game.ts` and `render/renderer.ts`).
- `window.__lb.profile(n)` (dev, or a build with `?debug`) runs n scripted frames synchronously and returns the same breakdown per frame.
- `npm run test:perf` (after `npm run build`): the automated test, see below. Since v0.7.1 the run music plays through it, and it first checks that the music plays in every arena.

## Profiling: what it looked like before

Scenario: wave 20, 250 enemies (mixed types, one in nine Shielded), an invulnerable Viking with Whirlwind, Frenzy and six
proc relics so hits, numbers and particles are constant. 1400x800, device pixel ratio 1. Measured with `profile(300)` after a 30-frame warm-up.

| Scenario | avg frame | p95 | update | render | draw calls | heaviest sections |
|---|---|---|---|---|---|---|
| Fog | 9.9 ms | **26.5 ms** | 1.7 | 8.2 | 1139 | enemies 5.2, texts 0.7, physics 0.6, overlay 0.6 |
| Blood Moon | 15.2 ms | **28.9 ms** | 1.8 | 13.4 | 1525 | enemies 8.0, texts 1.0, physics 0.6 |
| Plague | 11.9 ms | 23.6 ms | 1.9 | 10.0 | 1231 | enemies 5.2, shadows 2.7 |
| (no modifier) | 10.0 ms | 23.3 ms | 1.8 | 8.1 | 1166 | enemies 2.6, texts 2.2, particles 1.4 |

Render-only on a frozen busy scene (751 particles, 150 damage numbers on screen): **15.1 ms average, p95 35.8 ms**, 47 of 300 frames over 16 ms.
Update-only: 2.0 ms average, p95 3.6 ms, no spikes. With the enemies removed the render fell to 0.4 ms.

**Findings, in order of cost:**

1. **Damage numbers**: every number was `strokeText` + `fillText` with a `ctx.font` assignment (font parsing) per text, up to 150 per frame, and a Viking at four swings a second spawned four separate numbers per enemy.
2. **Per-enemy paths**: a shadow was an `ellipse()` path filled per enemy, each elite affix ring another stroked ellipse, a commander aura a dashed arc: hundreds of path rasterisations per frame.
3. **Particles**: one `globalAlpha` + one `fillStyle` state change per particle, up to 800 of them.
4. **Allocation churn**: `getSprite()` built a string key per enemy per frame; `activeStatuses()` allocated an array per enemy per frame; `tickStatuses` allocated `Object.keys()` per enemy per tick; hostile projectiles allocated `[player, ...minions]` per projectile per tick; zones the same; particles, texts and projectiles were fresh objects every time.
5. **Fog**: a `createRadialGradient` plus a full-screen fill every frame. Real, but small (0.6 ms): the fog complaint was mostly Fog waves being the ones where the horde is closest together.
6. **Plague**: a poison pool per kill with no ceiling; each pool is a filled and stroked disc per frame.

The spike pattern deserves a note. In the synchronous profile the 20-50 ms spikes landed in sections that do almost nothing
(a 34 ms "corpses" section is forty tiny rects). Chrome batches canvas commands and flushes them when its buffer fills; a loop that renders
300 frames without yielding to the compositor pays for its raster work in lumps. The live `requestAnimationFrame` loop presents a frame between renders and never shows those lumps.
That is why the automated test measures the live loop, and why the "before" and "after" tables are not the same kind of number.

## Fixes

| Fix | Where |
|---|---|
| Damage numbers merge: a hit within 0.3 s on the same enemy adds to its number; at most 80 numbers alive | `systems/effects.ts` `damageNumber`, `RENDER.maxTexts` |
| Numbers are blitted from per-size glyph atlases (one `drawImage` per digit, no font parsing, no text paths); words go through a bounded sprite cache | `render/sprites.ts` `digitGlyphs`, `textSprite` |
| Shadows, elite rings and commander auras are pre-rendered sprites keyed by radius / colour | `shadowSprite`, `ringSprite` |
| Particles drawn in four alpha buckets with the colour set only when it changes; culled to the viewport | `renderer.ts` |
| Object pools for particles, damage numbers and projectiles | `effects.ts`, `entities/hazards.ts` |
| No per-frame allocation in status ticking, projectile and zone hit tests, status pips, or sprite lookup (`e.spr` is cached on the enemy) | `logic/status.ts`, `systems/combat.ts`, `renderer.ts` |
| Fog is a cached tile (the gradient with the hole) blitted on the player plus four plain rectangles | `sprites.ts` `fogSprite` |
| Ground effects capped at 40; the oldest expires early | `RENDER.maxFields` |
| Per-frame dynamic detail: the smoothed *work* time of a frame (not the vsync interval) drives `quality.detail` 0.15..1, which scales the particle budget and switches shadows and rings off when over budget, and recovers slowly | `core/quality.ts` `nextDetail`, `QUALITY.dynamic` |

A bug came out of this too: the v0.3 auto quality downshift was fed the frame-to-frame interval (always ≈16.7 ms), so it could never react to actual work.

## After

Same synchronous profile as the "before" table (same pane, same scenario), so it is comparable:

| Scenario | avg frame | p95 | render | draw calls |
|---|---|---|---|---|
| Fog | 8.4 ms | 20.1 ms | 6.5 | 1068 |
| Blood Moon | 8.4 ms | 22.0 ms | 6.6 | 1437 |
| Plague | 4.5 ms | 12.6 ms | 3.4 | 1208 |

And the live loop, which is what a player experiences (`npm run test:perf`, headless Chromium, 300 frames of the game's own
`requestAnimationFrame` loop, horde topped up to 250, level-ups disabled so no choice screen pauses the sim):

| Scenario | frame avg | **frame p95** | update | render (main thread) | enemies | draw calls | detail |
|---|---|---|---|---|---|---|---|
| Fog | 17.6 ms | **16.8 ms** | 0.8 | 1.9 | 250 | 946 | 1.00 |
| Blood Moon | 16.9 ms | **16.8 ms** | 0.9 | 2.2 | 240 | 1610 | 1.00 |

A p95 of 16.8 ms is one vsync at 60 Hz: at most a handful of dropped frames in five seconds, at full detail.
The max in each run (50-300 ms) is the first frame of the run, when the arena texture is uploaded; the p95 excludes it by construction.

**Target met: no frame above 20 ms at the 95th percentile at wave 20 with Fog or Blood Moon and 250 enemies, on this desktop.**

## The automated test

`scripts/perf-test.mjs` serves the production build with `vite preview`, opens it in headless Chromium (Playwright) at 1400x800,
builds the scenario through the `?debug` hook, lets the real loop run 300 frames, and fails if the p95 frame time exceeds
`PERF_BUDGET_MS` (default 20). It runs in CI (`.github/workflows/perf.yml`) on every push to `main` with `PERF_BUDGET_MS=34`:
GitHub's runners raster the canvas in software (no GPU) and are roughly twice as slow as a desktop, so 34 ms there (two vsyncs)
is the equivalent of the 20 ms desktop budget. The number to watch over time is the p95 in the job's log, not just the pass mark.

## At the v0.4.0 release

CI run on the release commit (software raster, `PERF_BUDGET_MS=34`): Fog p95 **16.8 ms** (avg 17.0, update 0.6, render 0.9), Blood Moon p95 **16.7 ms**
(avg 16.7, update 0.55, render 0.8), 243-250 enemies, 1,275-1,315 draw calls, detail 1.0: both at the 60 Hz vsync with under 2 ms of work per frame,
so the v0.4 additions (relic tiers and stacking, talents, the utility ability, the achievement toasts) cost nothing measurable.
On the development laptop the same test read p95 33.3 ms for both scenarios with 1.3 ms update / 2.7 ms render: that is the headless compositor
presenting at 30 Hz while Teams and a video call were running, not the game. Read the update/render columns before the frame column when a
local run fails.

## At the v0.5.0 release

Local headless run on the release build (desktop budget 20 ms): Fog p95 **16.8 ms** (update 1.3, render 2.2), Blood Moon p95 **16.8 ms**
(update 1.3, render 2.2), 249-250 enemies, 1,070-1,268 draw calls, detail 1.0. The v0.5 additions (the bigger map with its closed-region
overlay, gate waypoints for every enemy and minion each tick, quests, events, the reworked HUD and the shared tooltip) stay under 4 ms of work
a frame; the heaviest sections are still drawing the enemies and their shadows.
