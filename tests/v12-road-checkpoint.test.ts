import { describe, expect, it } from 'vitest';
import { checkpointFact } from '../src/logic/realmRoad';

describe('realm road checkpoint fact (#253)', () => {
  it('words the checkpoint as levels cleared, never as a level of the champion', () => {
    expect(checkpointFact(2)).toEqual({ label: 'Checkpoint', value: 'Level 1 cleared' });
    expect(checkpointFact(4).value).toBe('Level 3 cleared');
    expect(checkpointFact(1).value).toBe('None cleared');
  });
});
