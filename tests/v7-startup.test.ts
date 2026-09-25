import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CRASH_STACK_LINES, crashReport } from '../src/logic/crash';

describe('startup with site data blocked (v0.7.5, #106)', () => {
  beforeEach(() => vi.stubGlobal('document', { hidden: false, addEventListener: () => {} })); // core/music.ts listens for the page being hidden
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('the sound and music settings load and save when localStorage throws', async () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    const audio = await import('../src/core/audio');
    const music = await import('../src/core/music');
    const { prefs } = await import('../src/core/storage');
    expect(audio.isMuted()).toBe(false);
    expect(audio.effectsLevel()).toBe('high');
    expect(music.musicLevel()).toBe('medium');
    expect(music.runMusicOn()).toBe(true);
    expect(() => audio.toggleMute()).not.toThrow();
    expect(() => audio.setEffectsLevel('low')).not.toThrow();
    expect(() => music.setRunMusic(false)).not.toThrow();
    expect(prefs.get('lastbastion.whatsNew')).toBeNull();
  });

  it('reads the stored settings when storage works', async () => {
    const store = new Map([['lastbastion.muted', '1'], ['lastbastion.effects', 'low'], ['lastbastion.music', 'off'], ['lastbastion.runMusic', '0']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    const audio = await import('../src/core/audio');
    const music = await import('../src/core/music');
    expect([audio.isMuted(), audio.effectsLevel(), music.musicLevel(), music.runMusicOn()]).toEqual([true, 'low', 'off', false]);
    audio.toggleMute();
    expect(store.get('lastbastion.muted')).toBe('0');
  });
});

describe('the error overlay report (v0.7.5, #106)', () => {
  it('names the version, the error and the top of the stack', () => {
    const e = new TypeError("Cannot read properties of undefined (reading 'x')");
    const lines = crashReport(e, '0.7.5').split('\n');
    expect(lines[0]).toBe('Last Bastion v0.7.5');
    expect(lines[1]).toBe("TypeError: Cannot read properties of undefined (reading 'x')");
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.length).toBeLessThanOrEqual(2 + CRASH_STACK_LINES);
  });

  it('reports a thrown non-Error as text', () => {
    expect(crashReport('boom', '0.7.5')).toBe('Last Bastion v0.7.5\nboom');
  });
});
