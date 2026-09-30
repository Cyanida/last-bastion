import { describe, expect, it } from 'vitest';
import { CHAMPION_STATS } from '../src/config/champion';
import { CLASSES, type ClassId } from '../src/config/classes';
import { newChampion } from '../src/logic/champions';
import { buildView } from '../src/logic/championLevels';

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

// #252: a Build row is named for the stat its point really goes into, from the same key as its "a point gives" line.
describe('build panel stat names', () => {
  const rows = (id: ClassId) => buildView({ ...newChampion(id), level: 2 }, id, {}).stats;

  it('every row for every class is named for the stat its gives line names', () => {
    for (const id of CLASS_IDS) {
      for (const s of rows(id)) expect(s.gives, `${id} ${s.id}`).toBe(s.gives.replace(/^(\+\d+%? ).*$/, `$1${s.name}`));
      expect(rows(id).map((s) => s.id)).toEqual([...CHAMPION_STATS]);
    }
  });

  it('the Angel and the Archer name what they get', () => {
    expect(rows('angel').map((s) => s.name)).toEqual(['Intelligence', 'Attack Speed', 'Grace', 'HP']);
    expect(rows('archer').map((s) => s.name)).toEqual(['Dexterity', 'Attack Speed', rows('archer')[2].name, 'HP']);
    expect(rows('paladin').map((s) => s.name)).toEqual(['Strength', 'Attack Speed', 'Faith', 'HP']);
  });
});
