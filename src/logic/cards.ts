import { CARDS, TUTORIAL, type CardId, type TutorialCard } from '../config/cards';
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

/** #60: what the tutorial cards need to know about the run (built by the screen between ticks, so tests need no game). */
export interface TutorialView {
  realm?: string; // the realm level being played, if any
  level?: number;
  tick: number; // ticks into the level
  held: number; // relics held
  setLevel: number; // the highest set level lit (0, 2, 4 or 6)
  utility: boolean; // the utility ability is unlocked
  levelUp: boolean; // a level-up is waiting
  status: boolean; // a status effect is on a foe near the champion, or on the champion
}

/** #60: the Marches' levels 1 and 2 are the tutorial; nowhere else shows its cards. */
export const inTutorial = (v: Pick<TutorialView, 'realm' | 'level'>): boolean => v.realm === TUTORIAL.realm && (v.level ?? 0) >= 1 && (v.level ?? 0) <= TUTORIAL.levels;

/**
 * #60: the first tutorial card not yet seen whose moment has come, or null. `choice`: a choice screen is about to open, when only the
 * level-up card may show (it comes before its screen); the others wait for play. Pure and read-only, like nextCard.
 */
export function tutorialCard(v: TutorialView, seen: readonly string[], choice = false): TutorialCard | null {
  if (!inTutorial(v)) return null;
  const due: [TutorialCard, boolean][] = choice
    ? [['levelUp', v.levelUp]]
    : [
        ['move', true],
        ['relics', v.held > 0 && v.tick >= TUTORIAL.relicsAfter],
        ['ability', v.tick >= TUTORIAL.abilityAfter],
        ['levelUp', v.levelUp],
        ['utility', v.utility],
        ['sets', v.setLevel >= 2],
        ['status', v.status],
      ];
  for (const [id, now] of due) if (now && !seen.includes(id)) return id;
  return null;
}

/** #60: a status effect on the champion or on a living, visible foe it has met (CARDS.meetRadius). */
export function statusSeen(foes: readonly { x: number; y: number; dead: boolean; hidden: boolean; statuses: object }[], px: number, py: number, own: object): boolean {
  const any = (m: object) => Object.keys(m).some((k) => k !== 'immune');
  if (any(own)) return true;
  const r2 = CARDS.meetRadius * CARDS.meetRadius;
  return foes.some((e) => !e.dead && !e.hidden && (e.x - px) ** 2 + (e.y - py) ** 2 <= r2 && any(e.statuses));
}
