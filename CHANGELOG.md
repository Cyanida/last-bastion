# Changelog

## v0.3.1
- The title screen shows the full version next to the build date ("build 2026-09-22 · v0.3.1"). This is the release that proves the auto-updater: an installed 0.3.0 finds it, downloads it and offers the restart.
- Release workflow: only `latest*.yml` is attached as update metadata (0.3.0 also carried electron-builder's debug file).

## v0.3.0 — Platforms, smarter enemies, Acts

### Platforms
- **One codebase, three shells.** Vite `base: './'`: the same `dist/` runs from GitHub Pages, from `file://` inside Electron and inside a future Capacitor iOS app.
- **Input layer** (`src/input/`): keyboard/mouse, touch (pointer events) and gamepad all map to the same intents and actions. Nothing else in the game listens to raw events.
- **Mobile / iPhone**: floating joystick under the left thumb, large ability button under the right thumb (tap = auto-aim at the densest cluster, hold and drag = aim), landscape-only overlay, safe-area insets, HUD scaling, 44px touch targets, zoom-out on small screens, device-pixel-ratio cap, pinch / double-tap / pull-to-refresh blocked, audio resumes on the first touch, pauses when hidden.
- **Quality setting** (auto / low / high): particles, screen shake, shadows and pixel ratio. Auto measures frame time in the first waves and downshifts once if needed.
- **PWA**: web manifest, icons drawn in code (`npm run icons`), Apple meta tags, and a service worker that precaches the exact build, works offline and only activates a new deploy when you tap "New version available" on the title screen.
- **GitHub Pages**: deployed by CI on every push to `main`: https://cyanida.github.io/last-bastion/
- **Windows desktop (Electron)**: sandboxed single window, no menu, remembers its bounds, F11 fullscreen. Per-user NSIS installer (no admin), shortcuts, uninstaller. Auto-update through `electron-updater` and GitHub Releases: checks on launch, downloads in the background, offers "Update ready — Restart" on the title screen, never interrupts a run. Manual check and a beta opt-in in Settings.
- **Release pipeline**: `npm run release` tags the version; CI builds on `windows-latest`, runs the tests and publishes the installer, blockmap and `latest.yml`. Tags with a suffix become pre-releases.
- **Capacitor** config and `npm run cap:sync` for a native iOS wrap later.

### Enemies
- **State machines** (`logic/fsm.ts`, `config/ai.ts`): idle, approach, flank, attack, retreat, flee, regroup, special. Ranged units keep their distance and sidestep after each shot, melee units swing round a crowded front, wounded levies run to the nearest healer.
- **Squads** spawn together in line, wedge or circle, march in formation on a shared target, and enrage, scatter or rout when their commander dies.
- **Commanders**: Bannerman (+damage aura), War Drummer (+speed), Chaplain (heals and cleanses). Marked on the field and on the minimap, worth a bounty.
- **Spawn director** (`logic/director.ts`): every wave is bought from a budget, deterministic from the run seed, weighted by wave, modifier, Act theme and your class, with a mild rubber band on recent performance.
- **Damage types** (physical, fire, holy, shadow, frost) with per-enemy weaknesses and resistances; **status effects** with stacking rules (burn, chill that freezes, bleed, poison, stun, fear, curse, blessed minions) on enemies and on you; **armor** that breaks (knights, cavalry, mirror knights) and shields that only break from behind. Hover or tap an enemy for its tooltip.
- **9 new enemy types**: Siege Engineer (+ Ballista), Plague Doctor, Hound Master, Mirror Knight, Siege Tower, Assassin, Shieldwall Spearman, Bone Collector. **2 new three-phase bosses** that reshape the arena: the Dragon (burns strips of the map, flies) and the Warden (seals you inside rings of stone).

### Run depth
- **Acts** of 10 waves: Act boss, Merchant, next arena, with an announced theme that tilts the director.
- **The Merchant**: heal, buy a relic of a chosen rarity, reroll or remove a relic, for run gold that would otherwise go to the Keep.
- **Curses**: 8 opt-in handicaps unlocked through achievements, each adding to the gold and class-XP multiplier.
- **Daily Trial** and **seeded runs**: the seed is on the results screen and can be typed in on the class select.
- Minimap, 4 status relics (Brimstone Oil, Serrated Edge, Hex Doll, Grave Pact), 5 new achievements, Settings screen.

### Save
- Format **version 3**. v0.2 (version 2) saves and v0.1 best-wave records migrate on load; new fields get defaults. Export / import accept both versions.

### Changed behaviour to be aware of
- Knights have breakable armor and shield bearers a breakable shield, so they die differently than in v0.2. The v0.2 relic tests now strip that armor from their test dummies; the one assertion on the literal save version follows `SAVE_VERSION`. All other v0.1 and v0.2 tests are untouched. 121 tests in total.
- Bosses: wave x5 comes from the arena's rotation (as before), wave x0 is now an Act boss.
- Balance: see BALANCE.md. The maxed / fresh ratio currently measures 1.34x against a 1.5-2x target.

## v0.2.0 — Depth and progression

### Depth within a run
- **Event system** (`core/events.ts`): `onHit`, `onKill`, `onDamageTaken`, `onBlocked`, `onAbilityUsed`, `onWaveStart`. Combat and spawning emit; relics and ability upgrades listen.
- **Relics**: 27 passive items in three rarities (9 common, 8 rare, 5 legendary, 5 class relics that lean on the class's secondary stat). Bosses always drop a choice of 3; elites have a 20% chance to drop a relic chest. 6 slots (7 with the Keep), shown in the HUD with tooltips; when full, taking a relic means giving one up. Data in `config/relics.ts`, hooks in `systems/relics.ts`.
- **Signature ability upgrade tracks**: 3 tiers per class at levels 5 / 10 / 15, each a choice between two mutually exclusive upgrades (30 in total). All of them keep scaling with the secondary stat.
- **Level-ups**: boon rarities (common / rare / epic), six tradeoff boons, one free reroll per level-up plus paid rerolls for gold.
- **Elites**: any regular enemy can spawn as an elite with 1-2 affixes (Shielded, Vampiric, Swift, Splitting, Frost Aura, Enraged). Bigger sprite, coloured ground rings, 4x XP, 5x gold, relic chance.
- **Wave modifiers** from wave 6: Fog, Blood Moon, Siege, Plague.
- **Bosses**: every boss has a second phase below 50% HP. Two new bosses: the Grand Inquisitor (racing lines of pyres) and the Plague Abbot (flasks that leave poison pools).
- **Enemies**: Shield Bearer (blocks projectiles from the front), War Priest (heals the most wounded ally), Cavalry (long telegraphed charge).
- **Arenas**: Forsaken Graveyard (tombstones, dead trees, grasping hands, corpses linger twice as long) and the Great Keep (pillars, braziers that flare and burn friend and foe). Each arena has its own boss rotation. Chosen on the class select screen.
- New primitives: lasting `Field`s, enemy statuses (slow, fear, mark), delayed actions, per-tick `player.mods`.

### Progression across runs
- **Gold** drops from enemies, plus bonuses for cleared waves and bosses; banked when the run ends (also when ended from the pause menu).
- **The Keep**: 11 permanent upgrade tracks with scaling costs and rank caps.
- **Class mastery**: class XP per run, 5 ranks per class (secondary stat, a starting relic, a reroll).
- **Achievements**: 21, with a Chronicle screen showing progress. They unlock the two new arenas and three legendary relics.
- **Difficulty tiers**: Squire, Knight, Champion, Legend. Clearing wave 15 on your highest tier unlocks the next.
- **Statistics**: per-class best wave, kills, runs, playtime, mastery; favorite relic; totals.
- **Save system**: one versioned save object (`lastbastion.save`, version 2) with field-by-field validation, migration from the v0.1 best-wave records, JSON export / import and a reset with confirmation.

### Balance and tooling
- `npm run sim`: headless bot simulation per class, fresh vs fully upgraded. Results and the intended power curve are in `BALANCE.md`.
- Enemy HP and damage now grow quadratically with the wave; attack rate, armor and lifesteal are capped; the ability cooldown pauses while the ability is active; waves go into overtime after 60 s.
- Class retuning (see `BALANCE.md`), XP curve unchanged from late v0.1.

### Changed behaviour to be aware of
- "Abandon run" became "End run": it shows the results screen and banks gold and class XP.
- `generateWave`, `rollUpgrades`, `applyStatUpgrade` keep their v0.1 signatures; new behaviour is behind optional parameters. All 19 v0.1 tests pass unmodified; 40 new tests.

## v0.1.0 — Baseline
- Five classes (Paladin, Viking, Angel, Necromancer, Archer) with six core stats, a unique secondary stat and a signature ability each.
- Auto-attack wave survival in the castle courtyard; five enemy types; three bosses with telegraphed specials on every 5th wave; endless scaling.
- XP, level-ups with a choice of 3 stat boons, results screen, best wave per class in `localStorage`.
- Canvas 2D rendering with code-drawn pixel sprites, WebAudio sound effects, parchment UI.
- Fixed-timestep loop, spatial hash, data-driven classes and enemies, unit tests for the pure logic.
