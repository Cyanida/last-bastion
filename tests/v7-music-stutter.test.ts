import { describe, expect, it } from 'vitest';
import type { ArenaId } from '../src/config/arenas';
import { MUSIC, THEMES } from '../src/config/music';
import { barSeconds, conduct, newConductor, type Bar, type Mood } from '../src/logic/runMusic';

const mood = (arena: ArenaId): Mood => ({ arena, layer: 1, cue: null });

/**
 * Drives the conductor like core/music.ts: a 100 ms timer on the main thread, so a slow frame delays the next tick. `stall` is how long
 * each frame blocks it; every bar has to be queued before its downbeat.
 */
function run(arena: ArenaId, stall: number, lookahead: number): { bars: Bar[]; late: number } {
  let c = newConductor(mood(arena), 1, 0.1);
  const bars: Bar[] = [];
  let late = 0;
  for (let now = 0; now < 30; now += 0.1 + stall) {
    const r = conduct(c, mood(arena), now, lookahead);
    if (r.bars.length && r.bars[0].at > c.at) late++;
    c = r.c;
    bars.push(...r.bars);
  }
  return { bars, late };
}

describe('run music through a frame-rate dip (v0.7.5, #97)', () => {
  it('keeps every bar on its downbeat with the timer delayed by 2 fps frames', () => {
    for (const arena of Object.keys(THEMES) as ArenaId[]) {
      const { bars, late } = run(arena, 0.5, MUSIC.lookahead);
      expect(late).toBe(0);
      for (let i = 1; i < bars.length; i++) expect(bars[i].at).toBeCloseTo(bars[i - 1].at + barSeconds(THEMES[arena]), 9);
    }
  });

  it('the old 0.4 s lookahead skipped under the same dip (the stutter)', () => {
    expect(run('courtyard', 0.5, 0.4).late).toBeGreaterThan(0);
  });

  it('the lookahead stays under a bar of every theme, so a mood change still lands within about a bar', () => {
    for (const t of Object.values(THEMES)) expect(MUSIC.lookahead).toBeLessThan(barSeconds(t));
  });
});
