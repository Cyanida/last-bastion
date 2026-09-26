import { CARDS, type CardId } from '../config/cards';
import type { EnemyId } from '../config/enemies';

/** What a flash card needs to know about a foe on the field (a structural slice of Enemy, so tests need no game). */
export interface CardFoe {
  x: number;
  y: number;
  def: { id: EnemyId };
  elite: boolean;
  hidden: boolean;
  dead: boolean;
  windupT: number;
}

/**
 * v0.8 (#124): the first card not yet seen among the foes near the player: the foe itself, then an elite, then a marked attack.
 * Pure and read-only: the screen calls it between ticks, so the simulation (the Daily Trial, the golden runs) never sees it.
 * #133: it also names the foe that brought the card, for the card's picture and the arena's spotlight.
 */
export function nextCard<F extends CardFoe>(foes: readonly F[], px: number, py: number, seen: readonly string[]): { id: CardId; foe: F } | null {
  const r2 = CARDS.meetRadius * CARDS.meetRadius;
  for (const e of foes) {
    if (e.dead || e.hidden || (e.x - px) ** 2 + (e.y - py) ** 2 > r2) continue;
    if (!seen.includes(e.def.id)) return { id: e.def.id, foe: e };
    if (e.elite && !seen.includes('elite')) return { id: 'elite', foe: e };
    if (e.windupT > 0 && !seen.includes('telegraph')) return { id: 'telegraph', foe: e };
  }
  return null;
}
