import { BAR_BEATS, BPM, composeBar, type NoteEvent } from '../logic/music';
import { isMuted, sharedAudio } from './audio';

/**
 * Menu music: plays logic/music.ts's score on the sfx AudioContext through a reverb. A lookahead scheduler queues a bar
 * once its downbeat is near; during runs, on mute and with the page hidden it is faded out and the scheduler stopped.
 */
export type MusicLevel = 'off' | 'low' | 'medium' | 'high';
export const MUSIC_LEVELS: MusicLevel[] = ['off', 'low', 'medium', 'high'];
const VOLUME: Record<MusicLevel, number> = { off: 0, low: 0.2, medium: 0.4, high: 0.7 };
const KEY = 'lastbastion.music';
const BEAT = 60 / BPM;
const LOOKAHEAD = 0.4;
const FADE_IN = 2;
const FADE_OUT = 1.5;

const hasStorage = typeof localStorage !== 'undefined';
const stored = hasStorage ? localStorage.getItem(KEY) : null;
let level: MusicLevel = MUSIC_LEVELS.includes(stored as MusicLevel) ? (stored as MusicLevel) : 'medium';
let wanted = false; // a menu screen is up
let bus: { master: GainNode; input: AudioNode } | null = null;
let session: { out: GainNode; timer: ReturnType<typeof setInterval> } | null = null;

export const musicLevel = () => level;
export function setMusicLevel(next: MusicLevel): void {
  level = next;
  if (hasStorage) localStorage.setItem(KEY, next);
  if (bus && next !== 'off') bus.master.gain.setTargetAtTime(VOLUME[next], bus.master.context.currentTime, 0.1);
  refreshMusic();
}
export function startMenuMusic(): void {
  wanted = true;
  refreshMusic();
}
export function stopMenuMusic(): void {
  wanted = false;
  refreshMusic();
}

/** Plays or fades out to match the screen, mute, the Music setting and page visibility. Call when any of them changes. */
export function refreshMusic(): void {
  const audio = sharedAudio();
  if (!audio) return; // no gesture yet: the first one calls this again
  const play = wanted && level !== 'off' && !isMuted() && !document.hidden;
  if (play && !session) begin(audio.ctx, audio.noise);
  else if (!play && session) fadeOut(audio.ctx);
}
document.addEventListener('visibilitychange', refreshMusic);

function begin(ctx: AudioContext, noise: AudioBuffer): void {
  bus ??= buildBus(ctx);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN);
  out.connect(bus.input);
  const seed = (Math.random() * 2 ** 32) >>> 0; // a fresh piece every time the menus come back
  let bar = 0;
  let at = ctx.currentTime + 0.1;
  const tick = () => {
    at = Math.max(at, ctx.currentTime); // after a long stall, skip ahead rather than pile up late notes
    for (; at < ctx.currentTime + LOOKAHEAD; at += BAR_BEATS * BEAT, bar++) {
      for (const e of composeBar(seed, bar)) play(ctx, noise, out, e, at + e.time * BEAT);
    }
  };
  tick();
  session = { out, timer: setInterval(tick, 100) };
}

function fadeOut(ctx: AudioContext): void {
  const { out, timer } = session!;
  session = null;
  clearInterval(timer);
  const now = ctx.currentTime;
  const from = out.gain.value; // mid fade-in, fade from wherever it got to
  out.gain.cancelScheduledValues(now);
  out.gain.setValueAtTime(from, now);
  out.gain.linearRampToValueAtTime(0, now + FADE_OUT);
  setTimeout(() => out.disconnect(), 8000); // the bar already queued plays out into silence first
}

/** Master volume, a gentle lowpass, and a convolution reverb on generated decaying stereo noise. */
function buildBus(ctx: AudioContext): { master: GainNode; input: AudioNode } {
  const master = ctx.createGain();
  master.gain.value = VOLUME[level];
  master.connect(ctx.destination);
  const tone = ctx.createBiquadFilter();
  tone.frequency.value = 4500;
  tone.connect(master);
  const len = Math.floor(ctx.sampleRate * 2.5);
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  const verb = ctx.createConvolver();
  verb.buffer = impulse;
  const send = ctx.createGain();
  send.gain.value = 0.6;
  tone.connect(send).connect(verb).connect(master);
  return { master, input: tone };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function osc(ctx: AudioContext, type: OscillatorType, freq: number, from: number, to: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.start(from);
  o.stop(to);
  return o;
}

/** A gain that goes through the given [time, level] points linearly, wired into `out`. */
function envelope(ctx: AudioContext, out: AudioNode, points: [number, number][]): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, points[0][0]);
  for (const [t, v] of points) g.gain.linearRampToValueAtTime(v, t);
  g.connect(out);
  return g;
}

/** One note. Nodes are made per note and left to the garbage collector once they stop. */
function play(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, e: NoteEvent, t: number): void {
  const f = hz(e.midi);
  const len = e.duration * BEAT;
  const v = e.velocity;
  if (e.voice === 'drone') {
    // triangle body plus a detuned saw under a lowpass that slowly opens and closes; long ends blur the chord changes
    const end = t + len + 1.5;
    const lp = ctx.createBiquadFilter();
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.linearRampToValueAtTime(800, t + len / 2);
    lp.frequency.linearRampToValueAtTime(220, end);
    lp.connect(envelope(ctx, out, [[t, 0], [t + 1.2, 0.07 * v], [t + len, 0.06 * v], [end, 0]]));
    osc(ctx, 'triangle', f, t, end).connect(lp);
    const saw = osc(ctx, 'sawtooth', f, t, end);
    saw.detune.value = -7;
    saw.connect(lp);
  } else if (e.voice === 'harp') {
    // a plucked string: bright saw through a lowpass that closes as the note decays
    const end = t + len + 0.8;
    const lp = ctx.createBiquadFilter();
    lp.frequency.setValueAtTime(Math.min(12000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, end);
    g.connect(out);
    osc(ctx, 'sawtooth', f, t, end).connect(lp).connect(g);
  } else if (e.voice === 'flute') {
    // sine with a little triangle, a vibrato that eases in, and a breath of noise on the attack
    const end = t + len + 0.2;
    const g = envelope(ctx, out, [[t, 0], [t + 0.09, 0.06 * v], [t + len, 0.045 * v], [end, 0]]);
    const body = osc(ctx, 'sine', f, t, end);
    const edge = osc(ctx, 'triangle', f, t, end);
    const edgeGain = ctx.createGain();
    edgeGain.gain.value = 0.25;
    body.connect(g);
    edge.connect(edgeGain).connect(g);
    const depth = ctx.createGain(); // vibrato depth in cents
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(10, t + 0.5);
    depth.connect(body.detune);
    depth.connect(edge.detune);
    osc(ctx, 'sine', 5, t, end).connect(depth);
    const breath = ctx.createBufferSource();
    breath.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    breath.connect(bp).connect(envelope(ctx, out, [[t, 0], [t + 0.01, 0.025 * v], [t + 0.12, 0]]));
    breath.start(t, Math.random() * 0.3, 0.15);
  } else {
    // bell: two detuned fundamentals and two inharmonic partials, each ringing out at its own rate
    for (const [ratio, amp, decay] of [[1, 1, 1], [1.0035, 0.8, 1], [2.76, 0.3, 0.45], [5.4, 0.12, 0.22]]) {
      const end = t + len * decay;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03 * v * amp, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      g.connect(out);
      osc(ctx, 'sine', f * ratio, t, end).connect(g);
    }
  }
}
