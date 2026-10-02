import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { CLASS_SOUNDS } from '../src/config/classSounds';
import { classLayers, classSoundKind, layersDur, soundPrint } from '../src/logic/classSounds';
import { cuePriority } from '../src/logic/voices';

// #284: each class's attack and ability sounds its own
describe('class sounds (#284)', () => {
  it('every class has an attack and an ability sound', () => {
    for (const cls of CLASS_ORDER) {
      for (const kind of ['attack', 'ability'] as const) {
        const layers = classLayers(cls, kind);
        expect(layers.length).toBeGreaterThan(0);
        for (const l of layers) {
          expect(l.dur).toBeGreaterThan(0);
          expect(l.vol).toBeGreaterThan(0);
          expect(l.vol).toBeLessThanOrEqual(0.2);
          if (l.wave !== 'noise') expect(Math.min(l.f0, l.f1)).toBeGreaterThan(0); // an exponential slide can't reach 0
        }
      }
    }
    expect(Object.keys(CLASS_SOUNDS).sort()).toEqual([...CLASS_ORDER].sort());
  });

  it('no two classes share an attack or an ability sound, and a class’s attack is not its ability', () => {
    for (const kind of ['attack', 'ability'] as const) expect(new Set(CLASS_ORDER.map((c) => soundPrint(classLayers(c, kind)))).size).toBe(CLASS_ORDER.length);
    for (const c of CLASS_ORDER) expect(soundPrint(classLayers(c, 'attack'))).not.toBe(soundPrint(classLayers(c, 'ability')));
  });

  it('the player’s swing and shot are his class’s attack, his cast its ability', () => {
    expect(classSoundKind('swing', 'player', 'paladin')).toBe('attack');
    expect(classSoundKind('shoot', 'player', 'archer')).toBe('attack');
    expect(classSoundKind('ability', 'player', 'necromancer')).toBe('ability');
  });

  it('anyone else’s cue, other sounds and an unknown class keep the plain sound', () => {
    expect(classSoundKind('swing', 'foe', 'viking')).toBeNull();
    expect(classSoundKind('ability', 'boss', 'angel')).toBeNull();
    expect(classSoundKind('hit', 'player', 'viking')).toBeNull();
    expect(classSoundKind('swing', 'player', null)).toBeNull();
  });

  it('an attack is short and an ability lasts longer; the voice priorities stay those of swing, shoot and ability', () => {
    for (const c of CLASS_ORDER) {
      expect(layersDur(classLayers(c, 'attack'))).toBeLessThanOrEqual(0.2);
      expect(layersDur(classLayers(c, 'ability'))).toBeGreaterThan(layersDur(classLayers(c, 'attack')));
    }
    expect(cuePriority('ability', 'player')).toBeGreaterThan(cuePriority('swing', 'player'));
    expect(layersDur([{ wave: 'sine', f0: 1, f1: 2, dur: 0.1, vol: 0.1, at: 0.3 }])).toBeCloseTo(0.4);
  });
});
