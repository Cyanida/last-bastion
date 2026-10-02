import { DUOS, isDuo, isFamily, relicDef, type RelicKey } from '../config/relics';
import type { RelicVoice, UiSound } from '../config/relicSounds';

/**
 * #287: which sound a relic and a menu button make (config/relicSounds.ts holds the sounds), kept out of the DOM and WebAudio so the
 * tests can read it.
 */
export type { RelicVoice, UiSound };

/** A relic's voice: its family's; a family's set bonuses, that family's; a duo, its first family's; a cursed or signature relic its own. */
export function relicVoice(k: RelicKey): RelicVoice {
  if (isFamily(k)) return k;
  if (isDuo(k)) return DUOS[k].families[0];
  const r = relicDef(k);
  return r.family ?? (r.signature ? 'signature' : 'cursed');
}

/** The sound a relic makes when it is taken. */
export const pickCue = (k: RelicKey): `relic.${RelicVoice}` => `relic.${relicVoice(k)}`;
/** The sound a relic makes when it does its work in the fight (its icon flashes). */
export const procCue = (k: RelicKey): `proc.${RelicVoice}` => `proc.${relicVoice(k)}`;

/** A pressed button as the classifier sees it: its classes, its data-* attributes (as `dataset`) and its aria-label. */
export interface ButtonInfo {
  className: string;
  data: Record<string, string | undefined>;
  label: string | null;
}
const BACK_DATA = ['back', 'pageClose', 'closeBuilding', 'menu', 'close'];

/**
 * What a menu button sounds like: a relic card taken 'pick'; a gold or green button, or a card picked, 'confirm' (a gold Continue that
 * goes back is still a confirm); a back or close button 'back'; anything else (and a relic card's ⓘ) the plain 'click'.
 */
export function uiSoundOf(b: ButtonInfo): UiSound {
  const cls = b.className.split(/\s+/);
  if (cls.includes('relic-info')) return 'click';
  if (cls.includes('relic-card') || cls.includes('duo-card')) return 'pick';
  if (cls.includes('gold') || cls.includes('go') || (cls.includes('card') && 'pick' in b.data)) return 'confirm';
  if (b.label === 'Back' || b.label === 'Close' || b.data.act === 'back' || BACK_DATA.some((k) => k in b.data)) return 'back';
  return 'click';
}

/** The sound name for a UI sound: the plain click is #282's tap. */
export const uiCue = (s: UiSound): 'tap' | `ui.${Exclude<UiSound, 'click'>}` => (s === 'click' ? 'tap' : `ui.${s}`);
