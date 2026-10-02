import type { SoundLayer } from '../config/classSounds';

/**
 * #284: plays a class's layered attack or ability sound (config/classSounds.ts) into `out`, whose gain carries the cue's volume, place
 * and the voice limit's fade. Each layer is one oscillator or noise burst with its own envelope; `rate` is the cue's small pitch change.
 * Returns the source that ends last (the voice limit stops it when it takes this voice over) and when it ends.
 */
export function playLayers(
  ctx: AudioContext,
  noise: AudioBuffer,
  out: AudioNode,
  layers: readonly SoundLayer[],
  now: number,
  rate: number,
): { node: AudioScheduledSourceNode; ends: number } {
  let last: { node: AudioScheduledSourceNode; ends: number } | null = null;
  for (const l of layers) {
    const t = now + (l.at ?? 0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.setValueAtTime(l.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + l.dur);
    g.connect(out);
    let src: AudioScheduledSourceNode;
    if (l.wave === 'noise') {
      const n = ctx.createBufferSource();
      n.buffer = noise;
      n.playbackRate.value = (l.rate ?? 1) * rate;
      src = n;
    } else {
      const o = ctx.createOscillator();
      o.type = l.wave;
      o.frequency.setValueAtTime(l.f0 * rate, t);
      o.frequency.exponentialRampToValueAtTime(l.f1 * rate, t + l.dur);
      src = o;
    }
    src.connect(g);
    src.start(t);
    src.stop(t + l.dur);
    if (!last || t + l.dur > last.ends) last = { node: src, ends: t + l.dur };
  }
  return last!;
}
