import { SQUADS } from '../config/director';
import { EVENTS, type EventKind } from '../config/events';
import { sfx } from '../sim/view';
import { addListener, type GameEvents } from '../core/events';
import { compact, pickWeighted, TAU } from '../core/math';
import type { Game, Rng, WaveEvent } from '../core/types';
import { createMinion } from '../entities/actors';
import { addField } from '../entities/hazards';
import { merchantPrice } from '../logic/acts';
import { squadPlan, squadUnits } from '../logic/director';
import { rollAffixes } from '../logic/elites';
import { enemyDmgMult, enemyHpMult } from '../logic/formulas';
import { placeRng, rollEvent } from '../logic/quests';
import { clampToRects, floorPoint, regionAt } from '../logic/regions';
import { pacingOf, unlockedPool } from '../logic/waves';
import { moveTo, POISON } from './aiHelpers';
import { floatText, ring, shake } from './effects';
import { clearPoint } from './movement';
import { regionsOf } from './regions';
import { spawnEnemy, spawnSquad } from './spawning';

/**
 * Seeded wave events (v0.5, config/events.ts). Rolled when a wave starts (logic/quests.ts rollEvent), gone when it ends:
 * the peddler packs up, the knight rides on, the cart rolls off. The ambush pays its bonus only if the wave was cleared.
 */
const START: Partial<Record<EventKind, (g: Game, ev: WaveEvent, rng: Rng) => void>> = {
  peddler(_g, ev) {
    ev.stock = EVENTS.peddler.stock;
  },

  knight(g, ev) {
    const c = EVENTS.knight;
    const p = g.player;
    ev.unit = createMinion(p.x + 40, p.y, { hp: Math.round(c.hp * enemyDmgMult(g.wave) * g.tier.enemyDmg), damage: c.damage * enemyHpMult(g.wave), speed: c.speed, attackCd: c.attackCd, life: Infinity, r: 15, scale: 3.5 });
    ev.unit.kind = 'knight';
    g.minions.push(ev.unit);
    ring(g, ev.unit.x, ev.unit.y, 60, '#e9c95a');
  },

  // a straight line across the floor you stand on, from one side to the other
  plagueCart(g, ev, rng) {
    const p = g.player;
    const f = regionAt(regionsOf(g), p.x, p.y)?.floor ?? g.openFloors[0];
    const t = 0.2 + rng() * 0.6;
    const ends = f.w >= f.h
      ? [{ x: f.x + 40, y: f.y + f.h * t }, { x: f.x + f.w - 40, y: f.y + f.h * t }]
      : [{ x: f.x + f.w * t, y: f.y + 40 }, { x: f.x + f.w * t, y: f.y + f.h - 40 }];
    if (rng() < 0.5) ends.reverse();
    ev.foe = spawnEnemy(g, 'plagueCart', ends[0].x, ends[0].y);
    ev.x = ends[1].x;
    ev.y = ends[1].y;
    ev.foe.side = true;
  },
};

function startEvent(g: Game): void {
  const kind = rollEvent(g.seed, g.wave);
  if (!kind) return;
  const rng = placeRng(g.seed, g.wave);
  const at = clearPoint(g, floorPoint(g.openFloors, rng, 120));
  const ev: WaveEvent = { kind, x: at.x, y: at.y, unit: null, foe: null, used: false, t: 0, stock: 0 };
  g.event = ev;
  g.eventsSeen++;
  START[kind]?.(g, ev, rng);
  const name = `${EVENTS[kind].icon} ${EVENTS[kind].name}`;
  g.banner = { text: pacingOf(g.wave) === 'breather' ? `A lull — ${name}` : `${g.banner.text} · ${name}`, t: 3 };
}

/** Two squads at once, from opposite sides of the player (the director's squad path, placed by hand). */
function springAmbush(g: Game): void {
  const p = g.player;
  const pool = SQUADS.filter((t) => t.from <= g.wave).map((t) => ({ value: t, weight: t.weight }));
  const a = g.rng() * TAU;
  for (const side of [1, -1]) {
    const t = pool.length ? pickWeighted(pool, g.rng) : SQUADS[0];
    const at = { x: p.x + Math.cos(a) * EVENTS.ambush.dist * side, y: p.y + Math.sin(a) * EVENTS.ambush.dist * side, r: 30 };
    clampToRects(g.openRects, at);
    const index = g.squadPlans.push(squadPlan(t)) - 1;
    spawnSquad(g, index, squadUnits(t, index), at);
  }
  g.banner = { text: 'Ambush!', t: 2 };
  sfx(g, 'warn');
  shake(g, 8);
}

function openCursedChest(g: Game, ev: WaveEvent): void {
  const p = g.player;
  // v0.7: the chest pays in gold and a Rune shard; relics come at fixed moments
  g.player.gold += EVENTS.cursedChest.gold * g.act;
  g.salvage += 1;
  floatText(g, p.x, p.y - 44, `+${EVENTS.cursedChest.gold * g.act}g · ◆ shard`, '#c9a227', 16);
  const pool = unlockedPool(g.wave, null);
  for (let i = 0; i < EVENTS.cursedChest.elites; i++) {
    const a = (i / EVENTS.cursedChest.elites) * TAU + g.rng();
    const e = spawnEnemy(g, pickWeighted(pool, g.rng), p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, rollAffixes(g.wave, g.rng));
    e.side = true;
  }
  ring(g, ev.x, ev.y, 90, '#a77fd0', 0.6);
  g.banner = { text: 'The chest was cursed!', t: 2 };
  sfx(g, 'warn');
  shake(g, 8);
}

/** The wave is over: the event goes with it. */
function endEvent(g: Game, ev: WaveEvent): void {
  if (ev.kind === 'ambush' && ev.used && !g.enemies.some((e) => !e.side && !e.dead)) {
    const gold = EVENTS.ambush.gold * g.act;
    g.player.gold += gold;
    floatText(g, g.player.x, g.player.y - 80, `Ambush repelled +${gold}g`, '#c9a227', 15);
  }
  if (ev.unit) compact(g.minions, (m) => m !== ev.unit);
  if (ev.foe && !ev.foe.dead) ev.foe.dead = true; // the cart rolls off the field
  g.event = null;
}

export function updateEvents(g: Game, dt: number): void {
  const ev = g.event;
  if (!ev) return;
  if (g.breather > 0) return endEvent(g, ev);
  const p = g.player;
  const d = Math.hypot(p.x - ev.x, p.y - ev.y);
  if (ev.kind === 'peddler') {
    if (d > EVENTS.peddler.reach * 2) ev.used = false; // walked away: he will trade again
    else if (d < EVENTS.peddler.reach && !ev.used && ev.stock > 0) {
      ev.used = true;
      g.pendingShop = true;
    }
  } else if (ev.kind === 'cursedChest' && !ev.used && d < EVENTS.cursedChest.reach) {
    ev.used = true;
    openCursedChest(g, ev);
  } else if (ev.kind === 'ambush' && !ev.used && (g.waveT >= EVENTS.ambush.delay || g.spawnQueue.length === 0)) {
    ev.used = true;
    springAmbush(g);
  } else if (ev.kind === 'plagueCart' && ev.foe && !ev.foe.dead) {
    const c = EVENTS.plagueCart;
    if (moveTo(ev.foe, ev.x, ev.y, c.speed, dt) < 10) ev.foe.dead = true; // made it across: gone, and its gold with it
    else if ((ev.t -= dt) <= 0) {
      ev.t = c.poolEvery;
      addField(g, { x: ev.foe.x, y: ev.foe.y, r: c.pool.r, life: c.pool.life, dps: c.pool.dps * g.waveDmgMult * g.tier.enemyDmg, hostile: true, color: POISON });
    }
  }
}

export const peddlerPrice = (g: Game): number => merchantPrice('heal', g.act);

/** v0.7: buy the peddler's healing draught. Gold spent here never reaches the Keep, as with the Merchant. */
export function peddlerBuy(g: Game): boolean {
  const ev = g.event;
  const price = peddlerPrice(g);
  const p = g.player;
  if (!ev || ev.stock <= 0 || g.player.gold < price || p.hp >= p.stats.hp) return false;
  g.player.gold -= price;
  g.merchantSpent += price;
  ev.stock--;
  p.hp = Math.min(p.stats.hp, p.hp + p.stats.hp * EVENTS.peddler.heal); // like the Merchant's surgeon, not healPlayer: No Respite does not bind him
  floatText(g, p.x, p.y - 34, `+${Math.round(p.stats.hp * EVENTS.peddler.heal)}`, '#6f8f4e', 15);
  sfx(g, 'xp');
  return true;
}

addListener((g, name, ev) => {
  if (name === 'onWaveStart') startEvent(g);
  else if (name === 'onKill' && g.event?.foe === (ev as GameEvents['onKill']).enemy) {
    const gold = EVENTS.plagueCart.gold * g.act;
    g.player.gold += gold;
    floatText(g, g.event.foe.x, g.event.foe.y - 40, `+${gold}g`, '#c9a227', 16);
  }
});
