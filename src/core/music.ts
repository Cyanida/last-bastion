import { MUSIC, THEMES } from '../config/music';
import { BAR_BEATS, BPM, composeBar, type NoteEvent } from '../logic/music';
import { barSeconds, composeRunBar, conduct, newConductor, nextBeat, stingerNotes, type Conductor, type Mood, type Stinger } from '../logic/runMusic';
import { isMuted, sharedAudio } from './audio';
import { quality } from './quality';

/**
 * Menu music, and (v0.7.1) quiet run music: plays logic/music.ts's and logic/runMusic.ts's scores on the sfx AudioContext through a
 * reverb. A lookahead scheduler queues a bar once its downbeat is within MUSIC.lookahead on the audio clock, so a dip in the frame rate
 * (which delays its timer) does not open a gap. The run music follows the run's mood (main.ts sets it every
 * frame). On mute, pause, the Music settings and with the page hidden it is faded out and the scheduler stopped.
 */
export type MusicLevel = 'off' | 'low' | 'medium' | 'high';
export const MUSIC_LEVELS: MusicLevel[] = ['off', 'low', 'medium', 'high'];
const KEY = 'lastbastion.music';
const RUN_KEY = 'lastbastion.runMusic';
const BEAT = 60 / BPM;
const FADE_IN = 2;
const FADE_OUT = 1.5;

const hasStorage = typeof localStorage !== 'undefined';
const stored = hasStorage ? localStorage.getItem(KEY) : null;
let level: MusicLevel = MUSIC_LEVELS.includes(stored as MusicLevel) ? (stored as MusicLevel) : 'medium';
let inRuns = !hasStorage || localStorage.getItem(RUN_KEY) !== '0'; // v0.7.1 "Music during runs", on by default
let menu = false; // a menu screen is up
let mood: Mood | null = null; // v0.7.1: a run is on screen and not paused
let jukebox = false; // v0.7.1: test mode's jukebox plays the run music on a menu, whatever "Music during runs" says
let conductor: Conductor | null = null; // the run's place in its music, kept through a pause
let bus: { master: GainNode; input: AudioNode } | null = null;
let session: { kind: 'menu' | 'run'; out: GainNode; tick: () => void; timer: ReturnType<typeof setInterval> } | null = null;
let voices: number[] = []; // when each queued note ends: the voice budget
let queued = 0; // notes queued since load (the perf test reads it)
let lastStinger = -Infinity;
let stingers = 0; // stingers played (the perf test reads it)
let late = 0; // v0.7.5: bars the scheduler reached after their downbeat, so the music skipped (the perf test checks a frame dip has none)
let peak = 0; // the most voices sounding at once (the perf test checks the budget)

export const musicLevel = () => level;
export function setMusicLevel(next: MusicLevel): void {
  level = next;
  if (hasStorage) localStorage.setItem(KEY, next);
  if (bus && next !== 'off') bus.master.gain.setTargetAtTime(MUSIC.volume[next], bus.master.context.currentTime, 0.1);
  refreshMusic();
}
export const runMusicOn = () => inRuns;
export function setRunMusic(on: boolean): void {
  inRuns = on;
  if (hasStorage) localStorage.setItem(RUN_KEY, on ? '1' : '0');
  refreshMusic();
}
export function startMenuMusic(): void {
  menu = true;
  mood = null;
  jukebox = false;
  conductor = null; // the next run starts a fresh piece
  refreshMusic();
}
export function stopMenuMusic(): void {
  menu = false;
  refreshMusic();
}
/** v0.7.1: the run's mood (logic/runMusic.ts moodOf), or null while it is paused or over. Cheap to call every frame. */
export function runMusic(next: Mood | null, fromJukebox = false): void {
  const changed = (mood === null) !== (next === null) || jukebox !== fromJukebox;
  mood = next;
  jukebox = fromJukebox;
  if (changed) refreshMusic();
  else if (session?.kind === 'run') session.tick(); // v0.7.5: slow frames also delay the timer, so each frame gets a look too (#97)
}

/**
 * v0.7.1: a stinger (logic/runMusic.ts stingerNotes) over the run music, on its next beat and through the voice budget. Nothing while the
 * run music is not playing, and at most one every MUSIC.stingerGap seconds.
 */
export function stinger(kind: Stinger): void {
  const audio = sharedAudio();
  if (!audio || session?.kind !== 'run' || !conductor) return;
  const { ctx, noise } = audio;
  if (ctx.currentTime < lastStinger + MUSIC.stingerGap) return;
  lastStinger = ctx.currentTime;
  stingers++;
  const at = nextBeat(conductor, ctx.currentTime);
  const beat = 60 / THEMES[conductor.arena].bpm;
  const back = Math.ceil((conductor.at - at) / barSeconds(THEMES[conductor.arena]) - 1e-6); // the lookahead can be over a bar ahead
  for (const e of stingerNotes(THEMES[conductor.arena], Math.max(0, conductor.bar - back), kind)) play(ctx, noise, session.out, e, at + e.time * beat, beat);
}

/** Plays or fades out to match the screen, mute, the Music settings and page visibility. Call when any of them changes. */
export function refreshMusic(): void {
  const audio = sharedAudio();
  if (!audio) return; // no gesture yet: the first one calls this again
  const audible = level !== 'off' && !isMuted() && !document.hidden;
  const kind = !audible ? null : mood ? (inRuns || jukebox ? 'run' : null) : menu ? 'menu' : null;
  if (session && session.kind !== kind) fadeOut(audio.ctx);
  if (kind && !session) begin(audio, kind);
}
document.addEventListener('visibilitychange', refreshMusic);

/** For the tests: what plays, where the run's music is, and how busy the voice budget is. */
export function musicStats() {
  const ctx = sharedAudio()?.ctx;
  const now = ctx?.currentTime ?? 0;
  return { playing: session?.kind ?? null, context: ctx?.state ?? null, arena: conductor?.arena ?? null, layer: conductor?.layer ?? null, bar: conductor?.bar ?? 0, voices: voices.filter((end) => end > now).length, queued, stingers, late, peak, budget: quality.level === 'low' ? MUSIC.voices.low : MUSIC.voices.high };
}

function begin(audio: { ctx: AudioContext; noise: AudioBuffer; out: AudioNode }, kind: 'menu' | 'run'): void {
  const { ctx, noise } = audio;
  bus ??= buildBus(ctx, audio.out);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(kind === 'run' ? MUSIC.runMix : 1, ctx.currentTime + FADE_IN); // the run music sits under the menu's
  out.connect(bus.input);
  const tick = kind === 'menu' ? menuTicker(ctx, noise, out) : runTicker(ctx, noise, out);
  tick();
  session = { kind, out, tick, timer: setInterval(tick, 100) };
}

function menuTicker(ctx: AudioContext, noise: AudioBuffer, out: GainNode): () => void {
  const seed = (Math.random() * 2 ** 32) >>> 0; // a fresh piece every time the menus come back
  let bar = 0;
  let at = ctx.currentTime + 0.1;
  return () => {
    at = Math.max(at, ctx.currentTime); // after a long stall, skip ahead rather than pile up late notes
    for (; at < ctx.currentTime + MUSIC.lookahead; at += BAR_BEATS * BEAT, bar++) {
      for (const e of composeBar(seed, bar)) play(ctx, noise, out, e, at + e.time * BEAT, BEAT);
    }
  };
}

/** v0.7.1: the run's bars, each in its arena's theme. A new arena fades the old theme's last chord out while the new one fades in. */
function runTicker(ctx: AudioContext, noise: AudioBuffer, out: GainNode): () => void {
  let fader = ctx.createGain(); // the current theme's own volume, for the crossfade
  fader.connect(out);
  const start = ctx.currentTime + 0.1;
  conductor = conductor ? { ...conductor, at: start } : newConductor(mood!, (Math.random() * 2 ** 32) >>> 0, start);
  return () => {
    if (!mood || !conductor) return;
    const next = conduct(conductor, mood, ctx.currentTime, MUSIC.lookahead);
    if (next.bars.length && next.bars[0].at > conductor.at) late++;
    conductor = next.c;
    for (const b of next.bars) {
      if (b.from) {
        const old = fader;
        const was = THEMES[b.from];
        const fade = MUSIC.crossfadeBars * barSeconds(was);
        old.gain.setValueAtTime(1, b.at);
        old.gain.linearRampToValueAtTime(0, b.at + fade);
        for (const e of composeRunBar(was, conductor.seed, 0, 0)) play(ctx, noise, old, e, b.at + (e.time * 60) / was.bpm, 60 / was.bpm);
        setTimeout(() => old.disconnect(), (b.at - ctx.currentTime + fade + 8) * 1000);
        fader = ctx.createGain();
        fader.gain.setValueAtTime(0, b.at);
        fader.gain.linearRampToValueAtTime(1, b.at + barSeconds(THEMES[b.arena]));
        fader.connect(out);
      }
      const beat = 60 / THEMES[b.arena].bpm;
      for (const e of composeRunBar(THEMES[b.arena], conductor.seed, b.bar, b.layer, b.cue)) play(ctx, noise, fader, e, b.at + e.time * beat, beat);
    }
  };
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
function buildBus(ctx: AudioContext, dest: AudioNode): { master: GainNode; input: AudioNode } {
  const master = ctx.createGain();
  master.gain.value = MUSIC.volume[level];
  master.connect(dest);
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
/** How long each voice rings past its note (a drum rings its own short time; a bell dies away within its note). */
const TAIL: Record<NoteEvent['voice'], number> = { drone: 1.5, harp: 0.8, flute: 0.2, bell: 0, drum: 0.4, choir: 1, organ: 0.6, horn: 0.3, bass: 0.2 };

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

/**
 * One note. Nodes are made per note and left to the garbage collector once they stop. v0.7.1: a fixed voice budget; when it is full
 * the note is dropped (the scores list their parts from the most to the least needed).
 */
function play(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, e: NoteEvent, t: number, beat: number): void {
  const f = hz(e.midi);
  const len = e.duration * beat;
  const v = e.velocity;
  const now = ctx.currentTime;
  voices = voices.filter((until) => until > now);
  if (voices.length >= (quality.level === 'low' ? MUSIC.voices.low : MUSIC.voices.high)) return;
  const end = t + len + TAIL[e.voice];
  voices.push(end);
  peak = Math.max(peak, voices.length);
  queued++;
  if (e.voice === 'drone') {
    // triangle body plus a detuned saw under a lowpass that slowly opens and closes; long ends blur the chord changes
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
  } else if (e.voice === 'drum') {
    // a skin (frame drum, march drum, timpani by pitch): a sine thump that drops into its pitch, and a tap of filtered noise
    const ring = t + (f < 90 ? 0.9 : 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 * v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, ring);
    g.connect(out);
    const skin = osc(ctx, 'sine', f, t, ring);
    skin.frequency.setValueAtTime(f * 1.5, t);
    skin.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    skin.connect(g);
    const tap = ctx.createBufferSource();
    tap.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 4;
    tap.connect(bp).connect(envelope(ctx, out, [[t, 0], [t + 0.003, 0.05 * v], [t + 0.06, 0]]));
    tap.start(t, Math.random() * 0.3, 0.08);
  } else if (e.voice === 'choir') {
    // a thin choir: two detuned saws through one vowel-like band, slow in and slow out
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 2.5;
    bp.connect(envelope(ctx, out, [[t, 0], [t + 0.6, 0.06 * v], [t + len, 0.05 * v], [end, 0]]));
    for (const cents of [-8, 8]) {
      const o = osc(ctx, 'sawtooth', f, t, end);
      o.detune.value = cents;
      o.connect(bp);
    }
  } else if (e.voice === 'organ') {
    // three stops (the fundamental, the octave and the twelfth), a short swell and a long hold
    const g = envelope(ctx, out, [[t, 0], [t + 0.12, 0.045 * v], [t + len, 0.04 * v], [end, 0]]);
    for (const [ratio, amp] of [[1, 1], [2, 0.5], [3, 0.25]]) {
      const stop = ctx.createGain();
      stop.gain.value = amp;
      osc(ctx, 'sine', f * ratio, t, end).connect(stop).connect(g);
    }
  } else if (e.voice === 'horn') {
    // soft brass: a saw under a lowpass that opens as the note swells
    const lp = ctx.createBiquadFilter();
    lp.frequency.setValueAtTime(f, t);
    lp.frequency.linearRampToValueAtTime(f * 3.5, t + 0.15);
    lp.frequency.linearRampToValueAtTime(f * 2, t + len);
    lp.connect(envelope(ctx, out, [[t, 0], [t + 0.12, 0.06 * v], [t + len, 0.045 * v], [end, 0]]));
    osc(ctx, 'sawtooth', f, t, end).connect(lp);
  } else if (e.voice === 'bass') {
    // a round plucked bass
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.02 * v, t + len);
    g.gain.linearRampToValueAtTime(0, end);
    g.connect(out);
    osc(ctx, 'triangle', f, t, end).connect(g);
  } else {
    // bell: two detuned fundamentals and two inharmonic partials, each ringing out at its own rate
    for (const [ratio, amp, decay] of [[1, 1, 1], [1.0035, 0.8, 1], [2.76, 0.3, 0.45], [5.4, 0.12, 0.22]]) {
      const partial = t + len * decay;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03 * v * amp, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, partial);
      g.connect(out);
      osc(ctx, 'sine', f * ratio, t, partial).connect(g);
    }
  }
}
