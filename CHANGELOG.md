# Changelog

## v0.7.5 — Aiming & fixes

A patch from the 25-09 playtest and code review: aim your own attacks, bosses last a real fight, duos stop inflating your sets, and a long list of things now work the way their cards say.

- **Aim setting**: a new setting sends your basic attacks where you point the mouse or the right stick, instead of at the nearest enemy.
- **Bosses last a real fight**: a boss's resolve means one ability can no longer end it; the Act bosses and the Usurper take a real fight now.
- **Duos combine**: a duo now joins its two relics into one relic with both effects plus its own, instead of adding a third. Your families keep the two relics' counts, and the duo can be attuned up to tier III.
- **Relic offers**: offers lean more toward the families you already hold, so a 6-set comes in about one winning run in seven.
- **Mirror knights**: the Archer shoots a lone mirror knight again, and the arrows it throws back wear its mirror down until it breaks.
- **Late-Act slams**: in Act III and IV, a Knight, Mirror Knight or Bone Collector with its slam ready slams as soon as you come into range.
- **Harder difficulties**: bleed, burn and poison from enemy hits and the Plague pools now scale with the difficulty, like every other enemy attack.
- **Relics that do what they say**: Phoenix Feather always gives its revive, a boss ending a relic chain still offers relics, selling Blood Pact returns only what it took, and Rebirth scales like other relics.
- **Combat fixes**: chains, charges, fields, Blood Tide, pulled assassins, arena fire and the gamepad behave as designed.
- **Gold**: the Gallows pays during a cursed run, and a Daily Trial counts against the same day's gold cap.
- **Pause**: Esc in Talents, the Glossary or Treasures goes back to the pause menu, and the run stays paused.
- **Music**: the run music keeps playing smoothly when the frame rate dips.
- **Startup**: the game starts with site data blocked, and an error shows a message instead of freezing the game.
- **Shared saves**: a shared save's titles and Daily label always show as text.
- **Web version**: two quick releases in a row can no longer leave the game on a stale page.

## v0.7.4 — Fixes & polish

A small patch before co-op: the Paladin decides when his shield bursts, and the Dragon looks like a dragon.

- **Divine Shield, detonated early**: press the ability again while the shield holds to end it on the spot. The burst is weaker the sooner you set it off: half strength right after the cast, rising to full when the shield would have run out. While the shield is up, the ability slot shows the burst a press would set off. Holding the key down doesn't count, only a new press.
- **The Dragon**: redrawn from the side, with a horned head on a long neck, a bat wing, a spade tail and clawed legs, so it reads as a dragon and no longer as a crab.

## v0.7.3 — Fixes & class balance

A patch from the playtests: the Archer can deal with shields and mirrors, the Paladin can't stay shielded forever, and every champion's name fits its card.

- **The Archer's aim**: auto-aim now takes the nearest enemy the shot can actually hurt. A Shield Bearer facing you is only shot at when nothing else is in reach, and a Mirror Knight that would throw your shot back is left alone until he swings. This helps every ranged champion. Surrounded, you no longer empty the quiver into the one blocker in front.
- **Shields and mirrors wear down**: a blocked shot costs a Shield Bearer's shield its damage, and a thrown-back shot costs a Mirror Knight's mirror half of it. Once broken, they stop nothing.
- **Divine Shield's downtime**: when the shield ends, its cooldown lasts at least as long as the shield was up, and cooldown refunds (perfect dodges, the Reliquary of Saints, the Last Stand) can't cut below that. With Sanctuary, Faith and Second Wind, the Paladin could stay invulnerable almost all the time late in a run. Now that is at most half the time, and he still wins.
- **Class cards**: "Necromancer" fits its card on the class select.
- **Class balance check**: all five classes measured with the sim (BALANCE.md). No class values changed.

## v0.7.2 — Music & convenience

Quiet music for every arena that builds a little when a fight heats up and never drowns out the effects, plus conveniences: a What's new screen, a glossary in every tooltip, and a hidden test mode. Also cursed relics and the Merchant's Reforge, both building on v0.7's relics.

- **Music during runs**: every arena has its own theme (the Courtyard's harp and flute, the Graveyard's drone and choir, the Great Keep's horns and march drum, the Last Bastion's organ and timpani). The music has four layers: sparse between waves, a base, the tune when the horde swells or you're hurt, and a heavier layer for bosses. Changes land on the bar line. It sits below the effects and ducks briefly under big sounds. Settings: *Music during runs* (on by default) and a separate *Effects* volume.
- **Stingers**: a short, soft figure in the tune's key when a relic attunes, a set bonus is reached, a duo forms, an ability evolves, or a boss changes phase.
- **What's new**: the first start of a new version shows what changed, once. The title screen's What's new button shows it again.
- **Glossary**: game terms in every tooltip (burn, chill, freeze, bleed, poison, curse, evolution, elite, commander, perfect dodge, Last Stand, Oath, attunement, awakened, set bonus, duo, cursed relic) are underlined and explained under the tip. The full list is in the pause menu and the Keep.
- **Test mode**: tap the version in Settings five times. It starts a run anywhere (champion, arena, Act, wave, level, talents, relics and their tier) that leaves no trace in your save. It also has a music jukebox for every theme, layer and stinger.
- **Cursed relics**: six very strong relics, each with a curse, and awakening one (tier III) lifts its curse: Hungering Blade, Doom Bell, Scepter of Ruin, Abyssal Eye, Crimson Chalice, Tyrant's Banner. Now and then (at most once an Act) one takes the third card at a wave boss or lair, marked in purple. They belong to no family. New deed: *Cursebearer*, win carrying 1, 2 and 3 of them.
- **Reforge** at the Merchant: swap a relic for a random other relic of its family, keeping half its attunement (an awakened relic comes back at tier II). Unlike Reroll it keeps your family count.
- **For developers**: `npm run test:perf` also checks that music plays in every arena and fails on console errors. `SIM_CLASS` runs the sims for one class. The class balance check (#22) continues after this release.

## v0.7.1 — Fix: the end of a run

A patch for v0.7.0.

- **Fixed:** the results screen, and the victory screen after beating the Usurper, did not open after a run that had reached a set bonus or formed a duo (nearly every run). The run was banked, but the screen stayed stuck, and a win could not be banked from the victory screen. The Relics table's tooltips now take relic, duo and set rows together. A test covers it.

## v0.7.0 — Relics, rebuilt

The relic rework (RELICS.md has the diagnosis, the approved design and the numbers): relics come at fixed moments you choose from, belong to seven families with set bonuses, grow by doing their work, and pair up into duos. Plus save safety: the game keeps backups of your save and can restore them.

- **Save safety**: loading never overwrites your save, and the last three saves from before a migration are kept as backups. If the save cannot be read, the newest readable backup is used (and the game says so). Settings › Save data lists the backups and restores any of them.
- **Relic moments**: relics come only at fixed moments: every wave boss, lairs, quests that promise one, the Merchant (one relic moment a visit) and Armorer's Choice at the start. Each is a pick of one from three with one reroll and a visible **Skip** that pays run gold and a Rune shard. Elites drop gold instead, level-ups offer no relics, strongboxes and the cursed chest pay gold and a shard, and the wandering peddler sells a healing draught. A full run meets about 14 moments. Offers roll from your own relic stream, so a seed always offers the same.
- **Seven families**: 🔥 Flame (burns), ❄️ Frost (chill, freeze, shatter), ⚡ Storm (chains and speed), 🩸 Blood (bleeds, HP for power), ✨ Holy (healing and ward), 💀 Grave (corpses, skeletons, curse) and 🛡️ Steel (armor stacks, block, thorns). **50 relics**, every one with a behavior (the plain stat relics are gone). Holding 2, 4 and 6 of a family unlocks its **set bonuses** (Stoked, Pyre, Inferno; Biting Cold, Shatter, Rimewalker; Arc, Thunderstrike, Tempest; Open Wounds, Bloodlust, Blood Magic; Blessed, Radiance, Communion; Charnel, Undying Host, Legion; Bulwark, Spiked, Juggernaut). Every class has three **preferred families** (shown at class select) it can max with straight pieces; any other family reaches a 4-set, and a duo can complete its 6 — at 125% strength, since that route is rarer.
- **Offers lean toward your families**: once you hold a family, every offer has at least one relic from a family you hold and one from a family you don't.
- **Attunement**: no duplicates any more. Each relic has a bar that fills as it does its work (damage, healing, ward and protection through it, statuses it applies, skeletons it raises) and a little every wave and elite. A full bar is a tier: **II** strengthens it, **III awakens** it with a named extra behavior (Hoarfrost, Wyrmfire, Covenant...). Tier-ups flash and go on the run log. Evolution recipes ask for a relic *attuned* to tier II.
- **12 duo relics**: hold one specific relic from each of two families and a wave boss or a lair offers their duo as a **gold fourth card** (it takes the pick): Thermal Shock, Wildfire, Boiling Blood, Funeral Pyre, Hailstorm, Rime Dead, Glacier Plate, Red Lightning, Lightning Rod, Martyr's Covenant, Requiem, Consecration. A duo counts toward both families; each relic feeds one duo. The pick screen says when a relic would complete one; the compendium lists recipes as hints until you form them.
- **What relics do, visibly**: the HUD shows your families with their counts (a new set bonus flashes), each relic's attunement bar, and a small icon over your champion when a relic procs; relic damage numbers take a relic colour. The results screen has a **Relics** table: each relic's, duo's and set's share of your damage, healing and damage turned away, where it came from and the tier it reached (also in the run log). A relic's burns, bleeds, curses, chills, bolts and skeletons count as its own work. No more category soft caps or proc sharing: bonuses add up at face value; relic healing keeps its per-wave cap and proc chains stop at depth 2.
- **The Keep**: Reliquary Guard now gives one more reroll at every relic moment per rank (two ranks; a third rank is refunded at what it cost, 616 gold), the Reliquary Vault a fourth option at wave-boss moments. New deeds: *Six of a Kind*, *Bound in Pairs*, *The Awakening*.
- **Your save moves over**: the compendium keeps the relics that stayed, Echo Bell becomes Thunder Drum and Hawkeye Quiver Galeforce Quiver, and the 31 new relics are marked *new in v0.7* until you find them. The save from before is kept as a backup.
- **Balance** (BALANCE.md, RELICS.md A8):
  - `npm run sim -- relics` measures relic builds with a bot that follows its families. It reports 6-sets, duos, 4-sets per class, the relic power index and every relic's share.
  - Measured: about 1.3 duos per winning run, a power index of about 1.7 over Acts II-III (2.1 in Act III), and every class reaching a 4-set in four to six families.
  - What changed: relic damage grows 0.18 per level (was 0.09), weaker relics and set bonuses were raised, a relic's chill makes enemies take a little more damage, and Deathmask curses on its own.
  - Offers no longer lean toward your families beyond the one-of-yours rule, legendaries and class relics come rarer, and duos appear at wave bosses and lairs.
- **Release safety**: the release workflow now checks that the published `latest.yml`, the installer's name and the version all match the tag, and fails the release if they don't. The README has a short manual updater test.

## v0.6.0 — A run with an ending

The Phase 6 plan: a run now climbs through four Acts to the Usurper and ends, with evolutions to build toward, a fork in the road between Acts, heavy attacks you can read and dodge, a Keep that adds options instead of power, an Oath ladder after the first win, and a results screen that always says what to do next. Plus two playtest requests: easier-to-read menu fonts, and a web version that only updates with a release.


- **Readable menus**: the menus now use Cinzel for headings and Alegreya Sans for text, like the HUD. The blackletter font is kept only for the title, and IM Fell English is gone.
- **Run log**: every run keeps a compact timeline in the save (the last 50): when each wave started and was cleared, the damage taken in it, the time with fewer than 5 enemies alive, and a mark for every level-up, relic, talent, ability upgrade, quest board, finished quest, event, shrine, boss kill, Merchant and new Act, plus what dealt the killing blow.
- **Boredom marker**: F8 (or the 😴 button in the pause menu) stamps "bored here" with the moment (wave, enemies alive, HP, level) into the run log.
- **Run history** in the Keep: the last 50 runs with class, difficulty, arena, duration, wave, level, cause of death and build, each with a timeline bar (a band per wave, as wide as it lasted; level-ups as ticks; everything else as icons with tooltips). **Export as JSON** saves the logs with a legend.
- **Run timer** on the HUD, under the wave.
- **`npm run sim -- pacing`**: run length, minutes per Act, the share of time with under 5 enemies alive, and the longest stretches with no new wave, pick, event, objective or boss, against the 90-second rule.
- **A run with an ending**: four Acts, then the Usurper. Act IV is always the new **Last Bastion** arena (a pillared hall with a red runner up to the throne, and a gatehouse whose fire rolls across the south end of the hall on a rhythm, burning the horde too) against *the Usurper's Host* (plate, crossbows, banners). Its last wave is **the Usurper**, in three phases:
  - *The Pretender's blade*: a marked cleave in front of him, a lunge down a marked line, and his guard called in.
  - *The ward*: he retreats to his throne behind a gold ward that nothing can pierce while any of the three **Royal Flames** burns (gold threads show which). Burning pitch falls around you, crossbow fans come from the dais, and the flames flare. Put all three out and he staggers.
  - *The crown's wrath*: a royal decree (two burning bands across the whole hall that cross where you stand), rings of broken ground rolling out from him, and lunges chained back to back.
  - Every phase gets its moment: until the first has run 20 seconds his HP holds at the threshold, and he cannot fall before the last has run 25 ("unyielding"), so even a huge build sees what he does.
- **Victory**: when he falls his host throws down its arms. The victory screen shows the run as it would bank (summary, build, what the win pays, deeds earned, the next mastery rank) and asks: **bank the win**, or **march on into Endless** (the Merchant, then Act V and the infinite scaling). Endless runs score 100 per wave past the Usurper plus one per kill, on a **leaderboard of the best five per class**. Wins show on the class cards.
- **Wins pay, the first most**: every win ◆ 2 Runes and 250 class XP; the first win with a class ◆ 10 more, 🪙 1,000 gold and 600 class XP more, all outside the run caps. Three new deeds: *Kingslayer* (win 1 / 5 / 20 runs), *Five Crowns* (win with 2 / 4 / 5 champions, a starting talent point at gold), *Beyond the Throne* (Endless: wave 45 / 50 / 60).
- **Readability**: nothing auto-targets a warded enemy; an arrow or bolt that kills you is named on the run log instead of "something unseen"; the boss bar says when a boss is warded, and "enraged" in its third phase too.
- **The balance bot dodges while it advances**: it used to drop everything and flee from any marked zone, and a ranged bot never walked toward a target out of its reach. Both kept it from ever putting out a Royal Flame; it now steps out of zones on its way in, and ranged classes close in on targets they cannot reach. BALANCE.md has the new numbers.
- **No more hunting stragglers**: once a wave's spawns are done and at most four enemies are left (none of them an elite or a boss), they get five seconds; then they come straight at you, faster, marked with a "!", and any siege structure left on its own gives up the field.
- **The pacing rule holds**: `sim -- pacing` finds no stretch longer than 90 seconds without a new wave, pick, event, objective or boss phase in any run (the longest averages 38 s fresh, 56 s maxed, down from 105 s). Boss phases and the Usurper's flames going out are beats in the run log now (⚜️ in Run history). The report also shows wins and counts Act IV for a won run.
- **Every heavy attack is readable**: an enemy winding up a telegraphed attack glows red until it lands, on top of its ground marker (circles for blasts, a filling line for charges) or, new, its **aim lines** (one thin line per shot of a volley: the Dragon's fire fan, the Lich's ring of bolts, the Usurper's crossbows, and the new patterns). An elite's leap always shows its line; the assassin glows before he stabs. Every wind-up is at least half a second, in config.
- **Patterns in Acts III and IV that make you move** (`config/ai.ts PATTERNS`): crossbowmen fire marked three-bolt volleys, ballistae, engineers and siege towers lob mortars at where you stand, plague doctors ring you with blasts (step in or out), war priests strike a holy cross through you, knights, mirror knights and bone collectors slam the ground around themselves. The mid-Act bosses and the Dragon add one each: the Black Knight a cross, the Warlord and the Lich rings of shots, the Inquisitor, the Abbot and the Dragon circles of blasts. Kill the caster and its blasts fizzle.
- **Perfect dodge**: step out of a telegraphed attack in its last quarter second (or roll, blink or leap through it) for +25% damage for 3 seconds and 30% of your signature ability's cooldown back, with a "PERFECT DODGE" flash and a chip on the HUD.
- **Last Stand**, once a run: the blow that would kill you leaves you at 1 HP, untouchable for 5 seconds, while your signature ability cools down 50% faster. The screen's edges burn red; it goes on the run log. (A future Oath can take it away.)
- **Enemy readability**: elites wear an orange outline and commanders a gold one, so they stand out of any crowd; everything that can hurt you flies with the same red halo, whatever it is made of; and a small mark beside an enemy tells how your attack fares against it without hovering (▲ weak to it, ▼ resists it, ✕ next to immune).
- **Evolutions**: every champion has three evolutions of the signature ability and two of the second one, 25 in all. Each takes a pair: one of the ability's upgrades, plus a keystone, a talent from a branch, or a relic at tier II. Complete a pair and the next level-up offers the evolution as a **gold card** (rerolls keep it); one of each kind a run. An evolution changes what the ability does, and still grows with the class's secondary stat:
  - *Paladin*: Aegis of Dawn (the shield becomes a dome that turns enemy shots back and burns what is inside), Day of Judgement (the burst rolls out in three rings and a sword of light falls on the strongest), Crusader's Charge (raising the shield throws you forward, trampling your path); Lion's Roar (the Challenge burns and marks what it pulls), Standard of Faith (it plants a standard the horde attacks instead of you, healing you near it).
  - *Viking*: Avatar of Wrath (raging, you grow into a giant whose every hit sends a shockwave), Maelstrom (a spinning storm of steel that cuts and drags), Blood Tide (kills while raging burst in blood that hurts, bleeds and heals); Thunderfall (the Leap lands as lightning that chains and stuns), Valkyrie's Descent (every Leap can be followed by a second, and landings leave burning craters).
  - *Angel*: Sunburst (a small sun drifts at your aim, burning and healing), Choir of Angels (circling wisps loose holy bolts), Sanctuary Wings (a ring of light that burns and throws back whatever crosses it, and heals you inside); Starfall (stars rain along the Blink's path), Phase Walk (a mirror image draws the horde and bursts into light).
  - *Necromancer*: Bone Colossus (the skeletons fuse into one giant that cleaves; raising again feeds it), Plague Legion (skeletons trail poison and burst into plague clouds), Soul Harvest (minion kills store souls that Raise Dead looses as seeking bolts); Corpse Lance (corpses hurl piercing bone lances instead of bursting), Death's Door (Corpse Explosion raises skeletons beyond the limit).
  - *Archer*: Meteor Arrow (one arrow into the sky comes down as a meteor), Storm Volley (every arrow calls lightning on a second enemy), Hunter's Mark (the toughest enemy hit becomes your prey: arrows seek it, a volley follows its death); Shadow Step (the roll leaves a shooting shadow that draws the horde), Frost Trap (the roll drops a trap that freezes everything around it).
- **Recipes**: the relic compendium in the Keep lists every recipe, in full once discovered and as a hint before. In a run, the tooltip of a relic or talent that would complete a recipe says so (and the talent glows gold in the tree). The HUD, pause and results screens show an evolved ability under its new name; evolutions go on the run log.
- **The road forks between Acts**: after the Merchant, a small map offers three routes into the next Act, each an arena, a theme (what the horde will be made of) and a focus: the **Elite path** (80% more elites, and they drop relics half again as often), the **Merchant path** (the Merchant also comes halfway through the Act, and 25% more gold drops), the **Pilgrim path** (a shrine blesses you as the Act begins, and the quest board lets you take one more) or the **Siege path** (enemies have 15% more HP and damage all Act, and its boss pays 2 Runes outside the cap). Act IV is always the Last Bastion; only its focus is yours to choose. The fork is rolled from the run's seed, so a Daily Trial forks the same way for everyone; routes go on the run log.
- **The Keep sells options, not power**: the Armory's Drill Yard, Archery Butts, Scriptorium and Balanced Arms (+35% damage when maxed, the main reason a maxed save walked through the Squire tier) are gone. In their place three sidegrades: the **Second Banner** (choose two starting traits), **Armorer's Choice** (every run opens on a choice of three common relics) and the **Quartermaster's Ledger** (up to three times a run, strike a level-up card from the run for good with its ✕, and get a fresh hand: a stat, the talent card, a relic or a tradeoff). Hearty Stock and Good Boots stop at three ranks, Veteran Levies at one. **Everything those ranks cost comes back**: a save from v0.5 is refunded in gold and Runes at v0.5 prices, and the Keep says how much the first time you open it.
- **The Oath ladder**: win with a class and its Oaths open, from 1 to 20. Every Oath adds one fixed hardship on top of all the ones below it: the curses (Iron Horde, Frenzy, Officer Corps, Glass Bones, Swarm, Hourglass, Blindfold, No Respite), wave modifiers twice as often and from wave 2, and new ones: *Unbowed Crowns* (a slain boss rises once more with 30% of its HP), *Thrice-Marked* (every elite carries three affixes), *Empty Road* (no Merchant in Act II), *No Last Stand*, *Iron Crowns* (bosses +30% HP), *Thin Purse* (one free reroll fewer), and tougher enemies at the top. An Oath run brings its own curses; free curses stay for custom runs. Each class card shows the highest Oath it has kept, and the **first win at every Oath level pays** ◆ 2-6 Runes and 🪙 340-1,100 gold. The Oath goes on the run log.
- **What to do next**: the results and victory screens always end with the three closest goals, each with a progress bar: the nearest deed tier, the next mastery rank, the class's sacred treasure step (which boss drops the next fragment), its first win or next Oath, a weekly contract, or the gold still missing for a Keep rank.
- **Quick restart**: the results screen's big button (or Enter) starts again at once with the same champion, traits and Oath, and says so on the button; the victory screen has **Bank and restart**.
- **Weekly contracts**: three seeded objectives every week (Monday to Sunday), the same for everyone, on the title screen with their progress: slay so many enemies, elites, bosses or squad commanders, complete quests, evolve abilities, reach a wave with a given champion, clear Acts or carry relics in one run. Each pays ◆ 2-5 Runes the moment a banked run completes it, outside the run caps; the results screen names the contracts a run completed.
- **The balance bot kites**: a ranged bot now circles the crowd instead of backing straight into a wall, looses the Archer's Volley at its full reach, and walks through the gate when its target is in another part of the map (it used to press against a wing's wall during the Usurper's ward). Both are how players play the Archer and the Necromancer (the strongest classes for players, the weakest for the old bot); the fresh Archer's share of runs past the Act I Dragon went from about 1 in 16 to 13 in 20.
- **`npm run sim -- deep`**: the fresh / maxed table with wins marching on into Endless, so a maxed save's depth is not capped at wave 40.
- **Balance: the Squire tier bites past the Dragon.** Enemies gain HP and damage faster from Act II on (HP slopes per Act 0.05 / 0.11 / 0.05 -> 0.05 / 0.16 / 0.14, damage 0.03 / 0.06 / 0.03 -> 0.03 / 0.08 / 0.07): about 45% more HP at wave 30. Before, a run that got past the Act I Dragon on Squire nearly always won; now Acts II-IV can end it too, and a win takes 30-40 minutes. Act I is unchanged. The Usurper's base HP goes from 4,000 to 3,000 and the Royal Flames' from 700 to 520, so under the steeper scaling his fight keeps the length it was tuned for.
- **The Archer has 95 HP** (was 80), like the Angel: it was the one class that often fell in Act I. Its damage is unchanged.
- **The web version updates only with a release**: GitHub Pages deploys the tagged commit after the release workflow succeeds, so work in progress on `main` never reaches players.

## v0.5.0 — Quests, a bigger map, sacred treasures, music, a readable HUD

The rest of the Phase 4 plan (side quests with map expansion, the sacred treasures, the balance pass) plus two backlog items: menu music and HUD readability.

### A bigger map
- **Every arena is the core of a bigger map**: four wings behind portcullis gates and a hidden vault in one corner. An Act starts with only the core open; the mid-Act boss and every finished quest open the next wing (seeded order).
- **Each wing holds a feature** (seeded per Act): a **shrine** (choose one of three blessings that last the run), a **strongbox** (gold and a relic), a **lair** (an elite sleeper with two affixes and guards; a choice of relics when it falls) or a **vent field** guarding a gold cache.
- Enemies come from the edges of **the whole open map**; closed wings are darkness behind bars, the vault is solid stone until it opens. The minimap shows what you have explored, what is open and what is still barred.

### Side quests, events, pacing
- **A quest board at the start of every Act**: three seeded quests, take up to two, no penalty for failing. **Protect the caravan** (two waves), **destroy the siege camps**, **escort the monk** to the chapel, **hunt the named elite**, **hold the shrine** (60 s), **find the hidden chest** (it glints when you are close). Rewards: a relic, gold, a Rune or a talent point; every finished quest also opens a wing.
- **Seeded events**, at most one a wave (so a Daily Trial is the same for everyone): a **wandering merchant** with a small shop, a **cursed chest** (relics, and elites around it), an **ambush** from two sides, a **lost knight** who fights beside you for a wave, a **plague cart** leaking poison across the field.
- **Pacing**: waves 3 and 8 of every Act are **breathers** (a lighter wave that always brings an event), waves 4 and 9 are heavier.
- A **quest tracker** in the HUD, markers in the world and on the minimap, arrows to off-screen objectives.

### Sacred treasures
- One per class: the **Holy Grail**, **Mjölnir's Shard**, the **Halo of Dawn**, the **Book of the Dead**, the **Bow of the Wild Hunt**. Each is a build-defining effect that scales with the class's secondary stat, in three tiers.
- **Earned over several runs** (from mastery rank 10): three **fragments** from set Act bosses while playing the class, then the class's **trial** on an Act board, then the treasure's **guardian** in the hidden vault. Tier II: carry it through two Acts in one run. Tier III: mastery rank 20 and the guardian slain again on Knight or harder.
- Equipped from the class select (not in the Daily Trial); each treasure opens a **hidden talent node**. A **Sacred Treasures** log in the Keep and the pause menu shows every chain.

### Music and the HUD
- **Menu music**, composed live in code (no audio files, copyright-free by construction): a D Dorian harp, flute, drone and bells that vary on every pass. It plays on the menus and the results screen, fades out when a run starts, follows the mute, and has a **Music** setting (Off / Low / Medium / High).
- **A readable HUD**: clear fonts (Cinzel, Alegreya Sans with even-width numbers) instead of blackletter, 14 px minimum text, dark plates behind floating text, a compact six-number stats panel with the full list on hover or tap, a one-line ability panel with the utility slot labelled with its key, a single-row relic bar with a "+N" overflow, and a minimap no panel can cover. Phones get a denser layout at full text size instead of shrunken text.

### Balance and fixes
- **Enemies no longer get stuck behind walls**: anything in a wing whose target is on another floor walks through the right gate (enemies, minions, the caravan and the monk). Real pathfinding around obstacles is planned for v0.6.
- **The talent tree**: three rows are open on a fresh save (the keystones need the Library's first level), and a locked row now looks locked; it used to look open and ignore the click.
- **Tooltips**: one shared tooltip for every menu and the HUD. It stays inside the window, never covers the element you move to next, and goes away when the screen changes (the old ones were clipped in scrolling dialogs and could stick).
- The difficulty tail past wave 30 is steeper (HP ×0.03 and damage ×0.012 per wave squared, from 0.012 / 0.005), and healing fades by 4% a wave past wave 30 (down to 15%). See BALANCE.md for what the sim shows and what is left for v0.6.
- New achievements: **Errant** (quests), **Worldly** (events), **Keeper of Relics** (sacred treasures).

### Known state, for v0.6
- The basic balance bot passes the Act I Dragon on a fresh save with the melee classes far more often than with the ranged ones, and a maxed save still reaches several times as deep as a fresh one. v0.6 reworks the Keep's stat ranks into sidegrades and targets the class spread; BALANCE.md has the numbers.

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
