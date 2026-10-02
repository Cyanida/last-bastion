import { mulberry32 } from '../core/math';
import type { EnemyId } from './enemies';
import { GAME } from './game';
import { expandArena, type Rect, type RegionDef, type WingDef, type WingId } from './regions';

export type ArenaId = 'courtyard' | 'graveyard' | 'keep' | 'emberForge' | 'bastion';
export type ObstacleKind = 'tomb' | 'tree' | 'pillar' | 'brazier' | 'throne' | 'anvil' | 'rack' | 'bunk' | 'crucible' | 'crypt' | 'ruin'; // #210: the anvil, weapon rack and bunk furnish the Great Keep's wings; #223: the crucible the Ember Forge; #273: the crypt and the broken chapel's ruined column the Forsaken Graveyard
export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  r: number;
}

export type Hazard =
  | { kind: 'graspingHands'; every: number; count: number; radius: number; delay: number; damage: number; spread: number }
  | { kind: 'braziers'; every: number; radius: number; delay: number; damage: number }
  | { kind: 'gatehouse'; every: number; radius: number; delay: number; damage: number; spacing: number }; // v0.6: fire rolls through the Last Bastion's south gate

export interface ArenaDef {
  id: ArenaId;
  name: string;
  desc: string;
  feature: string;
  w: number;
  h: number;
  wall: number;
  theme: {
    tile: 'cobble' | 'earth' | 'flagstone';
    mortar: string;
    stones: string[];
    patch: string; // rgba of the soft patches (moss, mist, carpet)
    wall: string;
    wallTop: string;
    carpet?: string; // v0.6: a runner from the south wall up to the throne
  };
  obstacles: Obstacle[];
  hazard: Hazard | null; // hazard damage scales with the wave like enemy damage does
  bosses: EnemyId[]; // boss rotation for every 5th wave
  corpseLifeMult: number;
  regions?: RegionDef[]; // v0.5: filled in by expandArena (config/regions.ts)
  wings?: Record<WingId, WingDef>; // #210: named wings (a fortress's rooms) with a fixed feature each; without, the wings are sides of the map
  lava?: Rect[]; // #223: lava channels on the floor that burn whoever stands in them (config LAVA, systems/arena.ts); moved into place by expandArena
  final?: { throne: { x: number; y: number }; flames: { x: number; y: number }[] }; // v0.6: the Usurper's throne and his Royal Flames (the Last Bastion only)
}

/** Deterministic scatter that keeps the player's spawn (the centre) and the wall clear. */
function scatter(seed: number, w: number, h: number, kinds: [ObstacleKind, number, number][]): Obstacle[] {
  const rng = mulberry32(seed);
  const out: Obstacle[] = [];
  for (const [kind, count, r] of kinds) {
    for (let placed = 0, tries = 0; placed < count && tries < 500; tries++) {
      const x = 140 + rng() * (w - 280);
      const y = 140 + rng() * (h - 280);
      const clearOfSpawn = Math.hypot(x - w / 2, y - h / 2) > 220;
      if (clearOfSpawn && out.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 70)) {
        out.push({ kind, x, y, r });
        placed++;
      }
    }
  }
  return out;
}

function grid(w: number, h: number, cols: number, rows: number, kind: ObstacleKind, r: number): Obstacle[] {
  const out: Obstacle[] = [];
  for (let i = 1; i <= cols; i++) for (let j = 1; j <= rows; j++) out.push({ kind, x: (w * i) / (cols + 1), y: (h * j) / (rows + 1), r });
  return out;
}

const { w, h, wall } = GAME.arena;

/** #273: the Forsaken Graveyard's crypts in its core: how many, and their collision radius (a crypt is wider than a tree). */
export const GRAVEYARD = { crypts: 2, cryptR: 34 };

/**
 * #223: the Ember Forge's lava (logic/lava.ts, systems/arena.ts). Whoever stands in a channel burns: `dps` a second (scaled with the wave
 * like enemy damage), x`foeMult` to foes, ticking every GAME.fieldTick. It hurts, it doesn't block: a channel is `width` px across, a
 * step or a dodge over it costs a tick or two, and `bridge`-px stone bridges (at these shares of the hall's width) cross it for free.
 */
export const LAVA = { dps: 12, foeMult: 2, width: 56, bridge: 130, bridges: [0.3, 0.7] };

/**
 * #223: the Ember Forge's lava channels: two runs of lava across the hall, a third of the way in from the north and the south wall, wall
 * to wall, each broken by LAVA.bridges stone bridges. The spawn (the centre) and the east and west gates' line stay clear of them.
 */
function lavaChannels(aw: number, ah: number): Rect[] {
  const out: Rect[] = [];
  for (const cy of [ah * 0.26, ah * 0.74]) {
    const gaps = LAVA.bridges.map((t) => aw * t).sort((a, b) => a - b);
    let x0 = wall;
    for (const gx of [...gaps, aw - wall + LAVA.bridge / 2]) {
      out.push({ x: x0, y: Math.round(cy - LAVA.width / 2), w: Math.round(gx - LAVA.bridge / 2 - x0), h: LAVA.width });
      x0 = gx + LAVA.bridge / 2;
    }
  }
  return out;
}

const AUTHORED: Record<ArenaId, ArenaDef> = {
  courtyard: {
    id: 'courtyard',
    name: 'Castle Courtyard',
    desc: 'Open cobbles. Nowhere to hide, nothing in your way.',
    feature: 'No obstacles, no hazards.',
    w, h, wall,
    theme: { tile: 'cobble', mortar: '#3f413d', stones: ['#63655f', '#585a55', '#6b6c64', '#54564f', '#5e605a'], patch: 'rgba(61,90,53,0.55)', wall: '#34353a', wallTop: '#4b4c53' },
    obstacles: [],
    hazard: null,
    bosses: ['blackKnight', 'warlord', 'lich'],
    corpseLifeMult: 1,
  },
  graveyard: {
    id: 'graveyard',
    name: 'Forsaken Graveyard',
    desc: 'Tombstones and dead trees break up the horde — and your line of fire. The Barrowvale’s crypts, sexton’s yard, broken chapel and old barrows lie behind its gates.',
    feature: 'Grasping hands burst from the earth near you. The dead linger twice as long. Each wing is always the same place.',
    w: 2200, h: 1500, wall,
    theme: { tile: 'earth', mortar: '#23291f', stones: ['#2f3a2a', '#33402d', '#2b3527', '#374331'], patch: 'rgba(150,170,180,0.22)', wall: '#26282c', wallTop: '#3a3d44' },
    // #273: two crypts join the scatter after the trees and tombs, so those stand where they always stood
    obstacles: scatter(7, 2200, 1500, [['tree', 7, 26], ['tomb', 22, 18], ['crypt', GRAVEYARD.crypts, GRAVEYARD.cryptR]]),
    hazard: { kind: 'graspingHands', every: 7, count: 3, radius: 62, delay: 1.3, damage: 14, spread: 170 },
    bosses: ['abbot', 'lich', 'warlord'],
    corpseLifeMult: 2,
    // #273: the Barrowvale's arena (its realm levels play here, config/world.ts), on the Great Keep's recipe (#210): each wing is a place
    // in the graveyard with the feature that suits it, its own ground and its own furniture
    wings: {
      north: { name: 'the crypts', feature: 'hazard', label: 'Grave gas', prop: 'crypt', floor: 'nave' },
      east: { name: 'the sexton’s yard', feature: 'chest', label: 'Strongbox', prop: 'tomb', propR: 18, floor: 'grave' },
      south: { name: 'the broken chapel', feature: 'shrine', label: 'Shrine', prop: 'ruin', floor: 'nave' },
      west: { name: 'the old barrows', feature: 'lair', label: 'Lair', prop: 'tree', floor: 'grave' },
    },
  },
  keep: {
    id: 'keep',
    name: 'The Great Keep',
    desc: 'The Iron Hold’s fortress: a pillared hall lit by fire, with a forge, an armory, barracks and a chapel behind its gates.',
    feature: 'Braziers flare on a rhythm and burn friend and foe alike — lure the horde through them. Each wing is always the same room.',
    w: 1700, h: 1200, wall,
    theme: { tile: 'flagstone', mortar: '#2c2622', stones: ['#6a5f55', '#5f554c', '#72665b', '#594f47'], patch: 'rgba(120,30,30,0.35)', wall: '#2e2a2a', wallTop: '#4a4340' },
    obstacles: [
      ...grid(1700, 1200, 4, 2, 'pillar', 30).filter((o) => Math.hypot(o.x - 850, o.y - 600) > 150),
      { kind: 'brazier', x: 425, y: 600, r: 20 },
      { kind: 'brazier', x: 1275, y: 600, r: 20 },
      { kind: 'brazier', x: 850, y: 250, r: 20 },
      { kind: 'brazier', x: 850, y: 950, r: 20 },
    ],
    hazard: { kind: 'braziers', every: 6, radius: 115, delay: 1.2, damage: 22 },
    bosses: ['inquisitor', 'blackKnight', 'abbot'],
    corpseLifeMult: 1,
    // #210: the fortress's rooms. Each holds the feature that suits it, so the Great Keep has the same four features as every arena.
    wings: {
      north: { name: 'the forge', feature: 'hazard', label: 'Forge fires', prop: 'anvil', floor: 'soot' },
      east: { name: 'the armory', feature: 'chest', label: 'Strongbox', prop: 'rack', floor: 'plank' },
      south: { name: 'the chapel', feature: 'shrine', label: 'Shrine', prop: 'pillar', floor: 'runner' },
      west: { name: 'the barracks', feature: 'lair', label: 'Lair', prop: 'bunk', floor: 'plank' },
    },
  },
  // #223: the Cinderlands' arena (#141's Ember Forge). Only a realm level (or test mode) plays it: not in ARENA_IDS, like the Last Bastion.
  emberForge: {
    id: 'emberForge',
    name: 'The Ember Forge',
    desc: 'The Cinderlands’ burning foundry: a basalt hall cut by channels of lava, with a smelter, a weaponsmith, a shrine and the quench pits behind its gates.',
    feature: 'Lava runs in two channels across the hall and burns whoever stands in it, friend or foe — cross at the bridges, or lure the horde through.',
    w: 1800, h: 1300, wall,
    theme: { tile: 'flagstone', mortar: '#171213', stones: ['#3b3533', '#443c39', '#35302f', '#4a413d'], patch: 'rgba(236,106,23,0.13)', wall: '#221c1c', wallTop: '#3d3432' },
    obstacles: [
      { kind: 'anvil', x: 560, y: 650, r: 30 },
      { kind: 'anvil', x: 1240, y: 650, r: 30 },
      ...[[300, 185], [1500, 185], [300, 1115], [1500, 1115]].map(([x, y]) => ({ kind: 'crucible' as const, x, y, r: 28 })),
    ],
    hazard: null, // its lava burns all the time (LAVA); the spreading fire (#224, SPREADING_FIRE) is the realm's own hazard on top
    lava: lavaChannels(1800, 1300),
    bosses: ['inquisitor', 'warlord', 'blackKnight'],
    corpseLifeMult: 1,
    wings: {
      north: { name: 'the smelter', feature: 'hazard', label: 'Slag vents', prop: 'crucible', floor: 'soot' },
      east: { name: 'the weaponsmith', feature: 'chest', label: 'Strongbox', prop: 'rack', floor: 'plank' },
      south: { name: 'the ember shrine', feature: 'shrine', label: 'Shrine', prop: 'pillar', floor: 'runner' },
      west: { name: 'the quench pits', feature: 'lair', label: 'Lair', prop: 'anvil', floor: 'soot' },
    },
  },
  // v0.6: Act IV, always. Never a starting arena (not in ARENA_IDS).
  bastion: {
    id: 'bastion',
    name: 'The Last Bastion',
    desc: 'The Usurper’s own castle: high walls, a burning gatehouse, a throne at the end of the hall.',
    feature: 'Fire rolls through the gatehouse on a rhythm and burns friend and foe. The Usurper waits on his throne.',
    w: 2000, h: 1500, wall,
    theme: { tile: 'flagstone', mortar: '#26232a', stones: ['#57555e', '#4e4c55', '#605d66', '#4a4850'], patch: 'rgba(90,20,20,0.3)', wall: '#2a2830', wallTop: '#46434e', carpet: '#6b1a1a' },
    obstacles: [
      ...[-1, 1].flatMap((side) => [360, 560, 760, 960, 1160].map((y) => ({ kind: 'pillar' as const, x: 1000 + side * 300, y, r: 28 }))),
      { kind: 'throne', x: 1000, y: 230, r: 44 }, // clear of the north gate's corridor
    ],
    hazard: { kind: 'gatehouse', every: 9, radius: 80, delay: 1.6, damage: 24, spacing: 170 },
    bosses: ['blackKnight', 'inquisitor', 'warlord'],
    corpseLifeMult: 1,
    final: { throne: { x: 1000, y: 230 }, flames: [{ x: 340, y: 560 }, { x: 1660, y: 560 }, { x: 1000, y: 1240 }] },
  },
};

/** The playable maps: each authored arena is the core of a bigger map with wings behind gates (config/regions.ts). */
export const ARENAS = Object.fromEntries(Object.entries(AUTHORED).map(([id, def]) => [id, expandArena(def)])) as Record<ArenaId, ArenaDef>;
/** The arenas a run can start in, and that Acts rotate through. The Last Bastion is only ever Act IV (config/acts.ts FINAL). */
/** #182: seconds before an arena's first hazard, at the run's start and again in each new Act's arena. */
export const HAZARD_GRACE = 5;
/** #211: a flagstone floor's slab, in px (render/arena.ts lays them from the map's corner): the forge presses mark whole slabs. */
export const FLAGSTONE = 80;
/**
 * #211: the Iron Hold's forge presses (logic/presses.ts, systems/arena.ts). Every `every` s a press marks the slabs round the player
 * (`line` of them through the player's slab; from wave `crossFrom` every other slam is a cross of five), lowers its ram for `delay` s
 * and slams: `damage` (scaled with the wave like enemy damage) to whoever stands on a marked slab, x`foeMult` to foes, like the
 * braziers, so luring the horde under them pays. The first slam comes `grace` s into the level. Only in the realm's own arena.
 */
export const PRESSES = { every: 8, delay: 1.5, grace: 8, line: 3, crossFrom: 11, damage: 18, foeMult: 3 };
/**
 * #224: the Cinderlands' spreading fire (logic/spreadingFire.ts, systems/arena.ts). Every `every` s the fire catches on the slab at the
 * lava's bank nearest the player (from wave `twoFrom` on two slabs, `apart` slabs or more from each other) and creeps to where the
 * player stood then, and on round that spot, a slab every `step` s, `reach` slabs in all. A slab kindles for `kindle` s (the warning:
 * it does no harm yet), then burns for `life` s: `dps` a second (scaled with the wave like enemy damage) to the player standing on it,
 * x`foeMult` to foes, like the lava, so luring the horde over it pays. The first fire catches `grace` s into the level. Only in the
 * realm's own arena. Measured with the bot (`npm run sim -- levels`): a longer trail (7 slabs, 4 s) or a burn stack a tick each cost
 * it a fifth of its level-1 clears, these numbers none.
 */
export const SPREADING_FIRE = { every: 10, grace: 10, reach: 5, step: 0.8, kindle: 0.8, life: 3, dps: 8, foeMult: 2, twoFrom: 11, apart: 4 };
/**
 * #274: the Barrowvale's grasping hands (logic/graspingHands.ts, systems/arena.ts). In its levels the Forsaken Graveyard's hands come from
 * marked graves and hold you: every `every` s (the arena's hazard clock, in place of its plain hands) `graves` graves are marked, one
 * under the player and the rest `near`..`far` px round him (from wave `moreFrom` one more), each `radius` wide. After `delay` s the hands
 * rise: the champion still standing in one takes `damage` (scaled with the wave like enemy damage) and is held there `hold` s (he cannot
 * walk; he still fights, and a dash or a blink still carries him out). Foes on a grave take x`foeMult` and are held `foeHold` s (a stun),
 * so leading the horde over the graves pays. A dodge, a shield or a block keeps the hold off with the blow. Only in the realm's own arena.
 */
export const GRAVE_HANDS = { every: 7, graves: 3, moreFrom: 11, near: 70, far: 170, radius: 40, delay: 1.3, hold: 1.2, damage: 10, foeMult: 3, foeHold: 2 };
export const ARENA_IDS: ArenaId[] = ['courtyard', 'graveyard', 'keep'];
