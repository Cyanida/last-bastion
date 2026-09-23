import { describe, expect, it } from 'vitest';
import type { ArenaId } from '../src/config/arenas';
import { ARENAS } from '../src/config/arenas';
import { MUSIC, THEMES } from '../src/config/music';
import { createGame } from '../src/game';
import { RANGES } from '../src/logic/music';
import { barSeconds, composeRunBar, conduct, moodOf, newConductor, type Bar, type Layer, type Mood } from '../src/logic/runMusic';
import { spawnEnemy } from '../src/systems/spawning';

const ARENA_LIST = Object.keys(ARENAS) as ArenaId[];
const LAYERS: Layer[] = [0, 1, 2, 3];
const mood = (arena: ArenaId, layer: Layer, cue: Mood['cue'] = null): Mood => ({ arena, layer, cue });
const key = (n: object) => JSON.stringify(n);

describe('run music: the themes (v0.7.1)', () => {
  it('every arena has a theme at 66-96 BPM, and every note is in its mode, its voice range and its bar', () => {
    for (const id of ARENA_LIST) {
      const t = THEMES[id];
      expect(t.bpm).toBeGreaterThanOrEqual(66);
      expect(t.bpm).toBeLessThanOrEqual(96);
      const scale = t.mode.map((s) => (t.root + s) % 12);
      for (let bar = 0; bar < 48; bar++) {
        for (const layer of LAYERS) {
          for (const cue of [null, 'fork', 'victory'] as const) {
            for (const n of composeRunBar(t, 7, bar, layer, cue)) {
              if (n.voice !== 'drum') expect(scale).toContain(n.midi % 12);
              expect(n.midi).toBeGreaterThanOrEqual(RANGES[n.voice][0]);
              expect(n.midi).toBeLessThanOrEqual(RANGES[n.voice][1]);
              expect(n.time).toBeGreaterThanOrEqual(0);
              expect(n.time).toBeLessThan(t.meter);
              expect(n.velocity).toBeGreaterThan(0);
              expect(n.velocity).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    }
  });

  it('a layer coming in adds its part and leaves the others as they were; the boss layer brings drums and a bass line', () => {
    for (const id of ARENA_LIST) {
      const t = THEMES[id];
      for (let bar = 0; bar < 32; bar++) {
        const [, base, dense, boss] = LAYERS.map((l) => composeRunBar(t, 3, bar, l).map(key));
        for (const n of base) expect(dense).toContain(n);
        for (const n of dense) expect(boss).toContain(n);
        const bossNotes = composeRunBar(t, 3, bar, 3);
        expect(bossNotes.some((n) => n.voice === 'bass')).toBe(true);
        expect(bossNotes.some((n) => n.voice === 'drum' && n.midi === t.boss.midi)).toBe(true);
        expect(composeRunBar(t, 3, bar, 0).length).toBeLessThan(base.length);
      }
      const base = new Set(composeRunBar(t, 3, 0, 1).map(key));
      expect(composeRunBar(t, 3, 0, 2).filter((n) => !base.has(key(n))).every((n) => n.voice === t.lead)).toBe(true);
      expect(composeRunBar(t, 3, 0, 2).length).toBeGreaterThan(base.size);
    }
  });

  it('the same seed gives the same music; passes and seeds vary', () => {
    const t = THEMES.keep;
    const form = t.chords.length * 2;
    const piece = (seed: number) => Array.from({ length: form * 4 }, (_, bar) => composeRunBar(t, seed, bar, 2));
    expect(piece(5)).toEqual(piece(5));
    expect(key(piece(6))).not.toBe(key(piece(5)));
    const passes = [0, 1, 2, 3].map((p) => key(piece(5).slice(p * form, (p + 1) * form)));
    expect(new Set(passes).size).toBeGreaterThan(1);
  });
});

describe('run music: the conductor (v0.7.1)', () => {
  /** Drives the conductor like core/music.ts does: a tick every 100 ms with a 0.4 s lookahead, the mood read at each tick. */
  function play(moods: [number, Mood][], seconds: number): (Bar & { want: Layer })[] {
    let c = newConductor(moods[0][1], 1, 0.1);
    const bars: (Bar & { want: Layer })[] = [];
    for (let now = 0; now < seconds; now += 0.1) {
      const want = moods.filter(([at]) => at <= now).at(-1)![1];
      const r = conduct(c, want, now, 0.4);
      c = r.c;
      bars.push(...r.bars.map((b) => ({ ...b, want: want.layer })));
    }
    return bars;
  }

  it('changes land on bar lines: every downbeat is one bar after the last, and a change shows on the first bar after it', () => {
    const changes: [number, Mood][] = [[0, mood('courtyard', 1)], [7.33, mood('courtyard', 2)], [15.05, mood('courtyard', 3)], [26.61, mood('courtyard', 1)], [40.2, mood('graveyard', 1)], [52.9, mood('graveyard', 0)]];
    const bars = play(changes, 70);
    for (let i = 1; i < bars.length; i++) expect(bars[i].at).toBeCloseTo(bars[i - 1].at + barSeconds(THEMES[bars[i - 1].arena]), 9);
    // up: on the first bar that was scheduled after the change
    for (const [at, m] of changes.slice(1, 3)) {
      const first = bars.find((b) => b.layer === m.layer)!;
      expect(first.at).toBeGreaterThan(at);
      expect(first.at - at).toBeLessThanOrEqual(barSeconds(THEMES[m.arena]) + 0.4 + 1e-9);
      expect(bars[bars.indexOf(first) - 1].at).toBeLessThanOrEqual(at + 0.4 + 1e-9);
    }
    // down: only after MUSIC.calmBars bars of asking for less
    const down = bars.findIndex((b) => b.at > 26.61 && b.layer === 1);
    const held = bars.slice(0, down).filter((b) => b.at > 26.61 && b.want === 1);
    expect(held.length).toBe(MUSIC.calmBars);
    expect(held.every((b) => b.layer === 3)).toBe(true);
    // a new arena: on the next bar, from its first bar, crossfading out of the old one (and only that bar says so)
    const moved = bars.find((b) => b.arena === 'graveyard')!;
    expect(moved.at).toBeGreaterThan(40.2);
    expect(moved.bar).toBe(0);
    expect(moved.from).toBe('courtyard');
    expect(bars.filter((b) => b.from).length).toBe(1);
    expect(bars.at(-1)!.layer).toBe(0);
  });

  it('bars count on within a theme, and a cue plays once each time it is asked for', () => {
    const bars = play([[0, mood('keep', 1)], [5, mood('keep', 0, 'fork')], [20, mood('keep', 1)], [30, mood('keep', 0, 'victory')]], 45);
    bars.forEach((b, i) => expect(b.bar).toBe(i));
    expect(bars.filter((b) => b.cue === 'fork').length).toBe(1);
    expect(bars.filter((b) => b.cue === 'victory').length).toBe(1);
  });

  it('after a stall it skips ahead instead of piling up late bars', () => {
    const c = newConductor(mood('bastion', 1), 1, 0.1);
    const { bars } = conduct(c, mood('bastion', 1), 30, 0.4);
    expect(bars.length).toBe(1);
    expect(bars[0].at).toBe(30);
  });
});

describe('run music: the mood of a run (v0.7.1)', () => {
  it('sparse before the first wave, at the Merchant and on a breather wave; the boss layer while a boss lives; cues at the fork and a victory', () => {
    const g = createGame('viking', 4, { arena: 'graveyard' });
    expect(moodOf(g)).toEqual(mood('graveyard', 0));
    g.wave = 1;
    expect(moodOf(g).layer).toBe(1);
    g.wave = 3; // WAVES.pacing.breather
    expect(moodOf(g).layer).toBe(0);
    g.wave = 4;
    g.player.hp = g.player.stats.hp * 0.2;
    expect(moodOf(g).layer).toBe(2);
    g.player.hp = g.player.stats.hp;
    for (let i = 0; i < MUSIC.danger.enemies; i++) spawnEnemy(g, 'peasant', 100 + i, 100);
    expect(moodOf(g).layer).toBe(2);
    spawnEnemy(g, 'warlord', 300, 300);
    expect(moodOf(g).layer).toBe(3);
    g.pendingMerchant = true;
    expect(moodOf(g).layer).toBe(0);
    g.pendingMerchant = false;
    g.pendingRoute = [];
    expect(moodOf(g)).toEqual(mood('graveyard', 0, 'fork'));
    g.pendingRoute = null;
    g.victory = 'pending';
    expect(moodOf(g).cue).toBe('victory');
  });
});
