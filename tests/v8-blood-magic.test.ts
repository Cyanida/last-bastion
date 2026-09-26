import { describe, expect, it } from 'vitest';
import { FAMILIES, type RelicId } from '../src/config/relics';
import { createGame } from '../src/game';
import { addRelic, updateRelics } from '../src/systems/relics';

const BLOOD: RelicId[] = ['serratedEdge', 'butchersHook', 'berserkerTooth', 'vampireFang', 'bloodPact', 'wolfskin'];

function viking() {
  const g = createGame('viking', 1);
  for (const id of BLOOD) addRelic(g, id);
  updateRelics(g, 1 / 60); // builds the set levels
  expect(g.player.relics.sets.blood?.level).toBe(6);
  return g;
}
const press = (g: ReturnType<typeof viking>) => {
  g.input.ability = true;
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
};

describe('Blood Magic (#145)', () => {
  it('does nothing while Berserker Rage is still active', () => {
    const g = viking();
    const p = g.player;
    p.abilityTime = 3; // rage on, cooldown already running
    p.abilityCd = 10;
    const hp = p.hp;
    press(g);
    expect(p.abilityCd).toBe(10);
    expect(p.hp).toBe(hp);
  });

  it('still pays HP to recast once the ability has ended and is cooling down', () => {
    const g = viking();
    const p = g.player;
    p.abilityTime = 0;
    p.abilityCd = 10;
    const hp = p.hp;
    press(g);
    expect(p.abilityCd).toBe(0);
    expect(p.hp).toBeCloseTo(hp * (1 - FAMILIES.blood.n.hpCost));
  });
});
