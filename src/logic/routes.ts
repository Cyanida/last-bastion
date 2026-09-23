import { ACT_THEMES, FINAL } from '../config/acts';
import { ARENA_IDS, type ArenaId } from '../config/arenas';
import { ROUTES, type RouteFocus } from '../config/routes';
import { mulberry32 } from '../core/math';
import { hashSeed } from './acts';

/** v0.6: the next Act, as the player chose it: its arena, theme and focus (config/routes.ts). */
export interface Route {
  arena: ArenaId;
  theme: number; // index into ACT_THEMES, or -1 for the Usurper's host (Act IV)
  focus: RouteFocus;
}

const FOCI: RouteFocus[] = ['elite', 'merchant', 'pilgrim', 'siege'];

/**
 * The fork after `act` (the Act just won): ROUTES.choices routes into Act act + 1, rolled from the run's seed and that Act alone, so the
 * same seed always forks the same way (the Daily Trial is a seed). Three different foci; arenas and themes vary where they can, and never
 * repeat the arena just left. Act IV is always the Last Bastion against the Usurper's host.
 */
export function routeChoices(seed: number, act: number, leaving: ArenaId): Route[] {
  const rng = mulberry32(hashSeed(`route:${seed}:${act}`));
  const shuffle = <T>(xs: T[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const foci = shuffle(FOCI).slice(0, ROUTES.choices);
  if (act + 1 === FINAL.act) return foci.map((focus) => ({ arena: FINAL.arena, theme: -1, focus }));
  const arenas = shuffle(ARENA_IDS.filter((a) => a !== leaving));
  const themes = shuffle(ACT_THEMES.map((_, i) => i).slice(1)); // The Levy is Act I's alone
  return foci.map((focus, i) => ({ arena: arenas[i % arenas.length], theme: themes[i % themes.length], focus }));
}
