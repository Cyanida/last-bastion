import { MERCHANT } from '../config/acts';
import { ARENAS } from '../config/arenas';
import { relicDef, type Rarity } from '../config/relics';
import { sfx } from '../core/audio';
import type { Game } from '../core/types';
import { actName, arenaFor, merchantPrice, randomRelic, themeFor, type MerchantItem } from '../logic/acts';
import { floatText } from './effects';
import { gainXp } from './leveling';
import { addRelic } from './relics';

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

export function merchantBuy(g: Game, rarity: Rarity): boolean {
  if (g.relics.length >= g.relicSlots) return false;
  const id = randomRelic(g.relicPool, g.relics, rarity, g.rng);
  return id !== null && pay(g, `buy:${rarity}`) && addRelic(g, id);
}

/** Swap a held relic for a random one of the same rarity. */
export function merchantReroll(g: Game, index: number): boolean {
  const old = g.relics[index];
  if (!old) return false;
  const id = randomRelic(g.relicPool, g.relics, relicDef(old).rarity, g.rng);
  if (id === null || !pay(g, 'reroll')) return false;
  g.relics = g.relics.filter((_, i) => i !== index);
  return addRelic(g, id);
}

export function merchantRemove(g: Game, index: number): boolean {
  if (!g.relics[index] || !pay(g, 'remove')) return false;
  g.relics = g.relics.filter((_, i) => i !== index);
  return true;
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
