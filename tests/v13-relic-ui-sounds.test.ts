import { describe, expect, it } from 'vitest';
import { CURSED_IDS, DUO_IDS, DUOS, FAMILY_IDS, RELIC_IDS, relicDef, SIGNATURE_IDS } from '../src/config/relics';
import { RELIC_SOUNDS } from '../src/config/relicSounds';
import { pickCue, procCue, relicVoice, uiCue, uiSoundOf, type ButtonInfo } from '../src/logic/relicSounds';

// #287: each relic family sounds its own when a relic is taken and when it does its work; the menus' buttons sound what they do
const btn = (className: string, data: Record<string, string> = {}, label: string | null = null): ButtonInfo => ({ className, data, label });
const shape = (k: keyof typeof RELIC_SOUNDS) => {
  const s = RELIC_SOUNDS[k];
  return `${s.wave} ${s.f0}->${s.f1} ${s.dur}`;
};

describe('relic family sounds (#287)', () => {
  it('every relic sounds its family; a cursed or signature relic its own; a duo its first family; a set its family', () => {
    for (const id of RELIC_IDS) {
      const r = relicDef(id);
      const want = r.family ?? (r.signature ? 'signature' : 'cursed');
      expect(relicVoice(id)).toBe(want);
      expect(RELIC_SOUNDS[pickCue(id)]).toBeDefined();
      expect(RELIC_SOUNDS[procCue(id)]).toBeDefined();
    }
    expect(CURSED_IDS.every((id) => relicVoice(id) === 'cursed')).toBe(true);
    expect(SIGNATURE_IDS.length > 0 && SIGNATURE_IDS.every((id) => relicVoice(id) === 'signature')).toBe(true);
    for (const d of DUO_IDS) expect(procCue(d)).toBe(`proc.${DUOS[d].families[0]}`);
    for (const f of FAMILY_IDS) expect([pickCue(f), procCue(f)]).toEqual([`relic.${f}`, `proc.${f}`]);
    expect(pickCue('brimstoneOil')).toBe('relic.flame');
  });

  it('no two families sound alike, taken or at work, and a proc is shorter and quieter than a pickup', () => {
    const voices = [...FAMILY_IDS, 'cursed', 'signature'] as const;
    expect(new Set(voices.map((v) => shape(`relic.${v}`))).size).toBe(voices.length);
    expect(new Set(voices.map((v) => shape(`proc.${v}`))).size).toBe(voices.length);
    for (const v of voices) {
      const pick = RELIC_SOUNDS[`relic.${v}`], proc = RELIC_SOUNDS[`proc.${v}`];
      expect(proc.dur).toBeLessThan(pick.dur);
      expect(proc.vol).toBeLessThan(pick.vol);
      expect('bus' in pick || 'bus' in proc).toBe(false); // the fight's: on the effects bus
    }
  });
});

describe('UI sounds (#287)', () => {
  it('a relic card taken picks; a duo card too, but its ⓘ only taps', () => {
    expect(uiSoundOf(btn('card panel boon relic-card fam-flame', { pick: '0' }))).toBe('pick');
    expect(uiSoundOf(btn('card panel boon evolution duo-card', { pick: '3' }))).toBe('pick');
    expect(uiSoundOf(btn('relic-info', { info: 'brimstoneOil' }, 'Brimstone Oil: full text'))).toBe('click');
  });

  it('a gold or green button and a card picked confirm, even a gold Continue that goes back', () => {
    expect(uiSoundOf(btn('kit-btn gold big', { start: '' }))).toBe('confirm');
    expect(uiSoundOf(btn('kit-btn go', { play: '' }))).toBe('confirm');
    expect(uiSoundOf(btn('kit-btn gold big', { back: '' }))).toBe('confirm');
    expect(uiSoundOf(btn('card panel boon special', { pick: '1' }))).toBe('confirm');
  });

  it('back and close buttons go back; the rest click', () => {
    expect(uiSoundOf(btn('kit-close', { back: '' }, 'Back'))).toBe('back');
    expect(uiSoundOf(btn('kit-close kit-corner', { pageClose: '' }, 'Close'))).toBe('back');
    expect(uiSoundOf(btn('kit-close', { act: 'back' }, 'Back'))).toBe('back');
    expect(uiSoundOf(btn('kit-btn wood', { menu: '' }))).toBe('back');
    expect(uiSoundOf(btn('kit-btn wood', { go: 'settings' }))).toBe('click');
    expect(uiSoundOf(btn('kit-close bp-step', { statAdd: 'str' }, 'Put a point into Strength'))).toBe('click');
    expect(uiSoundOf(btn('kit-btn wood', { act: 'copy' }))).toBe('click');
  });

  it('each UI sound is on the UI bus, the plain click is #282’s tap, and a hover is the quietest', () => {
    expect(uiCue('click')).toBe('tap');
    for (const s of ['hover', 'back', 'confirm', 'pick'] as const) {
      const k = uiCue(s) as Exclude<ReturnType<typeof uiCue>, 'tap'>;
      expect(RELIC_SOUNDS[k].bus).toBe('ui');
      if (s !== 'hover') expect(RELIC_SOUNDS['ui.hover'].vol).toBeLessThan(RELIC_SOUNDS[k].vol);
    }
    expect(RELIC_SOUNDS['ui.back'].f1).toBeLessThan(RELIC_SOUNDS['ui.back'].f0); // falls: away
    expect(RELIC_SOUNDS['ui.confirm'].f1).toBeGreaterThan(RELIC_SOUNDS['ui.confirm'].f0); // rises: on
  });
});
