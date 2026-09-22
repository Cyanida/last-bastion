import { STATUSES } from '../config/damage';
import { BOSS_RELIC_CHOICES, RELIC_DAMAGE_PER_LEVEL, RELIC_STACKING, relicDef, relicN, SYNERGIES, TIER_NUMERALS, type RelicId, type SynergyId } from '../config/relics';
import { sfx } from '../core/audio';
import { addListener, dispatch, type GameEvents, type Handlers } from '../core/events';
import { TAU } from '../core/math';
import type { Game, Mods } from '../core/types';
import { createMinion } from '../entities/actors';
import { fireProjectile } from '../entities/hazards';
import * as scale from '../logic/abilities';
import { combineMods } from '../logic/mods';
import { activeSynergies, foldRelicMods, procScale, relicModTotals, relicTier, rollRelics, softCap, totalsToMods, withRelic } from '../logic/relics';
import { applyStatus, damageEnemy, healPlayer, nearestEnemy, rollPlayerHit } from './combat';
import { burst, floatText, line, ring, shake } from './effects';

/**
 * Relic behaviour. Data (names, rarity, numbers per tier, plain stat mods) is in config/relics.ts;
 * a relic only needs an entry here if it reacts to events or changes over time. `n(g, id)` reads the numbers of the tier held.
 * Hooks allocate their own query arrays: they can fire in the middle of someone else's damage loop.
 * Synergies (SYN) fire the same way once both relics are held; anti-synergies are only warnings and have no hook.
 */
interface RelicHooks extends Handlers {
  acquire?(g: Game): void;
  /** Every tick, after p.mods has been reset: adjust mods, run timers. */
  tick?(g: Game, dt: number): void;
}

const n = (g: Game, id: RelicId) => relicN(id, relicTier(g.relicTiers, id));
const syn = (g: Game, id: SynergyId) => g.synergies.includes(id);
const relicDamage = (g: Game, base: number) => base * (1 + g.player.level * RELIC_DAMAGE_PER_LEVEL);
/** Healing from relics passes a soft cap per wave (a share of max HP, BALANCE.md): sustain relics add up, then each heals less. */
function relicHeal(g: Game, amount: number, show = false): void {
  const max = g.player.stats.hp;
  const prev = g.vars.relicHeal ?? 0;
  const next = prev + amount / max;
  g.vars.relicHeal = next;
  healPlayer(g, (softCap(next, RELIC_STACKING.healCap) - softCap(prev, RELIC_STACKING.healCap)) * max, show);
}

/** A proc's chance, shared out past the category's cap (BALANCE.md). */
const proc = (g: Game, id: RelicId, chance: number) => g.rng() < chance * procScale(g.relics, relicDef(id).category);

function nova(g: Game, x: number, y: number, radius: number, damage: number, knockback: number, color: string, each?: (e: Game['enemies'][number]) => void): void {
  for (const e of g.hash.query(x, y, radius, [])) {
    const a = Math.atan2(e.y - y, e.x - x);
    damageEnemy(g, e, damage, false, Math.cos(a) * knockback, Math.sin(a) * knockback, 'relic');
    each?.(e);
  }
  ring(g, x, y, radius, color, 0.45);
}

const HOOKS: Partial<Record<RelicId, RelicHooks>> = {
  vampireFang: {
    onKill(g, ev) {
      // Reaper: the Hood marks an enemy it found below its threshold; a kill on that enemy is an execution
      const executed = syn(g, 'reaper') && g.reaperMark === ev.enemy;
      if (executed) g.reaperMark = null;
      relicHeal(g, n(g, 'vampireFang').heal * (executed ? SYNERGIES.reaper.n.mult : 1));
    },
  },

  thornMail: {
    onDamageTaken(g, ev) {
      if (ev.attacker) damageEnemy(g, ev.attacker, ev.amount * n(g, 'thornMail').mult, false, 0, 0, 'relic');
    },
  },

  rallyBanner: {
    onWaveStart: (g) => relicHeal(g, g.player.stats.hp * n(g, 'rallyBanner').heal * (syn(g, 'muster') ? SYNERGIES.muster.n.mult : 1), true),
  },

  stormPennant: {
    onHit(g, ev) {
      const c = n(g, 'stormPennant');
      if (ev.source !== 'attack' || !proc(g, 'stormPennant', c.chance)) return;
      let from = ev.enemy;
      for (let i = 0; i < c.arcs; i++) {
        const next = nearestEnemy(g, from.x, from.y, c.range, from);
        if (!next) return;
        line(g, from.x, from.y, next.x, next.y, '#f2e6a0');
        damageEnemy(g, next, ev.amount * c.mult, false, 0, 0, 'relic');
        from = next;
      }
    },
  },

  powderKeg: {
    onKill(g, ev) {
      const c = n(g, 'powderKeg');
      if (ev.enemy.def.boss || !proc(g, 'powderKeg', c.chance)) return;
      const blast = ev.enemy.maxHp * c.hpFrac;
      const ignite = syn(g, 'fireInTheHole') ? (e: Game['enemies'][number]) => applyStatus(e, { apply: [{ id: 'burn', power: blast * SYNERGIES.fireInTheHole.n.power }] }, g) : undefined;
      nova(g, ev.enemy.x, ev.enemy.y, c.radius, blast, 200, '#e07b28', ignite);
      burst(g, ev.enemy.x, ev.enemy.y, '#e07b28', 16, 260);
      shake(g, 6);
      sfx('boom');
    },
  },

  sentinelStance: {
    tick(g) {
      const c = n(g, 'sentinelStance');
      bonus(g, 'damage', Math.min(c.max, g.player.still * c.perSec));
      if (syn(g, 'bastion')) bonus(g, 'armor', Math.min(SYNERGIES.bastion.n.max, g.player.still * SYNERGIES.bastion.n.perSec));
    },
  },

  shockSigil: {
    onDamageTaken(g) {
      const c = n(g, 'shockSigil');
      if (g.time < (g.vars.shockReady ?? 0)) return;
      g.vars.shockReady = g.time + c.cooldown * (syn(g, 'bulwark') ? SYNERGIES.bulwark.n.mult : 1);
      nova(g, g.player.x, g.player.y, c.radius, relicDamage(g, c.damage), c.knockback, '#7ec8d8');
      shake(g, 8);
    },
  },

  warHorn: {
    onWaveStart: (g) => void (g.vars.warHorn = g.time + n(g, 'warHorn').time),
    tick(g) {
      if (g.time < (g.vars.warHorn ?? 0)) bonus(g, 'atkSpd', n(g, 'warHorn').atkSpd);
    },
  },

  executioner: {
    onHit(g, ev) {
      const c = n(g, 'executioner');
      if (ev.source === 'attack' && !ev.enemy.dead && ev.enemy.hp / ev.enemy.maxHp < c.threshold) {
        g.reaperMark = ev.enemy;
        damageEnemy(g, ev.enemy, ev.amount * c.bonus, false, 0, 0, 'relic');
      }
    },
  },

  echoBell: {
    onAbilityUsed(g) {
      const c = n(g, 'echoBell');
      const stun = syn(g, 'thunderclap') ? (e: Game['enemies'][number]) => applyStatus(e, { apply: [{ id: 'stun', time: SYNERGIES.thunderclap.n.stun }] }, g) : undefined;
      nova(g, g.player.x, g.player.y, c.radius, relicDamage(g, c.damage), 240, '#c9a227', stun);
      if (syn(g, 'tempo')) g.player.abilityCd = Math.max(0, g.player.abilityCd - SYNERGIES.tempo.n.refund);
    },
  },

  frostBrand: {
    onHit(g, ev) {
      const c = n(g, 'frostBrand');
      if (ev.source !== 'attack' || !proc(g, 'frostBrand', c.chance)) return;
      const bleed = ev.enemy.statuses.bleed;
      if (bleed && syn(g, 'shatter')) bleed.stacks = Math.min(bleed.stacks * SYNERGIES.shatter.n.mult, STATUSES.bleed.maxStacks);
      applyStatus(ev.enemy, { slowMul: c.slow, slowT: c.time }, g); // enough chill freezes
    },
  },

  brimstoneOil: {
    onHit(g, ev) {
      const c = n(g, 'brimstoneOil');
      if (ev.source === 'attack' && proc(g, 'brimstoneOil', c.chance)) applyStatus(ev.enemy, { apply: [{ id: 'burn', power: ev.amount * c.power }] }, g);
    },
  },

  serratedEdge: {
    onHit(g, ev) {
      const c = n(g, 'serratedEdge');
      if (ev.source === 'attack' && ev.crit) applyStatus(ev.enemy, { apply: [{ id: 'bleed', stacks: c.stacks, power: ev.amount * c.power }] }, g);
    },
  },

  hexDoll: {
    onHit(g, ev) {
      if (ev.source === 'ability') applyStatus(ev.enemy, { apply: [{ id: 'curse', stacks: n(g, 'hexDoll').stacks }] }, g);
    },
  },

  gravePact: { onAbilityUsed: (g) => g.minions.forEach((m) => (m.blessedT = n(g, 'gravePact').time)) },

  bloodPact: {
    acquire(g) {
      // the cut is applied to the tier's fraction, and a tier-up gives the difference back
      const p = g.player;
      const c = n(g, 'bloodPact');
      const prev = g.vars.bloodPactHp ?? 1;
      p.stats.hp = (p.stats.hp / prev) * c.hp; // unrounded, so tiers and removal round-trip exactly
      g.vars.bloodPactHp = c.hp;
      p.hp = Math.min(p.hp, p.stats.hp);
    },
  },

  phoenixFeather: { acquire: (g) => void (g.player.revives += 1) }, // one charge per tier

  soulLantern: {
    onKill(g, ev) {
      const c = n(g, 'soulLantern');
      const ability = g.player.cls.ability;
      const own = (ability.id === 'raiseDead' ? scale.raiseDead(ability, g.player.stats.secondary).maxMinions : 0) + g.player.mods.minionMax;
      if (ev.enemy.def.boss || g.minions.length >= own + c.max || !proc(g, 'soulLantern', c.chance)) return;
      const m = createMinion(ev.enemy.x, ev.enemy.y, { hp: c.hp, damage: relicDamage(g, c.damage), speed: 165, attackCd: 0.7, life: c.life });
      if (syn(g, 'necropolis')) m.blessedT = n(g, 'gravePact').time;
      g.minions.push(m);
      ring(g, ev.enemy.x, ev.enemy.y, 30, '#7ec8d8');
    },
  },

  conquerorCrown: {
    onWaveStart(g) {
      const c = n(g, 'conquerorCrown');
      g.vars.crown = Math.min(c.max, (g.vars.crown ?? -c.perWave) + c.perWave); // the wave it was picked up in does not count
    },
    tick: (g) => bonus(g, 'damage', Math.max(0, g.vars.crown ?? 0)),
  },

  // ----- class relics -----
  reliquary: {
    onDamageTaken(g) {
      const p = g.player;
      p.abilityCd = Math.max(0, p.abilityCd - n(g, 'reliquary').perFaith * p.stats.secondary);
    },
  },

  wolfskin: {
    onAbilityUsed: (g) => void (g.vars.wolfskin = 0),
    onKill(g) {
      const p = g.player;
      const c = n(g, 'wolfskin');
      const ext = c.perRage * p.stats.secondary;
      if (p.abilityTime <= 0 || (g.vars.wolfskin ?? 0) + ext > p.abilityDur * c.cap) return;
      g.vars.wolfskin = (g.vars.wolfskin ?? 0) + ext;
      p.abilityTime += ext;
    },
  },

  seraphHalo: {
    onAbilityUsed(g) {
      const p = g.player;
      const c = n(g, 'seraphHalo');
      const count = Math.floor(c.base + p.stats.secondary * c.perGrace);
      for (let i = 0; i < count; i++) {
        const hit = rollPlayerHit(g, p.cls.attack.damage * c.mult, 'int');
        fireProjectile(g, p.x, p.y, (i / count) * TAU, { damage: hit.amount, crit: hit.crit, hostile: false, pierce: 2, shape: 'orb', color: '#f2e6a0', r: 6, speed: 420, range: 420, source: 'relic' });
      }
    },
  },

  boneChime: {
    tick(g) {
      const p = g.player;
      const c = n(g, 'boneChime');
      bonus(g, 'minionAtkSpd', p.stats.atkSpd * c.inherit + p.stats.secondary * c.perSoul);
    },
  },

  hawkeyeQuiver: { tick: (g) => bonus(g, 'pierce', Math.floor(g.player.stats.secondary / n(g, 'hawkeyeQuiver').per)) },
};

addListener((g, name, ev) => {
  if (name === 'onWaveStart') g.vars.relicHeal = 0;
  if (g.procDepth >= RELIC_STACKING.procDepth) return; // a relic reacting to a relic's damage is the last link of the chain
  g.procDepth++;
  try {
    for (const id of g.relics) dispatch(HOOKS[id], g, name, ev);
  } finally {
    g.procDepth--;
  }
  if (name === 'onKill' && (ev as GameEvents['onKill']).enemy.def.boss) offerRelics(g); // bosses always yield a choice of relics
});

/** A tick hook's conditional bonus (a charge, a horn, a crown): it joins the held relics' plain mods in the same soft-capped sum. */
const bonus = (g: Game, key: keyof Mods, amount: number): void => void (g.relicDyn[key] = (g.relicDyn[key] ?? 0) + amount);

/**
 * Layers held relics onto p.mods (already reset to g.baseMods this tick). Plain mods and the tick hooks' conditional bonuses add up per key
 * and pass the category's soft cap together (BALANCE.md); g.relicTotals keeps the sums for the stats panel.
 */
export function updateRelics(g: Game, dt: number): void {
  if (g.relicModsDirty) {
    g.relicStatic = relicModTotals(g.relics, g.relicTiers);
    g.synergies = activeSynergies(g.relics).filter((id) => !SYNERGIES[id].anti);
    g.relicModsDirty = false;
  }
  for (const key of Object.keys(g.relicDyn) as (keyof Mods)[]) g.relicDyn[key] = 0;
  for (const id of g.relics) HOOKS[id]?.tick?.(g, dt);
  if (syn(g, 'pilgrimsPurse')) {
    bonus(g, 'gold', SYNERGIES.pilgrimsPurse.n.bonus);
    bonus(g, 'xp', SYNERGIES.pilgrimsPurse.n.bonus);
  }
  if (syn(g, 'forager')) bonus(g, 'pickup', SYNERGIES.forager.n.mult - 1);
  g.relicTotals = foldRelicMods(g.relicStatic, g.relicDyn);
  combineMods(g.player.mods, totalsToMods(g.relicTotals));
}

/** Take a relic: new at tier 1, held one a tier up. False only when it is already at the top tier. */
export function addRelic(g: Game, id: RelicId): boolean {
  const next = withRelic(g.relicTiers, id, g.relicTierCap);
  if (next === g.relicTiers) return false;
  const upgrade = relicTier(g.relicTiers, id) > 0;
  g.relicTiers = next;
  if (!upgrade) g.relics = [...g.relics, id];
  g.relicModsDirty = true;
  g.relicsFound.push(id);
  HOOKS[id]?.acquire?.(g);
  const tier = relicTier(next, id);
  floatText(g, g.player.x, g.player.y - 50, `${relicDef(id).name}${upgrade ? ` ${TIER_NUMERALS[tier]}` : ''}`, '#c9a227', 16);
  sfx('levelup');
  return true;
}

/** Drop a held relic entirely (the Merchant's sell and salvage). */
export function removeRelic(g: Game, id: RelicId): boolean {
  if (!g.relics.includes(id)) return false;
  g.relics = g.relics.filter((r) => r !== id);
  const { [id]: _gone, ...rest } = g.relicTiers;
  g.relicTiers = rest;
  g.relicModsDirty = true;
  if (id === 'bloodPact') {
    const p = g.player;
    p.stats.hp = p.stats.hp / (g.vars.bloodPactHp ?? 1);
    g.vars.bloodPactHp = 1;
  }
  return true;
}

/** Queue a relic choice (boss kill: 3 options, elite chest: 1). The UI or the bot resolves it. */
export function offerRelics(g: Game, count = BOSS_RELIC_CHOICES): void {
  const options = rollRelics(g.relicPool, g.relics, g.relicTiers, g.rng, count, g.relicOffers.flat(), g.relicTierCap);
  if (options.length > 0) g.relicOffers.push(options);
}

/** Resolve the first queued offer. id = null skips it. */
export function resolveRelicOffer(g: Game, id: RelicId | null): boolean {
  if (id && !addRelic(g, id)) return false;
  g.relicOffers.shift();
  return true;
}
