import { mulberry32 } from '../core/math';
import type { Game, Player, SeededRng } from '../core/types';
import { hashSeed } from './acts';

/** Players 2-4 roll from their own stream split from the run seed, so a second player's crits never shift the world's draws. */
export const rollStream = (seed: number, player: number): SeededRng => mulberry32(hashSeed(`rolls:${seed}:${player}`));

/**
 * v0.8 (#28, ARCHITECTURE.md step 4): a run holds 1-4 players. Most systems still read `g.player` and `g.input`; they now mean the
 * focused player, and updateGame gives each player a turn with focus on them. Outside a turn the focus is players[0], so a
 * single-player run reads exactly what it always did. ponytail: a focus swap instead of `p` threaded through ~480 sites; the sites
 * move to taking a `p` file by file, and the swap goes when none are left.
 */
export function focus(g: Game, p: Player): void {
  if (g.player === p) return;
  g.player.input = g.input; // g.input is the live copy of the focused player's intent
  g.player = p;
  g.input = p.input;
}

/** Run `fn` as player `p` (their systems, their events, their hits), then give the focus back. */
export function withPlayer<T>(g: Game, p: Player, fn: () => T): T {
  const prev = g.player;
  if (prev === p) return fn();
  focus(g, p);
  try {
    return fn();
  } finally {
    focus(g, prev);
  }
}

/** The closest player to a point; players[0] on a tie, so one player is always the answer it was. */
export function nearestPlayer(g: Game, x: number, y: number): Player {
  let best = g.players[0];
  let bestD = (best.x - x) ** 2 + (best.y - y) ** 2;
  for (let i = 1; i < g.players.length; i++) {
    const p = g.players[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) (bestD = d), (best = p);
  }
  return best;
}

export const isPlayer = (g: Game, t: object): t is Player => g.players.includes(t as Player);

/** A player's current intent: the live g.input while they have the focus, their own copy otherwise. */
export const inputOf = (g: Game, p: Player): Game['input'] => (p === g.player ? g.input : p.input);
