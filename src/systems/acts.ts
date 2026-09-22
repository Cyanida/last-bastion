import { MERCHANT } from '../config/acts';
import { ARENAS } from '../config/arenas';
import { RELIC_DROPS, relicDef, type Rarity, type RelicId } from '../config/relics';
import { sfx } from '../core/audio';
import type { Game } from '../core/types';
import { actName, arenaFor, merchantPrice, themeFor, type MerchantItem } from '../logic/acts';
import { relicTier, rollRelics } from '../logic/relics';
import { floatText } from './effects';
import { gainXp } from './leveling';
import { addRelic, removeRelic } from './relics';

/** Pay for a Merchant item. Gold spent here never reaches the Keep: this run, or the next hundred? */
function pay(g: Game, item: MerchantItem): boolean {
  const price = merchantPrice(item, g.act);
  if (g.gold < price) return false;
  g.gold -= price;
  g.merchantSpent += price;
  sfx('xp');
  return true;
}

export function merchantHeal(g: Game): boolean {
  if (g.player.hp >= g.player.stats.hp || !pay(g, 'heal')) return false;
  g.player.hp = Math.min(g.player.stats.hp, g.player.hp + g.player.stats.hp * MERCHANT.heal.frac); // not healPlayer: the No Respite curse does not bind the Merchant
  return true;
}

/** A random relic of that rarity: new, or a tier up for one you hold (the drop rules apply, so a full reliquary buys mostly upgrades). */
export function merchantBuy(g: Game, rarity: Rarity): boolean {
  const ofRarity = (id: RelicId) => relicDef(id).rarity === rarity;
  const [id] = rollRelics(g.relicPool.filter(ofRarity), g.relics.filter(ofRarity), g.relicTiers, g.rng, 1);
  return id !== undefined && pay(g, `buy:${rarity}`) && addRelic(g, id);
}

/** Swap a held relic for a random new one of the same rarity, at the same tier. */
export function merchantReroll(g: Game, id: RelicId): boolean {
  const tier = relicTier(g.relicTiers, id);
  if (tier === 0) return false;
  const pool = g.relicPool.filter((r) => relicDef(r).rarity === relicDef(id).rarity && !g.relics.includes(r));
  const [next] = rollRelics(pool, [], {}, g.rng, 1);
  if (next === undefined || !pay(g, 'reroll')) return false;
  removeRelic(g, id);
  for (let t = 0; t < tier; t++) addRelic(g, next);
  return true;
}

export const sellPrice = (id: RelicId, tier: number, act: number): number => Math.round(merchantPrice(`buy:${relicDef(id).rarity}`, act) * RELIC_DROPS.sellFrac * tier);
export const salvageValue = (id: RelicId, tier: number): number => RELIC_DROPS.salvage[relicDef(id).rarity] * tier;

/** Sell a relic back for gold (all its tiers go). */
export function merchantSell(g: Game, id: RelicId): boolean {
  const tier = relicTier(g.relicTiers, id);
  if (tier === 0) return false;
  g.gold += sellPrice(id, tier, g.act);
  sfx('xp');
  return removeRelic(g, id);
}

/** Break a relic down into Rune shards (the Keep's second currency, v0.4) instead of gold. */
export function merchantSalvage(g: Game, id: RelicId): boolean {
  const tier = relicTier(g.relicTiers, id);
  if (tier === 0) return false;
  g.salvage += salvageValue(id, tier);
  sfx('xp');
  return removeRelic(g, id);
}

/** Leave the Merchant: on to the next Act, in the next arena. */
export function nextAct(g: Game): void {
  g.pendingMerchant = false;
  g.act++;
  g.arena = ARENAS[arenaFor(g.act, g.startArena)];
  const p = g.player;
  p.x = g.arena.w / 2;
  p.y = g.arena.h / 2;
  // nothing is left lying on the old field: loot is swept up, stragglers and hazards stay behind
  for (const k of g.pickups) {
    if (k.kind === 'xp') gainXp(g, k.value);
    else if (k.kind === 'gold') g.gold += k.value;
  }
  for (const e of g.enemies) e.dead = true;
  g.enemies.length = g.pickups.length = g.corpses.length = g.fields.length = g.zones.length = g.projectiles.length = g.barriers.length = g.squads.length = 0;
  g.minions.forEach((m, i) => Object.assign(m, { x: p.x + 40 * Math.cos(i * 2), y: p.y + 40 * Math.sin(i * 2) }));
  const theme = themeFor(g.act, g.seed);
  g.banner = { text: `${actName(g.act)} — ${theme.name}`, t: 3.5 };
  floatText(g, p.x, p.y - 50, g.arena.name, '#e9c95a', 16);
  sfx('wave');
}
