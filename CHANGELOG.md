# Changelog

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
