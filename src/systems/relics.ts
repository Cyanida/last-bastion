import { BOSS_RELIC_CHOICES, RELIC_DAMAGE_PER_LEVEL, RELICS, relicDef, type RelicId } from '../config/relics';
import { sfx } from '../core/audio';
import { addListener, dispatch, type GameEvents, type Handlers } from '../core/events';
import { TAU } from '../core/math';
import type { Game } from '../core/types';
import { createMinion } from '../entities/actors';
import { fireProjectile } from '../entities/hazards';
import * as scale from '../logic/abilities';
import { combineMods } from '../logic/mods';
import { rollRelics, withRelic } from '../logic/relics';
import { applyStatus, damageEnemy, healPlayer, nearestEnemy, rollPlayerHit } from './combat';
import { burst, floatText, line, ring, shake } from './effects';

/**
 * Relic behaviour. Data (names, rarity, numbers, plain stat mods) is in config/relics.ts;
 * a relic only needs an entry here if it reacts to events or changes over time.
 * Hooks allocate their own query arrays: they can fire in the middle of someone else's damage loop.
 */
interface RelicHooks extends Handlers {
  acquire?(g: Game): void;
  /** Every tick, after p.mods has been reset: adjust mods, run timers. */
  tick?(g: Game, dt: number): void;
}

const R = RELICS;
const relicDamage = (g: Game, base: number) => base * (1 + g.player.level * RELIC_DAMAGE_PER_LEVEL);

function nova(g: Game, x: number, y: number, radius: number, damage: number, knockback: number, color: string): void {
  for (const e of g.hash.query(x, y, radius, [])) {
    const a = Math.atan2(e.y - y, e.x - x);
    damageEnemy(g, e, damage, false, Math.cos(a) * knockback, Math.sin(a) * knockback, 'relic');
  }
  ring(g, x, y, radius, color, 0.45);
}

const HOOKS: Partial<Record<RelicId, RelicHooks>> = {
  vampireFang: { onKill: (g) => healPlayer(g, R.vampireFang.n.heal, false) },

  thornMail: {
    onDamageTaken(g, ev) {
      if (ev.attacker) damageEnemy(g, ev.attacker, ev.amount * R.thornMail.n.mult, false, 0, 0, 'relic');
    },
  },

  rallyBanner: { onWaveStart: (g) => healPlayer(g, g.player.stats.hp * R.rallyBanner.n.heal) },

  stormPennant: {
    onHit(g, ev) {
      const n = R.stormPennant.n;
      if (ev.source !== 'attack' || g.rng() >= n.chance) return;
      const next = nearestEnemy(g, ev.enemy.x, ev.enemy.y, n.range, ev.enemy);
      if (!next) return;
      line(g, ev.enemy.x, ev.enemy.y, next.x, next.y, '#f2e6a0');
      damageEnemy(g, next, ev.amount * n.mult, false, 0, 0, 'relic');
    },
  },

  powderKeg: {
    onKill(g, ev) {
      const n = R.powderKeg.n;
      if (ev.enemy.def.boss || g.rng() >= n.chance) return;
      nova(g, ev.enemy.x, ev.enemy.y, n.radius, ev.enemy.maxHp * n.hpFrac, 200, '#e07b28');
      burst(g, ev.enemy.x, ev.enemy.y, '#e07b28', 16, 260);
      shake(g, 6);
      sfx('boom');
    },
  },

  sentinelStance: {
    tick(g) {
      const n = R.sentinelStance.n;
      g.player.mods.damage *= 1 + Math.min(n.max, g.player.still * n.perSec);
    },
  },

  shockSigil: {
    onDamageTaken(g) {
      const n = R.shockSigil.n;
      if (g.time < (g.vars.shockReady ?? 0)) return;
      g.vars.shockReady = g.time + n.cooldown;
      nova(g, g.player.x, g.player.y, n.radius, relicDamage(g, n.damage), n.knockback, '#7ec8d8');
      shake(g, 8);
    },
  },

  warHorn: {
    onWaveStart: (g) => void (g.vars.warHorn = g.time + R.warHorn.n.time),
    tick(g) {
      if (g.time < (g.vars.warHorn ?? 0)) g.player.mods.atkSpd *= 1 + R.warHorn.n.atkSpd;
    },
  },

  executioner: {
    onHit(g, ev) {
      const n = R.executioner.n;
      if (ev.source === 'attack' && !ev.enemy.dead && ev.enemy.hp / ev.enemy.maxHp < n.threshold) {
        damageEnemy(g, ev.enemy, ev.amount * n.bonus, false, 0, 0, 'relic');
      }
    },
  },

  echoBell: {
    onAbilityUsed(g) {
      const n = R.echoBell.n;
      nova(g, g.player.x, g.player.y, n.radius, relicDamage(g, n.damage), 240, '#c9a227');
    },
  },

  frostBrand: {
    onHit(g, ev) {
      const n = R.frostBrand.n;
      if (ev.source === 'attack' && g.rng() < n.chance) applyStatus(ev.enemy, { slowMul: n.slow, slowT: n.time }, g); // enough chill freezes
    },
  },

  brimstoneOil: {
    onHit(g, ev) {
      const n = R.brimstoneOil.n;
      if (ev.source === 'attack' && g.rng() < n.chance) applyStatus(ev.enemy, { apply: [{ id: 'burn', power: ev.amount * n.power }] }, g);
    },
  },

  serratedEdge: {
    onHit(g, ev) {
      const n = R.serratedEdge.n;
      if (ev.source === 'attack' && ev.crit) applyStatus(ev.enemy, { apply: [{ id: 'bleed', stacks: n.stacks, power: ev.amount * n.power }] }, g);
    },
  },

  hexDoll: {
    onHit(g, ev) {
      if (ev.source === 'ability') applyStatus(ev.enemy, { apply: [{ id: 'curse', stacks: R.hexDoll.n.stacks }] }, g);
    },
  },

  gravePact: { onAbilityUsed: (g) => g.minions.forEach((m) => (m.blessedT = R.gravePact.n.time)) },

  bloodPact: {
    acquire(g) {
      const p = g.player;
      p.stats.hp = Math.round(p.stats.hp * R.bloodPact.n.hp);
      p.hp = Math.min(p.hp, p.stats.hp);
    },
  },

  phoenixFeather: { acquire: (g) => void (g.player.revives += R.phoenixFeather.n.charges) },

  soulLantern: {
    onKill(g, ev) {
      const n = R.soulLantern.n;
      const ability = g.player.cls.ability;
      const own = ability.id === 'raiseDead' ? scale.raiseDead(ability, g.player.stats.secondary).maxMinions : 0;
      if (ev.enemy.def.boss || g.minions.length >= own + n.max || g.rng() >= n.chance) return;
      g.minions.push(createMinion(ev.enemy.x, ev.enemy.y, { hp: n.hp, damage: relicDamage(g, n.damage), speed: 165, attackCd: 0.7, life: n.life }));
      ring(g, ev.enemy.x, ev.enemy.y, 30, '#7ec8d8');
    },
  },

  conquerorCrown: {
    onWaveStart(g) {
      const n = R.conquerorCrown.n;
      g.vars.crown = Math.min(n.max, (g.vars.crown ?? -n.perWave) + n.perWave); // the wave it was picked up in does not count
    },
    tick: (g) => void (g.player.mods.damage *= 1 + Math.max(0, g.vars.crown ?? 0)),
  },

  // ----- class relics -----
  reliquary: {
    onDamageTaken(g) {
      const p = g.player;
      p.abilityCd = Math.max(0, p.abilityCd - R.reliquary.n.perFaith * p.stats.secondary);
    },
  },

  wolfskin: {
    onAbilityUsed: (g) => void (g.vars.wolfskin = 0),
    onKill(g) {
      const p = g.player;
      const n = R.wolfskin.n;
      const ext = n.perRage * p.stats.secondary;
      if (p.abilityTime <= 0 || (g.vars.wolfskin ?? 0) + ext > p.abilityDur * n.cap) return;
      g.vars.wolfskin = (g.vars.wolfskin ?? 0) + ext;
      p.abilityTime += ext;
    },
  },

  seraphHalo: {
    onAbilityUsed(g) {
      const p = g.player;
      const n = R.seraphHalo.n;
      const count = Math.floor(n.base + p.stats.secondary * n.perGrace);
      for (let i = 0; i < count; i++) {
        const hit = rollPlayerHit(g, p.cls.attack.damage * n.mult, 'int');
        fireProjectile(g, p.x, p.y, (i / count) * TAU, { damage: hit.amount, crit: hit.crit, hostile: false, pierce: 2, shape: 'orb', color: '#f2e6a0', r: 6, speed: 420, range: 420, source: 'relic' });
      }
    },
  },

  boneChime: {
    tick(g) {
      const p = g.player;
      p.mods.minionAtkSpd *= 1 + p.stats.atkSpd * R.boneChime.n.inherit + p.stats.secondary * R.boneChime.n.perSoul;
    },
  },

  hawkeyeQuiver: { tick: (g) => void (g.player.mods.pierce += Math.floor(g.player.stats.secondary / R.hawkeyeQuiver.n.per)) },
};

addListener((g, name, ev) => {
  for (const id of g.relics) dispatch(HOOKS[id], g, name, ev);
  if (name === 'onKill' && (ev as GameEvents['onKill']).enemy.def.boss) offerRelics(g); // bosses always yield a choice of relics
});

/** Layers held relics onto p.mods (already reset to g.baseMods this tick). */
export function updateRelics(g: Game, dt: number): void {
  for (const id of g.relics) {
    const mods = relicDef(id).mods;
    if (mods) combineMods(g.player.mods, mods);
    HOOKS[id]?.tick?.(g, dt);
  }
}

/** Returns false if the relic could not be taken (slots full and no valid slot to replace). */
export function addRelic(g: Game, id: RelicId, replace?: number): boolean {
  const next = withRelic(g.relics, g.relicSlots, id, replace);
  if (next === g.relics) return false;
  g.relics = next;
  HOOKS[id]?.acquire?.(g);
  floatText(g, g.player.x, g.player.y - 50, relicDef(id).name, '#c9a227', 16);
  sfx('levelup');
  return true;
}

/** Queue a relic choice (boss kill: 3 options, elite chest: 1). The UI or the bot resolves it. */
export function offerRelics(g: Game, count = BOSS_RELIC_CHOICES): void {
  const options = rollRelics(g.relicPool, [...g.relics, ...g.relicOffers.flat()], g.rng, count);
  if (options.length > 0) g.relicOffers.push(options);
}

/** Resolve the first queued offer. id = null skips it. */
export function resolveRelicOffer(g: Game, id: RelicId | null, replace?: number): boolean {
  if (id && !addRelic(g, id, replace)) return false;
  g.relicOffers.shift();
  return true;
}
