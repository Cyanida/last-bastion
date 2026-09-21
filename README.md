# Last Bastion — V0.2

A 2D top-down medieval wave-survival game. TypeScript + Vite, HTML5 Canvas 2D, no engine, no asset files:
sprites are pixel grids in code, sound is WebAudio synthesis. See [CHANGELOG.md](CHANGELOG.md) for what v0.2 added
and [BALANCE.md](BALANCE.md) for the intended power curve and simulation results.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | type check + production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit tests (vitest): formulas, waves, level-up pool, relic hooks, ability upgrades, affixes, economy, unlocks, save migration |
| `npm run sim` | headless balance simulation (see below) |
| `npm run preview` | serve the production build |

## Controls

| Input | Action |
|---|---|
| WASD / arrow keys | move |
| (automatic) | basic attack on the nearest enemy in range |
| Space / right mouse | signature ability (Arrow Volley / Ballista Shot aim at the cursor) |
| 1 / 2 / 3 | pick a boon, relic or ability upgrade (or click) |
| R | reroll the level-up boons (free rerolls first, then gold) |
| Esc / P | pause: shows your relics and ability upgrades; "End run" banks your gold |
| M | mute |
| hover a relic slot | tooltip |

## A run

1. Pick **arena** and **difficulty** at the top of the class select screen, then a class.
2. Waves come from the arena edges; every 5th wave is a boss. If a wave drags on for 60 s after its last spawn, the next one arrives anyway.
3. **Level-ups** offer 3 boons with rarities (common / rare / epic), sometimes a *tradeoff* (big bonus, real drawback). One free reroll per level-up, more for gold.
4. At **levels 5, 10 and 15** you choose one of two upgrades for your signature ability. The other is gone for that run.
5. **Bosses** always drop a choice of 3 **relics**; **elites** (ringed, larger, with affixes) sometimes drop a relic chest. 6 slots; when full you must give one up.
6. From wave 6 some waves roll a **modifier** (Fog, Blood Moon, Siege, Plague), announced in the wave banner.
7. When the run ends, its **gold** and **class XP** are banked.

## Between runs

| Screen | What |
|---|---|
| **The Keep** | Spend gold on permanent upgrades (six core stats, starting gold, rerolls, XP, pickup radius, a 7th relic slot). Also shows class mastery: 5 ranks per class, earned by playing that class. |
| **Chronicle** | 21 achievements with progress bars (they unlock the Graveyard, the Keep arena and three legendary relics), and statistics: best wave, kills, runs and playtime per class, favorite relic, totals. |
| **Save data** | Export the save as JSON (copy it somewhere safe), import a save by pasting it, or reset everything (asks for confirmation). |

Difficulty tiers (Squire, Knight, Champion, Legend) scale enemy stats and elite frequency and multiply gold and class XP.
Clearing wave 15 on your highest tier unlocks the next.

### Save format

One object under the `localStorage` key `lastbastion.save`, with a `version` field (currently 2). On load it is validated
field by field (`logic/save.ts` `migrate`), so a damaged or hand-edited import cannot break the game. If no v2 save exists,
the v0.1 best-wave records (`lastbastion.best`) are migrated; that old key is only read, never deleted (except by Reset).

## Simulation

```bash
npm run sim                  # 6 runs per class, Squire, courtyard
npm run sim -- 10 1 keep     # 10 runs per class, Knight tier, the Great Keep
```

A basic bot (`src/sim/bot.ts`: kite, dodge telegraphs, ability on cooldown) plays every class with a fresh save and with
everything maxed, and prints the average wave reached, the maxed / fresh ratio and the spread between classes. Use it after
touching numbers in `src/config/`; targets and current results are in [BALANCE.md](BALANCE.md).

## Where to tune balance

Everything numeric lives in `src/config/`; game logic never hard-codes balance.

| File | Contents |
|---|---|
| `config/classes.ts` | starting stats, per-level growth, armor/regen, basic attack, ability numbers and secondary-stat scaling |
| `config/abilityUpgrades.ts` | the 30 ability upgrades (numbers + text generated from them), tier levels, the per-class tracks |
| `config/relics.ts` | the relics: rarity, numbers, plain stat mods, rarity weights, slot count |
| `config/enemies.ts` | HP, damage, speed, XP and behavior parameters per enemy and boss, including phase-2 numbers |
| `config/elites.ts` | elite chance curve, elite multipliers, affix numbers |
| `config/waves.ts` | enemy count curve, HP/damage scaling, unlock wave + weight per type, overtime, wave modifiers |
| `config/arenas.ts` | size, palette, obstacles, hazard, boss rotation per arena |
| `config/upgrades.ts` | level-up boons, rarity weights and multipliers, tradeoffs, free rerolls |
| `config/economy.ts` | gold drops and bonuses, reroll prices, Keep upgrades (costs, caps), mastery ranks, difficulty tiers |
| `config/achievements.ts` | achievements: target, progress function, what they unlock |
| `config/game.ts` | damage-per-stat-point, crit, cooldown reduction, XP curve, caps (armor, attack rate, leech), i-frames |

## Structure

```
src/config/    balance data (see above)
src/logic/     pure functions: formulas, ability scaling, waves, elites, upgrades, relic rolls, economy, achievements, save
src/core/      types, math/rng, spatial hash, events, input, storage, WebAudio sfx
src/entities/  factories: player, enemy, minion, projectile, zone, field, timers
src/systems/   movement, combat, enemyAI, minions, spawning, arena hazards, abilities, relics, leveling, effects
src/render/    sprites (pixel grids + palette), pre-rendered arenas, world renderer
src/sim/       the balance bot (also drives the dev smoke-test hook)
src/ui/        DOM HUD, menu and choice screens, parchment CSS
src/game.ts    createGame(), run summary and the fixed-step update order
src/main.ts    state machine (menu / playing / choice / paused / results), save commits, the loop
scripts/       simulate.ts
```

- **Loop**: fixed 60 Hz simulation with an accumulator; rendering runs once per animation frame, independent of it.
- **Collisions**: enemies go into a uniform spatial hash each tick. ~0.3 ms sim + ~2.2 ms draw per frame with 300 enemies (69 elites) and ~800 particles.
- **Events** (`core/events.ts`): combat emits, relics and ability upgrades listen. Hooks must allocate their own query arrays, because they can fire inside another system's damage loop.
- **Mods** (`player.mods`) are rebuilt every tick: Keep + tradeoffs (`g.baseMods`), then relics, then passive ability upgrades. Nothing mutates them permanently, so removing a relic just works.
- **Zones** (delayed area damage) and **Fields** (lasting areas) are the two area primitives: boss telegraphs, cultist blasts, volley arrows, arena hazards, fire, poison and holy ground all use them.
- Choices (boons, relics, ability tiers) are queued on the `Game` and resolved by `systems/` functions, so the UI and the headless bot share the same code path.

### Adding a relic
A row in `config/relics.ts`. If it is more than a stat mod, one entry in `HOOKS` in `systems/relics.ts` (`acquire`, `tick`, or any event).
To gate it behind an achievement, add `unlocks: { relic: id }` to that achievement.

### Adding an ability upgrade
A row in `config/abilityUpgrades.ts`, its id in the class's track, and a `has(p, id)` branch in that ability's hook in `systems/abilities.ts`.

### Adding a class, enemy, arena
- Class: as in v0.1 (`ClassDef` + `AbilityCfg` variant + scaling function + ability hook + sprite), plus a track of six upgrades and ideally a class relic.
- Enemy: a row in `config/enemies.ts` and an entry in `WAVES.pool`; a hook in `systems/enemyAI.ts` only for new behavior. Any regular enemy can be an elite for free.
- Arena: a row in `config/arenas.ts` (theme, obstacles, hazard, boss rotation).

## Known simplifications

- No render interpolation between sim ticks (sim is 60 Hz; marked `ponytail:` in `main.ts`).
- Obstacles are circle colliders; enemies slide around them rather than path-find.
- Replacing a relic does not undo one-time `acquire` effects (Blood Pact's HP cut stays).
- Achievements are evaluated when the save changes (end of run, Keep purchase, import), not mid-run.
- In dev mode `window.__lb` exposes `start`, `run(ticks, holdAbility, steer)`, `bot(ticks)`, `draw()`, `save` for automated smoke tests.
