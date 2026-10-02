import type { FoeLayer } from '../config/foeSounds';

/**
 * #285: plays a foe family's sound (config/foeSounds.ts, picked by logic/foeSounds.ts) for core/audio.ts sfx: each layer one oscillator
 * or noise burst with its own envelope and start, all into `out` (the cue's gain, which carries its volume, place and voice). Returns the
 * source that ends last, the one the voice limit stops when it takes the voice over (the others are silenced with the cue's gain).
 */
const heard: Record<string, number> = {}; // voice key -> times played, for the play test

export function playFoeVoice(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, key: string, layers: readonly FoeLayer[], now: number, rate: number): AudioScheduledSourceNode {
  let last: AudioScheduledSourceNode | null = null;
  let lastEnd = -1;
  for (const l of layers) {
    const t0 = now + (l.at ?? 0);
    const t1 = t0 + l.dur;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.setValueAtTime(l.vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t1);
    let src: AudioScheduledSourceNode;
    if (l.wave === 'noise') {
      const n = ctx.createBufferSource();
      n.buffer = noise;
      n.playbackRate.value = rate;
      src = n;
      if (l.filter) {
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = l.filter * rate;
        n.connect(f).connect(g);
      } else n.connect(g);
    } else {
      const o = ctx.createOscillator();
      o.type = l.wave;
      o.frequency.setValueAtTime(l.f0 * rate, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, l.f1 * rate), t1);
      o.connect(g);
      src = o;
    }
    g.connect(out);
    src.start(t0);
    src.stop(t1);
    if (t1 > lastEnd) (lastEnd = t1), (last = src);
  }
  heard[key] = (heard[key] ?? 0) + 1;
  return last!;
}

/** For the play test: how many times each foe voice was played. */
export const foeVoiceStats = (): Record<string, number> => ({ ...heard });
