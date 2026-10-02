import { describe, expect, it } from 'vitest';
import { ARENAS } from '../src/config/arenas';
import { FEATURES, featureSpot, WING_IDS } from '../src/config/regions';
import { REALMS } from '../src/config/world';
import { featureLabel, fixedFeatures, inRect, regionAt, rollWings } from '../src/logic/regions';
import { wingsOpenBy } from '../src/logic/world';
import PROPS from '../src/render/props.json';

const keep = ARENAS.keep;

describe('#210 the Great Keep as a fortress', () => {
  it('is the Iron Hold arena', () => {
    expect(REALMS.ironHold.arena).toBe('keep');
  });

  it('has four named wings: the forge, the armory, the chapel and the barracks, each holding a different feature', () => {
    const names = WING_IDS.map((id) => keep.regions!.find((r) => r.id === id)!.name);
    expect(names).toEqual(['the forge', 'the armory', 'the chapel', 'the barracks']);
    const features = fixedFeatures(keep.wings)!;
    expect(new Set(Object.values(features))).toEqual(new Set(Object.keys(FEATURES))); // the same four features as every arena
    expect(features.north).toBe('hazard');
    expect(features.west).toBe('lair');
  });

  it('keeps its rooms every Act and seed, while the opening order is rolled exactly as an arena without names rolls it', () => {
    for (const seed of [1, 42, 2654435761, 99991]) {
      for (const act of [1, 2, 3]) {
        const named = rollWings(seed, act, fixedFeatures(keep.wings));
        const plain = rollWings(seed, act);
        expect(named.features).toEqual({ north: 'hazard', east: 'chest', south: 'shrine', west: 'lair' });
        expect(named.order).toEqual(plain.order);
        expect([...named.order].sort()).toEqual([...WING_IDS].sort());
      }
    }
  });

  it('the other arenas still roll their wing features', () => {
    for (const id of ['courtyard', 'bastion'] as const) { // #273: the Forsaken Graveyard has named wings now too
      expect(ARENAS[id].wings).toBeUndefined();
      expect(fixedFeatures(ARENAS[id].wings)).toBeUndefined();
      expect(ARENAS[id].regions!.find((r) => r.id === 'north')!.name).toBe('the north wing');
    }
    const seen = new Set(Array.from({ length: 12 }, (_, s) => rollWings(s, 1).features.north));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('names the feature after its room', () => {
    expect(featureLabel('hazard', 'north', keep.wings)).toBe('Forge fires');
    expect(featureLabel('hazard', 'north', ARENAS.courtyard.wings)).toBe(FEATURES.hazard.name);
  });

  it('furnishes each wing with its own rigged prop, on its floor and clear of its feature and gate', () => {
    const want = { north: 'anvil', east: 'rack', south: 'pillar', west: 'bunk' } as const;
    for (const id of WING_IDS) {
      const wing = keep.regions!.find((r) => r.id === id)!;
      const spot = featureSpot(wing);
      const inside = keep.obstacles.filter((o) => regionAt(keep.regions!, o.x, o.y)?.id === id);
      expect(inside.length, id).toBe(4);
      for (const o of inside) {
        expect(o.kind).toBe(want[id]);
        expect(PROPS[o.kind], o.kind).toBeDefined();
        expect(inRect(wing.floor, o.x, o.y, -o.r)).toBe(true);
        expect(Math.hypot(o.x - spot.x, o.y - spot.y)).toBeGreaterThan(o.r + 70);
        expect(inRect(wing.gate!, o.x, o.y, o.r)).toBe(false);
      }
    }
  });

  it('opens a wing by the start wave like every arena: none in an Act\'s first half, one in its second', () => {
    // the Iron Hold's levels start at waves 1, 9, 17, 25 and 33 (#243)
    expect(REALMS.ironHold.levels.map((l) => wingsOpenBy(l.waves[0]))).toEqual([0, 1, 1, 0, 0]);
  });
});
