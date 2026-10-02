import { describe, expect, it } from 'vitest';
import { VOICES } from '../src/config/voices';
import { cuePriority, pickVoice, placeCue, tooSoon, vary, type Voice } from '../src/logic/voices';
import { by, sfx } from '../src/sim/view';
import type { Game } from '../src/core/types';

// #283: effect cues carry a source, a priority and a place: a voice limit, small variations, stereo by position
const full = (prio: number, n = VOICES.max): Voice[] => Array.from({ length: n }, (_, i) => ({ prio, start: i * 0.01, ends: 1 }));

describe('the voice limit (#283)', () => {
  it('a boss cue outranks the same cue from a foe, a warning outranks a hit, and the source adds to any sound', () => {
    expect(cuePriority('warn', 'boss')).toBeGreaterThan(cuePriority('warn', 'foe'));
    expect(cuePriority('warn', 'foe')).toBeGreaterThan(cuePriority('hit', 'foe'));
    expect(cuePriority('hurt', 'player')).toBeGreaterThan(cuePriority('hit', 'foe'));
    expect(cuePriority('hit', 'boss')).toBeGreaterThan(cuePriority('hit', 'foe'));
    expect(cuePriority('someNewSound', 'world')).toBe(VOICES.fallback); // a sound a later issue adds before it is weighed
  });

  it('a free voice while fewer than the limit sound; voices that are done free their place', () => {
    expect(pickVoice([], 1, 0)).toBe('free');
    expect(pickVoice(full(1, VOICES.max - 1), 1, 0.5)).toBe('free');
    expect(pickVoice(full(9), 0, 2)).toBe('free'); // all ended by now
  });

  it('when full, a boss cue takes the weakest, oldest voice; a hit in a crowd is dropped', () => {
    const crowd = full(cuePriority('hit', 'foe'));
    crowd[5] = { prio: 0, start: 0.5, ends: 1 }; // an xp chime, the weakest
    expect(pickVoice(crowd, cuePriority('warn', 'boss'), 0.6)).toBe(5);
    expect(pickVoice(full(1), cuePriority('warn', 'boss'), 0.6)).toBe(0); // all equal: the oldest
    expect(pickVoice(full(cuePriority('hit', 'foe')), cuePriority('hit', 'foe'), 0.6)).toBe('drop'); // hits don't cut each other off
    expect(pickVoice(full(cuePriority('warn', 'boss')), cuePriority('hit', 'foe'), 0.6)).toBe('drop');
  });

  it('a crowded fight of hits never takes a boss cue’s voice, and the boss cue always gets one', () => {
    const voices: Voice[] = [];
    let now = 0, bossPlayed = 0, bossDropped = 0, hitsDropped = 0;
    for (let tick = 0; tick < 600; tick++, now += 1 / 60) {
      for (let i = voices.length - 1; i >= 0; i--) if (voices[i].ends <= now) voices.splice(i, 1);
      const cues = [...Array(20).fill(cuePriority('hit', 'foe')), ...(tick % 30 === 0 ? [cuePriority('warn', 'boss')] : [])];
      for (const prio of cues) {
        const slot = pickVoice(voices, prio, now);
        const boss = prio === cuePriority('warn', 'boss');
        if (slot === 'drop') (boss ? bossDropped++ : hitsDropped++);
        else {
          if (slot !== 'free') voices.splice(slot, 1);
          voices.push({ prio, start: now, ends: now + 0.25 });
          if (boss) bossPlayed++;
        }
      }
      expect(voices.filter((v) => v.ends > now).length).toBeLessThanOrEqual(VOICES.max);
    }
    expect(bossPlayed).toBe(20);
    expect(bossDropped).toBe(0);
    expect(hitsDropped).toBeGreaterThan(0);
  });

  it('the same sound from one source repeats at most once per VOICES.repeat', () => {
    expect(tooSoon(undefined, 0)).toBe(false);
    expect(tooSoon(1, 1 + VOICES.repeat / 2)).toBe(true);
    expect(tooSoon(1, 1 + VOICES.repeat)).toBe(false);
  });
});

describe('small variations (#283)', () => {
  it('pitch and volume stay within VOICES.vary either way, and the middle is unchanged', () => {
    expect(vary(0.5, 0.5)).toEqual({ rate: 1, volume: 1 });
    for (const r of [0, 0.1, 0.37, 0.8, 0.9999]) {
      const v = vary(r, 1 - r);
      expect(Math.abs(v.rate - 1)).toBeLessThanOrEqual(VOICES.vary.pitch + 1e-9);
      expect(Math.abs(v.volume - 1)).toBeLessThanOrEqual(VOICES.vary.volume + 1e-9);
    }
    expect(vary(0, 0).rate).toBeLessThan(vary(0.99, 0).rate);
  });
});

describe('stereo by position (#283)', () => {
  const at = { x: 500, y: 300, halfW: 400, halfH: 220 };
  it('the middle of the screen sits in the middle at full volume; left pans left, right pans right', () => {
    expect(placeCue(500, 300, at)).toEqual({ pan: 0, gain: 1 });
    expect(placeCue(300, 300, at).pan).toBeCloseTo(-VOICES.pan / 2);
    expect(placeCue(900, 300, at)).toEqual({ pan: VOICES.pan, gain: 1 }); // the right edge: still on screen
    expect(placeCue(2000, 300, at).pan).toBe(VOICES.pan); // never past the edge's pan
  });

  it('past the edge of the screen it gets quieter with distance, down to the floor', () => {
    const near = placeCue(900 + 100, 300, at).gain, far = placeCue(900 + 400, 300, at).gain;
    expect(near).toBeLessThan(1);
    expect(far).toBeLessThan(near);
    expect(placeCue(900 + 100_000, 300 + 100_000, at).gain).toBe(VOICES.distance.floor);
    expect(placeCue(500, 300 + 220 + VOICES.distance.fade / 2, at)).toEqual({ pan: 0, gain: 0.5 }); // below the screen: no pan, half volume
  });

  it('a cue with no place, or no listener yet, is centred at full volume', () => {
    expect(placeCue(NaN, NaN, at)).toEqual({ pan: 0, gain: 1 });
    expect(placeCue(10, 10, null)).toEqual({ pan: 0, gain: 1 });
  });
});

describe('the cue API (#283)', () => {
  it('a cue waits in g.out with its source and a copy of its place; a boss’s own cue is a boss cue', () => {
    const g = { out: [] } as unknown as Game;
    const boss = { x: 10, y: 20, def: { boss: true } }, foe = { x: 1, y: 2, def: { boss: false } };
    sfx(g, 'xp');
    sfx(g, 'warn', by(boss));
    sfx(g, 'hit', by(foe));
    sfx(g, 'hurt', { src: 'player', at: { x: 5, y: 6 } });
    boss.x = 99; // the queue holds a copy, not the boss
    expect(g.out.map((c) => [c.name, c.src, c.x, c.y])).toEqual([
      ['xp', 'world', NaN, NaN],
      ['warn', 'boss', 10, 20],
      ['hit', 'foe', 1, 2],
      ['hurt', 'player', 5, 6],
    ]);
  });
});
