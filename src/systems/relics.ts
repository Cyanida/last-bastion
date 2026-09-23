import { ROUTES } from '../config/routes';
import { ATTUNEMENT, BOSS_RELIC_CHOICES, FAMILIES, FAMILY_IDS, RELIC_MOMENTS, RELIC_STACKING, relicDef, relicMods, RELIC_MAX_TIER, SET_LEVELS, TIER_NUMERALS, type FamilyId, type RelicId, type SetLevel } from '../config/relics';
import { sfx } from '../core/audio';
import { addListener, emit, type EventName, type GameEvents } from '../core/events';
import type { Game, Mods, Player, RelicSource } from '../core/types';
import { combineMods } from '../logic/mods';
import { attuneAll, foldRelicMods, relicModTotals, relicTier, rollOffer, totalsToMods } from '../logic/relics';
import { floatText, ring } from './effects';
import { relicContext } from './relicContext';
import { credit, familySets, rawBy, type RelicHooks } from './relicCore';
import { BLOOD_RELICS, BLOOD_SETS } from './relicFamilies/blood';
import { FLAME_RELICS, FLAME_SETS } from './relicFamilies/flame';
import { FROST_RELICS, FROST_SETS } from './relicFamilies/frost';
import { GRAVE_RELICS, GRAVE_SETS } from './relicFamilies/grave';
import { HOLY_RELICS, HOLY_SETS } from './relicFamilies/holy';
import { STEEL_RELICS, STEEL_SETS } from './relicFamilies/steel';
import { STORM_RELICS, STORM_SETS } from './relicFamilies/storm';

/**
 * v0.7 relic engine (RELICS.md): relic moments and offers, per-relic contribution, and the dispatch of every held relic's hooks and every
 * reached set bonus. The behaviour of each relic and set lives in systems/relicFamilies/<family>.ts; the shared mechanics in relicCore.ts.
 * Hooks run inside one another's damage (a relic reacting to a relic): the chain stops at RELIC_STACKING.procDepth.
 */
export const HOOKS: Partial<Record<RelicId, RelicHooks>> = { ...FLAME_RELICS, ...FROST_RELICS, ...STORM_RELICS, ...BLOOD_RELICS, ...HOLY_RELICS, ...GRAVE_RELICS, ...STEEL_RELICS };
const SETS: Record<FamilyId, Partial<Record<SetLevel, RelicHooks>>> = { flame: FLAME_SETS, frost: FROST_SETS, storm: STORM_SETS, blood: BLOOD_SETS, holy: HOLY_SETS, grave: GRAVE_SETS, steel: STEEL_SETS };
const BONUS_KEYS = new Set<keyof Mods>(['damage', 'atkSpd', 'moveSpd', 'cooldown', 'pickup', 'xp', 'gold', 'minionAtkSpd', 'minionDamage']); // multiplicative mods (logic/relics.ts)

/** Calls one hook of a relic or a set, telling it whose it is. */
function run<K extends EventName>(hooks: RelicHooks | undefined, g: Game, name: K, ev: GameEvents[K], p: Player): void {
  (hooks?.[name] as ((g: Game, ev: GameEvents[K], p: Player) => void) | undefined)?.(g, ev, p);
}

/** The set bonuses a player has reached, lowest first (a 6 also runs the 2 and the 4). */
function reachedSets(p: Player): RelicHooks[] {
  const out: RelicHooks[] = [];
  for (const f of FAMILY_IDS) {
    const level = p.relics.sets[f]?.level ?? 0;
    for (const at of [2, 4, 6] as const) if (level >= at && SETS[f][at]) out.push(SETS[f][at]!);
  }
  return out;
}

/** RELICS.md: a plain bonus (+damage, +attack speed, +crit...) is credited its share of the total on every hit, relic by relic. */
function shareOut(g: Game, p: Player, key: keyof Mods, amount: number, frac: number): void {
  const t = p.relics.totals[key];
  if (!t || t.raw <= 0 || frac <= 0) return;
  for (const [id, keys] of Object.entries(rawBy.get(p) ?? {}) as [RelicId, Partial<Record<keyof Mods, number>>][]) {
    const r = keys[key];
    if (r && r > 0) credit(g, p, id, 'damage', (amount * frac * r) / t.raw);
  }
}

/** A hit by the player, an ability or a minion: relic damage goes to the relic whose hook dealt it, the rest is shared out by bonus. */
function attribute(g: Game, p: Player, ev: GameEvents['onHit']): void {
  g.vars.dealt = (g.vars.dealt ?? 0) + ev.amount;
  if (ev.source === 'relic') {
    if (relicContext.acting) credit(g, p, relicContext.acting, 'damage', ev.amount, true);
    return;
  }
  const eff = (key: keyof Mods) => p.relics.totals[key]?.eff ?? 0;
  if (ev.source === 'attack' || ev.source === 'ability') {
    const d = eff('damage');
    shareOut(g, p, 'damage', ev.amount, d / (1 + d));
  }
  if (ev.source === 'attack') {
    const a = eff('atkSpd');
    shareOut(g, p, 'atkSpd', ev.amount, a / (1 + a));
    const pierce = eff('pierce');
    shareOut(g, p, 'pierce', ev.amount, pierce / (1 + ('pierce' in p.cls.attack ? (p.cls.attack.pierce as number) : 0) + pierce));
  }
  if (ev.source === 'minion' && g.minions.length) {
    const m = eff('minionAtkSpd');
    shareOut(g, p, 'minionAtkSpd', ev.amount, m / (1 + m));
  }
}

addListener((g, name, ev) => {
  const p = g.player; // ponytail: one player; with co-op this runs for every player whose relics care about the event
  if (name === 'onWaveStart') {
    g.vars.relicHeal = 0;
    g.vars.dealtAtWave = g.vars.dealt ?? 0;
    p.relics.work = {};
  }
  if (name === 'onWaveCleared') {
    // A4: the wave just fought is what the next wave's damage attunement is measured against; every held relic attunes a little
    g.vars.waveDealtRef = Math.max(ATTUNEMENT.refDamage, (g.vars.dealt ?? 0) - (g.vars.dealtAtWave ?? 0));
    attuneAll(p.relics, ATTUNEMENT.wave);
  }
  if (name === 'onKill' && (ev as GameEvents['onKill']).enemy.elite) attuneAll(p.relics, ATTUNEMENT.elite);
  if (name === 'onHit') attribute(g, p, ev as GameEvents['onHit']);
  if (name === 'onDamageTaken') g.vars.taken = (g.vars.taken ?? 0) + (ev as GameEvents['onDamageTaken']).amount;
  if (name === 'onIncoming') g.vars.incoming = (g.vars.incoming ?? 0) + (ev as GameEvents['onIncoming']).amount;
  if (g.procDepth >= RELIC_STACKING.procDepth) return; // a relic reacting to a relic's damage is the last link of the chain
  g.procDepth++;
  const outer = relicContext.acting;
  try {
    for (const id of p.relics.held) {
      relicContext.acting = id;
      run(HOOKS[id], g, name, ev, p);
    }
    relicContext.acting = null;
    for (const set of reachedSets(p)) run(set, g, name, ev, p);
  } finally {
    relicContext.acting = outer;
    g.procDepth--;
  }
  // v0.7: every wave boss is a relic moment (a lair's boss is the lair's moment; the Usurper ends the run)
  const slain = name === 'onKill' ? (ev as GameEvents['onKill']).enemy : null;
  if (slain?.def.boss && !slain.side && slain.def.id !== 'usurper') offerRelics(g, undefined, 'boss');
});

/**
 * Layers a player's relics onto p.mods (already reset to g.baseMods this tick): plain mods and the tick hooks' conditional bonuses add up
 * per key at face value; p.relics.totals keeps the sums for the stats panel. Rebuilds the family counts and set levels when relics change.
 */
export function updateRelics(g: Game, dt: number): void {
  const p = g.player;
  const r = p.relics;
  if (r.dirty) {
    r.static = relicModTotals(r.held, r.tiers);
    r.sets = familySets(r.held, r.duos);
    r.dirty = false;
  }
  for (const key of Object.keys(r.dyn) as (keyof Mods)[]) r.dyn[key] = 0;
  // numbers the families set every tick, back to neutral first (Blessed Water, Butcher's Hook, Charnel)
  g.vars.relicHealMult = 1;
  g.vars['relic.bleedSlow'] = 0;
  g.vars['corpse.mult'] = 1;
  // the per-relic weights for contribution (RELICS.md): static mods, then the tick hooks add their conditional bonuses
  const raw: Partial<Record<RelicId, Partial<Record<keyof Mods, number>>>> = {};
  for (const id of r.held) {
    const mods = relicMods(id, relicTier(r.tiers, id));
    if (mods) raw[id] = Object.fromEntries(Object.entries(mods).map(([k, v]) => [k, BONUS_KEYS.has(k as keyof Mods) ? (k === 'cooldown' ? 1 - v! : v! - 1) : v!]));
  }
  rawBy.set(p, raw);
  for (const id of r.held) {
    relicContext.acting = id;
    HOOKS[id]?.tick?.(g, dt, p);
  }
  relicContext.acting = null;
  for (const set of reachedSets(p)) set.tick?.(g, dt, p);
  for (const id of r.held) if ((r.attune[id] ?? 0) >= 1 && relicTier(r.tiers, id) < RELIC_MAX_TIER) tierUp(g, p, id);
  // armor stacks (Steel): +3% armor each, gone `fade` seconds after the last one was gained
  if (p.armorStacks > 0 && g.time - p.armorStackT > FAMILIES.steel.n.fade) p.armorStacks = 0;
  if (p.armorStacks > 0) r.dyn.armor = (r.dyn.armor ?? 0) + p.armorStacks * FAMILIES.steel.n.stackArmor;
  r.totals = foldRelicMods(r.static, r.dyn);
  combineMods(p.mods, totalsToMods(r.totals));
}

/**
 * Take a relic, at tier 1 (or `tier`: the Merchant's swap keeps the tier). False when it is already held: v0.7 has no duplicates, a relic
 * grows by attunement. `from`: where it came from (RELICS.md).
 */
export function addRelic(g: Game, id: RelicId, from: RelicSource = 'other', tier = 1): boolean {
  const r = g.player.relics;
  if (r.held.includes(id)) return false;
  r.tiers = { ...r.tiers, [id]: Math.min(RELIC_MAX_TIER, tier) };
  r.held = [...r.held, id];
  r.attune[id] = 0;
  r.dirty = true;
  r.found.push(id);
  r.from[id] ??= from;
  HOOKS[id]?.acquire?.(g, g.player);
  floatText(g, g.player.x, g.player.y - 50, relicDef(id).name, '#c9a227', 16);
  sfx('levelup');
  return true;
}

/** A4: a full attunement bar. Tier II strengthens the relic, tier III awakens it; a flash, a sound, and the onRelicTier event (run log, stinger). */
function tierUp(g: Game, p: Player, id: RelicId): void {
  const r = p.relics;
  const tier = relicTier(r.tiers, id) + 1;
  r.tiers = { ...r.tiers, [id]: tier };
  r.attune[id] = 0; // ponytail: progress past a full bar is dropped; carry it over if tiers ever come too slowly
  r.dirty = true;
  HOOKS[id]?.acquire?.(g, p); // Blood Pact's HP cut follows its tier
  const def = relicDef(id);
  const color = FAMILIES[def.family].color;
  floatText(g, p.x, p.y - 60, tier >= RELIC_MAX_TIER ? `${def.icon} ${def.name} awakens: ${def.awaken.name}` : `${def.icon} ${def.name} attuned: tier ${TIER_NUMERALS[tier]}`, color, 17);
  ring(g, p.x, p.y, 70, color, 0.6);
  sfx('levelup');
  emit(g, 'onRelicTier', { id, tier });
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

/** v0.7: a relic's family (RELICS.md). */
export const familyOf = (id: RelicId): FamilyId => relicDef(id).family;

const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

/**
 * v0.7: what taking `id` would do for this player's build right now, in numbers: a plain bonus as its real gain after everything already held
 * (+12% damage on top of +80% is +7% of your damage), a held relic's tier-up and what it has done so far, its family count (A3).
 */
export function relicPreview(p: Player, id: RelicId): string[] {
  const r = p.relics;
  const before = relicModTotals(r.held, r.tiers);
  const after = relicModTotals([...r.held, id], { ...r.tiers, [id]: 1 });
  const lines: string[] = [];
  const gain = (key: keyof Mods) => (after[key]?.eff ?? 0) - (before[key]?.eff ?? 0);
  const mult = (key: keyof Mods) => (1 + (after[key]?.eff ?? 0)) / (1 + (before[key]?.eff ?? 0)) - 1;
  for (const key of Object.keys(relicMods(id, 1) ?? {}) as (keyof Mods)[]) {
    if (key === 'damage') lines.push(`${pct(mult('damage'))} of your damage`);
    else if (key === 'atkSpd') lines.push(`${pct(mult('atkSpd'))} of your attack speed`);
    else if (key === 'cooldown') lines.push(`${pct(gain('cooldown'))} off your ability's cooldown`);
    else if (key === 'armor') lines.push(`${pct(gain('armor'))} armor`);
    else if (key === 'moveSpd' || key === 'gold' || key === 'xp' || key === 'pickup') lines.push(`${pct(mult(key))} ${{ moveSpd: 'movement speed', gold: 'gold', xp: 'experience', pickup: 'pickup radius' }[key]}`);
    if (after[key] && after[key]!.eff < after[key]!.raw - 1e-9) lines[lines.length - 1] += ' (soft-capped)';
  }
  const fam = familyOf(id);
  {
    const n = r.sets[fam]?.count ?? 0;
    const set = (SET_LEVELS as readonly number[]).includes(n + 1) ? `: ${FAMILIES[fam].sets[(n + 1) as SetLevel][0]}` : '';
    lines.push(`${FAMILIES[fam].icon} ${FAMILIES[fam].name} ${n} → ${n + 1}${set}`);
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
  return rollOffer(pool, r.held, r.rng, n, familyOf, RELIC_MOMENTS.heldFamilyWeight, r.offers.flatMap((o) => o.options));
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
  const options = rollOffer(pool, p.relics.held, p.relics.rng, offer.options.length, familyOf, RELIC_MOMENTS.heldFamilyWeight, [...others, ...offer.options]);
  if (!options.length) return false;
  offer.options = options;
  offer.rerolls--;
  return true;
}
