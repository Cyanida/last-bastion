import { BUS_ORDER, MIXER, type BusId } from '../config/mixer';
import { MUSIC } from '../config/music';
import { busGain, duckDepth, heard, readMix, withBus, type Mix } from '../logic/mixer';
import { VOICES, type CueSource } from '../config/voices';
import { cuePriority, pickVoice, placeCue, tooSoon, vary, type Listener, type Voice } from '../logic/voices';
import { prefs } from './storage';

/**
 * Tiny WebAudio synth. Every sound is one oscillator or noise burst with a pitch slide. #282: and the mixer: each sound goes out on a bus
 * (music, effects, UI, ambience), each bus through its own gain into the master, each with a Settings slider (logic/mixer.ts).
 */
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
  clang: { wave: 'square', f0: 1500, f1: 950, dur: 0.06, vol: 0.05 }, // #212: a blow breaks an iron plate
  slam: { wave: 'square', f0: 95, f1: 38, dur: 0.22, vol: 0.2 }, // #211: a forge press's ram lands
  block: { wave: 'triangle', f0: 620, f1: 380, dur: 0.08, vol: 0.07 }, // #213: an iron tower shield turns a blow
  thorns: { wave: 'sawtooth', f0: 700, f1: 260, dur: 0.08, vol: 0.06 }, // #214: a thorn bearer's spikes bite back
  tap: { wave: 'triangle', f0: 540, f1: 400, dur: 0.04, vol: 0.08, bus: 'ui' }, // #282: a menu button pressed
} satisfies Record<string, { wave: Wave; f0: number; f1: number; dur: number; vol: number; bus?: 'ui' }>;
export type SfxName = keyof typeof SOUNDS;
/** v0.7.1: the music ducks under these for a moment. #282: the ambience too. */
const HEAVY: SfxName[] = ['boom', 'slam', 'ability', 'levelup', 'wave'];
/** #282: the bus a sound goes out on: the effects unless it says otherwise. */
export const busOf = (name: SfxName): 'effects' | 'ui' => {
  const s = SOUNDS[name];
  return 'bus' in s ? s.bus : 'effects';
};

const MUTE_KEY = 'lastbastion.muted';
const MIX_KEY = 'lastbastion.mixer'; // #282: replaces lastbastion.music and lastbastion.effects, which it migrates from (and leaves alone)
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let buses: Record<BusId, GainNode> | null = null; // #282: the slider gains, every bus into the master
const ducks: Partial<Record<BusId, GainNode>> = {}; // #282: after a bus's slider, the gain a heavy effect pulls down (MIXER.duck)
let wind: { src: AudioBufferSourceNode; out: GainNode } | null = null; // #282: the ambience bed while a run is on screen
let windWanted = false;
let muted = prefs.get(MUTE_KEY) === '1';
let mix: Mix = readMix(prefs.get(MIX_KEY), { music: prefs.get('lastbastion.music'), effects: prefs.get('lastbastion.effects') });
const lastPlayed: Record<string, number> = {}; // #283: by sound and source, so a foe's warning never holds back a boss's
const played = { effects: 0, ui: 0 }; // #282: sounds started per bus (the play test hears the menu's taps)

/** Must be called from a user gesture (browser autoplay rules). */
export function initAudio(): void {
  if (!ctx && typeof AudioContext !== 'undefined') {
    const c = (ctx = new AudioContext());
    noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const gain = (bus: BusId) => {
      const g = c.createGain();
      g.gain.value = busGain(mix, bus);
      return g;
    };
    const b = (buses = { master: gain('master'), music: gain('music'), effects: gain('effects'), ui: gain('ui'), ambience: gain('ambience') });
    b.master.connect(c.destination);
    for (const bus of BUS_ORDER) {
      if (bus === 'master') continue;
      if (bus in MIXER.duck) b[bus].connect((ducks[bus] = c.createGain())).connect(b.master);
      else b[bus].connect(b.master);
    }
  }
  void ctx?.resume();
  refreshAmbience();
}

/** The one AudioContext, its noise buffer and the music's way out, for core/music.ts; null until the first gesture. */
export const sharedAudio = () => (ctx && noise && buses ? { ctx, noise, out: buses.music } : null);

/**
 * #282: where a sound for a bus goes in, so a recorded file can be played later (decode it with ctx.decodeAudioData and start a buffer
 * source into this). Null until the first gesture.
 */
export const busInput = (bus: Exclude<BusId, 'master'>): AudioNode | null => buses?.[bus] ?? null;

export const getMix = (): Mix => mix;
/** #282: a Settings slider moved: the bus follows smoothly, and the mix is kept. */
export function setVolume(bus: BusId, pct: number): void {
  mix = withBus(mix, bus, pct);
  prefs.set(MIX_KEY, JSON.stringify(mix));
  if (ctx && buses) buses[bus].gain.setTargetAtTime(busGain(mix, bus), ctx.currentTime, 0.05);
  refreshAmbience();
}
/** #282: whether anything on this bus can be heard (mute, the master and its own slider). */
export const busHeard = (bus: BusId): boolean => heard(mix, bus, muted);

/** Pulls the music (#282: and the ambience) down under a heavy effect, then lets it back up. */
function duck(now: number): void {
  const d = MUSIC.duck;
  for (const [bus, node] of Object.entries(ducks) as [BusId, GainNode][]) {
    const g = node.gain;
    const depth = duckDepth(bus);
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(depth, now + d.attack);
    g.setValueAtTime(depth, now + d.attack + d.hold);
    g.linearRampToValueAtTime(1, now + d.attack + d.hold + d.release);
  }
}

export const isMuted = () => muted;
export function toggleMute(): boolean {
  muted = !muted;
  prefs.set(MUTE_KEY, muted ? '1' : '0');
  refreshAmbience();
  return muted;
}

/**
 * #282: the ambience: a bed of wind while a run is on screen (main.ts says so every frame; only a change does any work). It is started
 * and stopped rather than left playing silent, so a muted or zeroed ambience costs nothing.
 */
export function ambience(on: boolean): void {
  if (on === windWanted) return;
  windWanted = on;
  refreshAmbience();
}
function refreshAmbience(): void {
  if (!ctx || !buses) return;
  const audible = windWanted && heard(mix, 'ambience', muted) && !(typeof document !== 'undefined' && document.hidden);
  const a = MIXER.ambience;
  const now = ctx.currentTime;
  if (audible && !wind) {
    // brown noise (integrated white), lowpassed: a long enough loop that its repeat is not heard
    const len = Math.floor(ctx.sampleRate * a.seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) d[i] = last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    for (let i = 0; i < len; i++) d[i] *= 3.5; // brown noise is quiet: up to about white noise's level
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = a.cutoff;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(a.gain, now + a.fade);
    const lfo = ctx.createOscillator(); // the gusts
    lfo.frequency.value = a.lfoHz;
    const depth = ctx.createGain();
    depth.gain.value = a.lfoDepth;
    lfo.connect(depth).connect(out.gain);
    src.connect(lp).connect(out).connect(buses.ambience);
    src.start(now);
    lfo.start(now);
    src.onended = () => (lfo.stop(), out.disconnect());
    wind = { src, out };
  } else if (!audible && wind) {
    const { src, out } = wind;
    wind = null;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + a.fade);
    src.stop(now + a.fade);
  }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refreshAmbience);

/**
 * For the tests: the mix, each bus's gain (Chromium only moves a bus's value while something sounds through it), the sounds started per
 * bus, whether the wind blows and whether the music is ducked right now.
 */
export function mixerStats() {
  const b = buses;
  return {
    mix: { ...mix },
    muted,
    gains: b ? (Object.fromEntries(BUS_ORDER.map((bus) => [bus, b[bus].gain.value])) as Record<BusId, number>) : null,
    played: { ...played },
    ambience: !!wind,
    ducked: ducks.music ? ducks.music.gain.value < 1 : false,
  };
}

/**
 * #283: the effect voices playing (the UI's taps are not limited), where the player looks (main.ts tells how to ask; asked only when a
 * placed cue plays, so it costs nothing per frame), and what the voice limit did, for the play test.
 */
const voices: (Voice & { node: AudioScheduledSourceNode; gain: GainNode })[] = [];
let listener: (() => Listener | null) | null = null;
export const listenFrom = (fn: () => Listener | null): void => void (listener = fn);
const cues = { played: 0, dropped: 0, stolen: 0, panned: 0, faded: 0, boss: 0, bossDropped: 0, crowded: 0, bossCrowded: 0 };
export const voiceStats = () => ({ ...cues, max: VOICES.max, live: ctx ? voices.filter((v) => v.ends > ctx!.currentTime).length : 0 });

/** A cue the voice limit took the place of: faded out quickly rather than cut, which would click. */
function steal(i: number, now: number): void {
  const [v] = voices.splice(i, 1);
  const g = v.gain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0, now + VOICES.stealFade);
  try {
    v.node.stop(now + VOICES.stealFade);
  } catch {
    // already stopped: nothing to cut
  }
}

/**
 * Plays a sound. #283: a cue from the simulation carries its source and place (sim/view.ts): on the effects bus it needs a voice
 * (logic/voices.ts pickVoice: a boss cue or a warning keeps one, a hit in a crowd is dropped first), its pitch and volume vary a little,
 * and it pans by where it is on screen and quietens off it.
 */
export function sfx(name: SfxName, cue?: { src: CueSource; x: number; y: number }): void {
  const bus = busOf(name);
  if (!ctx || !buses || !heard(mix, bus, muted)) return;
  const now = ctx.currentTime;
  const from = cue?.src ?? 'world';
  const key = from === 'world' ? name : `${name}:${from}`;
  if (tooSoon(lastPlayed[key], now)) return; // 200 hits per frame should not be 200 voices
  const prio = cuePriority(name, from);
  if (bus === 'effects') {
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i].ends <= now) voices.splice(i, 1);
    const crowded = voices.length >= VOICES.max;
    if (crowded) cues.crowded++;
    const slot = pickVoice(voices, prio, now);
    if (slot === 'drop') {
      cues.dropped++;
      if (from === 'boss') cues.bossDropped++;
      return;
    }
    if (slot !== 'free') (steal(slot, now), cues.stolen++);
    cues.played++;
    if (from === 'boss') (cues.boss++, crowded && cues.bossCrowded++);
  }
  lastPlayed[key] = now;
  played[bus]++;
  const s: { wave: Wave; f0: number; f1: number; dur: number; vol: number } = SOUNDS[name];
  const v = vary(Math.random(), Math.random());
  const place = cue && Number.isFinite(cue.x) ? placeCue(cue.x, cue.y, listener?.() ?? null) : null;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(s.vol * v.volume * (place?.gain ?? 1), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + s.dur);
  if (place && Math.abs(place.pan) > 0.01) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = place.pan;
    gain.connect(pan).connect(buses[bus]);
    cues.panned++;
  } else gain.connect(buses[bus]);
  if (place && place.gain < 1) cues.faded++;
  if (HEAVY.includes(name)) duck(now);
  let src: AudioScheduledSourceNode;
  if (s.wave === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = noise;
    n.playbackRate.value = v.rate;
    src = n;
  } else {
    const o = ctx.createOscillator();
    o.type = s.wave;
    o.frequency.setValueAtTime(s.f0 * v.rate, now);
    o.frequency.exponentialRampToValueAtTime(s.f1 * v.rate, now + s.dur);
    src = o;
  }
  src.connect(gain);
  src.start(now);
  src.stop(now + s.dur);
  if (bus === 'effects') voices.push({ prio, start: now, ends: now + s.dur, node: src, gain });
}
