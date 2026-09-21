import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import { ARMOR, DAMAGE_TYPES, ENEMY_STATUS, STATUSES, type DamageType } from '../config/damage';
import { AFFIXES, ELITES } from '../config/elites';
import { GOLD } from '../config/economy';
import { GAME } from '../config/game';
import { MODIFIERS } from '../config/waves';
import { sfx } from '../core/audio';
import { emit } from '../core/events';
import { angleDiff, compact, dist2, TAU } from '../core/math';
import type { DamageSource, Enemy, Game, Minion, Player, Status } from '../core/types';
import { addField, fireProjectile } from '../entities/hazards';
import { goldDrop } from '../logic/economy';
import { attackDamage, mitigate, rollCrit } from '../logic/formulas';
import { applyStatusTo, curseStacks, damageTakenFactor, fromBehind, slowStacks, throughArmor, typeMultiplier, type StatusApply } from '../logic/status';
import { burst, floatText, ring, shake, swingArc } from './effects';
import { spawnEnemy } from './spawning';

const BLOOD = '#8e1b1b';
const near: Enemy[] = []; // scratch for the loops in this file
const nearest: Enemy[] = []; // nearestEnemy's own scratch: it may be called from inside those loops

export function nearestEnemy(g: Game, x: number, y: number, range: number, exclude?: Enemy): Enemy | null {
  let best: Enemy | null = null;
  let bestD = Infinity;
  for (const e of g.hash.query(x, y, range, nearest)) {
    if (e.dead || e.hidden || e === exclude) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function goldMult(g: Game): number {
  return g.player.mods.gold * g.tier.gold * (g.vars.curseMult ?? 1) * (g.modifier === 'bloodMoon' ? MODIFIERS.bloodMoon.n.gold : 1);
}

export function killEnemy(g: Game, e: Enemy, source: DamageSource = 'attack'): void {
  if (e.dead) return;
  e.dead = true;
  g.kills++;
  const boss = e.def.boss;
  g.pickups.push({ x: e.x, y: e.y, value: e.xp, kind: 'xp' });
  const gold = goldDrop(e.def.xp, boss ? 'boss' : e.elite ? 'elite' : 'regular', g.rng, goldMult(g), ELITES.goldMult);
  if (gold > 0) g.pickups.push({ x: e.x + 8, y: e.y + 6, value: gold, kind: 'gold' });
  if (e.def.aura || e.def.onDeath) {
    // commanders are worth hunting: a bounty on top of the normal drop
    g.commandersKilled++;
    g.pickups.push({ x: e.x - 6, y: e.y + 8, value: Math.round((e.def.bonusGold ?? 0) * goldMult(g)), kind: 'gold' });
  }
  g.corpses.push({ x: e.x, y: e.y, t: 0 });
  burst(g, e.x, e.y, BLOOD, boss ? 60 : e.elite ? 20 : 8, boss ? 320 : 150);
  sfx(boss ? 'boom' : 'kill');

  if (g.modifier === 'plague' && !boss) {
    const n = MODIFIERS.plague.n;
    addField(g, { x: e.x, y: e.y, r: n.radius, life: n.life, dps: n.dps * g.waveDmgMult, hostile: true, color: '#6f8f4e' });
  }
  if (e.elite) {
    g.elitesKilled++;
    ring(g, e.x, e.y, 90, AFFIXES[e.affixes[0]].color, 0.5);
    if (g.rng() < ELITES.relicChance) g.pickups.push({ x: e.x - 8, y: e.y - 6, value: 1, kind: 'relic' });
    if (e.affixes.includes('splitting')) {
      const n = AFFIXES.splitting.n;
      for (let i = 0; i < n.count; i++) {
        const a = (i / n.count) * TAU + 0.5;
        const c = spawnEnemy(g, e.def.id, e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24);
        c.hp = c.maxHp = Math.max(1, Math.round(e.maxHp * n.hpFrac));
      }
    }
  }
  if (boss) {
    g.bossesKilled.push(e.def.id);
    if (!g.bossHit) g.flawlessBosses++;
    g.gold += Math.round(GOLD.bossBonus * goldMult(g));
    shake(g, 22);
    ring(g, e.x, e.y, 260, '#c9a227', 0.8);
    g.banner = { text: `${e.def.name} has fallen`, t: 2.5 };
  }
  emit(g, 'onKill', { enemy: e, source });
}

/** Puts an attack's debuffs on an enemy. The v0.2 slow / mark payloads map onto Chilled and Cursed stacks. */
export function applyStatus(e: Enemy, s: Status | null, g?: Game): void {
  if (!s || e.dead) return;
  const list: StatusApply[] = [...(s.apply ?? [])];
  if (s.slowT) list.push({ id: 'slow', stacks: slowStacks(s.slowMul ?? 0.5), time: s.slowT });
  if (s.markT) list.push({ id: 'curse', stacks: curseStacks(s.markMul ?? 1.3), time: s.markT });
  for (const a of list) {
    if (a.id === 'fear') {
      if (!e.def.boss) e.fearT = Math.max(e.fearT, a.time ?? STATUSES.fear.duration);
    } else if (applyStatusTo(e.statuses, a, e.def.boss) === 'frozen' && g) floatText(g, e.x, e.y - e.r - 20, 'FROZEN', STATUSES.slow.color, 14);
  }
}

/**
 * Returns the damage that reached the enemy's HP. kx/ky is a knockback impulse, and also tells which way the hit travelled.
 * Order: resistance / weakness -> Cursed -> elite barrier -> armor -> HP.
 */
export function damageEnemy(g: Game, e: Enemy, amount: number, crit = false, kx = 0, ky = 0, source: DamageSource = 'attack', type: DamageType = 'physical'): number {
  if (e.dead) return 0;
  const typeMult = typeMultiplier(e.def.id, type);
  amount *= typeMult * damageTakenFactor(e.statuses);
  const armor = ARMOR[e.def.id];
  if (armor && e.armorHp > 0) {
    if (armor.backBreak) {
      // a shield: only hits from behind wear it down, and those go straight through
      if (fromBehind(kx, ky, e.angle)) e.armorHp -= amount;
      else amount *= 1 - armor.reduction;
    } else {
      const hit = throughArmor(amount, e.armorHp, armor.reduction);
      amount = hit.dealt;
      e.armorHp = hit.armorHp;
    }
    if (e.armorHp <= 0) {
      e.armorHp = 0;
      floatText(g, e.x, e.y - e.r - 22, armor.backBreak ? 'SHIELD BROKEN' : 'ARMOR BROKEN', '#9a9aa0', 15);
      burst(g, e.x, e.y, '#9a9aa0', 14, 220);
      shake(g, 5);
    }
  }
  // shieldwall: while the line holds, anything that comes at the pavises from the front barely scratches
  const wall = e.def.wall;
  if (wall && e.charged && (kx !== 0 || ky !== 0) && !fromBehind(kx, ky, e.angle)) amount *= 1 - wall.reduction;
  e.flash = 0.1;
  e.kx += kx * (1 - e.def.knockbackResist);
  e.ky += ky * (1 - e.def.knockbackResist);
  if (e.shieldMax > 0) e.shieldT = AFFIXES.shielded.n.regenDelay;
  if (e.shield > 0) {
    const soaked = Math.min(e.shield, amount);
    e.shield -= soaked;
    amount -= soaked;
    if (amount <= 0) {
      floatText(g, e.x, e.y - e.r - 8, 'shield', AFFIXES.shielded.color, 11);
      return 0;
    }
  }
  const dealt = Math.min(e.hp, amount);
  e.hp -= amount;
  // numbers take the colour of their damage type; "!" marks a weakness, "-" a resistance
  const label = `${Math.round(amount)}${typeMult > 1 ? '!' : typeMult < 1 ? '-' : ''}`;
  floatText(g, e.x, e.y - e.r - 8, label, crit ? '#f2c94c' : DAMAGE_TYPES[type].color, crit ? 20 : typeMult > 1 ? 15 : 13);
  burst(g, e.x, e.y, BLOOD, crit ? 6 : 2);
  if (crit) shake(g, 4);
  sfx('hit');
  if (source === 'attack') {
    const leech = g.player.buff.lifesteal + g.player.mods.lifesteal;
    if (leech > 0) healPlayer(g, Math.min(dealt * leech, g.player.stats.hp * GAME.leechCapPerHit), false);
  }
  emit(g, 'onHit', { enemy: e, amount, crit, source });
  if (e.hp <= 0) killEnemy(g, e, source);
  return dealt;
}

/** Damage of a player attack or ability with the given base and scaling stat, crit rolled from Dexterity. */
export function rollPlayerHit(g: Game, base: number, scaling: 'str' | 'dex' | 'int'): { amount: number; crit: boolean } {
  const p = g.player;
  return rollCrit(attackDamage(base, p.stats[scaling], p.buff.damage * p.mods.damage), p.stats.dex, g.rng, p.mods.crit);
}

function revive(g: Game): boolean {
  const p = g.player;
  let frac = 0;
  if (p.reviveT > 0) {
    frac = ABILITY_UPGRADES.guardianAngel.n.hp;
    p.reviveT = 0;
  } else if (p.revives > 0) {
    frac = GAME.reviveHp;
    p.revives--;
  } else return false;
  p.hp = p.stats.hp * frac;
  p.invulnT = GAME.reviveGrace;
  for (const e of g.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
    if (d < 220) {
      e.kx += ((e.x - p.x) / d) * 500 * (1 - e.def.knockbackResist);
      e.ky += ((e.y - p.y) / d) * 500 * (1 - e.def.knockbackResist);
    }
  }
  ring(g, p.x, p.y, 220, '#f2e6a0', 0.7);
  burst(g, p.x, p.y, '#f2e6a0', 50, 360);
  floatText(g, p.x, p.y - 44, 'REVIVED', '#f2e6a0', 20);
  shake(g, 16);
  sfx('levelup');
  return true;
}

export function damagePlayer(g: Game, amount: number, ignoreIFrames = false, attacker: Enemy | null = null): void {
  const p = g.player;
  if (g.over || p.invulnT > 0) return;
  if (p.invulnerable) {
    emit(g, 'onBlocked', { amount, attacker });
    return;
  }
  if (!ignoreIFrames) {
    if (p.iFrames > 0) return;
    p.iFrames = GAME.contactIFrames;
  }
  const taken = mitigate(amount * damageTakenFactor(p.statuses) * (g.vars.damageTaken ?? 1), Math.min(GAME.armorCap, p.cls.armor + p.mods.armor));
  p.hp -= taken;
  p.flash = 0.12;
  g.bossHit = true;
  floatText(g, p.x, p.y - 34, `-${Math.round(taken)}`, '#c23a2e', 15);
  shake(g, Math.min(14, 4 + taken * 0.3));
  sfx('hurt');
  if (p.hp <= 0) {
    if (p.deathless) p.hp = 1;
    else if (!revive(g)) {
      p.hp = 0;
      g.over = true;
      burst(g, p.x, p.y, BLOOD, 40, 260);
      return;
    }
  }
  emit(g, 'onDamageTaken', { amount: taken, attacker });
}

export function healPlayer(g: Game, amount: number, show = true): void {
  const p = g.player;
  if (g.breather > 0 && g.wave > 0 && g.curses.includes('noRespite')) return; // No Respite: nothing mends between waves
  const healed = Math.min(p.stats.hp - p.hp, amount);
  if (healed <= 0) return;
  p.hp += healed;
  if (show) floatText(g, p.x, p.y - 34, `+${Math.round(healed)}`, '#6f8f4e', 15);
}

export function damageMinion(g: Game, m: Minion, amount: number): void {
  m.hp -= amount;
  m.flash = 0.1;
  burst(g, m.x, m.y, '#d8d2bd', 2);
}

/** Enemies hit whatever they are fighting through this. */
export function hurtTarget(g: Game, t: Player | Minion, amount: number, ignoreIFrames = false, attacker: Enemy | null = null): void {
  const before = t.hp;
  if (t === g.player) damagePlayer(g, amount, ignoreIFrames, attacker);
  else damageMinion(g, t as Minion, amount);
  // some enemies leave something behind: wolves make you bleed, cultists set you alight, the Lich curses
  const inflicts = attacker && t.hp < before ? ENEMY_STATUS[attacker.def.id] : undefined;
  if (inflicts && t === g.player) applyStatusTo(g.player.statuses, { ...inflicts, power: (inflicts.power ?? 0) * g.waveDmgMult });
  if (attacker?.affixes.includes('vampiric') && t.hp < before) {
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + (before - t.hp) * AFFIXES.vampiric.n.heal);
  }
}

/** Auto-attack: data-driven from the class's AttackCfg, shaped by buffs and mods. */
export function updatePlayerAttack(g: Game, dt: number): void {
  const p = g.player;
  p.attackTimer -= dt;
  if (p.attackTimer > 0) return;
  const atk = p.cls.attack;
  const range = atk.kind === 'melee' ? atk.range * p.buff.range : atk.range;
  const target = nearestEnemy(g, p.x, p.y, range);
  if (!target) return;
  p.attackTimer = 1 / Math.min(GAME.maxAttackRate, p.stats.atkSpd * p.buff.atkSpd * p.mods.atkSpd);
  p.facing = Math.atan2(target.y - p.y, target.x - p.x);
  p.flip = target.x < p.x;

  if (atk.kind === 'melee') {
    const arc = p.buff.fullCircle ? TAU : atk.arc;
    swingArc(g, p.x, p.y, range, p.facing, arc, atk.color);
    sfx('swing');
    for (const e of g.hash.query(p.x, p.y, range, near)) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      if (e.dead || angleDiff(a, p.facing) > arc / 2) continue;
      const hit = rollPlayerHit(g, atk.damage, atk.scaling);
      damageEnemy(g, e, hit.amount, hit.crit, Math.cos(a) * atk.knockback, Math.sin(a) * atk.knockback, 'attack', atk.type);
    }
  } else {
    for (let i = -p.buff.multishot / 2; i <= p.buff.multishot / 2; i++) {
      const hit = rollPlayerHit(g, atk.damage, atk.scaling);
      fireProjectile(g, p.x, p.y - 6, p.facing + i * 0.18, {
        damage: hit.amount,
        crit: hit.crit,
        hostile: false,
        pierce: atk.pierce + p.mods.pierce,
        shape: atk.shape,
        color: atk.color,
        r: atk.radius,
        speed: atk.speed,
        range: atk.range * 1.3,
        dtype: atk.type,
      });
    }
    sfx('shoot');
  }
}

/** Shield bearers stop projectiles that come at their front. */
function blockedByShield(e: Enemy, vx: number, vy: number): boolean {
  if (!e.def.frontBlock) return false;
  if (e.def.wall && !e.charged) return false; // a shieldwall spearman on his own is just a man with a plank
  if (ARMOR[e.def.id]?.backBreak && e.armorHp <= 0) return false; // shield broken
  return angleDiff(Math.atan2(-vy, -vx), e.angle) < e.def.frontBlock;
}

export function updateProjectiles(g: Game, dt: number): void {
  const { w, h, wall, obstacles } = g.arena;
  const p = g.player;
  compact(g.projectiles, (pr) => {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    if (pr.life <= 0 || pr.x < wall || pr.y < wall || pr.x > w - wall || pr.y > h - wall) return false;
    for (const o of g.barriers.length ? [...obstacles, ...g.barriers] : obstacles) {
      if (dist2(pr.x, pr.y, o.x, o.y) < o.r * o.r) {
        burst(g, pr.x, pr.y, '#9a9aa0', 3, 60);
        return false;
      }
    }
    if (pr.hostile) {
      const victim = [p, ...g.minions].find((t) => dist2(pr.x, pr.y, t.x, t.y) <= (pr.r + t.r) ** 2);
      if (!victim) return true;
      hurtTarget(g, victim, pr.damage, true);
      return false;
    }
    for (const e of g.hash.query(pr.x, pr.y, pr.r, near)) {
      if (e.dead || pr.hit.includes(e)) continue;
      // mirror knight: sends it straight back, unless he has just swung (attackTimer running) or it is a ballista-sized bolt
      if (e.def.reflect && e.attackTimer <= 0 && e.armorHp > 0 && pr.pierce < 50 && angleDiff(Math.atan2(-pr.vy, -pr.vx), e.angle) < e.def.reflect) {
        Object.assign(pr, { vx: -pr.vx, vy: -pr.vy, hostile: true, damage: e.damage, color: '#7ec8d8', life: 1.2, status: null });
        floatText(g, e.x, e.y - e.r - 8, 'reflected', '#7ec8d8', 11);
        return true;
      }
      if (pr.pierce < 50 && blockedByShield(e, pr.vx, pr.vy)) {
        floatText(g, e.x, e.y - e.r - 8, 'blocked', '#9a9aa0', 11);
        burst(g, pr.x, pr.y, '#c9a227', 4, 90);
        return false;
      }
      const v = Math.hypot(pr.vx, pr.vy) || 1;
      damageEnemy(g, e, pr.damage, pr.crit, (pr.vx / v) * 60, (pr.vy / v) * 60, pr.source, pr.dtype);
      applyStatus(e, pr.status, g);
      pr.hit.push(e);
      if (pr.pierce-- <= 0) return false;
    }
    return true;
  });
}

export function updateZones(g: Game, dt: number): void {
  compact(g.zones, (z) => {
    if (z.owner?.dead) return false;
    z.t += dt;
    if (z.t < z.delay) return true;
    if (z.killsOwner && z.owner) killEnemy(g, z.owner, 'hazard');
    if (z.hostile) {
      for (const t of [g.player, ...g.minions]) {
        if (dist2(z.x, z.y, t.x, t.y) <= (z.r + t.r) ** 2) hurtTarget(g, t, z.damage, true, z.owner);
      }
      ring(g, z.x, z.y, z.r, z.color);
      burst(g, z.x, z.y, z.color, 18, 240);
      shake(g, 8);
      sfx('boom');
    } else {
      let hits = 0;
      for (const e of g.hash.query(z.x, z.y, z.r, near)) {
        if (e.dead) continue;
        damageEnemy(g, e, z.damage, z.crit, 0, 0, 'ability', z.dtype);
        applyStatus(e, z.status, g);
        if (z.maxHits > 0 && ++hits >= z.maxHits) break;
      }
      if (z.arrow) burst(g, z.x, z.y, z.color, 3, 80);
      else ring(g, z.x, z.y, z.r, z.color);
    }
    if (z.leaveField) addField(g, { x: z.x, y: z.y, r: z.r, hostile: z.hostile, ...z.leaveField });
    return false;
  });
}

export function updateFields(g: Game, dt: number): void {
  const p = g.player;
  compact(g.fields, (f) => {
    f.life -= dt;
    f.tickT -= dt;
    if (f.tickT <= 0) {
      f.tickT += GAME.fieldTick;
      const inside = dist2(f.x, f.y, p.x, p.y) <= f.r * f.r;
      if (f.hostile) {
        if (inside) {
          damagePlayer(g, f.dps * GAME.fieldTick, true);
          if (f.apply) applyStatusTo(p.statuses, f.apply);
        }
        for (const m of g.minions) if (dist2(f.x, f.y, m.x, m.y) <= f.r * f.r) damageMinion(g, m, f.dps * GAME.fieldTick);
      } else {
        if (inside && f.heal > 0) healPlayer(g, f.heal * GAME.fieldTick, false);
        for (const e of g.hash.query(f.x, f.y, f.r, near)) {
          if (e.dead) continue;
          damageEnemy(g, e, f.dps * GAME.fieldTick, false, 0, 0, 'ability', f.dtype);
          if (f.apply) applyStatus(e, { apply: [f.apply] }, g);
        }
      }
    }
    return f.life > 0;
  });
}
