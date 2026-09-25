import { credit, relicContext } from './relicContext';
import { ATTUNEMENT, FAMILIES, isFamily, RELIC_COLOR, type RelicKey } from '../config/relics';
import { addWork } from '../logic/relics';
import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import { ARMOR, ARMOR_WEAR, DAMAGE_TYPES, ENEMY_STATUS, STATUSES, type DamageType } from '../config/damage';
import { AFFIXES, ELITES } from '../config/elites';
import { GOLD } from '../config/economy';
import { GAME, RENDER, SKILL } from '../config/game';
import { ROUTES } from '../config/routes';
import { MODIFIERS } from '../config/waves';
import { sfx } from '../sim/view';
import { emit } from '../core/events';
import { angleDiff, compact, dist2, TAU } from '../core/math';
import type { Body, DamageSource, Enemy, Game, Minion, Player, Projectile, Status } from '../core/types';
import { addField, fireProjectile, recycleProjectile } from '../entities/hazards';
import { goldDrop } from '../logic/economy';
import { inRects } from '../logic/regions';
import { attackDamage, mitigate, rollCrit, healFactor } from '../logic/formulas';
import { applyStatusTo, curseStacks, damageTakenFactor, fromBehind, slowStacks, throughArmor, throughResolve, typeMultiplier, type StatusApply } from '../logic/status';
import { burst, damageNumber, floatText, ring, shake, swingArc } from './effects';
import { tauntedDamageMult } from './utility';
import { lastStand, zoneStruck } from './dodge';
import { isPlayer, withPlayer } from '../logic/players';
import { spawnEnemy } from './spawning';

const BLOOD = '#8e1b1b';
const near: Enemy[] = []; // scratch for the loops in this file
const SEEK_TURN = 6; // v0.6: radians a second a seeking bolt can turn
const nearest: Enemy[] = []; // nearestEnemy's own scratch: it may be called from inside those loops

/** `exclude`: one enemy, or every enemy a chain has already hit (so it never bounces back A→B→A). */
export function nearestEnemy(g: Game, x: number, y: number, range: number, exclude?: Enemy | readonly Enemy[]): Enemy | null {
  let best: Enemy | null = null;
  let bestD = Infinity;
  for (const e of g.hash.query(x, y, range, nearest)) {
    if (e.dead || e.hidden || e.warded || e === exclude || (Array.isArray(exclude) && exclude.includes(e))) continue; // v0.6: nothing auto-targets a warded enemy (hitting it does nothing)
    const d = dist2(x, y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function goldMult(g: Game): number {
  return g.player.mods.gold * g.tier.gold * (g.vars.curseMult ?? 1) * (g.modifier === 'bloodMoon' ? MODIFIERS.bloodMoon.n.gold : 1) * (g.route?.focus === 'merchant' ? ROUTES.merchant.gold : 1);
}

export function killEnemy(g: Game, e: Enemy, source: DamageSource = 'attack'): void {
  if (e.dead) return;
  e.dead = true;
  g.kills++;
  const boss = e.def.boss;
  g.pickups.push({ x: e.x, y: e.y, value: e.xp, kind: 'xp' });
  const gold = goldDrop(e.def.xp, boss ? 'boss' : e.elite ? 'elite' : 'regular', g.rng, goldMult(g), ELITES.goldMult * g.eliteGold);
  if (gold > 0) g.pickups.push({ x: e.x + 8, y: e.y + 6, value: gold, kind: 'gold' });
  if (e.def.aura || e.def.onDeath) {
    // commanders are worth hunting: a bounty on top of the normal drop
    g.commandersKilled++;
    g.pickups.push({ x: e.x - 6, y: e.y + 8, value: Math.round((e.def.bonusGold ?? 0) * goldMult(g)), kind: 'gold' });
  }
  g.corpses.push({ x: e.x, y: e.y, t: 0 });
  burst(g, e.x, e.y, BLOOD, boss ? 60 : e.elite ? 20 : 8, boss ? 320 : 150);
  sfx(g, boss ? 'boom' : 'kill');

  if (g.modifier === 'plague' && !boss) {
    const n = MODIFIERS.plague.n;
    addField(g, { x: e.x, y: e.y, r: n.radius, life: n.life, dps: n.dps * g.waveDmgMult * g.tier.enemyDmg, hostile: true, color: '#6f8f4e' });
  }
  if (e.elite) {
    g.elitesKilled++;
    ring(g, e.x, e.y, 90, AFFIXES[e.affixes[0]].color, 0.5);
    // v0.7: elites no longer drop relics (relics come at fixed moments, RELICS.md); their gold and the attunement they give stay
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
    g.player.gold += Math.round((GOLD.bossBonus + g.bossGold) * goldMult(g));
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
  // v0.7 set bonuses on every status the player puts on an enemy: Flame's Stoked, Frost's Biting Cold, Blood's Open Wounds
  // ponytail: the player is g.player; with co-op the status has to say whose it is
  if (g && relicContext.acting) addWork(g.player.relics, relicContext.acting, ATTUNEMENT.proc); // A4: a relic's status is work
  const sets = g?.player.relics.sets;
  if (sets) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.id === 'burn' && (sets.flame?.level ?? 0) >= 2) list[i] = { ...a, max: STATUSES.burn.maxStacks + FAMILIES.flame.n.stacksBonus, power: (a.power ?? 0) * (1 + FAMILIES.flame.n.burnPerS * g!.player.stats.secondary) };
      else if (a.id === 'slow' && (sets.frost?.level ?? 0) >= 2) list[i] = { ...a, stacks: Math.ceil((a.stacks ?? 1) * FAMILIES.frost.n.chillMult) };
      else if (a.id === 'bleed' && (sets.blood?.level ?? 0) >= 2) list[i] = { ...a, stacks: (a.stacks ?? 1) + FAMILIES.blood.n.extraStacks };
    }
  }
  for (const a of list) {
    if (a.id === 'fear') {
      if (!e.def.boss) e.fearT = Math.max(e.fearT, a.time ?? STATUSES.fear.duration);
    } else if (applyStatusTo(e.statuses, a, e.def.boss) === 'frozen' && g) {
      floatText(g, e.x, e.y - e.r - 20, 'FROZEN', STATUSES.slow.color, 14);
      e.frozenT = g.time + (e.statuses.stun?.time ?? 0); // v0.7: Frost reads it
      emit(g, 'onFreeze', { enemy: e });
    }
    const s = e.statuses[a.id] ?? (a.id === 'slow' ? e.statuses.stun : undefined); // a chill that tipped over is a freeze now
    if (s && (!s.by || (relicContext.acting && !isFamily(relicContext.acting)))) s.by = relicContext.acting ?? undefined; // v0.7: whose it is (a burn's ticks, a curse's extra damage, a freeze's shatter): a relic takes it over, a set bonus spreading it does not (A8)
  }
}

/**
 * Returns the damage that reached the enemy's HP. kx/ky is a knockback impulse, and also tells which way the hit travelled.
 * Order: resistance / weakness -> Cursed -> elite barrier -> armor -> HP.
 */
export function damageEnemy(g: Game, e: Enemy, amount: number, crit = false, kx = 0, ky = 0, source: DamageSource = 'attack', type: DamageType = 'physical'): number {
  if (e.dead) return 0;
  if (e.warded) {
    if (e.flash <= 0) floatText(g, e.x, e.y - e.r - 20, 'WARDED', '#e9c95a', 14); // at most once per flash, or it floods the screen
    e.flash = 0.25;
    return 0;
  }
  const typeMult = typeMultiplier(e.def.id, type);
  const chill = e.statuses.slow?.by ? 1 + e.statuses.slow.stacks * FAMILIES.frost.n.chillVuln : 0; // v0.7 A8: a relic's chill: +4% damage taken per stack
  amount *= typeMult * damageTakenFactor(e.statuses) * (chill || 1);
  if (e.def.boss && source !== 'hazard') amount *= g.player.mods.bossDamage;
  const armor = ARMOR[e.def.id];
  if (armor && e.armorHp > 0) {
    if (armor.backBreak) {
      // a shield: only hits from behind wear it down, and those go straight through
      // ...and only hits from the front are turned by it: area damage (no direction) ignores the shield
      if (fromBehind(kx, ky, e.angle)) e.armorHp -= amount;
      else if (kx !== 0 || ky !== 0) amount *= 1 - armor.reduction;
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
  if (e.def.boss) {
    // v0.7.5 (#95): a boss's resolve: a burst past its allowance does a fraction, so one ability cannot end the fight (status ticks included)
    const r = throughResolve(amount, e.maxHp, e.resolve, e.resolveT, g.time);
    amount = r.dealt;
    e.resolve = r.load;
    e.resolveT = g.time;
  }
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
  const dealt = Math.max(0, Math.min(e.hp - e.hpFloor, amount));
  const curse = e.statuses.curse; // v0.7: what a relic's curse added is that relic's work
  if (curse?.by && dealt > 0) credit(g, g.player, curse.by as RelicKey, 'damage', dealt * (1 - 1 / damageTakenFactor(e.statuses)));
  if (chill && dealt > 0) credit(g, g.player, e.statuses.slow!.by as RelicKey, 'damage', dealt * (1 - 1 / chill)); // ...and a relic's chill (Frost, A8)
  e.hp = Math.max(e.hpFloor, e.hp - amount); // v0.6: a boss phase that has not run its course holds at its threshold
  // numbers take the colour of their damage type; "!" marks a weakness, "-" a resistance
  damageNumber(g, e, amount, crit ? '#f2c94c' : source === 'relic' && relicContext.acting ? RELIC_COLOR : DAMAGE_TYPES[type].color, crit ? 20 : typeMult > 1 ? 15 : 13, typeMult > 1 ? '!' : typeMult < 1 ? '-' : '');
  burst(g, e.x, e.y, BLOOD, crit ? 6 : 2);
  if (crit) shake(g, 4);
  sfx(g, 'hit');
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
  const hit = rollCrit(attackDamage(base, p.stats[scaling], p.buff.damage * p.mods.damage), p.stats.dex, g.rng, p.mods.crit);
  if (hit.crit && p.mods.critDamage > 0) hit.amount *= (GAME.critMult + p.mods.critDamage) / GAME.critMult;
  return hit;
}

function revive(g: Game): boolean {
  const p = g.player;
  let frac = 0;
  if (p.reviveT > 0) {
    frac = ABILITY_UPGRADES.guardianAngel.n.hp;
    p.reviveT = 0;
  } else if (p.revives > 0) {
    frac = g.vars['phoenix.hp'] ?? GAME.reviveHp; // v0.7: Phoenix Feather's tier
    p.revives--;
    emit(g, 'onRevive', {});
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
  sfx(g, 'levelup');
  return true;
}

/** `cause` names what hurt when it was not an enemy (the run log's cause of death). */
export function damagePlayer(g: Game, amount: number, ignoreIFrames = false, attacker: Enemy | null = null, cause = 'something unseen'): void {
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
  if (p.mods.dodge > 0 && g.rng() < Math.min(GAME.dodgeCap, p.mods.dodge)) {
    floatText(g, p.x, p.y - 34, 'dodge', '#f2e6a0', 13);
    return;
  }
  // v0.7: relics may shrink the hit or block it (Steel, Frost, Grave); a blocked hit does nothing, but blocking is an event of its own
  const incoming = { amount, attacker, blocked: false };
  emit(g, 'onIncoming', incoming);
  if (incoming.blocked) {
    floatText(g, p.x, p.y - 34, 'BLOCK', '#a8b0bc', 14);
    emit(g, 'onBlock', { amount, attacker });
    return;
  }
  let taken = mitigate(incoming.amount * damageTakenFactor(p.statuses) * (g.vars.damageTaken ?? 1) * tauntedDamageMult(g, attacker), Math.min(GAME.armorCap, p.cls.armor + p.mods.armor));
  if (p.ward > 0) {
    // v0.7 ward (Holy): it takes the hit first
    const soak = Math.min(p.ward, taken);
    p.ward -= soak;
    taken -= soak;
  }
  p.hp -= taken;
  p.flash = 0.12;
  g.bossHit = true;
  floatText(g, p.x, p.y - 34, `-${Math.round(taken)}`, '#c23a2e', 15);
  shake(g, Math.min(14, 4 + taken * 0.3));
  sfx(g, 'hurt');
  if (p.hp <= 0) {
    if (p.deathless) p.hp = 1;
    else if (!revive(g) && !lastStand(g)) {
      p.hp = 0;
      g.over = true;
      g.log.cause = attacker ? `${attacker.elite ? 'elite ' : ''}${attacker.def.name}` : cause;
      burst(g, p.x, p.y, BLOOD, 40, 260);
      return;
    }
  }
  emit(g, 'onDamageTaken', { amount: taken, attacker });
}

/** Returns the HP actually restored (0 when already full or healing is blocked), which the class feats count. */
export function healPlayer(g: Game, amount: number, show = true): number {
  const p = g.player;
  if (g.breather > 0 && g.wave > 0 && g.curses.includes('noRespite')) return 0; // No Respite: nothing mends between waves
  const heal = amount * healFactor(g.wave) * (g.vars.relicHealMult ?? 1); // v0.5: sustain fades past wave 30; v0.7: Blessed Water
  const healed = Math.min(p.stats.hp - p.hp, heal);
  if (heal > 0) emit(g, 'onHeal', { amount: Math.max(0, healed), over: heal - Math.max(0, healed) }); // v0.7: Holy turns overhealing into ward and pulses
  if (healed <= 0) return 0;
  p.hp += healed;
  g.vars.healed = (g.vars.healed ?? 0) + healed; // v0.7: the denominator of the relics' healing share (RELICS.md)
  if (show) floatText(g, p.x, p.y - 34, `+${Math.round(healed)}`, '#6f8f4e', 15);
  return healed;
}

export function damageMinion(g: Game, m: Minion, amount: number): void {
  m.hp -= amount;
  m.flash = 0.1;
  burst(g, m.x, m.y, '#d8d2bd', 2);
}

/** Enemies hit whatever they are fighting through this. */
export function hurtTarget(g: Game, t: Player | Minion, amount: number, ignoreIFrames = false, attacker: Enemy | null = null, cause?: string): void {
  const before = t.hp;
  const player = isPlayer(g, t); // v0.8 (#28): any player, hurt with the focus on them
  if (player) withPlayer(g, t, () => damagePlayer(g, amount, ignoreIFrames, attacker, cause));
  else damageMinion(g, t as Minion, amount);
  // some enemies leave something behind: wolves make you bleed, cultists set you alight, the Lich curses
  const inflicts = attacker && t.hp < before ? ENEMY_STATUS[attacker.def.id] : undefined;
  if (inflicts && player) applyStatusTo(t.statuses, { ...inflicts, power: (inflicts.power ?? 0) * g.waveDmgMult * g.tier.enemyDmg });
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
  // v0.7.5 (#81): with manual aim the attack still waits for an enemy in reach, but goes where the player aims
  const { aimX, aimY, manualAim } = g.input;
  const aimed = !!manualAim && (aimX !== p.x || aimY !== p.y);
  const target = atk.kind === 'melee' || aimed ? nearestEnemy(g, p.x, p.y, range) : shotTarget(g, p.x, p.y, range);
  if (!target) return;
  const to = aimed ? { x: aimX, y: aimY } : target;
  p.attackTimer = 1 / Math.min(GAME.maxAttackRate, p.stats.atkSpd * p.buff.atkSpd * p.mods.atkSpd);
  p.facing = Math.atan2(to.y - p.y, to.x - p.x);
  p.flip = to.x < p.x;

  if (atk.kind === 'melee') {
    const arc = p.buff.fullCircle ? TAU : atk.arc;
    swingArc(g, p.x, p.y, range, p.facing, arc, atk.color);
    sfx(g, 'swing');
    for (const e of g.hash.query(p.x, p.y, range, near)) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      if (e.dead || angleDiff(a, p.facing) > arc / 2) continue;
      const hit = rollPlayerHit(g, atk.damage, atk.scaling);
      damageEnemy(g, e, hit.amount, hit.crit, Math.cos(a) * atk.knockback, Math.sin(a) * atk.knockback, 'attack', atk.type);
    }
  } else {
    // v0.5 the Bow of the Wild Hunt (systems/treasures.ts sets splitEvery): every n-th shot splits into three
    const every = g.vars.splitEvery ?? 0;
    const shots = p.buff.multishot + (every > 0 && (g.vars.shots = (g.vars.shots ?? 0) + 1) % every === 0 ? 2 : 0);
    for (let i = -shots / 2; i <= shots / 2; i++) {
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
    sfx(g, 'shoot');
  }
}

/** A mirror knight throws a projectile coming at his front back, unless he has just swung (attackTimer) or his armor is broken. */
const reflects = (e: Enemy, vx: number, vy: number): boolean =>
  !!e.def.reflect && e.attackTimer <= 0 && e.armorHp > 0 && angleDiff(Math.atan2(-vy, -vx), e.angle) < e.def.reflect;

/** v0.7.3 (#59): would this enemy block or throw back a projectile shot at it from (x, y)? */
export const stopsShot = (e: Enemy, x: number, y: number): boolean => reflects(e, e.x - x, e.y - y) || blockedByShield(e, e.x - x, e.y - y);

/**
 * v0.7.3 (#59): the ranged auto-attack's target: the nearest enemy the shot can hurt. A front-facing shield bearer or mirror knight is only shot
 * at when nothing else is in reach (v0.7.5, #92: the shot wears his shield or mirror down until it breaks).
 */
function shotTarget(g: Game, x: number, y: number, range: number): Enemy | null {
  let best: Enemy | null = null;
  let fallback: Enemy | null = null;
  let bestD = Infinity;
  let fallbackD = Infinity;
  for (const e of g.hash.query(x, y, range, nearest)) {
    if (e.dead || e.hidden || e.warded) continue;
    const d = dist2(x, y, e.x, e.y);
    if (!stopsShot(e, x, y)) {
      if (d < bestD) (bestD = d), (best = e);
    } else if (d < fallbackD) (fallbackD = d), (fallback = e);
  }
  return best ?? fallback;
}

/** v0.7.3 (#59): a blocked or thrown-back shot costs the shield or mirror its damage (times ARMOR_WEAR); at 0 it breaks. */
function wearArmor(g: Game, e: Enemy, amount: number): void {
  if (e.armorHp <= 0) return;
  e.armorHp = Math.max(0, e.armorHp - amount);
  if (e.armorHp === 0) floatText(g, e.x, e.y - e.r - 20, e.def.reflect ? 'mirror broken' : 'shield broken', '#e9c95a', 13);
}

/** Shield bearers stop projectiles that come at their front. */
function blockedByShield(e: Enemy, vx: number, vy: number): boolean {
  if (!e.def.frontBlock) return false;
  if (e.def.wall && !e.charged) return false; // a shieldwall spearman on his own is just a man with a plank
  if (ARMOR[e.def.id]?.backBreak && e.armorHp <= 0) return false; // shield broken
  return angleDiff(Math.atan2(-vy, -vx), e.angle) < e.def.frontBlock;
}

/** Projectile step. No per-projectile allocation: the dead go back to the pool, hostile hits scan minions in place. */
export function updateProjectiles(g: Game, dt: number): void {
  const { obstacles } = g.arena;
  compact(g.projectiles, (pr) => {
    const alive = stepProjectile(g, pr, dt, obstacles);
    if (!alive) recycleProjectile(pr);
    return alive;
  });
}

function stepProjectile(g: Game, pr: Projectile, dt: number, obstacles: readonly Body[]): boolean {
  if (pr.seek && !pr.hostile) {
    // v0.6: a seeking bolt (Soul Harvest) turns toward the nearest enemy, at most SEEK_TURN radians a second
    const e = nearestEnemy(g, pr.x, pr.y, 420);
    if (e) {
      const want = Math.atan2(e.y - pr.y, e.x - pr.x);
      const have = Math.atan2(pr.vy, pr.vx);
      const turn = Math.max(-SEEK_TURN * dt, Math.min(SEEK_TURN * dt, Math.atan2(Math.sin(want - have), Math.cos(want - have))));
      const v = Math.hypot(pr.vx, pr.vy);
      pr.vx = Math.cos(have + turn) * v;
      pr.vy = Math.sin(have + turn) * v;
    }
  }
  pr.x += pr.vx * dt;
  pr.y += pr.vy * dt;
  pr.life -= dt;
  if (pr.life <= 0 || !inRects(g.openRects, pr.x, pr.y)) return false; // v0.5: walls are wherever the open map ends
  for (const o of obstacles) if (dist2(pr.x, pr.y, o.x, o.y) < o.r * o.r) return (burst(g, pr.x, pr.y, '#9a9aa0', 3, 60), false);
  for (const o of g.barriers) if (dist2(pr.x, pr.y, o.x, o.y) < o.r * o.r) return (burst(g, pr.x, pr.y, '#9a9aa0', 3, 60), false);
  if (pr.hostile) {
    for (const q of g.players) if (dist2(pr.x, pr.y, q.x, q.y) <= (pr.r + q.r) ** 2) return (hurtTarget(g, q, pr.damage, true, null, pr.dtype === 'physical' ? 'an arrow' : `a bolt of ${DAMAGE_TYPES[pr.dtype].name.toLowerCase()}`), false); // v0.8 (#28): any player
    for (const m of g.minions) if (dist2(pr.x, pr.y, m.x, m.y) <= (pr.r + m.r) ** 2) return (hurtTarget(g, m, pr.damage, true), false);
    return true;
  }
  for (const e of g.hash.query(pr.x, pr.y, pr.r, near)) {
    if (e.dead || pr.hit.includes(e)) continue;
    // mirror knight: sends it straight back, unless he has just swung (attackTimer running) or it is a ballista-sized bolt
    if (pr.pierce < 50 && reflects(e, pr.vx, pr.vy)) {
      wearArmor(g, e, pr.damage * ARMOR_WEAR.reflect); // v0.7.3 (#59): every throw-back costs the mirror
      pr.vx = -pr.vx;
      pr.vy = -pr.vy;
      pr.hostile = true;
      pr.damage = e.damage;
      pr.color = '#7ec8d8';
      pr.life = 1.2;
      pr.status = null;
      floatText(g, e.x, e.y - e.r - 8, 'reflected', '#7ec8d8', 11);
      return true;
    }
    if (pr.pierce < 50 && blockedByShield(e, pr.vx, pr.vy)) {
      wearArmor(g, e, pr.damage * ARMOR_WEAR.block); // v0.7.3 (#59): a blocked shot wears the shield down
      floatText(g, e.x, e.y - e.r - 8, 'blocked', '#9a9aa0', 11);
      burst(g, pr.x, pr.y, '#c9a227', 4, 90);
      return false;
    }
    const v = Math.hypot(pr.vx, pr.vy) || 1;
    const outer = relicContext.acting;
    if (pr.by) relicContext.acting = pr.by; // a relic's bolt lands after its hook: its damage is still the relic's (A4)
    damageEnemy(g, e, pr.damage, pr.crit, (pr.vx / v) * 60, (pr.vy / v) * 60, pr.source, pr.dtype);
    relicContext.acting = outer;
    applyStatus(e, pr.status, g);
    pr.hit.push(e);
    if (pr.pierce-- <= 0) return false;
  }
  return true;
}

export function updateZones(g: Game, dt: number): void {
  compact(g.zones, (z) => {
    if (z.owner?.dead) return false;
    z.t += dt;
    // ponytail: the perfect dodge (lastIn, zoneStruck) still watches only the first player; per-player when dodge state moves onto Player
    const p = g.players[0];
    const inside = z.hostile && dist2(z.x, z.y, p.x, p.y) <= (z.r + p.r) ** 2;
    if (z.t < z.delay) {
      if (inside && z.delay >= SKILL.perfect.minDelay) z.lastIn = g.time; // v0.6: the perfect dodge watches who stood in it
      return true;
    }
    if (z.killsOwner && z.owner) killEnemy(g, z.owner, 'hazard');
    if (z.hostile) {
      if (z.delay >= SKILL.perfect.minDelay) zoneStruck(g, z.lastIn, inside);
      for (const q of g.players) if (dist2(z.x, z.y, q.x, q.y) <= (z.r + q.r) ** 2) hurtTarget(g, q, z.damage, true, z.owner); // v0.8 (#28): every player in it
      for (const m of g.minions) if (dist2(z.x, z.y, m.x, m.y) <= (z.r + m.r) ** 2) hurtTarget(g, m, z.damage, true, z.owner);
      ring(g, z.x, z.y, z.r, z.color);
      burst(g, z.x, z.y, z.color, 18, 240);
      shake(g, 8);
      sfx(g, 'boom');
    } else {
      let hits = 0;
      for (const e of g.hash.query(z.x, z.y, z.r, near)) {
        if (e.dead) continue;
        damageEnemy(g, e, z.damage, z.crit, 0, 0, z.source, z.dtype);
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
    if (f.follow) (f.x = p.x), (f.y = p.y); // v0.6 evolutions: a dome that moves with you, a sun that drifts
    else if (f.vx || f.vy) (f.x += (f.vx ?? 0) * dt), (f.y += (f.vy ?? 0) * dt);
    f.tickT -= dt;
    if (f.tickT <= 0) {
      f.tickT += GAME.fieldTick;
      if (f.hostile) {
        // v0.8 (#28): every player standing in it
        for (const q of g.players) {
          if (dist2(f.x, f.y, q.x, q.y) > f.r * f.r) continue;
          withPlayer(g, q, () => damagePlayer(g, f.dps * GAME.fieldTick, true, null, `${DAMAGE_TYPES[f.dtype].name.toLowerCase()} on the ground`));
          if (f.apply) applyStatusTo(q.statuses, f.apply);
        }
        for (const m of g.minions) if (dist2(f.x, f.y, m.x, m.y) <= f.r * f.r) damageMinion(g, m, f.dps * GAME.fieldTick);
      } else {
        if (f.heal > 0) for (const q of g.players) if (dist2(f.x, f.y, q.x, q.y) <= f.r * f.r) withPlayer(g, q, () => healPlayer(g, f.heal * GAME.fieldTick, false));
        for (const e of g.hash.query(f.x, f.y, f.r, near)) {
          if (e.dead) continue;
          const outer = relicContext.acting;
          relicContext.acting = f.by ?? outer; // a relic's field (Scorched Earth) credits its relic
          damageEnemy(g, e, f.dps * GAME.fieldTick, false, 0, 0, f.by ? 'relic' : 'ability', f.dtype);
          if (f.apply) applyStatus(e, { apply: [f.apply] }, g);
          relicContext.acting = outer;
        }
      }
    }
    return f.life > 0;
  });
  // the oldest go past the cap (a Plague wave would otherwise carpet the arena); trimmed here, never while the loop above runs
  if (g.fields.length > RENDER.maxFields) g.fields.splice(0, g.fields.length - RENDER.maxFields);
}
