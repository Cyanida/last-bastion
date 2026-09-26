import { describe, expect, it } from 'vitest';
import { CARDS, MECHANIC_CARDS } from '../src/config/cards';
import { nextCard, type CardFoe } from '../src/logic/cards';
import type { EnemyId } from '../src/config/enemies';

const foe = (id: EnemyId, more: Partial<CardFoe> = {}): CardFoe => ({ x: 100, y: 0, def: { id }, elite: false, hidden: false, dead: false, windupT: 0, ...more });

describe('v0.8.1 flash card picture and spotlight (#133)', () => {
  it('names the foe that brought the card, for its picture and the spotlight', () => {
    const far = foe('peasant', { x: CARDS.meetRadius + 50 });
    const wolf = foe('wolf', { elite: true, windupT: 0.2 });
    const knight = foe('knight');
    const foes = [far, wolf, knight];
    expect(nextCard(foes, 0, 0, [])?.foe).toBe(wolf);
    expect(nextCard(foes, 0, 0, ['wolf'])?.foe).toBe(wolf); // its elite card
    expect(nextCard(foes, 0, 0, ['wolf', 'elite', 'telegraph'])?.foe).toBe(knight);
  });

  it('every mechanic has an icon for its card, and the spotlight dims but never blacks out', () => {
    for (const m of Object.values(MECHANIC_CARDS)) expect(m.icon.length).toBeGreaterThan(0);
    expect(CARDS.spotDim).toBeGreaterThan(0);
    expect(CARDS.spotDim).toBeLessThan(1);
  });
});
