import { describe, expect, it } from 'vitest';
import { ARENA_IDS, ARENAS, GRAVEYARD } from '../src/config/arenas';
import { THEMES } from '../src/config/music';
import { featureSpot, FEATURES, WING_IDS } from '../src/config/regions';
import { ARENA_FAMILIES } from '../src/config/relics';
import { REALMS } from '../src/config/world';
import { createGame } from '../src/game';
import { featureLabel, fixedFeatures, inRect, regionAt, rollWings } from '../src/logic/regions';
import PROPS from '../src/render/props.json';

const yard = ARENAS.graveyard;
const core = yard.regions!.find((r) => r.id === 'core')!.floor;

describe('#273 the Forsaken Graveyard, the Barrowvale arena', () => {
  it('is the Barrowvale arena, and every Barrowvale level plays in it', () => {
    expect(REALMS.barrowvale.arena).toBe('graveyard');
    for (const level of [1, 2, 3, 4, 5]) expect(createGame('viking', 5, { level: { realm: 'barrowvale', level } }).arena.id).toBe('graveyard');
  });

  it('stays a starting arena with its theme, its relic families and its grasping hands', () => {
    expect(ARENA_IDS).toContain('graveyard');
    expect(THEMES.graveyard).toBeDefined();
    expect(ARENA_FAMILIES.graveyard).toContain('grave');
    expect(yard.hazard?.kind).toBe('graspingHands');
    expect(yard.corpseLifeMult).toBe(2);
  });

  it('has four named places: the crypts, the sexton’s yard, the broken chapel and the old barrows, each with a different feature', () => {
    expect(WING_IDS.map((id) => yard.regions!.find((r) => r.id === id)!.name)).toEqual(['the crypts', 'the sexton’s yard', 'the broken chapel', 'the old barrows']);
    const features = fixedFeatures(yard.wings)!;
    expect(new Set(Object.values(features))).toEqual(new Set(Object.keys(FEATURES)));
    expect(features.south).toBe('shrine'); // the chapel's altar
    expect(features.west).toBe('lair'); // something sleeps in the barrows
    expect(featureLabel('hazard', 'north', yard.wings)).toBe('Grave gas');
  });

  it('keeps its places every Act and seed', () => {
    for (const seed of [1, 42, 2654435761]) {
      for (const act of [1, 2, 3]) expect(rollWings(seed, act, fixedFeatures(yard.wings)).features).toEqual({ north: 'hazard', east: 'chest', south: 'shrine', west: 'lair' });
    }
  });

  it('furnishes each place with its own rigged prop, clear of its feature', () => {
    for (const kind of ['crypt', 'ruin', 'tomb', 'tree'] as const) expect(PROPS[kind]).toBeDefined();
    for (const id of WING_IDS) {
      const wing = yard.regions!.find((r) => r.id === id)!;
      const props = yard.obstacles.filter((o) => inRect(wing.floor, o.x, o.y));
      expect(props.length).toBe(4);
      expect(new Set(props.map((o) => o.kind))).toEqual(new Set([yard.wings![id].prop]));
      const spot = featureSpot(wing);
      for (const o of props) expect(Math.hypot(o.x - spot.x, o.y - spot.y)).toBeGreaterThan(o.r + 60);
    }
    // the sexton's headstones keep a headstone's size; the crypts and the chapel's columns stand in for the dead trees
    expect(yard.obstacles.filter((o) => o.kind === 'tomb' && regionAt(yard.regions!, o.x, o.y)?.id === 'east').every((o) => o.r === 18)).toBe(true);
    expect(yard.obstacles.filter((o) => o.kind === 'ruin').every((o) => o.r === PROPS.ruin.r)).toBe(true);
  });

  it('adds its crypts to the core without moving the trees and tombstones that stood there', () => {
    const crypts = yard.obstacles.filter((o) => o.kind === 'crypt' && regionAt(yard.regions!, o.x, o.y)?.id === 'core');
    expect(crypts.length).toBe(GRAVEYARD.crypts);
    const cx = core.x + core.w / 2, cy = core.y + core.h / 2;
    for (const c of crypts) {
      expect(c.r).toBe(GRAVEYARD.cryptR);
      expect(Math.hypot(c.x - cx, c.y - cy)).toBeGreaterThan(220); // the spawn stays clear
      for (const o of yard.obstacles) if (o !== c) expect(Math.hypot(o.x - c.x, o.y - c.y)).toBeGreaterThan(o.r + c.r);
    }
    const coreRest = yard.obstacles.filter((o) => regionAt(yard.regions!, o.x, o.y)?.id === 'core' && o.kind !== 'crypt');
    expect(coreRest.filter((o) => o.kind === 'tree').length).toBe(7);
    expect(coreRest.filter((o) => o.kind === 'tomb').length).toBe(22);
  });

  it('keeps every gate clear of its furniture', () => {
    for (const r of yard.regions!) {
      if (!r.gate) continue;
      for (const o of yard.obstacles) expect(inRect(r.gate, o.x, o.y)).toBe(false);
    }
  });
});
