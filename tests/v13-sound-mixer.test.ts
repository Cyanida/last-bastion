import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUS_ORDER, MIXER } from '../src/config/mixer';
import { MUSIC } from '../src/config/music';
import { busGain, duckDepth, heard, mixLabel, outGain, readMix, snap, withBus } from '../src/logic/mixer';

// #282: the sound mixer: music, effects, UI and ambience buses into a master, each with a saved Settings slider
const none = { music: null, effects: null };

describe('the sound mixer (#282)', () => {
  it('a fresh player gets the default mix, on the sliders’ grid', () => {
    expect(readMix(null, none)).toEqual(MIXER.defaults);
    for (const bus of BUS_ORDER) expect(MIXER.defaults[bus] % MIXER.step).toBe(0);
  });

  it('the old Music and Effects levels migrate to about the same loudness', () => {
    for (const level of ['off', 'low', 'medium', 'high'] as const) {
      const mix = readMix(null, { music: level, effects: level });
      expect(Math.abs(busGain(mix, 'music') - MUSIC.volume[level])).toBeLessThanOrEqual((MIXER.full.music * MIXER.step) / 200 + 1e-9);
      expect(Math.abs(busGain(mix, 'effects') - MUSIC.effects[level])).toBeLessThanOrEqual((MIXER.full.effects * MIXER.step) / 200 + 1e-9);
      expect([mix.master, mix.ui, mix.ambience]).toEqual([MIXER.defaults.master, MIXER.defaults.ui, MIXER.defaults.ambience]);
    }
    expect(readMix(null, { music: 'off', effects: 'high' })).toMatchObject({ music: 0, effects: 100 });
    expect(readMix(null, { music: 'loud', effects: null })).toEqual(MIXER.defaults); // nonsense stays default
  });

  it('a saved mix wins over the old levels; a broken one falls back bus by bus or whole', () => {
    const saved = JSON.stringify({ ...MIXER.defaults, music: 20, ambience: 0 });
    expect(readMix(saved, { music: 'high', effects: 'off' })).toMatchObject({ music: 20, effects: 100, ambience: 0 });
    expect(readMix(JSON.stringify({ master: 'x', ui: 140, effects: 33 }), none)).toEqual({ ...MIXER.defaults, ui: 100, effects: 35 });
    expect(readMix('{not json', { music: 'low', effects: null }).music).toBe(30); // as if never saved: the old level
  });

  it('a slider moves one bus, snapped to the grid and kept in 0..100', () => {
    const mix = withBus(MIXER.defaults, 'ui', 42);
    expect(mix).toEqual({ ...MIXER.defaults, ui: 40 });
    expect(withBus(mix, 'master', 130).master).toBe(100);
    expect(withBus(mix, 'master', -5).master).toBe(0);
    expect(snap(57)).toBe(55);
  });

  it('every bus goes through the master; Sound off or a zero silences it, so nothing is scheduled', () => {
    const mix = { ...MIXER.defaults, master: 50, effects: 80 };
    expect(outGain(mix, 'effects', false)).toBeCloseTo(0.5 * 0.8 * MIXER.full.effects);
    expect(outGain(mix, 'effects', true)).toBe(0);
    expect(heard(mix, 'effects', false)).toBe(true);
    expect(heard({ ...mix, master: 0 }, 'music', false)).toBe(false);
    expect(heard({ ...mix, ambience: 0 }, 'ambience', false)).toBe(false);
    expect(heard({ ...mix, ambience: 0 }, 'ui', false)).toBe(true); // one bus at zero leaves the others alone
    expect(heard(mix, 'ui', true)).toBe(false);
  });

  it('the music and the ambience duck under big moments; the effects and the UI never do', () => {
    expect(duckDepth('music')).toBe(MIXER.duck.music);
    expect(duckDepth('ambience')).toBe(MIXER.duck.ambience);
    for (const bus of ['music', 'ambience'] as const) expect(duckDepth(bus)).toBeLessThan(1);
    for (const bus of ['effects', 'ui', 'master'] as const) expect(duckDepth(bus)).toBe(1);
  });

  it('the label names the level, Off at zero', () => {
    expect(mixLabel(0)).toBe('Off');
    expect(mixLabel(55)).toBe('55%');
  });
});

describe('the mixer in core/audio.ts (#282)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('routes the menu tap to the UI bus and the fight to the effects bus', async () => {
    const { busOf } = await import('../src/core/audio');
    expect(busOf('tap')).toBe('ui');
    for (const name of ['hit', 'boom', 'levelup', 'warn'] as const) expect(busOf(name)).toBe('effects');
  });

  it('keeps the mix in storage and migrates the old levels on first load', async () => {
    const store = new Map([['lastbastion.music', 'high'], ['lastbastion.effects', 'medium']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    const audio = await import('../src/core/audio');
    expect(audio.getMix()).toMatchObject({ music: 100, effects: 65 });
    audio.setVolume('ambience', 20);
    expect(JSON.parse(store.get('lastbastion.mixer')!)).toEqual({ ...MIXER.defaults, music: 100, effects: 65, ambience: 20 });
    expect(store.get('lastbastion.music')).toBe('high'); // left alone: an older build still reads it
    expect(audio.busHeard('ambience')).toBe(true);
    audio.setVolume('master', 0);
    expect(['music', 'effects', 'ui', 'ambience'].some((b) => audio.busHeard(b as 'music'))).toBe(false);
  });
});
