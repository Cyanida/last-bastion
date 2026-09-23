import { ACT_THEMES, ACTS, FINAL, MERCHANT } from '../config/acts';
import { ROUTES } from '../config/routes';
import { addListener, type GameEvents } from '../core/events';
import { routeChoices, type Route } from '../logic/routes';
import { markRoute } from './runlog';
import { ARENAS } from '../config/arenas';
import { RELIC_DROPS, relicDef, type Rarity, type RelicId, RELIC_MOMENTS } from '../config/relics';
import { sfx } from '../core/audio';
import type { Game } from '../core/types';
import { actName, arenaFor, isActEnd, merchantPrice, themeFor, type MerchantItem } from '../logic/acts';
import { relicTier, rollRelics } from '../logic/relics';
import { floatText } from './effects';
import { gainXp } from './leveling';
import { addRelic, offerRelics, removeRelic } from './relics';
import { initRegions, shrineChoices } from './regions';
import { initQuests } from './quests';
import { takeFragment } from './treasures';

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

/** v0.7: a relic moment of that rarity: pay, then pick one of three relics you do not hold. */
export function merchantBuy(g: Game, rarity: Rarity): boolean {
  if (g.midMerchant || (g.vars.merchantRelics ?? 0) >= RELIC_MOMENTS.merchantPerVisit) return false; // v0.7: one relic moment a visit, none at the caravan
  const pool = g.player.relics.pool.filter((id) => relicDef(id).rarity === rarity);
  if (!pool.some((id) => !g.player.relics.held.includes(id)) || !pay(g, `buy:${rarity}`)) return false;
  offerRelics(g, RELIC_MOMENTS.choices, 'merchant', g.player, pool);
  g.vars.merchantRelics = (g.vars.merchantRelics ?? 0) + 1;
  return true;
}

/** Swap a held relic for a random new one of the same rarity, at the same tier. */
export function merchantReroll(g: Game, id: RelicId): boolean {
  const tier = relicTier(g.player.relics.tiers, id);
  if (tier === 0) return false;
  const pool = g.player.relics.pool.filter((r) => relicDef(r).rarity === relicDef(id).rarity && !g.player.relics.held.includes(r));
  const [next] = rollRelics(pool, [], g.rng, 1);
  if (next === undefined || !pay(g, 'reroll')) return false;
  removeRelic(g, id);
  addRelic(g, next, 'merchant', tier);
  return true;
}

export const sellPrice = (id: RelicId, tier: number, act: number): number => Math.round(merchantPrice(`buy:${relicDef(id).rarity}`, act) * RELIC_DROPS.sellFrac * tier);
export const salvageValue = (id: RelicId, tier: number): number => RELIC_DROPS.salvage[relicDef(id).rarity] * tier;

/** Sell a relic back for gold (all its tiers go). */
export function merchantSell(g: Game, id: RelicId): boolean {
  const tier = relicTier(g.player.relics.tiers, id);
  if (tier === 0) return false;
  g.gold += sellPrice(id, tier, g.act);
  sfx('xp');
  return removeRelic(g, id);
}

/** Break a relic down into Rune shards (the Keep's second currency, v0.4) instead of gold. */
export function merchantSalvage(g: Game, id: RelicId): boolean {
  const tier = relicTier(g.player.relics.tiers, id);
  if (tier === 0) return false;
  g.salvage += salvageValue(id, tier);
  sfx('xp');
  return removeRelic(g, id);
}

/** v0.6: this Act's theme: the one its route chose, else the rotation (Act I is always The Levy, Act IV the Usurper's host). */
export function actTheme(g: Game): (typeof ACT_THEMES)[number] {
  const t = g.route?.theme;
  return t === undefined ? themeFor(g.act, g.seed) : t < 0 ? FINAL.theme : ACT_THEMES[t];
}

/** Leave the Merchant: on with the Act (the Merchant path's visit halfway), or to the fork in the road (v0.6). */
export function leaveMerchant(g: Game): void {
  g.pendingMerchant = false;
  g.vars.merchantRelics = 0; // v0.7: one relic moment a visit
  if (g.midMerchant) g.midMerchant = false;
  else g.pendingRoute = routeChoices(g.seed, g.act, g.arena.id);
}

/** Take one of the routes on offer into the next Act. */
export function chooseRoute(g: Game, i: number): void {
  const route = g.pendingRoute?.[i];
  if (!route) return;
  g.pendingRoute = null;
  nextAct(g, route);
}

/** On to the next Act, in the route's arena (or the rotation's, without one). */
export function nextAct(g: Game, route: Route | null = null): void {
  g.pendingMerchant = false;
  g.midMerchant = false;
  g.pendingRoute = null;
  g.act++;
  g.route = route;
  g.arena = ARENAS[route?.arena ?? arenaFor(g.act, g.startArena)];
  initRegions(g);
  const p = g.player;
  p.x = g.arena.w / 2;
  p.y = g.arena.h / 2;
  // nothing is left lying on the old field: loot is swept up, stragglers and hazards stay behind
  for (const k of g.pickups) {
    if (k.kind === 'xp') gainXp(g, k.value);
    else if (k.kind === 'gold') g.gold += k.value;
    else if (k.kind === 'fragment') takeFragment(g);
  }
  for (const e of g.enemies) e.dead = true;
  g.enemies.length = g.pickups.length = g.corpses.length = g.fields.length = g.zones.length = g.projectiles.length = g.barriers.length = g.squads.length = 0;
  g.minions.forEach((m, i) => Object.assign(m, { x: p.x + 40 * Math.cos(i * 2), y: p.y + 40 * Math.sin(i * 2) }));
  const theme = actTheme(g);
  g.banner = { text: `${actName(g.act)} — ${theme.name}`, t: 3.5 };
  if (route) markRoute(g, `${ROUTE_NAMES[route.focus]} · ${g.arena.name} · ${theme.name}`);
  if (route?.focus === 'pilgrim') g.pendingShrine = shrineChoices(g); // a blessing to start the Act with
  floatText(g, p.x, p.y - 50, g.arena.name, '#e9c95a', 16);
  sfx('wave');
  initQuests(g); // what is left of the old Act's quests fails; a new board is up
}

const ROUTE_NAMES = { elite: 'Elite path', merchant: 'Merchant path', pilgrim: 'Pilgrim path', siege: 'Siege path' } as const;

/** v0.6 Siege path: the Act's boss pays Runes on top of the capped ones. */
addListener((g, name, ev) => {
  if (name !== 'onKill' || g.route?.focus !== 'siege' || !isActEnd(g.wave)) return;
  const e = (ev as GameEvents['onKill']).enemy;
  if (e.def.boss && !e.side && (ACTS.bosses.includes(e.def.id) || e.def.id === FINAL.boss)) g.questRunes += ROUTES.siege.runes;
});
