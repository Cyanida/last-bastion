import { describe, expect, it } from 'vitest';
import { CARD_IDS, CARDS, cardInfo } from '../src/config/cards';
import { nextCard, type CardFoe } from '../src/logic/cards';
import { defaultSave, migrate } from '../src/logic/save';
import type { EnemyId } from '../src/config/enemies';

const foe = (id: EnemyId, more: Partial<CardFoe> = {}): CardFoe => ({ x: 100, y: 0, def: { id }, elite: false, hidden: false, dead: false, windupT: 0, ...more });

describe('v0.8 flash cards (#124)', () => {
  it('shows a foe once, then the mechanics it brings', () => {
    const foes = [foe('wolf', { elite: true, windupT: 0.2 })];
    expect(nextCard(foes, 0, 0, [])).toBe('wolf');
    expect(nextCard(foes, 0, 0, ['wolf'])).toBe('elite');
    expect(nextCard(foes, 0, 0, ['wolf', 'elite'])).toBe('telegraph');
    expect(nextCard(foes, 0, 0, ['wolf', 'elite', 'telegraph'])).toBeNull();
  });

  it('only counts a foe that is met: near, visible and alive', () => {
    expect(nextCard([foe('knight', { x: CARDS.meetRadius + 1 })], 0, 0, [])).toBeNull();
    expect(nextCard([foe('assassin', { hidden: true }), foe('knight', { dead: true })], 0, 0, [])).toBeNull();
  });

  it('every card has a short text and a name', () => {
    for (const id of CARD_IDS) {
      const c = cardInfo(id);
      expect(c.name.length, id).toBeGreaterThan(0);
      expect(c.text.split(' ').length, `${id}: keep it short`).toBeLessThanOrEqual(14);
    }
    expect(cardInfo('lich').boss).toBe(true);
  });

  it('the save keeps seen cards; an older save has seen none', () => {
    const old = { ...defaultSave() } as Record<string, unknown>;
    delete old.cards;
    expect(migrate(old).cards).toEqual([]);
    expect(migrate({ ...defaultSave(), cards: ['wolf', 'nonsense', 3, 'elite'] }).cards.sort()).toEqual(['elite', 'wolf']);
  });
});
