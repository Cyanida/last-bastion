# Last Bastion — V0.3

A 2D top-down medieval wave-survival game. TypeScript + Vite, HTML5 Canvas 2D, no engine, no asset files:
sprites are pixel grids in code, sound effects and the menu music are WebAudio synthesis. One codebase, three ways to play.

| | |
|---|---|
| **Browser / phone** | https://cyanida.github.io/last-bastion/ |
| **Windows** | [Latest release](https://github.com/Cyanida/last-bastion/releases/latest): `last-bastion-Setup-<version>.exe` |
| What changed | [CHANGELOG.md](CHANGELOG.md) · balance targets and simulation results: [BALANCE.md](BALANCE.md) |

## Play on iPhone (or any phone)

<img src="docs/qr.png" width="180" alt="QR code for https://cyanida.github.io/last-bastion/" />

1. Scan the code (or open https://cyanida.github.io/last-bastion/) in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Start it from the home screen icon: it runs full screen, in landscape, and works **offline** after the first load.

Left thumb anywhere on the left half: a joystick appears under it. Right thumb on the big button: your signature ability
(tap = it aims at the densest group of enemies; hold and drag = aim it yourself, release to fire). Tap an enemy to see what it is weak to.
When a new version has been deployed the title screen shows **"New version available — Tap to reload"**; it never updates in the middle of a run.
On Android, Chrome offers "Install app" for the same page.

## Install on Windows

1. Download `last-bastion-Setup-<version>.exe` from [Releases](https://github.com/Cyanida/last-bastion/releases/latest) and run it. It installs for the current user only: **no administrator rights needed**. You get desktop and Start menu shortcuts and an uninstaller ("Apps" in Windows settings).
2. **SmartScreen will warn** on first run, because the installer is not code-signed: choose **More info → Run anyway**.
3. **Auto-update**: on every launch the game asks GitHub Releases for a newer version, downloads it in the background and shows **"Update to vX.Y.Z ready — Restart"** on the title screen. It never interrupts a run; if you ignore the button, the update installs when you quit. Settings has **Check for updates** and a **Beta versions** switch (pre-releases are ignored unless that is on).
4. F11 toggles fullscreen. The window remembers its size and position.

Saves live in the app's own browser storage, exactly as on the web. To move a save between the browser, your phone and the desktop app use **Settings → Save data → Export / Import**.

<details><summary>Code signing (not set up)</summary>

A signing certificate removes the SmartScreen warning. electron-builder picks it up from the environment, so it only touches CI:
add the certificate as repository secrets and pass them to the "Build installer and publish" step in `.github/workflows/release.yml`:

```yaml
env:
  CSC_LINK: ${{ secrets.WIN_CSC_LINK }}           # base64 of the .pfx, or an https link to it
  CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_PASSWORD }}
```

(or `win.certificateFile` / `win.certificatePassword` under `"build"` in package.json for a local file; `win.signtoolOptions` for signtool details, e.g. an EV token.)
</details>

## Develop

```bash
npm install
npm run dev              # web, http://localhost:5173
```

| Script | What |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run dev:electron` | the same dev server inside the Electron shell |
| `npm run build` | type check + production build to `dist/` (also emits `sw.js`) |
| `npm run typecheck` / `npm test` | `tsc --noEmit` / vitest (312 tests) |
| `npm run test:perf` | headless Chromium frame-time test of Fog and Blood Moon against the built game (PERF.md) |
| `npm run sim` | headless balance simulation, see below |
| `npm run icons` | redraw all icons and the README QR code from code |
| `npm run dist` | build the Windows installer into `release/` without publishing |
| `npm run release` | tag the current version and push the tag: CI publishes the release |
| `npm run cap:sync` | build and copy `dist/` into the Capacitor iOS project |

### How a release is made

1. Bump `"version"` in `package.json`, update `CHANGELOG.md`, commit.
2. `npm run release` → creates and pushes the tag `v<version>`.
3. `.github/workflows/release.yml` runs on `windows-latest`: `npm ci`, type check, tests, `vite build`, then `electron-builder --publish always`.
   The GitHub Release ends up with the installer, its `.blockmap` (for differential updates) and `latest.yml` (what installed copies read to find the update). A last step fails the job if the `.exe` or `latest.yml` is missing.
4. A version with a suffix (`0.4.0-beta.1`) is published as a **pre-release**; stable installs ignore those.
5. When the release workflow succeeds, `pages.yml` deploys that tagged commit to GitHub Pages, which the PWA picks up as "new version available".
   Pushes to `main` between releases never reach the web version; a manual run of `pages.yml` redeploys the latest tag.

### Testing the updater by hand

Install an older release (e.g. `v0.3.0`), start it, wait on the title screen. Within about a minute (the installer is ~110 MB)
"Update to v0.3.1 ready" appears; **Restart** installs it silently and relaunches; the title screen then shows the new version and build date.
Settings → Updates shows the live status ("Checking…", "Downloading… 40%", or the error if the check failed).

### Native iOS build (later, needs a Mac)

The repo is already set up for Capacitor (`capacitor.config.ts`, `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`):

```bash
npm install
npx cap add ios          # once: creates ios/ (git-ignored)
npm run cap:sync         # build the web app and copy it into the Xcode project
npx cap open ios         # Xcode: set your team, Deployment Info → Landscape only, run on a device
```

The game needs nothing native: the PWA and the Capacitor app run the same `dist/`.

## Controls

| Input | Action |
|---|---|
| WASD / arrows · left stick · left thumb | move |
| (automatic) | basic attack on the nearest enemy in range |
| Space / right mouse · A or RT · ability button | signature ability (mouse: at the cursor; touch: tap to auto-aim, hold and drag to aim; right stick aims on a gamepad) |
| E / Shift · X or RB · small touch button | utility ability (from level 3): Challenge, Leap, Blink, Corpse Explosion or Dodge Roll, aimed like the signature ability or along your movement |
| 1 / 2 / 3 · X / Y / RB | pick a boon, relic or ability upgrade |
| R · LB | reroll boons |
| Esc / P · Start · pause button | pause (shows your build and opens the **talent tree**; "End run" banks your gold) |
| M | mute |
| hover or tap an enemy | tooltip: state, affixes, weaknesses and resistances, armor, status effects |
| F11 (desktop) | fullscreen |
| F3 | performance overlay (frame / update / render time, entity counts, draw calls) |
| F8 · pause menu button | playtest aid: mark "bored here" in the run log (Keep › Run history) |

All of it goes through `src/input/`: devices are mapped to *intents* (move vector, ability, aim) and *actions* (pause, confirm, pick N...). The game and the screens never read raw events.

## A run

- **A run has an ending** (v0.6): four Acts, then **the Usurper**. Act IV is always fought in **the Last Bastion** (pillared hall, a throne, a gatehouse that burns on a rhythm) against his own host. He fights in three phases: a cleave and a marked lunge with his guard at his side; then he hides on his throne behind a **ward** that only the three **Royal Flames** keep alive, while burning pitch and crossbow volleys rain on you; then the crown's wrath (burning bands across the whole hall that cross where you stand, rings of broken ground rolling out from him, chained lunges). Each phase has a minimum length, so even a huge build sees it. His fall wins the run: **bank the win**, or march on into **Endless** (the old infinite waves, for a score on a per-class leaderboard). The first win with a class pays far more than later ones.
- **The tail of a wave** (v0.6): when only a few weak enemies are left they come to you after a few seconds, and siege structures give up: nobody hunts stragglers.
- **Routes** (v0.6): after the Merchant the road forks three ways into the next Act: an arena, a theme and a focus (Elite, Merchant, Pilgrim or Siege path). Seeded, so a Daily Trial forks the same way for everyone.
- **Acts**: 10 waves each. Wave 5 brings a boss from the arena's rotation, wave 10 an **Act boss** with three phases (the Dragon burns strips of the map, the Warden seals you inside rings of stone). Then the **Merchant**, then the next arena and a themed Act.
- **The map grows** (v0.5): an Act starts in the arena's core; four wings wait behind gates, each with a feature (a shrine with a blessing, a strongbox, a lair, a vent field with a cache), and a hidden vault. The mid-Act boss and every finished quest open the next wing. Enemies come from the edges of the whole open map.
- **Quests and events**: a board at every Act start offers three seeded quests (take up to two, no penalty for failing); waves 3 and 8 are lighter breathers with a seeded event (merchant, cursed chest, ambush, a knight ally, a plague cart).
- **Sacred treasures**: one per class, earned over several runs (fragments from Act bosses, a trial, the guardian in the vault), equipped at the class select.
- **The Merchant** sells a heal and a random relic of the rarity you choose (new, or a tier up for one you carry), rerolls a relic, and buys relics back for gold or salvages them into Rune shards. Run gold spent here would otherwise be banked for the Keep.
- **Enemies think**: ranged units keep their distance and reposition, melee units flank, wounded levies flee to healers. **Squads** march in formation behind a **commander** (Bannerman, Drummer, Chaplain, Hound Master): kill him and the squad scatters, routs or goes berserk. Commanders carry a bounty and show on the minimap.
- **Readable, dodgeable heavy attacks** (v0.6): anything winding up a telegraphed attack glows red until it lands, over its ground marker or aim lines. From Act III enemies and bosses add patterns that make you move (volleys, mortars, rings, crosses, slams). **Perfect dodge**: leave a telegraph in its last quarter second (or roll, blink or leap through it) for a damage buff and part of your ability's cooldown back. **Last Stand**: once a run, a killing blow leaves you at 1 HP, untouchable for 5 seconds. Elites and commanders wear outlines, hostile shots a red halo, and a mark beside an enemy shows whether your attack is strong (▲) or weak (▼) against it.
- **Evolutions** (v0.6): each champion has five (three for the signature ability, two for the second one), each unlocked in a run by a pair of requirements (an upgrade plus a keystone, a talent branch or a relic at tier II) and offered as a gold level-up card; one of each kind a run. Recipes are in the compendium.
- **Damage types and status effects**: holy, shadow, fire, frost, physical; burn, chill (enough of it freezes), bleed, poison, stun, fear, curse. Knights have armor that breaks; shield bearers only break from behind; a shieldwall only holds while the line stands together.
- **Relics (31)** have no slot cap since v0.4: a duplicate raises the relic a tier (three tiers, visibly stronger numbers). Every relic has a tooltip everywhere it appears (drop cards, the HUD bar, pause and results, the Merchant, the compendium in the Keep) with its current and next tier and its **synergies** (12 pairs that do something extra together) and **clashes** (4 pairs that warn). Relics of a kind add up and pass a soft cap (damage, attack speed, defense, utility; on-hit and on-kill procs share their chance past three relics; relic healing is capped per wave), shown in the HUD stats panel. Proc chains stop at depth 2. Late drops are mostly upgrades.
- **Talents**: a point every 3 levels, spent from the pause menu in one of three branches per class (seven nodes each, prerequisites, an exclusive keystone at the bottom). **Second ability** at level 3 with two-way upgrades at levels 8 and 14. **Starting trait** chosen on the class select screen, unlocked by achievements.
- **Level-ups** offer stat boons, tradeoffs, talent points and relics; **ability upgrade tracks, elites and wave modifiers** as in v0.2.
- **Curses** (class select screen): opt-in handicaps that raise the gold and class-XP multiplier. Unlocked through achievements.
- **Oaths** (v0.6, class select screen): after a class's first win, Oaths 1-20, each adding one fixed hardship on top of those below it (curses, wave modifiers, bosses that rise again, three-affix elites, no Merchant in Act II, no Last Stand...). The first win at each level pays; each class shows the highest Oath it has kept. Free curses stay for custom runs.
- **Weekly contracts** (v0.6, title screen): three seeded objectives a week that pay Runes when a banked run completes them.
- **After a run** (v0.6): the results screen shows the three closest goals and a Quick restart with the same champion, traits and Oath.
- **Daily Trial** (title screen): same seed, class, arena and curses for everyone that day. Any run's **seed** is on its results screen; type it on the class select to replay it.

## Between runs

The Keep is six buildings (Armory, Barracks, Chapel, Library, Treasury, Watchtower) holding the permanent upgrade tracks (since v0.6 more options than power: a second starting trait, a starting relic choice, level-up banishes); a building's level caps its tracks and is raised with gold, **Runes** (from Act bosses, quests, achievements and salvaged relics) and a deed. Class mastery is a 25-rank track with a named unlock at every rank, and the account level (all ranks added up) has milestones at 10 / 25 / 50 / 75 / 100. Also the relic compendium, the **Sacred Treasures** log, **Run history** (the last 50 runs, each with a timeline of its waves, level-ups, relics, quests, events, bosses and boredom marks, and its build; export as JSON), the **Chronicle** (68 tiered achievements in six categories with rewards and equippable titles, plus statistics), difficulty tiers, and Settings (graphics quality, sound, menu music, updates, save data).

### Save format

One object under the `localStorage` key `lastbastion.save`, `version: 4` (v0.6 added `runs`, the run logs, which older saves simply lack). `logic/save.ts` `migrate` reads versions 2 (v0.2), 3 (v0.3) and 4 and validates every field, so older saves, partial or hand-edited imports all load; a v3 save is granted a Rune per achievement; if there is no save it migrates the v0.1 best-wave records.

## Simulation

```bash
npm run sim                  # 6 runs per class, Squire, courtyard
npm run sim -- 10 1 keep     # 10 runs per class, Knight tier, starting in the Great Keep
npm run sim -- probe 3       # wall probe: the bot revived on death through wave 30, deaths and level per band of waves
npm run sim -- relics 3      # relic power index: no relics vs a run's haul vs every relic at tier III
npm run sim -- economy 80    # one save played run after run, buying the Keep greedily: when is it fully raised?
npm run sim -- deep 3        # the fresh / maxed table, but wins march on into Endless: depth is not capped at wave 40
npm run sim -- pacing 4      # from the run logs: run length, minutes per Act, quiet time, the longest stretches with nothing new
```

A basic bot (`src/sim/bot.ts`: kite, dodge telegraphs and shots, ability on cooldown, visits the Merchant) plays full runs headlessly, with a fresh save and with everything maxed.
It reports the average wave reached, the maxed / fresh ratio, the spread between classes, commanders and elites slain, Acts cleared, and the level at the end of each wave against the target pace. Runs are seeded, so a result can be reproduced.
Targets and current results are in [BALANCE.md](BALANCE.md).

## Where to tune balance

Everything numeric lives in `src/config/`; game logic never hard-codes balance.

| File | Contents |
|---|---|
| `classes.ts`, `abilityUpgrades.ts`, `relics.ts`, `upgrades.ts` | classes, the 30 ability upgrades, relics (tiers, synergies, stacking), level-up boons |
| `talents.ts`, `utility.ts`, `traits.ts` | talent trees, the utility abilities and their upgrades, starting traits |
| `enemies.ts` | stats and behaviour parameters per enemy and boss |
| `ai.ts` | per-type state machine profiles, squad reactions, aura timing |
| `director.ts` | wave budget, class / modifier bias, squad templates, rubber band |
| `damage.ts` | resistances, armor, status effects, what enemy hits inflict |
| `waves.ts`, `elites.ts`, `arenas.ts` | unlock waves, scaling per Act, the target level pace, modifiers, affixes, arenas and hazards |
| `acts.ts`, `curses.ts`, `oaths.ts`, `contracts.ts` | Act length and bosses, themes, Merchant prices, curses, the Oath ladder, weekly contracts |
| `economy.ts`, `achievements.ts` | gold, Runes and the caps, the Keep's buildings and tracks, the 25-rank mastery, account milestones, tiers, achievements and what they unlock |
| `game.ts` | formulas' constants, caps, quality levels, camera zoom |

## Structure

```
src/config/    balance data (see above)
src/logic/     pure functions: formulas, fsm, squads, director, status, acts, curses, save ...  (what the tests cover)
src/input/     the input layer: mapping.ts (pure) + devices
src/core/      types, math/rng, spatial hash, events, storage, audio, quality, platform, pwa
src/entities/  factories
src/systems/   movement, combat, status, enemyAI, specials, bosses, squads, spawning, acts, abilities, relics, ...
src/render/    sprites, arenas, renderer (world, minimap, overlays)
src/sim/       the balance bot
src/ui/        DOM HUD, screens, CSS
electron/      main.cjs (window, updater) + preload.cjs (the four-function desktop API)
scripts/       simulate, make-icons, sw-plugin (service worker at build time), dev-electron, release
public/        manifest + generated icons     build/  installer icon     docs/  QR code
```

### Adding things

- **Enemy**: a row in `config/enemies.ts`, a profile in `config/ai.ts`, an entry in `WAVES.pool` or a squad template. Only a new *kind* of action needs a function in `systems/specials.ts`. Resistances, armor and inflicted statuses are rows in `config/damage.ts`.
- **Boss**: a def with `phases`, and a script registered with `registerBoss` in `systems/bosses.ts`.
- **Relic**: a row in `config/relics.ts` with its `category`, numbers `n` and two `tiers` overrides (the text is a function of the numbers, so every tier describes itself), plus a hook in `systems/relics.ts` if it reacts to events (read the tier's numbers through `n(g, id)`). A **synergy** is a row in `SYNERGIES` plus a `syn(g, id)` check inside the hooks it changes.
- **Ability upgrade / class / arena**: as in v0.2 (data row + hook).
- **Curse**: a row in `config/curses.ts`, read where it matters through `curseValue`, and an achievement that unlocks it.
- **Talent node**: a row in a class's branch in `config/talents.ts` (`mods`, `stats`, or a number another system reads). **Trait**: a row in `config/traits.ts`. **Utility upgrade**: a row in `config/utility.ts` plus a `has()` branch in that utility's hook in `systems/utility.ts`.

## Known simplifications

- No render interpolation between sim ticks (60 Hz sim; marked `ponytail:` in `main.ts`).
- Obstacles and barriers are circle colliders; enemies slide around them rather than path-find.
- Selling or salvaging a relic undoes Blood Pact's HP cut but not Phoenix Feather's charges (they stay until used).
- Achievements are evaluated when the save changes (end of run, Keep purchase, import), not mid-run.
- The Google Fonts are fetched from the network (and then cached by the service worker); fully offline from the very first start, or in the desktop app without a connection, headings fall back to a system serif.
- In dev mode `window.__lb` exposes `start`, `run(ticks, holdAbility, mode)`, `bot(ticks)`, `draw()`, `save`, `quality` for automated smoke tests.
