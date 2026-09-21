import type { ClassDef } from '../config/classes';
import { GAME } from '../config/game';
import { STAT_LABELS, TRADEOFF_CHANCE, TRADEOFF_IDS, TRADEOFFS, UPGRADE_CHOICES, UPGRADE_RARITIES, UPGRADES, type TradeoffDef, type TradeoffId, type UpgradeRarity } from '../config/upgrades';
import { pickWeighted } from '../core/math';
import type { Mods, Rng, StatKey, Stats } from '../core/types';
import { STAT_KEYS } from '../core/types';
import { combineMods } from './mods';

/** n distinct upgrade options. 'secondary' is the class's own stat, so every class's pool differs. */
export function rollUpgrades(rng: Rng, n = UPGRADE_CHOICES): StatKey[] {
  const pool = [...STAT_KEYS];
  const out: StatKey[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/** What one stat boon gives at a rarity: the bonus part is scaled, so an epic "x1.10" is "x1.25". */
export function upgradeAmount(key: StatKey, rarity: UpgradeRarity = 'common'): number {
  const u = UPGRADES[key];
  const mult = UPGRADE_RARITIES[rarity].mult;
  return u.mode === 'mult' ? 1 + (u.amount - 1) * mult : Math.round(u.amount * mult);
}

export function applyStatUpgrade(stats: Stats, key: StatKey, rarity: UpgradeRarity = 'common'): Stats {
  const amount = upgradeAmount(key, rarity);
  return { ...stats, [key]: UPGRADES[key].mode === 'mult' ? stats[key] * amount : stats[key] + amount };
}

export function statLabel(key: StatKey, cls: ClassDef): string {
  return key === 'secondary' ? cls.secondary.name : STAT_LABELS[key];
}

export function upgradeText(key: StatKey, cls: ClassDef): { title: string; desc: string } {
  const title = statLabel(key, cls);
  if (key !== 'secondary') return { title, desc: UPGRADES[key].desc };
  return { title, desc: `+${UPGRADES.secondary.amount} ${title} — ${cls.secondary.desc}` };
}

// ---------- v0.2: rarities, tradeoffs ----------

export type LevelUpOption = { kind: 'stat'; key: StatKey; rarity: UpgradeRarity } | { kind: 'tradeoff'; id: TradeoffId };

function rollRarity(rng: Rng): UpgradeRarity {
  const rarities = Object.keys(UPGRADE_RARITIES) as UpgradeRarity[];
  return pickWeighted(rarities.map((r) => ({ weight: UPGRADE_RARITIES[r].weight, value: r })), rng);
}

/** Three distinct boons, each with a rolled rarity; sometimes the last one is a tradeoff not taken yet this run. */
export function rollLevelUpOptions(rng: Rng, taken: TradeoffId[] = []): LevelUpOption[] {
  const options: LevelUpOption[] = rollUpgrades(rng).map((key) => ({ kind: 'stat', key, rarity: rollRarity(rng) }));
  const tradeoffs = TRADEOFF_IDS.filter((id) => !taken.includes(id));
  if (tradeoffs.length > 0 && rng() < TRADEOFF_CHANCE) {
    options[options.length - 1] = { kind: 'tradeoff', id: tradeoffs[Math.floor(rng() * tradeoffs.length)] };
  }
  return options;
}

export function applyTradeoff(stats: Stats, mods: Mods, id: TradeoffId): { stats: Stats; mods: Mods } {
  const t: TradeoffDef = TRADEOFFS[id];
  const next = { ...stats };
  for (const key of Object.keys(t.stats ?? {}) as StatKey[]) {
    const change = t.stats![key]!;
    next[key] = next[key] * (change.mult ?? 1) + (change.add ?? 0);
  }
  next.hp = Math.max(GAME.minMaxHp, Math.round(next.hp));
  return { stats: next, mods: combineMods({ ...mods }, t.mods ?? {}) };
}

export function optionText(o: LevelUpOption, cls: ClassDef): { title: string; desc: string; tag: string } {
  if (o.kind === 'tradeoff') return { title: TRADEOFFS[o.id].name, desc: TRADEOFFS[o.id].desc, tag: 'Tradeoff' };
  const title = statLabel(o.key, cls);
  const amount = upgradeAmount(o.key, o.rarity);
  const gain = UPGRADES[o.key].mode === 'mult' ? `+${Math.round((amount - 1) * 100)}%` : `+${amount}`;
  const what = o.key === 'secondary' ? cls.secondary.desc : UPGRADES[o.key].desc.replace(/^\S+\s*/, '');
  return { title, desc: `${gain} ${o.key === 'secondary' ? `${title} — ${what}` : what}`, tag: UPGRADE_RARITIES[o.rarity].name };
}
