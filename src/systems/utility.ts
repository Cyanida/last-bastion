import { UTILITIES, UTILITY, UTILITY_TRACKS, UTILITY_UPGRADES, type UtilityId, type UtilityUpgradeId } from '../config/utility';
import { sfx } from '../sim/view';
import { emit } from '../core/events';
import type { Enemy, Game, Player } from '../core/types';
import { addField } from '../entities/hazards';
import { abilityCooldown } from '../logic/formulas';
import { applyStatus, damageEnemy, healPlayer, rollPlayerHit } from './combat';
import { burst, floatText, ring, shake } from './effects';
import { feat, featAdd } from './feats';
import { clampToArena } from './movement';

/**
 * The utility ability (config/utility.ts): one hook per class. Unlocked at UTILITY.unlockLevel, cast with g.input.utility,
 * tiers chosen at UTILITY.tiers levels (g.player.pendingUtilityTiers), upgrades read through has(). Talents scale it through
 * p.mods.utilityCd and p.mods.utilityPower.
 */
const U = UTILITY_UPGRADES;
const has = (p: Player, id: UtilityUpgradeId) => p.utilityUpgrades.includes(id);
export const utilityDef = (p: Player) => UTILITIES[p.cls.id];
export const utilityUnlocked = (p: Player) => p.level >= UTILITY.unlockLevel;

/** Where a dash goes: toward the aim point (up to `range`) when it is away from the player, else along the movement or facing direction. */
function dashTarget(g: Game, range: number): { x: number; y: number } {
  const p = g.player;
  const dx = g.input.aimX - p.x;
  const dy = g.input.aimY - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 30) return moveDash(g, range);
  const r = Math.min(range, d);
  return { x: p.x + (dx / d) * r, y: p.y + (dy / d) * r };
}

function moveDash(g: Game, range: number): { x: number; y: number } {
  const p = g.player;
  let dx = g.input.moveX;
  let dy = g.input.moveY;
  if (Math.hypot(dx, dy) < 0.01) (dx = Math.cos(p.facing)), (dy = Math.sin(p.facing));
  const d = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / d) * range, y: p.y + (dy / d) * range };
}

import { evolutionHook } from './evolutions';

const HOOKS: Record<UtilityId, (g: Game) => boolean> = {
  taunt(g) {
    const p = g.player;
    const n = UTILITIES.paladin.n;
    const power = p.mods.utilityPower;
    let pulled = 0;
    for (const e of g.hash.query(p.x, p.y, n.radius, [])) {
      if (e.def.boss) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.kx += (dx / d) * n.pull * power;
      e.ky += (dy / d) * n.pull * power;
      e.tauntT = n.duration * power;
      if (has(p, 'chains')) applyStatus(e, { apply: [{ id: 'stun', time: U.chains.n.stun }] }, g);
      pulled++;
    }
    feat(g, 'taunted', pulled);
    if (has(p, 'rallyingCry')) healPlayer(g, p.stats.hp * Math.min(U.rallyingCry.n.max, pulled * U.rallyingCry.n.heal));
    if (has(p, 'consecration')) addField(g, { x: p.x, y: p.y, r: U.consecration.n.radius, life: U.consecration.n.time, dps: U.consecration.n.dps * power, hostile: false, color: '#f2d675', dtype: 'holy' });
    ring(g, p.x, p.y, n.radius, '#f2d675', 0.5);
    shake(g, 6);
    return true;
  },

  leap(g) {
    const p = g.player;
    const n = UTILITIES.viking.n;
    const range = n.range * (has(p, 'longJump') ? U.longJump.n.range : 1);
    const to = dashTarget(g, range);
    p.x = to.x;
    p.y = to.y;
    clampToArena(g, p);
    const radius = n.radius * (has(p, 'earthshatter') ? U.earthshatter.n.radius : 1);
    const hit = rollPlayerHit(g, n.damage * (has(p, 'earthshatter') ? U.earthshatter.n.damage : 1) * p.mods.utilityPower, 'str');
    let hits = 0;
    for (const e of g.hash.query(p.x, p.y, radius, [])) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      damageEnemy(g, e, hit.amount, hit.crit, Math.cos(a) * n.knockback, Math.sin(a) * n.knockback, 'ability');
      hits++;
    }
    feat(g, 'leapHits', hits);
    if (has(p, 'bloodLanding')) healPlayer(g, hits * U.bloodLanding.n.heal, false);
    if (has(p, 'warCry')) g.player.vars.warCry = g.time + U.warCry.n.time;
    ring(g, p.x, p.y, radius, '#c23a2e', 0.4);
    burst(g, p.x, p.y, '#8a6a4a', 14, 220);
    shake(g, 8);
    return true;
  },

  blink(g) {
    const p = g.player;
    const n = UTILITIES.angel.n;
    const from = { x: p.x, y: p.y };
    const to = dashTarget(g, n.range * (has(p, 'farBlink') ? U.farBlink.n.range : 1));
    p.x = to.x;
    p.y = to.y;
    clampToArena(g, p);
    p.invulnT = Math.max(p.invulnT, n.invuln * (has(p, 'quickBlink') ? U.quickBlink.n.invuln : 1));
    if (has(p, 'blessedBlink')) healPlayer(g, p.stats.hp * U.blessedBlink.n.heal);
    if (has(p, 'afterimage')) {
      const hit = rollPlayerHit(g, U.afterimage.n.damage * p.mods.utilityPower, 'int');
      for (const e of g.hash.query(from.x, from.y, U.afterimage.n.radius, [])) damageEnemy(g, e, hit.amount, hit.crit, 0, 0, 'ability', 'holy');
      ring(g, from.x, from.y, U.afterimage.n.radius, '#f2e6a0', 0.4);
    }
    burst(g, from.x, from.y, '#f2e6a0', 12, 160);
    burst(g, p.x, p.y, '#f2e6a0', 12, 160);
    featAdd(g, 'blinks');
    return true;
  },

  corpseExplosion(g) {
    const p = g.player;
    const n = UTILITIES.necromancer.n;
    const radius = n.radius * (has(p, 'deathWave') ? U.deathWave.n.radius : 1);
    const blast = n.blast * (has(p, 'boneShards') ? U.boneShards.n.blast : 1);
    const corpses = g.corpses.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) <= radius);
    if (corpses.length === 0) return false;
    const hit = rollPlayerHit(g, n.damage * (has(p, 'boneShards') ? U.boneShards.n.damage : 1) * p.mods.utilityPower, 'int');
    let caught = 0;
    for (const c of corpses) {
      for (const e of g.hash.query(c.x, c.y, blast, [])) {
        const a = Math.atan2(e.y - c.y, e.x - c.x);
        damageEnemy(g, e, hit.amount, hit.crit, Math.cos(a) * 160, Math.sin(a) * 160, 'ability', 'shadow');
        caught++;
      }
      if (has(p, 'gravedust')) addField(g, { x: c.x, y: c.y, r: blast * 0.7, life: U.gravedust.n.time, dps: U.gravedust.n.dps * p.mods.utilityPower, hostile: false, color: '#6f8f4e', dtype: 'shadow', apply: { id: 'poison', power: U.gravedust.n.dps * 0.5 } });
      ring(g, c.x, c.y, blast, '#8a5cc6', 0.4);
      burst(g, c.x, c.y, '#8a5cc6', 10, 200);
    }
    feat(g, 'corpseHits', caught);
    if (has(p, 'harvest')) healPlayer(g, corpses.length * U.harvest.n.heal, false);
    g.corpses = g.corpses.filter((c) => !corpses.includes(c));
    shake(g, Math.min(12, 3 + corpses.length));
    sfx(g, 'boom');
    return true;
  },

  dodgeRoll(g) {
    const p = g.player;
    const n = UTILITIES.archer.n;
    const from = { x: p.x, y: p.y };
    const to = moveDash(g, n.range);
    p.x = to.x;
    p.y = to.y;
    clampToArena(g, p);
    p.invulnT = Math.max(p.invulnT, n.invuln * (has(p, 'ghostStep') ? U.ghostStep.n.invuln : 1));
    if (has(p, 'ghostStep')) g.player.vars.ghostStep = g.time + U.ghostStep.n.time;
    const dps = n.caltropDps * (has(p, 'sharpCaltrops') ? U.sharpCaltrops.n.dps : 1) * p.mods.utilityPower;
    addField(g, {
      x: from.x, y: from.y, r: n.caltropRadius * (has(p, 'scatter') ? U.scatter.n.radius : 1), life: n.caltropLife * (has(p, 'scatter') ? U.scatter.n.life : 1),
      dps, hostile: false, color: '#6f8f4e', dtype: 'physical',
      apply: has(p, 'sharpCaltrops') ? { id: 'bleed', power: dps * 0.5 } : { id: 'slow', stacks: 1, time: 1 },
    });
    burst(g, from.x, from.y, '#6f8f4e', 8, 120);
    featAdd(g, 'rolls');
    return true;
  },
};

export function updateUtility(g: Game, dt: number): void {
  const p = g.player;
  p.utilityCd = Math.max(0, p.utilityCd - dt);
  // upgrade after-effects
  if (g.time < (g.player.vars.warCry ?? 0)) p.mods.atkSpd *= 1 + U.warCry.n.atkSpd;
  if (g.time < (g.player.vars.ghostStep ?? 0)) p.mods.moveSpd *= 1 + U.ghostStep.n.moveSpd;
  if (!g.input.utility || p.utilityCd > 0 || !utilityUnlocked(p)) return;
  const def = utilityDef(p);
  const from = { x: p.x, y: p.y };
  const evo = evolutionHook(g, 'utility'); // v0.6: an evolution adds to the utility, or takes it over
  if (!(evo?.replaceUtility ? evo.replaceUtility(g, from) : HOOKS[def.id](g))) return;
  const upgradeCd = (has(p, 'longJump') ? U.longJump.n.cooldown : 1) * (has(p, 'quickBlink') ? U.quickBlink.n.cooldown : 1) * (has(p, 'quickRoll') ? U.quickRoll.n.cooldown : 1);
  p.utilityCd = p.utilityCdMax = abilityCooldown(def.cooldown, p.stats.int) * p.mods.utilityCd * upgradeCd;
  sfx(g, 'ability');
  emit(g, 'onUtilityUsed', { id: def.id });
  evo?.utility?.(g, from); // after the cooldown is set: Valkyrie's Descent hands it straight back
}

/** Taunted enemies deal less with Iron Will; called by combat for hits on the player. */
export function tauntedDamageMult(g: Game, attacker: Enemy | null): number {
  return attacker && attacker.tauntT > 0 && has(g.player, 'ironWill') ? U.ironWill.n.damage : 1;
}

/** Resolve the first queued utility tier. Invalid picks (wrong tier, already taken) are ignored. */
export function chooseUtilityUpgrade(g: Game, id: UtilityUpgradeId): boolean {
  const p = g.player;
  const tier = g.player.pendingUtilityTiers[0];
  if (tier === undefined) return false;
  const options = UTILITY_TRACKS[p.cls.id][tier];
  if (!options || !(options as readonly string[]).includes(id) || options.some((o) => p.utilityUpgrades.includes(o))) return false;
  p.utilityUpgrades = [...p.utilityUpgrades, id];
  g.player.pendingUtilityTiers.shift();
  floatText(g, p.x, p.y - 50, U[id].name, utilityDef(p).color, 17);
  ring(g, p.x, p.y, 110, utilityDef(p).color, 0.6);
  return true;
}

export const utilityUpgradeOptions = (g: Game): readonly UtilityUpgradeId[] => UTILITY_TRACKS[g.player.cls.id][g.player.pendingUtilityTiers[0]] ?? [];

export const describeUtility = (p: Player): string => {
  const def = utilityDef(p);
  return utilityUnlocked(p) ? `${def.desc}${p.utilityUpgrades.length ? ` · ${p.utilityUpgrades.map((id) => U[id].name).join(' · ')}` : ''}` : `Unlocks at level ${UTILITY.unlockLevel}.`;
};
