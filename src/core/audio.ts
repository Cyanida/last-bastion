import { MUSIC } from '../config/music';
import type { MusicLevel } from './music';

/** Tiny WebAudio synth. Every sound is one oscillator or noise burst with a pitch slide. */
type Wave = OscillatorType | 'noise';
const SOUNDS = {
  hit: { wave: 'noise', f0: 0, f1: 0, dur: 0.05, vol: 0.12 },
  swing: { wave: 'noise', f0: 0, f1: 0, dur: 0.09, vol: 0.06 },
  shoot: { wave: 'triangle', f0: 720, f1: 360, dur: 0.07, vol: 0.06 },
  hurt: { wave: 'sawtooth', f0: 220, f1: 90, dur: 0.16, vol: 0.14 },
  kill: { wave: 'square', f0: 180, f1: 60, dur: 0.1, vol: 0.06 },
  ability: { wave: 'sine', f0: 330, f1: 880, dur: 0.35, vol: 0.16 },
  boom: { wave: 'noise', f0: 0, f1: 0, dur: 0.35, vol: 0.22 },
  warn: { wave: 'square', f0: 140, f1: 140, dur: 0.25, vol: 0.08 },
  levelup: { wave: 'triangle', f0: 440, f1: 1320, dur: 0.45, vol: 0.16 },
  wave: { wave: 'sawtooth', f0: 110, f1: 220, dur: 0.5, vol: 0.1 },
  xp: { wave: 'sine', f0: 900, f1: 1300, dur: 0.05, vol: 0.04 },
} satisfies Record<string, { wave: Wave; f0: number; f1: number; dur: number; vol: number }>;
export type SfxName = keyof typeof SOUNDS;
/** v0.7.1: the music ducks under these for a moment. */
const HEAVY: SfxName[] = ['boom', 'ability', 'levelup', 'wave'];

const MUTE_KEY = 'lastbastion.muted';
const FX_KEY = 'lastbastion.effects';
const hasStorage = typeof localStorage !== 'undefined';
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let fxBus: GainNode | null = null; // v0.7.1: the effects volume
let musicBus: GainNode | null = null; // v0.7.1: the music goes out through here, so an effect can duck it
let muted = hasStorage && localStorage.getItem(MUTE_KEY) === '1';
const storedFx = hasStorage ? localStorage.getItem(FX_KEY) : null;
let effects: MusicLevel = storedFx && storedFx in MUSIC.effects ? (storedFx as MusicLevel) : 'high';
const lastPlayed: Partial<Record<SfxName, number>> = {};

/** Must be called from a user gesture (browser autoplay rules). */
export function initAudio(): void {
  if (!ctx && typeof AudioContext !== 'undefined') {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    fxBus = ctx.createGain();
    fxBus.gain.value = MUSIC.effects[effects];
    fxBus.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(ctx.destination);
  }
  void ctx?.resume();
}

/** The one AudioContext, its noise buffer and the music's way out, for core/music.ts; null until the first gesture. */
export const sharedAudio = () => (ctx && noise && musicBus ? { ctx, noise, out: musicBus } : null);

export const effectsLevel = () => effects;
export function setEffectsLevel(next: MusicLevel): void {
  effects = next;
  if (hasStorage) localStorage.setItem(FX_KEY, next);
  if (ctx && fxBus) fxBus.gain.setTargetAtTime(MUSIC.effects[next], ctx.currentTime, 0.05);
}

/** Pulls the music down under a heavy effect, then lets it back up. */
function duck(now: number): void {
  const g = musicBus!.gain;
  const d = MUSIC.duck;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(d.depth, now + d.attack);
  g.setValueAtTime(d.depth, now + d.attack + d.hold);
  g.linearRampToValueAtTime(1, now + d.attack + d.hold + d.release);
}

export const isMuted = () => muted;
export function toggleMute(): boolean {
  muted = !muted;
  if (hasStorage) localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  return muted;
}

export function sfx(name: SfxName): void {
  if (!ctx || muted || effects === 'off') return;
  const now = ctx.currentTime;
  if (now - (lastPlayed[name] ?? -1) < 0.05) return; // 200 hits per frame should not be 200 voices
  lastPlayed[name] = now;
  const s: { wave: Wave; f0: number; f1: number; dur: number; vol: number } = SOUNDS[name];
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(s.vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + s.dur);
  gain.connect(fxBus!);
  if (HEAVY.includes(name)) duck(now);
  let src: AudioScheduledSourceNode;
  if (s.wave === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = noise;
    src = n;
  } else {
    const o = ctx.createOscillator();
    o.type = s.wave;
    o.frequency.setValueAtTime(s.f0, now);
    o.frequency.exponentialRampToValueAtTime(s.f1, now + s.dur);
    src = o;
  }
  src.connect(gain);
  src.start(now);
  src.stop(now + s.dur);
}
