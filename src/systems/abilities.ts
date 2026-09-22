import { ABILITY_UPGRADES, type AbilityUpgradeId } from '../config/abilityUpgrades';
import type { AbilityId, Cfg } from '../config/classes';
import { sfx } from '../core/audio';
import { addListener, dispatch, emit, type Handlers } from '../core/events';
import { clamp, dist2, TAU } from '../core/math';
import type { Enemy, Game, Player, Status } from '../core/types';
import { createMinion, neutralBuff } from '../entities/actors';
import { addField, addZone, after, fireProjectile } from '../entities/hazards';
import * as scale from '../logic/abilities';
import { pickAbilityUpgrade } from '../logic/abilityUpgrades';
import { abilityCooldown, attackDamage } from '../logic/formulas';
import { applyStatus, damageEnemy, healPlayer, rollPlayerHit } from './combat';
import { burst, floatText, ring, shake } from './effects';
import { feat, featAdd } from './feats';

/**
 * One hook per signature ability. A new class = a ClassDef in config/classes.ts,
 * an AbilityCfg variant, a scaling function in logic/abilities.ts and a hook here.
 * Ability upgrades (config/abilityUpgrades.ts) are branches inside their ability's hook: `has(p, id)`.
 */
interface AbilityHook<K extends AbilityId> {
  /** Return false if the cast could not happen (cooldown is not spent). */
  activate(g: Game, c: Cfg<K>): boolean;
  /** Every tick while p.abilityTime > 0. */
  tick?(g: Game, c: Cfg<K>, dt: number): void;
  /** When p.abilityTime runs out. */
  expire?(g: Game, c: Cfg<K>): void;
  /** Every tick regardless of the ability being active: passive upgrades adjust p.mods here. */
  passive?(g: Game, c: Cfg<K>): void;
  /** Reactions to combat events (only called for the class that owns the ability). */
  on?: Handlers;
  /** Current numbers for the HUD, so secondary-stat scaling is visible. */
  describe(p: Player, c: Cfg<K>): string;
  /** Radius of the cursor reticle for targeted abilities. */
  aimRadius?(p: Player, c: Cfg<K>): number;
}

const U = ABILITY_UPGRADES;
const near: Enemy[] = [];
const has = (p: Player, id: AbilityUpgradeId) => p.upgrades.includes(id);

function activeFor(p: Player, seconds: number): void {
  p.abilityTime = p.abilityDur = seconds * p.mods.abilityDur;
}

/** Arrow Volley's falling arrows, shared by the first and the (Double Volley) second salvo. */
function volleyZones(g: Game, c: Cfg<'arrowVolley'>, tx: number, ty: number, status: Status | null): void {
  const s = scale.arrowVolley(c, g.player.stats.secondary);
  for (let i = 0; i < s.arrows; i++) {
    const a = g.rng() * TAU;
    const r = Math.sqrt(g.rng()) * c.radius;
    const hit = rollPlayerHit(g, c.damage, 'dex');
    addZone(g, {
      x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r, r: c.arrowRadius,
      delay: 0.25 + (i / s.arrows) * c.duration,
      damage: hit.amount, crit: hit.crit, hostile: false, maxHits: s.pierce, arrow: true, color: '#e8e2d0', status,
    });
  }
  ring(g, tx, ty, c.radius, c.aura, c.duration);
}

function ballistaShot(g: Game, c: Cfg<'arrowVolley'>, angle: number, status: Status | null): void {
  const p = g.player;
  const n = U.ballista.n;
  const hit = rollPlayerHit(g, c.damage * scale.arrowVolley(c, p.stats.secondary).arrows * n.mult, 'dex');
  fireProjectile(g, p.x, p.y - 6, angle, { damage: hit.amount, crit: hit.crit, hostile: false, pierce: 999, shape: 'arrow', color: '#f2c94c', r: n.radius, speed: n.speed, range: n.range, status, source: 'ability' });
  shake(g, 10);
  sfx('boom');
}

const HOOKS: { [K in AbilityId]: AbilityHook<K> } = {
  divineShield: {
    activate(g, c) {
      const p = g.player;
      activeFor(p, scale.divineShield(c, p.stats.secondary).duration);
      p.invulnerable = true;
      p.absorbed = 0;
      if (has(p, 'secondWind')) healPlayer(g, p.stats.hp * U.secondWind.n.heal);
      ring(g, p.x, p.y, 60, c.aura);
      return true;
    },
    tick(g, _c, dt) {
      const p = g.player;
      const faith = p.stats.secondary;
      if (has(p, 'zeal')) p.buff.atkSpd = 1 + U.zeal.n.atkSpd + faith * U.zeal.n.perFaith;
      if (has(p, 'sanctuary')) {
        const n = U.sanctuary.n;
        healPlayer(g, n.heal * (1 + faith * n.perFaith) * dt, false);
        const crowded = g.hash.query(p.x, p.y, n.radius, near).length >= n.enemies;
        if (crowded && (g.vars.sanctuary ?? 0) < p.abilityDur * n.maxExtend) {
          p.abilityTime += dt * n.slowdown; // drains at half speed while surrounded
          g.vars.sanctuary = (g.vars.sanctuary ?? 0) + dt * n.slowdown;
        }
      }
    },
    expire(g, c) {
      const p = g.player;
      p.invulnerable = false;
      p.buff = neutralBuff();
      g.vars.sanctuary = 0;
      const radius = c.burstRadius * (has(p, 'judgement') ? U.judgement.n.radius : 1);
      const base = scale.divineShield(c, p.stats.secondary).burstDamage;
      const dmg = attackDamage(base, p.stats.str, p.mods.damage) + (has(p, 'martyr') ? p.absorbed * U.martyr.n.mult : 0);
      for (const e of g.hash.query(p.x, p.y, radius, near)) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        damageEnemy(g, e, dmg, false, Math.cos(a) * c.burstKnockback, Math.sin(a) * c.burstKnockback, 'ability', 'holy');
        if (has(p, 'judgement')) applyStatus(e, { slowMul: U.judgement.n.slow, slowT: U.judgement.n.time }, g);
      }
      ring(g, p.x, p.y, radius, c.aura, 0.5);
      burst(g, p.x, p.y, c.aura, 40, 380);
      shake(g, 14);
      sfx('boom');
    },
    on: {
      onBlocked(g, ev) {
        const p = g.player;
        p.absorbed += ev.amount;
        feat(g, 'absorb', p.absorbed);
        if (has(p, 'mirrorShield') && ev.attacker) {
          const n = U.mirrorShield.n;
          damageEnemy(g, ev.attacker, ev.amount * n.reflect * (1 + p.stats.secondary * n.perFaith), false, 0, 0, 'ability', 'holy');
        }
      },
    },
    describe(p, c) {
      const s = scale.divineShield(c, p.stats.secondary);
      return `${s.duration.toFixed(1)}s shield · ${Math.round(attackDamage(s.burstDamage, p.stats.str, p.mods.damage))} burst`;
    },
  },

  berserkerRage: {
    activate(g, c) {
      const p = g.player;
      const rage = p.stats.secondary;
      activeFor(p, scale.berserkerRage(c, rage, 1).duration);
      g.vars.frenzy = 0;
      g.vars.rageKills = 0;
      if (has(p, 'dreadHowl')) {
        const n = U.dreadHowl.n;
        for (const e of g.hash.query(p.x, p.y, n.radius, near)) if (!e.def.boss) e.fearT = n.time + rage * n.perRage;
        ring(g, p.x, p.y, n.radius, '#1a1614', 0.5);
      }
      ring(g, p.x, p.y, 70, c.aura);
      shake(g, 6);
      return true;
    },
    tick(g, c) {
      const p = g.player;
      const b = scale.berserkerRage(c, p.stats.secondary, p.hp / p.stats.hp); // re-evaluated live: lower HP = angrier
      p.buff = {
        ...neutralBuff(),
        damage: b.damage + (g.vars.frenzy ?? 0),
        atkSpd: b.atkSpd,
        lifesteal: b.lifesteal * (has(p, 'bloodthirst') ? U.bloodthirst.n.mult : 1),
        fullCircle: has(p, 'whirlwind'),
        range: has(p, 'whirlwind') ? U.whirlwind.n.range : 1,
      };
      p.deathless = has(p, 'undying');
      if (g.rng() < 0.4) burst(g, p.x, p.y - 8, c.aura, 1, 90);
    },
    expire(g) {
      const p = g.player;
      p.buff = neutralBuff();
      p.deathless = false;
      if (has(p, 'earthshaker')) {
        const n = U.earthshaker.n;
        const dmg = attackDamage(n.damage * (1 + p.stats.secondary * n.perRage), p.stats.str, p.mods.damage);
        for (const e of g.hash.query(p.x, p.y, n.radius, near)) {
          const a = Math.atan2(e.y - p.y, e.x - p.x);
          damageEnemy(g, e, dmg, false, Math.cos(a) * n.knockback, Math.sin(a) * n.knockback, 'ability');
        }
        ring(g, p.x, p.y, n.radius, '#b8322a', 0.5);
        burst(g, p.x, p.y, '#5a3d25', 40, 340);
        shake(g, 16);
        sfx('boom');
      }
    },
    on: {
      onKill(g) {
        const p = g.player;
        if (p.abilityTime <= 0) return;
        feat(g, 'rageKills', (g.vars.rageKills = (g.vars.rageKills ?? 0) + 1));
        if (!has(p, 'frenzy')) return;
        const n = U.frenzy.n;
        g.vars.frenzy = Math.min(n.cap + p.stats.secondary * n.capPerRage, (g.vars.frenzy ?? 0) + n.perKill);
      },
    },
    describe(p, c) {
      const b = scale.berserkerRage(c, p.stats.secondary, p.hp / p.stats.hp);
      const pct = (v: number) => Math.round(v * 100);
      return `${b.duration.toFixed(1)}s · +${pct(b.damage - 1)}% dmg · +${pct(b.atkSpd - 1)}% speed · ${pct(b.lifesteal)}% leech`;
    },
  },

  heavenlyRadiance: {
    activate(g, c) {
      const p = g.player;
      const grace = p.stats.secondary;
      const s = scale.heavenlyRadiance(c, grace);
      const status: Status | null = has(p, 'blindingLight') ? { slowMul: U.blindingLight.n.slow, slowT: U.blindingLight.n.time } : null;
      featAdd(g, 'radiance', healPlayer(g, attackDamage(s.heal, p.stats.int)));
      const dmg = attackDamage(c.damage, p.stats.int, p.mods.damage);
      let slain = 0;
      for (const e of g.hash.query(p.x, p.y, s.radius, near)) {
        damageEnemy(g, e, dmg, false, 0, 0, 'ability', 'holy');
        applyStatus(e, status, g);
        if (e.dead) slain++;
      }
      if (has(p, 'benediction')) g.vars.cdRefund = Math.min(U.benediction.n.cap, slain * U.benediction.n.refund);
      if (has(p, 'twinPulse')) addZone(g, { x: p.x, y: p.y, r: s.radius, delay: U.twinPulse.n.delay, damage: dmg * U.twinPulse.n.mult, hostile: false, color: c.aura, status, dtype: 'holy' });
      if (has(p, 'consecration')) {
        const n = U.consecration.n;
        addField(g, { x: p.x, y: p.y, r: s.radius * n.radius, life: n.time, dps: attackDamage(n.dps, p.stats.int, p.mods.damage), heal: n.heal + grace * n.healPerGrace, hostile: false, color: c.aura, dtype: 'holy' });
      }
      if (has(p, 'guardianAngel')) p.reviveT = U.guardianAngel.n.time + grace * U.guardianAngel.n.perGrace;
      activeFor(p, has(p, 'ascension') ? U.ascension.n.time + grace * U.ascension.n.perGrace : 0.4);
      ring(g, p.x, p.y, s.radius, c.aura, 0.5);
      burst(g, p.x, p.y, c.aura, 36, s.radius * 2);
      shake(g, 8);
      return true;
    },
    tick(g) {
      if (has(g.player, 'ascension')) g.player.buff.multishot = U.ascension.n.bolts;
    },
    expire: (g) => void (g.player.buff = neutralBuff()),
    describe(p, c) {
      const s = scale.heavenlyRadiance(c, p.stats.secondary);
      return `heal ${Math.round(attackDamage(s.heal, p.stats.int))} · radius ${Math.round(s.radius)}`;
    },
  },

  raiseDead: {
    activate(g, c) {
      const p = g.player;
      const s = scale.raiseDead(c, p.stats.secondary);
      const golems = has(p, 'boneGolems');
      const max = (golems ? Math.ceil(s.maxMinions / U.boneGolems.n.divisor) : s.maxMinions) + p.mods.minionMax;
      const slots = max - g.minions.length;
      if (slots <= 0) return false;
      const corpses = g.corpses.sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y)).splice(0, slots);
      // no fresh corpses (start of a run, boss duel): claw one skeleton out of the ground itself. Endless Legion: more.
      const free = Math.min(slots, has(p, 'endlessLegion') ? U.endlessLegion.n.free : 1);
      for (let i = corpses.length; i < free; i++) corpses.push({ x: p.x + 30 - i * 60, y: p.y + 10, t: 0 });
      for (const at of corpses) {
        g.minions.push(
          createMinion(at.x, at.y, {
            hp: c.minionHp * (golems ? U.boneGolems.n.hp : 1),
            damage: attackDamage(s.damage, p.stats.int) * (golems ? U.boneGolems.n.damage : 1),
            speed: c.minionSpeed * (golems ? 0.8 : 1),
            attackCd: c.minionAttackCd,
            life: s.lifetime,
            r: golems ? U.boneGolems.n.radius : undefined,
            scale: golems ? U.boneGolems.n.scale : undefined,
            volatile: has(p, 'volatileBones') ? U.volatileBones.n.mult : 0,
            status: has(p, 'graveChill') ? { slowMul: U.graveChill.n.slow, slowT: U.graveChill.n.time } : null,
          }),
        );
        ring(g, at.x, at.y, golems ? 50 : 30, c.aura);
        burst(g, at.x, at.y, c.aura, 10);
      }
      activeFor(p, 0.4);
      feat(g, 'minions', g.minions.length);
      floatText(g, p.x, p.y - 40, `${corpses.length} risen`, c.aura, 15);
      return true;
    },
    passive(g) {
      const p = g.player;
      if (has(p, 'boneArmor')) p.mods.armor += g.minions.length * U.boneArmor.n.armor;
      if (has(p, 'frenziedDead')) p.mods.minionAtkSpd *= U.frenziedDead.n.mult;
    },
    describe(p, c) {
      const s = scale.raiseDead(c, p.stats.secondary);
      const golems = has(p, 'boneGolems');
      const max = (golems ? Math.ceil(s.maxMinions / U.boneGolems.n.divisor) : s.maxMinions) + p.mods.minionMax;
      const dmg = attackDamage(s.damage, p.stats.int) * (golems ? U.boneGolems.n.damage : 1) * p.mods.minionDamage;
      return `max ${max} ${golems ? 'golems' : 'skeletons'} · ${Math.round(dmg)} dmg · ${s.lifetime.toFixed(0)}s`;
    },
  },

  arrowVolley: {
    activate(g, c) {
      const p = g.player;
      // clamp the target point to cast range
      const dx = g.input.aimX - p.x;
      const dy = g.input.aimY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = clamp(d, 0, c.castRange) / d;
      const tx = p.x + dx * k;
      const ty = p.y + dy * k;
      const angle = Math.atan2(dy, dx);
      const status: Status = {};
      if (has(p, 'pinning')) Object.assign(status, { slowMul: U.pinning.n.slow, slowT: U.pinning.n.time });
      if (has(p, 'markedForDeath')) Object.assign(status, { markMul: U.markedForDeath.n.mult, markT: U.markedForDeath.n.time });

      feat(g, 'volleyHits', g.hash.query(tx, ty, c.radius, near).length); // what the volley comes down on; the arrows land over the next second
      const fire = has(p, 'ballista') ? () => ballistaShot(g, c, angle, status) : () => volleyZones(g, c, tx, ty, status);
      fire();
      if (has(p, 'doubleVolley')) after(g, U.doubleVolley.n.delay, fire);
      if (has(p, 'burningRain')) {
        const n = U.burningRain.n;
        const dps = attackDamage(n.dps * (1 + p.stats.secondary * n.perFocus), p.stats.dex, p.mods.damage);
        after(g, c.duration * 0.5, () => addField(g, { x: tx, y: ty, r: c.radius, life: n.time, dps, hostile: false, color: '#e07b28', dtype: 'fire', apply: { id: 'burn', power: dps * 0.25 } }));
      }
      activeFor(p, has(p, 'quickDraw') ? U.quickDraw.n.time : 0.3);
      return true;
    },
    tick(g) {
      if (has(g.player, 'quickDraw')) g.player.buff.atkSpd = 1 + U.quickDraw.n.atkSpd;
    },
    expire: (g) => void (g.player.buff = neutralBuff()),
    describe(p, c) {
      const s = scale.arrowVolley(c, p.stats.secondary);
      return has(p, 'ballista') ? `1 bolt = ${Math.round(s.arrows * U.ballista.n.mult * 10) / 10} arrows · pierces all` : `${s.arrows} arrows · pierce ${s.pierce}`;
    },
    aimRadius: (p, c) => (has(p, 'ballista') ? 14 : c.radius),
  },
};

// The config's `id` picks the hook, so passing that same config back in is always the right type.
function hookFor(p: Player): { hook: AbilityHook<AbilityId>; cfg: Cfg<AbilityId> } {
  return { hook: HOOKS[p.cls.ability.id] as unknown as AbilityHook<AbilityId>, cfg: p.cls.ability };
}

addListener((g, name, ev) => dispatch(hookFor(g.player).hook.on, g, name, ev));

export function updateAbility(g: Game, dt: number): void {
  const p = g.player;
  const { hook, cfg } = hookFor(p);
  if (p.abilityTime > 0) {
    p.abilityTime -= dt;
    hook.tick?.(g, cfg, dt);
    if (p.abilityTime <= 0) {
      p.abilityTime = 0;
      hook.expire?.(g, cfg);
    }
  }
  p.reviveT = Math.max(0, p.reviveT - dt);
  // the cooldown waits for the ability to end, so duration stacking can never reach 100% uptime
  if (p.abilityTime <= 0) p.abilityCd = Math.max(0, p.abilityCd - dt);
  if (g.input.ability && p.abilityCd <= 0 && p.abilityTime <= 0) {
    g.vars.cdRefund = 0;
    if (!hook.activate(g, cfg)) return;
    const upgradeMult = has(p, 'secondWind') ? U.secondWind.n.cooldown : 1;
    const cooldown = abilityCooldown(cfg.cooldown, p.stats.int) * p.mods.cooldown * p.mods.abilityCd * upgradeMult * (1 - (g.vars.cdRefund ?? 0));
    p.abilityCd = p.abilityCdMax = cooldown;
    sfx('ability');
    emit(g, 'onAbilityUsed', { cooldown });
  }
}

/** Passive ability upgrades adjust p.mods; runs every tick after relics. */
export function abilityPassives(g: Game): void {
  const { hook, cfg } = hookFor(g.player);
  hook.passive?.(g, cfg);
}

/** Resolve the first queued tier choice. Invalid picks (wrong class/tier, tier already taken) are ignored. */
export function chooseAbilityUpgrade(g: Game, id: AbilityUpgradeId): boolean {
  const p = g.player;
  const next = pickAbilityUpgrade(p.upgrades, p.cls.id, g.pendingAbilityTiers[0], id);
  if (next === p.upgrades) return false;
  p.upgrades = next;
  g.pendingAbilityTiers.shift();
  floatText(g, p.x, p.y - 50, ABILITY_UPGRADES[id].name, p.cls.ability.aura, 17);
  ring(g, p.x, p.y, 110, p.cls.ability.aura, 0.6);
  return true;
}

export function describeAbility(p: Player): string {
  const { hook, cfg } = hookFor(p);
  return hook.describe(p, cfg);
}

export function abilityAimRadius(p: Player): number {
  const { hook, cfg } = hookFor(p);
  return hook.aimRadius?.(p, cfg) ?? 0;
}
