import { ABILITY_TRACKS } from '../config/abilityUpgrades';
import { UTILITY_TRACKS } from '../config/utility';
import { branchPlan, canTakeTalent } from '../logic/talents';
import { spendTalent } from '../systems/talents';
import { chooseBlessing } from '../systems/regions';
import { chooseUtilityUpgrade } from '../systems/utility';
import type { ClassId } from '../config/classes';
import { GAME } from '../config/game';
import { UPGRADE_RARITIES } from '../config/upgrades';
import type { Game, StatKey } from '../core/types';
import { createGame, summarizeRun, updateGame, type RunOptions } from '../game';
import type { RunSummary } from '../logic/save';
import type { LevelUpOption } from '../logic/upgrades';
import { chooseAbilityUpgrade } from '../systems/abilities';
import { merchantBuy, merchantHeal, nextAct } from '../systems/acts';
import { chooseLevelUp, levelUpOptions } from '../systems/leveling';
import { resolveRelicOffer } from '../systems/relics';

/**
 * A deliberately basic player: kite (or, for melee, wade in until hurt), step out of telegraphs,
 * use the ability on cooldown, take sensible boons. Used by scripts/simulate.ts for balance numbers
 * and by the dev hook for smoke tests. It is a yardstick between classes, not a good player.
 */

const DT = 1 / GAME.tickRate;

export function botInput(g: Game): void {
  const p = g.player;
  const melee = p.cls.attack.kind === 'melee';
  let nx = p.x;
  let ny = p.y;
  let nd = Infinity;
  let fx = 0;
  let fy = 0;
  for (const e of g.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    if (d < nd) {
      nd = d;
      nx = e.x;
      ny = e.y;
    }
    if (d < 170) {
      fx += (p.x - e.x) / d;
      fy += (p.y - e.y) / d;
    }
    const t = e.telegraph; // sidestep charge lines
    if (t) {
      const along = (p.x - e.x) * Math.cos(t.angle) + (p.y - e.y) * Math.sin(t.angle);
      const across = -(p.x - e.x) * Math.sin(t.angle) + (p.y - e.y) * Math.cos(t.angle);
      if (along > -20 && along < t.length + 20 && Math.abs(across) < t.width / 2 + 40) {
        const side = across >= 0 ? 1 : -1;
        fx += -Math.sin(t.angle) * side * 6;
        fy += Math.cos(t.angle) * side * 6;
      }
    }
  }
  // step out of anything about to hurt
  let danger = false;
  for (const z of [...g.zones, ...g.fields]) {
    if (!z.hostile) continue;
    const d = Math.hypot(p.x - z.x, p.y - z.y) || 1;
    if (d < z.r + 30) {
      danger = true;
      fx += ((p.x - z.x) / d) * 5;
      fy += ((p.y - z.y) / d) * 5;
    }
  }

  // sidestep shots that are coming at us
  for (const pr of g.projectiles) {
    if (!pr.hostile) continue;
    const dx = p.x - pr.x;
    const dy = p.y - pr.y;
    const d = Math.hypot(dx, dy) || 1;
    const v = Math.hypot(pr.vx, pr.vy) || 1;
    if (d > 220 || (dx * pr.vx + dy * pr.vy) / (d * v) < 0.9) continue;
    const side = dx * pr.vy - dy * pr.vx >= 0 ? 1 : -1;
    fx += (-pr.vy / v) * side * -4;
    fy += (pr.vx / v) * side * -4;
  }

  let mx = 0;
  let my = 0;
  // melee wades in while healthy, and always hunts when nothing is close (a lone crossbowman must not plink it to death)
  const crowded = nd < 170;
  const brave = melee && !danger && (p.hp > p.stats.hp * 0.4 || !crowded);
  if (brave && nd < Infinity) {
    mx = nx - p.x;
    my = ny - p.y;
  } else if (fx || fy) {
    // flee, with a pull to the middle so it does not pin itself in a corner
    mx = fx + (g.arena.w / 2 - p.x) * 0.002;
    my = fy + (g.arena.h / 2 - p.y) * 0.002;
  } else {
    let best = Infinity;
    for (const k of g.pickups) {
      const d = Math.hypot(k.x - p.x, k.y - p.y);
      if (d < best) {
        best = d;
        mx = k.x - p.x;
        my = k.y - p.y;
      }
    }
  }
  const len = Math.hypot(mx, my);
  g.input.moveX = len > 4 ? mx / len : 0;
  g.input.moveY = len > 4 ? my / len : 0;
  g.input.aimX = nx;
  g.input.aimY = ny;
  g.input.ability = nd < 220 || p.cls.id === 'necromancer';
  // the utility: the Paladin when enemies are close, the Necromancer when corpses lie around, the rest when crowded or hurt
  g.input.utility = p.cls.id === 'necromancer' ? g.corpses.length >= 3 && nd < 300 : p.cls.id === 'paladin' ? nd < 200 : crowded || p.hp < p.stats.hp * 0.4;
}

function scoreOption(g: Game, o: LevelUpOption): number {
  if (o.kind === 'tradeoff') return 0.9;
  if (o.kind === 'talent') return 1.2;
  if (o.kind === 'relic') return 1.0;
  const p = g.player;
  const weights: Record<StatKey, number> = { hp: p.cls.attack.kind === 'melee' ? 1.3 : 1, str: 0.2, dex: 0.5, int: 0.4, atkSpd: 1.4, moveSpd: 0.6, secondary: 1.1 };
  weights[p.cls.attack.scaling] = 1.6;
  return weights[o.key] * UPGRADE_RARITIES[o.rarity].mult;
}

/** Resolve every pending choice the way the UI would, without the UI. `variant` picks the ability upgrade branch (0 or 1) and the talent branch. */
export function botChoose(g: Game, variant = 0): void {
  if (g.pendingShrine) chooseBlessing(g, g.pendingShrine[0]);
  while (g.relicOffers.length > 0) resolveRelicOffer(g, g.relicOffers[0][0]); // no cap since v0.4: always take the first (a held one = a tier up)
  while (g.pendingAbilityTiers.length > 0) {
    if (!chooseAbilityUpgrade(g, ABILITY_TRACKS[g.player.cls.id][g.pendingAbilityTiers[0]][variant])) g.pendingAbilityTiers.shift();
  }
  while (g.pendingUtilityTiers.length > 0) {
    if (!chooseUtilityUpgrade(g, UTILITY_TRACKS[g.player.cls.id][g.pendingUtilityTiers[0]][variant])) g.pendingUtilityTiers.shift();
  }
  // talents: walk one branch (the variant picks which), spilling into the next when it is full
  let spent = true;
  while (g.talentPoints > 0 && spent) {
    spent = false;
    for (let b = 0; b < 3 && !spent; b++) {
      const next = branchPlan(g.player.cls.id, variant + b).find((id) => canTakeTalent(g.player.talents, id, g.talentPoints, g.talentRowCap));
      if (next) spent = spendTalent(g, next);
    }
  }
  if (g.pendingMerchant) {
    // patch up first, then a relic if there is room and money; never hoards for the Keep (it is a yardstick, not a saver)
    if (g.player.hp < g.player.stats.hp * 0.6) merchantHeal(g);
    if (!merchantBuy(g, 'rare')) merchantBuy(g, 'common');
    nextAct(g);
  }
  while (g.pendingLevelUps > 0) {
    const options = levelUpOptions(g);
    chooseLevelUp(g, options.reduce((a, b) => (scoreOption(g, b) > scoreOption(g, a) ? b : a)));
  }
}

export function botStep(g: Game, variant = 0): void {
  botChoose(g, variant);
  botInput(g);
  updateGame(g, DT);
}

export function simulateRun(classId: ClassId, seed: number, opts: RunOptions = {}, variant = 0, maxSeconds = 45 * 60): RunSummary {
  const g = createGame(classId, seed, opts);
  while (!g.over && g.time < maxSeconds) botStep(g, variant);
  return summarizeRun(g);
}

export interface ProbeResult {
  deathsAtWave: number[]; // index w-1: how often the bot died during wave w
  secondsAtWave: number[]; // index w-1: how long wave w took (spawn to clear)
  levelAtWave: number[];
  wave: number; // the last wave it cleared
}

/**
 * Wall probe: the same bot, but revived in place on death, so every class reaches `toWave` and the
 * curve can be read as deaths per wave instead of "wave reached". A wall is a band of waves where
 * deaths jump and stay high, or a boss wave that never ends.
 */
export function probeRun(classId: ClassId, seed: number, opts: RunOptions = {}, variant = 0, toWave = 30, maxSeconds = 90 * 60): ProbeResult {
  const g = createGame(classId, seed, opts);
  const deathsAtWave: number[] = [];
  const secondsAtWave: number[] = [];
  while (g.wavesCleared < toWave && g.time < maxSeconds) {
    const cleared = g.wavesCleared;
    botStep(g, variant);
    if (g.wavesCleared > cleared) secondsAtWave[cleared] = g.waveT;
    if (g.over) {
      deathsAtWave[Math.max(0, g.wave - 1)] = (deathsAtWave[Math.max(0, g.wave - 1)] ?? 0) + 1;
      g.over = false;
      g.player.hp = g.player.stats.hp;
      g.player.invulnT = 3;
      // come back where the crowd is not (reviving in place just dies again: that measures the probe, not the game)
      let best = -1;
      for (let i = 0; i < 9; i++) {
        const x = g.arena.w * (i === 8 ? 0.5 : 0.5 + 0.35 * Math.cos((i / 8) * Math.PI * 2));
        const y = g.arena.h * (i === 8 ? 0.5 : 0.5 + 0.35 * Math.sin((i / 8) * Math.PI * 2));
        const near = g.enemies.reduce((d, e) => Math.min(d, Math.hypot(e.x - x, e.y - y)), Infinity);
        if (near > best) {
          best = near;
          g.player.x = x;
          g.player.y = y;
        }
      }
    }
  }
  for (let w = 0; w < toWave; w++) {
    deathsAtWave[w] ??= 0;
    secondsAtWave[w] ??= 0;
  }
  return { deathsAtWave, secondsAtWave, levelAtWave: g.levelAtWave, wave: g.wavesCleared };
}
