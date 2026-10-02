import { AMBIENCE } from '../config/ambience';
import type { ArenaId } from '../config/arenas';
import { bedLevel, bedOf, bedSeed, renderBed } from '../logic/ambience';

/**
 * #288: an arena's ambience bed as WebAudio: its loop (rendered once per arena and kept), swelling on the bed's LFO, through a gain that
 * follows the fight (logic/ambience bedLevel) into the ambience bus. core/audio.ts decides when one plays.
 */
export interface BedVoice {
  arena: ArenaId;
  layer: number;
  src: AudioBufferSourceNode;
  level: GainNode; // the fight's level, gliding
}

const loops = new Map<ArenaId, AudioBuffer>();

function loopOf(ctx: AudioContext, arena: ArenaId): AudioBuffer {
  let buf = loops.get(arena);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.round(bedOf(arena).seconds * ctx.sampleRate), ctx.sampleRate);
    buf.getChannelData(0).set(renderBed(bedOf(arena), ctx.sampleRate, bedSeed(arena)));
    loops.set(arena, buf);
  }
  return buf;
}

/** Starts an arena's bed into `into`, fading in. */
export function startBed(ctx: AudioContext, into: AudioNode, arena: ArenaId, layer: number): BedVoice {
  const now = ctx.currentTime;
  const w = bedOf(arena).wind;
  const src = ctx.createBufferSource();
  src.buffer = loopOf(ctx, arena);
  src.loop = true;
  const swell = ctx.createGain(); // the gusts: 1 ± lfoDepth
  const lfo = ctx.createOscillator();
  lfo.frequency.value = w.lfoHz;
  const depth = ctx.createGain();
  depth.gain.value = w.lfoDepth;
  lfo.connect(depth).connect(swell.gain);
  const level = ctx.createGain();
  level.gain.setValueAtTime(0, now);
  level.gain.linearRampToValueAtTime(bedLevel(layer), now + AMBIENCE.fade);
  src.connect(swell).connect(level).connect(into);
  src.start(now);
  lfo.start(now);
  src.onended = () => (lfo.stop(), level.disconnect());
  return { arena, layer, src, level };
}

/** The fight moved to another music layer: the bed glides to its level there. */
export function bedToLayer(ctx: AudioContext, v: BedVoice, layer: number): void {
  if (layer === v.layer) return;
  v.layer = layer;
  const now = ctx.currentTime;
  v.level.gain.cancelScheduledValues(now);
  v.level.gain.setValueAtTime(v.level.gain.value, now);
  v.level.gain.linearRampToValueAtTime(bedLevel(layer), now + AMBIENCE.glide);
}

/** Fades a bed out and lets it go. */
export function stopBed(ctx: AudioContext, v: BedVoice): void {
  const now = ctx.currentTime;
  v.level.gain.cancelScheduledValues(now);
  v.level.gain.setValueAtTime(v.level.gain.value, now);
  v.level.gain.linearRampToValueAtTime(0, now + AMBIENCE.fade);
  v.src.stop(now + AMBIENCE.fade);
}
