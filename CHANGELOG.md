# Changelog

## v0.4.0 — Performance, scaling, relics, talents, the Keep, achievements

Playtest feedback, in order: frame drops in Fog and Blood Moon, level-ups slowing down late, stale runs, too few build choices, a Keep emptied by one good run, shallow achievements, the relic cap and missing tooltips. This release covers the first six of the nine planned increments; **side quests with map expansion, the sacred treasures and the balance pass follow in v0.5.**

### Performance
- **Perf overlay** (F3, or Settings > Performance overlay): frame / update / render time, entity counts and draw calls, with a p95 over the last 300 frames.
- Fog and Blood Moon at wave 20 with 250 enemies profiled headless before and after (PERF.md): pre-rendered shadows, rings, digit glyphs and the fog tile instead of per-frame paths and text; object pools for projectiles, particles and floating text; a hard particle budget; viewport culling; merged damage numbers; a per-frame quality knob that lowers detail when the frame's work runs long. p95 26-29 ms -> 17 ms.
- `npm run test:perf` plays both modifiers in headless Chromium against the built game and fails when p95 goes over budget; CI runs it.

### Scaling and XP
- **Linear XP curve** (`12 × level` per level) with the **target pace in config** (`WAVES.pace`: one level a wave in Act I, sliding to one every two waves by Act III), enemy XP scaled per wave and Act, wave-clear XP, and a mild catch-up bonus below the expected level (never a penalty above it).
- **One scaling axis per Act**: Act I grows the count, Act II grows stats and elites (elite chance climbs 2.2x faster, two-affix elites), Act III grows composition (pricier units, more squads and commanders); beyond wave 30 a quadratic tail. BALANCE.md has the tables.
- The simulation prints the level reached per wave per class against the target, and `npm run sim -- probe` revives the bot on death to read deaths per wave through wave 30 (no class hits a wall between waves 15 and 30).

### Relics
- **No slot cap.** A duplicate pickup raises the relic a tier (three tiers): every relic has tier 2 and 3 numbers in `config/relics.ts`, and its text is generated from them, so a card or tooltip always says exactly what this tier and the next one do.
- **Tooltips everywhere**: drop cards, the HUD relic bar (hover or tap), pause and results screens (the build), the Merchant's held list, and a **relic compendium** in the Keep (discovered / undiscovered, how often found, all three tiers, synergies).
- **12 synergies** that do something extra when both relics are held (Fire in the Hole, Shatter, Thunderclap, Reaper, Bulwark, Muster, Bastion, Pilgrim's Purse, Necropolis, Forager, Rebirth, Tempo) and **4 clashes** that warn (Restless, Overkill, Thin Blood, Blunted); both are listed on every card and tooltip, active ones marked.
- **Stacking rules** (BALANCE.md): plain mods of a kind add up at face value to a soft cap and then have diminishing returns (never more than half the cap again), conditional bonuses (Sentinel's charge, the War Horn, the Crown) count in the same sum; on-hit and on-kill procs share their chance past three relics of the category; relic healing per wave is capped the same way; proc chains stop at depth 2. The HUD stats panel shows each sum, its effective value and the cap.
- **Merchant**: buy a relic of a rarity (new, or a tier up), reroll one at the same tier, **sell** one for gold, or **salvage** it into Rune shards (kept in the save for the Keep's second currency).
- **Drops**: the share of new relics in an offer shrinks with every relic held, so late drops are mostly upgrades. Relic damage now grows 9% per level (was 12%: characters are a third higher-level at the same wave).
- `npm run sim -- relics` reports the **relic power index**: no relics vs a run's haul of 12 pickups vs every relic at tier 3.

### Build depth: talents, a second ability, traits
- **Talent trees** (`config/talents.ts`): three branches per class (Paladin Bulwark / Zealot / Crusader, Viking Berserk / Raider / Jarl, Angel Mercy / Wrath / Herald, Necromancer Horde / Lich / Plague, Archer Ranger / Hunter / Marksman), seven nodes each in four rows with prerequisites, and one **keystone** per branch that needs four points in it; only one keystone per run. A talent point every 3 levels, spent any time from the pause menu on a touch-friendly tree screen. Nodes are plain data: stat adds, mods, and new mod keys the game reads (crit damage, dodge, thorns, heal on kill, damage below half HP, boss damage, extra minions, ability duration and cooldown, utility cooldown and power).
- **Second ability** at level 3, on its own key (E or Shift, gamepad X or RB, a second touch button): the Paladin's **Challenge** (pull and taunt), the Viking's **Leap**, the Angel's **Blink** (with a moment of invulnerability), the Necromancer's **Corpse Explosion**, the Archer's **Dodge Roll** that drops caltrops. Two-way upgrade choices at levels 8 and 14 (20 upgrades in `config/utility.ts`); talents in each class's third branch scale it.
- **Starting traits** on the class select screen (`config/traits.ts`): Glass Cannon and Stalwart from the start; Scavenger, Cursed Luck, Pilgrim and Duelist unlocked by achievements. The choice is remembered; the Daily Trial ignores it so everyone plays the same run.
- **Level-up pool**: a card can now be a talent point (15%) or a relic drop (12%) instead of a stat boon, next to the tradeoffs.
- The pause and results screens show the whole build: trait, talents (and unspent points), ability and utility upgrades, relics with tiers, active synergies and clashes.
- The balance bot spends its points down one branch, takes utility upgrades and casts the utility.

### Runes and the Keep
- **Runes**, a second currency: Act bosses pay 1 / 1 / 2 (at most 4 a run), salvaged relics ten shards to a Rune; quests, treasure steps and achievement tiers pay them too (later increments). A save arriving from v0.3 is granted one Rune per achievement earned.
- **The Keep is six buildings** (Armory, Barracks, Chapel, Library, Treasury, Watchtower), each holding a few upgrade tracks. A building's level caps how far its tracks can be bought; raising it costs gold, Runes and a deed (an achievement). Gold buys the base ranks, the top ranks cost Runes as well. New tracks: class XP, utility cooldown, starting level, relic drop chance, the Reliquary Vault (relics can reach tier III; the old seventh slot became this), salvage yield, starting talent points, gold income, Rune income, daily caps, curse bonus, elite and boss bounties. The Library's level opens talent rows (keystones at level 2); the Watchtower's level gates the difficulty tiers.
- **Class mastery is a 25-rank track** with a named unlock at every rank (secondary stat, rerolls, a starting relic, talent points, utility cooldown, class XP, a starting level, the second utility upgrade choice, four titles, three sprite palettes, two treasure quest steps). The full track is on the class's mastery screen in the Keep; palettes are picked on the class select.
- **Account level** = every class's mastery rank added up (0-125), with milestones at 10 / 25 / 50 / 75 / 100 (gold, a reroll, XP, a talent point, damage).
- **Caps**: gold from curses and the Daily Trial is capped per calendar day (600 / 400, +200 per Toll Gate rank), and a single run banks at most twice the run cap (1200, +400 per rank) with diminishing returns past it: one deep run no longer empties the Keep's shopping list.
- `npm run sim -- economy` plays one save run after run, buying greedily, and reports when the Keep is fully raised (BALANCE.md; target 40-60 runs).

### Achievements
- **62 deeds in six categories** (Survival, Combat, Champions, Collection, Challenges, Secrets), most with **bronze / silver / gold tiers** (152 tiers), counters and progress bars; 11 hidden deeds show only a hint until earned.
- **Every tier pays**: Runes (1 / 2 / 4), and gold tiers add titles, trait unlocks, account-wide sprite palettes, permanent starting talent points or a sacred treasure step.
- **15 class feats on real mechanics**: one Divine Shield absorbing 2,000 / 5,000 / 12,000; 100 kills in one Berserker Rage; 20 minions alive at once; 40 enemies under one Arrow Volley; 50 caught by one Corpse Explosion...
- **Titles** are equipped in the Chronicle and shown on the title and results screens; an **in-run toast** announces a tier the moment it is earned; the **Chronicle** has category and earned / hidden filters and is reachable from the title screen and the Keep.
- Existing deed ids keep their meaning (a stored id means "bronze earned"); `champion` and `legend` became tiers of `knight` and migrate.

### Save
- Format **version 4** (buildings, Runes, daily gold, achievement tiers and rewards, the trait and palettes in settings); v2 and v3 saves migrate, a v3 save is granted a Rune per achievement.

### Known state, for v0.5
- With talents and the utility abilities the balance bot's maxed runs go far deeper than fresh ones (ratio 4.1x, target 1.5-2x) and the Archer trails the other classes; the v0.5 balance pass steepens the tail past wave 30 and revisits the utility cooldowns and the class spread. The relic power index and the Keep's economy are re-run there too (achievement tiers now add early Rune income).

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
