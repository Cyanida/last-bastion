import type { ArenaId } from './arenas';

/**
 * #288: each arena's ambience bed on the ambience bus (core/ambience.ts plays it, logic/ambience.ts renders it). A bed is one loop of
 * `seconds`, rendered once per arena: wind (brown noise through a one-pole lowpass at `cutoff`, swelling by ± lfoDepth of its level on a slow LFO), plus what the
 * place adds on top, scattered through the loop at random from the arena's seed:
 * - crackle: fire, short pops of noise (`perSecond` of them, each `length` s);
 * - calls: a crow's caw, a few rasping notes falling from `f0` to `f1`, `notes` to a call, `perLoop` calls a loop;
 * - drips: water dripping in stone, a short sine blip `perLoop` times;
 * - echo: the room, a feedback delay over the whole bed that wraps round the loop (the keep's stone hall).
 * Gains are linear, before the ambience bus's slider. fight: how loud the bed sits under each music layer (logic/runMusic Layer 0..3),
 * so it fills a breather and steps back under a boss; it glides there over `glide` s.
 */
export interface Bed {
  seconds: number;
  wind: { gain: number; cutoff: number; lfoHz: number; lfoDepth: number };
  crackle?: { gain: number; perSecond: number; length: number };
  calls?: { gain: number; perLoop: number; notes: number; f0: number; f1: number; note: number; gap: number };
  drips?: { gain: number; perLoop: number; f0: number; f1: number; length: number };
  echo?: { delay: number; feedback: number };
}

const BEDS: Record<ArenaId, Bed> = {
  // wind across the open courtyard: the #282 bed
  courtyard: { seconds: 4, wind: { gain: 1, cutoff: 420, lfoHz: 0.07, lfoDepth: 0.43 } },
  // wind over the graves, and now and then a crow
  graveyard: {
    seconds: 11,
    wind: { gain: 0.85, cutoff: 360, lfoHz: 0.05, lfoDepth: 0.5 },
    calls: { gain: 0.12, perLoop: 2, notes: 3, f0: 900, f1: 620, note: 0.16, gap: 0.12 },
  },
  // a draught in the stone hall, water dripping, and the hall's echo
  keep: {
    seconds: 9,
    wind: { gain: 0.55, cutoff: 260, lfoHz: 0.04, lfoDepth: 0.2 },
    drips: { gain: 0.1, perLoop: 5, f0: 1700, f1: 1100, length: 0.06 },
    echo: { delay: 0.23, feedback: 0.45 },
  },
  // the forge's fires roaring low and crackling
  emberForge: {
    seconds: 7,
    wind: { gain: 0.7, cutoff: 200, lfoHz: 0.11, lfoDepth: 0.3 },
    crackle: { gain: 0.16, perSecond: 7, length: 0.012 },
  },
  // wind on the high walls, and the gatehouse fire crackling below
  bastion: {
    seconds: 8,
    wind: { gain: 1, cutoff: 520, lfoHz: 0.08, lfoDepth: 0.5 },
    crackle: { gain: 0.1, perSecond: 3, length: 0.01 },
  },
};

export const AMBIENCE = {
  gain: 0.35, // the bed's level into the ambience bus
  fade: 1.5, // seconds in and out, and between two arenas' beds
  fight: [1, 0.8, 0.6, 0.45] as const, // by music layer: breather, fight, danger, boss
  glide: 1.2,
  beds: BEDS,
};
