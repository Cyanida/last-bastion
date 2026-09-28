import { describe, expect, it } from 'vitest';
import { CLASS_ORDER, CLASSES } from '../src/config/classes';
import { STAT_KEYS } from '../src/core/types';
import { classFacts, statShare } from '../src/logic/roster';

const roster = CLASS_ORDER.map((id) => CLASSES[id]);

describe('#65: the champion select', () => {
  it('fills a stat bar by the share of the roster’s highest', () => {
    for (const k of STAT_KEYS) {
      const shares = roster.map((c) => statShare(roster, k, c.base[k]));
      expect(Math.max(...shares)).toBe(1); // the best of the roster fills its bar
      expect(shares.every((s) => s > 0 && s <= 1)).toBe(true);
    }
    expect(statShare(roster, 'hp', CLASSES.paladin.base.hp / 2)).toBeCloseTo(0.5);
    expect(statShare([], 'hp', 10)).toBe(0);
  });

  it('lists the facts the bars leave out', () => {
    const p = classFacts(CLASSES.paladin);
    expect(p.map((f) => f.label)).toEqual(['Attack', 'Reach', 'Armor', 'Regen', 'Cooldown']);
    expect(p[0].value).toBe('Melee · Strength');
    expect(p[2].value).toBe('40%');
    expect(classFacts(CLASSES.archer)[0].value).toBe('Ranged · Dexterity');
  });
});
