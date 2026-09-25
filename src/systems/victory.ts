import { ACTS, FINAL } from '../config/acts';
import { VICTORY } from '../config/economy';
import { sfx } from '../sim/view';
import { addListener, type GameEvents } from '../core/events';
import type { Game } from '../core/types';
import { burst, ring, shake } from './effects';

/**
 * v0.6: the end of a run. When the Usurper falls his host breaks (whoever is left throws down their arms, nothing more comes),
 * and the run waits on the player: bank the win, or go on into Endless (the Merchant, then Act V and the old infinite scaling).
 */
addListener((g, name, ev) => {
  if (name !== 'onKill' || g.victory !== 'none' || (ev as GameEvents['onKill']).enemy.def.id !== FINAL.boss) return;
  g.victory = 'pending';
  g.victoryKills = g.kills;
  g.spawnQueue.length = 0;
  for (const e of g.enemies) {
    if (e.dead || e.side) continue;
    e.dead = true; // no bounty: they surrender
    burst(g, e.x, e.y, '#e8e2d0', 6, 120);
  }
  const u = (ev as GameEvents['onKill']).enemy;
  ring(g, u.x, u.y, 320, '#e9c95a', 1.2);
  shake(g, 18);
  sfx(g, 'levelup');
  g.banner = { text: 'The Usurper has fallen', t: 5 };
});

/** On past the Usurper: the Merchant (already due, wave 40 ended an Act) and then Act V. */
export function goEndless(g: Game): void {
  g.victory = 'endless';
}

/** Endless: VICTORY.scorePerWave for every wave cleared past the Usurper, plus one per kill since he fell. 0 before Endless. */
export const endlessScore = (g: Game): number =>
  g.victory === 'endless' ? Math.max(0, g.wavesCleared - FINAL.act * ACTS.length) * VICTORY.scorePerWave + (g.kills - g.victoryKills) : 0;
