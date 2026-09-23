import { STATUSES } from '../config/damage';
import { BOSS_RELIC_CHOICES, RELIC_COLOR, RELIC_DAMAGE_PER_LEVEL, RELIC_MOMENTS, RELIC_STACKING, relicDef, relicMods, relicN, SYNERGIES, TIER_NUMERALS, type RelicId, type SynergyId } from '../config/relics';
import { sfx } from '../core/audio';
import { addListener, dispatch, type GameEvents, type Handlers } from '../core/events';
import { TAU } from '../core/math';
import type { Game, Mods, Player, RelicSource } from '../core/types';
import { createMinion } from '../entities/actors';
import { fireProjectile } from '../entities/hazards';
import * as scale from '../logic/abilities';
import { combineMods } from '../logic/mods';
import { activeSynergies, foldRelicMods, relicModTotals, relicTier, rollOffer, softCap, totalsToMods, withRelic } from '../logic/relics';
import { ROUTES } from '../config/routes';
import { applyStatus, damageEnemy, healPlayer, nearestEnemy, rollPlayerHit } from './combat';
import { burst, floatText, line, ring, shake } from './effects';
import { skeletonCount } from './minions';
import { relicContext } from './relicContext';

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

const n = (g: Game, id: RelicId) => relicN(id, relicTier(g.player.relics.tiers, id));
const BONUS_KEYS = new Set<keyof Mods>(['damage', 'atkSpd', 'moveSpd', 'cooldown', 'pickup', 'xp', 'gold', 'minionAtkSpd', 'minionDamage']); // multiplicative mods (logic/relics.ts)

/**
 * v0.7 (RELICS.md): per-relic contribution. `relicContext.acting` is the relic whose hook is running, so relic damage and relic healing are credited
 * to it exactly. Plain mods (+damage, +attack speed, armor...) are credited as their share of the bonus on every hit; burns and bleeds
 * a relic applies are credited as their full expected damage when applied (an estimate: a status can be cut short by a kill).
 */
const lanternMinions = new WeakSet<object>();
function credit(g: Game, id: RelicId, kind: 'damage' | 'healing' | 'prevented', amount: number, proc = false): void {
  if (!(amount > 0)) return;
  const s = (g.player.relics.stats[id] ??= { damage: 0, healing: 0, prevented: 0 });
  s[kind] += amount;
  if (proc) flash(g, id);
}

/** v0.7: a relic that just did something flashes its icon over the player, at most once every RELIC_FLASH seconds per relic. */
const RELIC_FLASH = 1.2;
function flash(g: Game, id: RelicId): void {
  const key = `flash.${id}`;
  if (g.time - (g.vars[key] ?? -99) < RELIC_FLASH) return;
  g.vars[key] = g.time;
  const p = g.player;
  floatText(g, p.x + (g.rng() - 0.5) * 30, p.y - p.r - 34, relicDef(id).icon, RELIC_COLOR, 15);
}
/** Each held relic's raw bonus per mod key (static mods plus this tick's conditional bonuses): the weights for sharing out a total. */
const rawBy = new WeakMap<Game, Partial<Record<RelicId, Partial<Record<keyof Mods, number>>>>>();
function shareOut(g: Game, key: keyof Mods, amount: number, frac: number): void {
  const t = g.player.relics.totals[key];
  if (!t || t.raw <= 0 || frac <= 0) return;
  for (const [id, keys] of Object.entries(rawBy.get(g) ?? {}) as [RelicId, Partial<Record<keyof Mods, number>>][]) {
    const r = keys[key];
    if (r && r > 0) credit(g, id, 'damage', (amount * frac * r) / t.raw);
  }
}
/** A hit by the player, an ability or a minion: relic damage is credited to the relicContext.acting relic, the rest shared out by bonus. */
function attribute(g: Game, ev: GameEvents['onHit']): void {
  g.vars.dealt = (g.vars.dealt ?? 0) + ev.amount;
  if (ev.source === 'relic') {
    if (relicContext.acting) credit(g, relicContext.acting, 'damage', ev.amount, true);
    return;
  }
  const eff = (key: keyof Mods) => g.player.relics.totals[key]?.eff ?? 0;
  if (ev.source === 'attack' || ev.source === 'ability') {
    const d = eff('damage');
    shareOut(g, 'damage', ev.amount, d / (1 + d));
  }
  if (ev.source === 'attack') {
    const a = eff('atkSpd');
    shareOut(g, 'atkSpd', ev.amount, a / (1 + a));
    const pierce = eff('pierce');
    shareOut(g, 'pierce', ev.amount, pierce / (1 + ('pierce' in g.player.cls.attack ? (g.player.cls.attack.pierce as number) : 0) + pierce));
  }
  if (ev.source === 'ability') shareOut(g, 'cooldown', ev.amount, eff('cooldown')); // casts scale with 1 / (1 - cut): the cut's share of ability damage is the cut
  if (ev.source === 'minion' && g.minions.length) {
    const m = eff('minionAtkSpd');
    shareOut(g, 'minionAtkSpd', ev.amount, m / (1 + m));
    if (g.player.relics.held.includes('soulLantern')) credit(g, 'soulLantern', 'damage', (ev.amount * g.minions.filter((x) => lanternMinions.has(x)).length) / g.minions.length);
    if (g.player.relics.held.includes('gravePact')) credit(g, 'gravePact', 'damage', ((ev.amount * 0.3) / 1.3) * (g.minions.filter((x) => x.blessedT > 0).length / g.minions.length));
  }
  const curse = ev.enemy.statuses.curse?.stacks ?? 0;
  if (curse && g.player.relics.held.includes('hexDoll')) credit(g, 'hexDoll', 'damage', (ev.amount * 0.12 * curse) / (1 + 0.12 * curse));
}
const syn = (g: Game, id: SynergyId) => g.player.relics.synergies.includes(id);
const relicDamage = (g: Game, base: number) => base * (1 + g.player.level * RELIC_DAMAGE_PER_LEVEL);
/** Healing from relics passes a soft cap per wave (a share of max HP, BALANCE.md): sustain relics add up, then each heals less. */
function relicHeal(g: Game, amount: number, show = false): void {
  const max = g.player.stats.hp;
  const prev = g.vars.relicHeal ?? 0;
  const next = prev + amount / max;
  g.vars.relicHeal = next;
  const healed = healPlayer(g, (softCap(next, RELIC_STACKING.healCap) - softCap(prev, RELIC_STACKING.healCap)) * max, show);
  if (relicContext.acting) credit(g, relicContext.acting, 'healing', healed, true);
}

/** A proc's chance, shared out past the category's cap (BALANCE.md). */
const proc = (g: Game, _id: RelicId, chance: number) => g.rng() < chance; // v0.7: no proc sharing

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
      const executed = syn(g, 'reaper') && g.player.relics.reaperMark === ev.enemy;
      if (executed) g.player.relics.reaperMark = null;
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
        g.player.relics.reaperMark = ev.enemy;
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
      if (ev.source !== 'attack' || !proc(g, 'brimstoneOil', c.chance)) return;
      applyStatus(ev.enemy, { apply: [{ id: 'burn', power: ev.amount * c.power }] }, g);
      credit(g, 'brimstoneOil', 'damage', ev.amount * c.power * STATUSES.burn.duration, true);
    },
  },

  serratedEdge: {
    onHit(g, ev) {
      const c = n(g, 'serratedEdge');
      if (ev.source !== 'attack' || !ev.crit) return;
      applyStatus(ev.enemy, { apply: [{ id: 'bleed', stacks: c.stacks, power: ev.amount * c.power }] }, g);
      credit(g, 'serratedEdge', 'damage', ev.amount * c.power * c.stacks * STATUSES.bleed.duration, true);
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
      if (ev.enemy.def.boss || skeletonCount(g) >= own + c.max || !proc(g, 'soulLantern', c.chance)) return;
      const m = createMinion(ev.enemy.x, ev.enemy.y, { hp: c.hp, damage: relicDamage(g, c.damage), speed: 165, attackCd: 0.7, life: c.life });
      if (syn(g, 'necropolis')) m.blessedT = n(g, 'gravePact').time;
      lanternMinions.add(m);
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
  if (name === 'onHit') attribute(g, ev as GameEvents['onHit']);
  if (name === 'onDamageTaken') {
    // armor from relics: its share of what the armor as a whole turned away
    const taken = (ev as GameEvents['onDamageTaken']).amount;
    g.vars.taken = (g.vars.taken ?? 0) + taken;
    const armor = Math.min(0.9, g.player.mods.armor);
    const a = g.player.relics.totals.armor?.eff ?? 0;
    if (a > 0 && armor > 0) {
      const prevented = (taken / (1 - armor)) * a;
      g.vars.prevented = (g.vars.prevented ?? 0) + prevented;
      for (const [id, keys] of Object.entries(rawBy.get(g) ?? {}) as [RelicId, Partial<Record<keyof Mods, number>>][]) if (keys.armor) credit(g, id, 'prevented', (prevented * keys.armor) / (g.player.relics.totals.armor?.raw || 1));
    }
  }
  if (g.procDepth >= RELIC_STACKING.procDepth) return; // a relic reacting to a relic's damage is the last link of the chain
  g.procDepth++;
  const outer = relicContext.acting;
  try {
    for (const id of g.player.relics.held) {
      relicContext.acting = id;
      dispatch(HOOKS[id], g, name, ev);
    }
  } finally {
    relicContext.acting = outer;
    g.procDepth--;
  }
  // v0.7: every wave boss is a relic moment (a lair's boss is the lair's moment; the Usurper ends the run)
  const slain = name === 'onKill' ? (ev as GameEvents['onKill']).enemy : null;
  if (slain?.def.boss && !slain.side && slain.def.id !== 'usurper') offerRelics(g, undefined, 'boss');
});

/** A tick hook's conditional bonus (a charge, a horn, a crown): it joins the held relics' plain mods in the same soft-capped sum. */
const bonus = (g: Game, key: keyof Mods, amount: number): void => {
  g.player.relics.dyn[key] = (g.player.relics.dyn[key] ?? 0) + amount;
  if (relicContext.acting) {
    const keys = ((rawBy.get(g) ?? {})[relicContext.acting] ??= {});
    keys[key] = (keys[key] ?? 0) + amount;
  }
};

/**
 * Layers held relics onto p.mods (already reset to g.baseMods this tick). Plain mods and the tick hooks' conditional bonuses add up per key
 * and pass the category's soft cap together (BALANCE.md); g.player.relics.totals keeps the sums for the stats panel.
 */
export function updateRelics(g: Game, dt: number): void {
  if (g.player.relics.dirty) {
    g.player.relics.static = relicModTotals(g.player.relics.held, g.player.relics.tiers);
    g.player.relics.synergies = activeSynergies(g.player.relics.held).filter((id) => !SYNERGIES[id].anti);
    g.player.relics.dirty = false;
  }
  for (const key of Object.keys(g.player.relics.dyn) as (keyof Mods)[]) g.player.relics.dyn[key] = 0;
  // the per-relic weights for contribution (RELICS.md): static mods, then the tick hooks add their conditional bonuses
  const raw: Partial<Record<RelicId, Partial<Record<keyof Mods, number>>>> = {};
  for (const id of g.player.relics.held) {
    const mods = relicMods(id, relicTier(g.player.relics.tiers, id));
    if (mods) raw[id] = Object.fromEntries(Object.entries(mods).map(([k, v]) => [k, BONUS_KEYS.has(k as keyof Mods) ? (k === 'cooldown' ? 1 - v! : v! - 1) : v!]));
  }
  rawBy.set(g, raw);
  for (const id of g.player.relics.held) {
    relicContext.acting = id;
    HOOKS[id]?.tick?.(g, dt);
  }
  relicContext.acting = null;
  if (syn(g, 'pilgrimsPurse')) {
    bonus(g, 'gold', SYNERGIES.pilgrimsPurse.n.bonus);
    bonus(g, 'xp', SYNERGIES.pilgrimsPurse.n.bonus);
  }
  if (syn(g, 'forager')) bonus(g, 'pickup', SYNERGIES.forager.n.mult - 1);
  g.player.relics.totals = foldRelicMods(g.player.relics.static, g.player.relics.dyn);
  combineMods(g.player.mods, totalsToMods(g.player.relics.totals));
}

/** Take a relic: new at tier 1, held one a tier up. False only when it is already at the top tier. `from`: where it came from (RELICS.md). */
export function addRelic(g: Game, id: RelicId, from: RelicSource = 'other'): boolean {
  const next = withRelic(g.player.relics.tiers, id, g.player.relics.tierCap);
  if (next === g.player.relics.tiers) return false;
  const upgrade = relicTier(g.player.relics.tiers, id) > 0;
  g.player.relics.tiers = next;
  if (!upgrade) g.player.relics.held = [...g.player.relics.held, id];
  g.player.relics.dirty = true;
  g.player.relics.found.push(id);
  g.player.relics.from[id] ??= from;
  HOOKS[id]?.acquire?.(g);
  const tier = relicTier(next, id);
  floatText(g, g.player.x, g.player.y - 50, `${relicDef(id).name}${upgrade ? ` ${TIER_NUMERALS[tier]}` : ''}`, '#c9a227', 16);
  sfx('levelup');
  return true;
}

/** Drop a held relic entirely (the Merchant's sell and salvage). */
export function removeRelic(g: Game, id: RelicId): boolean {
  if (!g.player.relics.held.includes(id)) return false;
  g.player.relics.held = g.player.relics.held.filter((r) => r !== id);
  const { [id]: _gone, ...rest } = g.player.relics.tiers;
  g.player.relics.tiers = rest;
  g.player.relics.dirty = true;
  if (id === 'bloodPact') {
    const p = g.player;
    p.stats.hp = p.stats.hp / (g.vars.bloodPactHp ?? 1);
    g.vars.bloodPactHp = 1;
  }
  return true;
}

/** v0.7: a relic's family, once families exist (A3); until then the offer rule has nothing to hold on to. */
export const familyOf = (id: RelicId): string | undefined => (relicDef(id) as { family?: string }).family;

const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

/**
 * v0.7: what taking `id` would do for this player's build right now, in numbers: a plain bonus as its real gain after everything already held
 * (+12% damage on top of +80% is +7% of your damage), a held relic's tier-up and what it has done so far, its family count (A3).
 */
export function relicPreview(g: Game, p: Player, id: RelicId): string[] {
  const r = p.relics;
  const tier = relicTier(r.tiers, id);
  const heldAfter = tier ? r.held : [...r.held, id];
  const before = relicModTotals(r.held, r.tiers);
  const after = relicModTotals(heldAfter, withRelic(r.tiers, id, r.tierCap));
  const lines: string[] = [];
  const gain = (key: keyof Mods) => (after[key]?.eff ?? 0) - (before[key]?.eff ?? 0);
  const mult = (key: keyof Mods) => (1 + (after[key]?.eff ?? 0)) / (1 + (before[key]?.eff ?? 0)) - 1;
  for (const key of Object.keys(relicMods(id, tier + 1) ?? {}) as (keyof Mods)[]) {
    if (key === 'damage') lines.push(`${pct(mult('damage'))} of your damage`);
    else if (key === 'atkSpd') lines.push(`${pct(mult('atkSpd'))} of your attack speed`);
    else if (key === 'cooldown') lines.push(`${pct(gain('cooldown'))} off your ability's cooldown`);
    else if (key === 'armor') lines.push(`${pct(gain('armor'))} armor`);
    else if (key === 'moveSpd' || key === 'gold' || key === 'xp' || key === 'pickup') lines.push(`${pct(mult(key))} ${{ moveSpd: 'movement speed', gold: 'gold', xp: 'experience', pickup: 'pickup radius' }[key]}`);
    if (after[key] && after[key]!.eff < after[key]!.raw - 1e-9) lines[lines.length - 1] += ' (soft-capped)';
  }
  const s = r.stats[id];
  const dealt = g.vars.dealt ?? 0;
  if (tier && s && dealt > 0 && s.damage > 0) lines.push(`So far: ${Math.round((s.damage / dealt) * 100)}% of your damage`);
  if (tier && s && (g.vars.healed ?? 0) > 0 && s.healing > 0) lines.push(`So far: ${Math.round((s.healing / g.vars.healed!) * 100)}% of your healing`);
  const fam = familyOf(id);
  if (fam && !tier) {
    const n = r.held.filter((h) => familyOf(h) === fam).length;
    lines.push(`${fam} ${n} → ${n + 1}`);
  }
  return lines;
}

/**
 * v0.7: each held relic's share of this run, in % with one decimal, best first: of all damage dealt, all healing received, and all damage its
 * armor turned away (of damage taken plus turned away). What the results screen's Relics section and the run log show.
 */
export function relicShares(g: Game, p: Player = g.player): { id: RelicId; tier: number; from: RelicSource; damage: number; healing: number; mitigation: number }[] {
  const r = p.relics;
  const pct = (v: number, of: number) => (of > 0 ? Math.round((v / of) * 1000) / 10 : 0);
  const taken = (g.vars.taken ?? 0) + (g.vars.prevented ?? 0);
  return r.held.map((id) => {
    const s = r.stats[id] ?? { damage: 0, healing: 0, prevented: 0 };
    return { id, tier: relicTier(r.tiers, id), from: r.from[id] ?? 'other', damage: pct(s.damage, g.vars.dealt ?? 0), healing: pct(s.healing, g.vars.healed ?? 0), mitigation: pct(s.prevented, taken) };
  }).sort((a, b) => Math.max(b.damage, b.healing, b.mitigation) - Math.max(a.damage, a.healing, a.mitigation));
}

/** Rerolls a moment starts with: the base, the Cursed Luck trait, the Elite path's Act. */
export const momentRerolls = (g: Game): number => RELIC_MOMENTS.rerolls + (g.vars['trait.rerolls'] ?? 0) + (g.route?.focus === 'elite' ? ROUTES.elite.rerolls : 0);

function roll(p: Player, pool: RelicId[], n: number): RelicId[] {
  const r = p.relics;
  return rollOffer(pool, r.held, r.tiers, r.rng, n, familyOf, RELIC_MOMENTS.heldFamilyWeight, r.offers.flatMap((o) => o.options), r.tierCap);
}

/**
 * v0.7: queue a relic moment for a player: a pick of `count` (RELIC_MOMENTS). `pool` narrows it (the Merchant sells one rarity).
 * Every relic choice is an action on a player's own state, so in co-op any player can have their own moment.
 */
export function offerRelics(g: Game, count = BOSS_RELIC_CHOICES, from: RelicSource = 'other', p: Player = g.player, pool = p.relics.pool): void {
  const options = roll(p, pool, count);
  if (!options.length) return;
  p.relics.offers.push({ from, options, rerolls: momentRerolls(g) });
  g.vars[`moments.${from}`] = (g.vars[`moments.${from}`] ?? 0) + 1; // counted for the sims (RELICS.md: 12-16 a run)
}

/** Take one of the first queued moment's options. */
export function resolveRelicOffer(g: Game, id: RelicId | null, p: Player = g.player): boolean {
  const offer = p.relics.offers[0];
  if (!offer) return false;
  if (id === null) return skipRelicOffer(g, p);
  if (!offer.options.includes(id) || !addRelic(g, id, offer.from)) return false;
  p.relics.offers.shift();
  return true;
}

/** What skipping the current moment pays: run gold (more each Act) and a Rune shard. */
export const skipReward = (g: Game) => ({ gold: RELIC_MOMENTS.skip.gold + RELIC_MOMENTS.skip.goldPerAct * g.act, shards: RELIC_MOMENTS.skip.shards });

/** Skip the first queued moment: its reward instead of a relic. */
export function skipRelicOffer(g: Game, p: Player = g.player): boolean {
  if (!p.relics.offers.shift()) return false;
  const reward = skipReward(g);
  g.gold += reward.gold;
  g.salvage += reward.shards;
  floatText(g, p.x, p.y - 50, `+${reward.gold}g · ◆ shard`, '#c9a227', 15);
  return true;
}

/** Reroll the first queued moment's options (its rerolls run out; the relic stream decides, so a seed rerolls the same way). */
export function rerollRelicOffer(g: Game, p: Player = g.player): boolean {
  const offer = p.relics.offers[0];
  if (!offer || offer.rerolls <= 0) return false;
  const pool = offer.from === 'merchant' ? p.relics.pool.filter((id) => relicDef(id).rarity === relicDef(offer.options[0]).rarity) : p.relics.pool;
  const others = p.relics.offers.slice(1).flatMap((o) => o.options);
  const options = rollOffer(pool, p.relics.held, p.relics.tiers, p.relics.rng, offer.options.length, familyOf, RELIC_MOMENTS.heldFamilyWeight, [...others, ...offer.options], p.relics.tierCap);
  if (!options.length) return false;
  offer.options = options;
  offer.rerolls--;
  return true;
}
