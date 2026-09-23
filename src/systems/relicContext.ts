import { ATTUNEMENT, keyColor, keyIcon, type RelicKey } from '../config/relics';
import type { Game, Player } from '../core/types';
import { addWork } from '../logic/relics';
import { floatText } from './effects';

/**
 * v0.7: the relic whose hook is running right now. Relic damage and healing are credited to it (RELICS.md), its icon flashes over the player,
 * and its damage numbers take its colour. A module of its own so combat can read it (and credit relics) without importing the relic system.
 */
export const relicContext: { acting: RelicKey | null } = { acting: null }; // a relic, a duo (A5) or a family's set bonuses (A8)

/** RELICS.md: credit a relic with what it did; `proc` also flashes its icon over the player (at most every 1.2 s per relic). */
export function credit(g: Game, p: Player, id: RelicKey, kind: 'damage' | 'healing' | 'prevented', amount: number, proc = false): void {
  if (!(amount > 0)) return;
  const s = (p.relics.stats[id] ??= { damage: 0, healing: 0, prevented: 0 });
  s[kind] += amount;
  if (kind === 'prevented') g.vars.prevented = (g.vars.prevented ?? 0) + amount; // all that relics turned away: the mitigation share's denominator (with damage taken)
  if (proc) flash(g, p, id);
  const a = ATTUNEMENT;
  addWork(p.relics, id, kind === 'damage' ? (a.damage * amount) / Math.max(1, g.vars.waveDealtRef ?? a.refDamage) : (a.support * amount) / p.stats.hp);
}

const RELIC_FLASH = 1.2;
export function flash(g: Game, p: Player, id: RelicKey): void {
  const key = `flash.${id}`;
  if (g.time - (g.vars[key] ?? -99) < RELIC_FLASH) return;
  g.vars[key] = g.time;
  floatText(g, p.x + (g.rng() - 0.5) * 30, p.y - p.r - 34, keyIcon(id), keyColor(id), 15);
}
