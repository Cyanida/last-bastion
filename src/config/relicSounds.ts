import type { FamilyId } from './relics';

/**
 * #287: each relic family's own sounds, and the menus' (core/audio.ts plays them like any other sound; logic/relicSounds.ts picks which).
 * A sound is one oscillator (or a noise burst) sliding from f0 to f1 Hz over `dur` seconds, starting at `vol` (linear, before its bus's
 * slider). relic.*: a relic of that voice taken, on the effects bus; proc.*: it does its work in the fight (its icon flashes over the
 * champion, at most every 1.2 s a relic), quieter and short. A cursed or signature relic has no family and sounds its own; a duo sounds as
 * its first family. ui.*: the menus, on the UI bus: a mouse coming onto a button, a back or close, a confirm (a gold or green button, a
 * card picked), and a relic card taken (a plain button keeps #282's tap).
 */
export type RelicVoice = FamilyId | 'cursed' | 'signature';
export type UiSound = 'hover' | 'click' | 'back' | 'confirm' | 'pick';
type Spec = { wave: OscillatorType | 'noise'; f0: number; f1: number; dur: number; vol: number; bus?: 'ui' };

export const RELIC_SOUNDS = {
  'relic.flame': { wave: 'sawtooth', f0: 160, f1: 560, dur: 0.32, vol: 0.12 }, // a fire catching and roaring up
  'relic.frost': { wave: 'sine', f0: 2400, f1: 1600, dur: 0.4, vol: 0.1 }, // a glassy chime
  'relic.storm': { wave: 'square', f0: 1600, f1: 120, dur: 0.25, vol: 0.08 }, // a crack of lightning falling
  'relic.blood': { wave: 'sawtooth', f0: 110, f1: 55, dur: 0.4, vol: 0.16 }, // a deep throb
  'relic.holy': { wave: 'sine', f0: 523, f1: 1568, dur: 0.5, vol: 0.14 }, // a bright rising bell
  'relic.grave': { wave: 'triangle', f0: 196, f1: 65, dur: 0.5, vol: 0.18 }, // a hollow fall into the earth
  'relic.steel': { wave: 'square', f0: 1400, f1: 1050, dur: 0.18, vol: 0.08 }, // a ringing blade
  'relic.cursed': { wave: 'sawtooth', f0: 70, f1: 40, dur: 0.6, vol: 0.16 }, // a low groan
  'relic.signature': { wave: 'triangle', f0: 440, f1: 1760, dur: 0.6, vol: 0.16 }, // a champion's fanfare, longer than a level-up
  'proc.flame': { wave: 'sawtooth', f0: 420, f1: 180, dur: 0.09, vol: 0.05 }, // a flare
  'proc.frost': { wave: 'sine', f0: 2800, f1: 2200, dur: 0.07, vol: 0.04 }, // a tink of ice
  'proc.storm': { wave: 'square', f0: 2000, f1: 400, dur: 0.06, vol: 0.04 }, // a zap
  'proc.blood': { wave: 'sine', f0: 90, f1: 55, dur: 0.14, vol: 0.12 }, // a heartbeat
  'proc.holy': { wave: 'sine', f0: 1320, f1: 1760, dur: 0.12, vol: 0.05 }, // a chime
  'proc.grave': { wave: 'triangle', f0: 260, f1: 120, dur: 0.12, vol: 0.08 }, // a knock on a coffin lid
  'proc.steel': { wave: 'triangle', f0: 1800, f1: 1300, dur: 0.06, vol: 0.05 }, // a ting off a plate
  'proc.cursed': { wave: 'sawtooth', f0: 120, f1: 70, dur: 0.12, vol: 0.06 },
  'proc.signature': { wave: 'triangle', f0: 990, f1: 1480, dur: 0.1, vol: 0.05 },
  'ui.hover': { wave: 'sine', f0: 1100, f1: 1250, dur: 0.03, vol: 0.025, bus: 'ui' }, // barely there: a mouse runs over many
  'ui.back': { wave: 'triangle', f0: 520, f1: 300, dur: 0.07, vol: 0.07, bus: 'ui' }, // falls: away
  'ui.confirm': { wave: 'triangle', f0: 520, f1: 1040, dur: 0.12, vol: 0.08, bus: 'ui' }, // rises an octave: on
  'ui.pick': { wave: 'sine', f0: 660, f1: 1320, dur: 0.22, vol: 0.09, bus: 'ui' }, // a relic card taken (its family's sound follows from the fight)
} satisfies Record<`relic.${RelicVoice}` | `proc.${RelicVoice}` | `ui.${Exclude<UiSound, 'click'>}`, Spec>;
