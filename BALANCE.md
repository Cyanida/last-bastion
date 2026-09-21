# Balance notes (v0.2)

All numbers live in `src/config/`. This file says what they are *supposed* to achieve, and what the
headless simulation says they currently achieve.

## Intended power curve

| Stretch | Without Keep upgrades (Squire) | What should be happening |
|---|---|---|
| Waves 1-4 | Comfortable | Learn the class, first 3-4 boons. Elites start at wave 4 (3% per enemy). |
| **Wave 5, first boss** | **The first real check.** | A run that took random boons and ignores telegraphs ends here. Ability tier 1 arrives at level 5, right around this fight, and the boss pays out the first guaranteed relic choice. |
| Waves 6-9 | Hard | Wave modifiers begin (35% of waves), knights and cultists join, then shield bearers and priests. A fresh character with one relic and one ability tier is expected to die somewhere in here. |
| Wave 10, second boss | A good fresh run | Reaching it at all unlocks the Graveyard. Beating it is a strong fresh run. |
| Waves 11-15 | Needs a build | Cavalry, two-affix elites, tier 2 (level 10). Clearing wave 15 unlocks the next difficulty: that is the goal a *developed* save is meant to reach, not a fresh one. |
| 15+ | Borrowed time | Enemy HP and damage grow quadratically (`WAVES.hp.quad`, `WAVES.dmg.quad`), so every build eventually loses, including sustain builds. |

### What permanent upgrades should do

A fully upgraded Keep plus mastery rank 5 is budgeted at roughly **+20% effective HP, +30-35% damage output, +25% XP,
2 extra rerolls, 1 extra relic slot and a free common relic**. Target: **1.5-2x as many waves on the same tier, never 10x.**
The rest of the long-term curve is carried by the difficulty tiers: a maxed character on *Knight* should do about as well
as a fresh character on *Squire*.

Things that exist specifically to keep that ceiling in place:

- `GAME.maxAttackRate` (4.5/s): attack-speed boons multiply, and with knockback on every swing that made melee untouchable.
- `GAME.armorCap` (75%) and `GAME.leechCapPerHit` (2% max HP): mitigation and lifesteal otherwise outgrow enemy damage.
- The ability cooldown does not tick while the ability is active, so duration stacking (Faith, Rage, Wolfskin Cloak) can never reach 100% uptime.
- `WAVES.overtime` (60 s): after the last spawn of a wave the next wave arrives anyway (never during a boss). No stalemates, no safe farming of a single straggler.
- Relic damage scales with character level (`RELIC_DAMAGE_PER_LEVEL`), not with attack stats, so proc relics stay useful without multiplying with everything else.

### Economy

A fresh Squire run banks roughly 100-350 gold (wave 6-10). The whole Keep costs 10,967 gold, of which 4,000 is the
seventh relic slot: dozens of runs on Squire, far fewer on higher tiers (gold x1.6 / x2.5 / x4). Gold spent on paid rerolls
during a run is gold not banked, and starting gold (War Chest) is never counted as earned.

## Simulation

```bash
npm run sim -- [runs per cell = 6] [tier = 0..3] [arena = courtyard|graveyard|keep]
```

`src/sim/bot.ts` plays headlessly: melee wades in while above 40% HP, ranged kites, both step out of telegraphs and
sidestep shots, the ability is used on cooldown, boons are picked by a fixed priority, the first relic on offer is always taken and
ability-upgrade branches alternate per seed (A, B, A, B...). **It is a yardstick, not a good player**: it has no
target priority (priests!), no positioning plan for bosses and never uses obstacles. A human should beat these numbers by a few waves; what matters is the
spread between classes and the maxed / fresh ratio.

### Results: Squire, courtyard, 8 runs per cell

| Class | Fresh: avg wave (min-max) | Maxed: avg wave (min-max) | Ratio |
|---|---|---|---|
| Paladin | 7.5 (5-10) | 16.5 (7-30) | 2.20 |
| Viking | 5.8 (5-8) | 10.6 (5-15) | 1.85 |
| Angel | 8.0 (4-11) | 19.3 (8-47) | 2.41 |
| Necromancer | 7.0 (5-9) | 15.6 (8-30) | 2.23 |
| Archer | 7.1 (5-9) | 8.4 (5-10) | 1.18 |
| **All** | **7.1** | **14.1** | **1.99** |

Spread between classes (fresh): 1.39x.

### Results: Knight, courtyard, 4 runs per cell

| Class | Fresh | Maxed | Ratio |
|---|---|---|---|
| Paladin | 5.0 | 9.5 | 1.90 |
| Viking | 3.5 | 5.3 | 1.50 |
| Angel | 6.0 | 12.5 | 2.08 |
| Necromancer | 4.8 | 8.8 | 1.84 |
| Archer | 5.0 | 6.8 | 1.35 |
| **All** | **4.8** | **8.6** | **1.76** |

So a maxed character on Knight (8.6) lands a little above a fresh one on Squire (7.1): the tiers absorb the permanent power, as intended.

### What the simulation changed

The first pass was far off, and the fixes are all in config or one-liners:

| Finding | Fix |
|---|---|
| Every fresh run died at the first boss, mostly to contact damage | Boss contact cooldown 0.9 s -> 1.3 s, Black Knight charge x2 -> x1.7, boss HP cut earlier in v0.1 |
| Maxed Paladin / Angel reached wave 60 and the 45-minute cap (ratio 6x) | Quadratic enemy damage, steeper quadratic HP, attack-rate cap, armor cap 80% -> 75% |
| Viking with Undying + Wolfskin was effectively immortal | Cooldown pauses while the ability is active; leech cap per hit |
| Reliquary of Saints gave near-permanent Divine Shield when hit often | 0.04 s -> 0.02 s per Faith per hit |
| One run stalled for 30 minutes on a single unkillable straggler | Wave overtime |
| Viking, Archer, Necromancer lagged; Angel led | Viking HP/armor/regen/damage up and Rage cooldown 20 -> 13 s; Archer HP 70 -> 80, pierce 1, volley 16 -> 20; skeletons 45 -> 60 HP and 9 -> 11 damage; Radiance heal 20 -> 13 and cooldown 14 -> 16 s |

### Known outliers

- **Archer scales worst with the Keep (1.18x)** for the bot: it dies to burst (boss charges, cavalry), which more stats barely help and which the bot dodges poorly. Expect a human to get far more out of 205 move speed. Watch this one with real play data before buffing.
- **Variance is high for sustain classes when maxed** (Angel 8-47): runs that survive to tier 3 upgrades snowball for a while before the quadratic scaling catches them. If that feels wrong in play, raise `WAVES.dmg.quad` before touching the classes.
- Relic and ability-upgrade *combinations* are not searched by the bot (it takes the first relic offered). Expect stronger synergies than these averages show.
