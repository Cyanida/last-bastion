import type { Enemy, Game } from '../core/types';
import { bossCueName, hasBossSounds, nextBossCue } from '../logic/bossSounds';
import { by, sfx } from '../sim/view';

/**
 * #286: each boss's own sounds (config/bossSounds.ts): his signature the first step he is on the field, a cue as each phase begins and
 * his big-move sound whenever he warns. It reads what the bosses did this step (their phase, and the warnings already in g.out) rather
 * than every boss script calling it, so a boss script stays as it is. Runs right after updateEnemies.
 */
const heard = new WeakMap<Enemy, number>(); // the phase whose cue a boss has made (his arrival: his first phase)
const bosses: Enemy[] = []; // scratch: this step's bosses
const warned: boolean[] = [];

export function updateBossSounds(g: Game): void {
  bosses.length = 0;
  for (const e of g.enemies) if (e.def.boss && !e.dead) bosses.push(e);
  if (bosses.length === 0) return;
  warned.length = 0;
  for (let i = 0; i < bosses.length; i++) warned.push(false);
  // a boss's warning cue carries where he was: it is the nearest boss's (nearly always the only one)
  for (const c of g.out) {
    if (c.name !== 'warn' || c.src !== 'boss') continue;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < bosses.length; i++) {
      const d = (bosses[i].x - c.x) ** 2 + (bosses[i].y - c.y) ** 2;
      if (d < bestD) (best = i), (bestD = d);
    }
    warned[best] = true;
  }
  for (let i = 0; i < bosses.length; i++) {
    const e = bosses[i];
    if (!hasBossSounds(e.def.id)) continue;
    const cue = nextBossCue(heard.get(e), e.phase, warned[i]);
    if (!cue) continue;
    heard.set(e, Math.max(heard.get(e) ?? 0, e.phase));
    sfx(g, bossCueName(e.def.id, cue.kind, cue.phase), by(e));
  }
}
