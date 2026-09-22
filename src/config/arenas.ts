import { mulberry32 } from '../core/math';
import type { EnemyId } from './enemies';
import { GAME } from './game';
import { expandArena, type RegionDef } from './regions';

export type ArenaId = 'courtyard' | 'graveyard' | 'keep';
export type ObstacleKind = 'tomb' | 'tree' | 'pillar' | 'brazier';
export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  r: number;
}

export type Hazard =
  | { kind: 'graspingHands'; every: number; count: number; radius: number; delay: number; damage: number; spread: number }
  | { kind: 'braziers'; every: number; radius: number; delay: number; damage: number };

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
  };
  obstacles: Obstacle[];
  hazard: Hazard | null; // hazard damage scales with the wave like enemy damage does
  bosses: EnemyId[]; // boss rotation for every 5th wave
  corpseLifeMult: number;
  regions?: RegionDef[]; // v0.5: filled in by expandArena (config/regions.ts)
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
    desc: 'Tombstones and dead trees break up the horde — and your line of fire.',
    feature: 'Grasping hands burst from the earth near you. The dead linger twice as long.',
    w: 2200, h: 1500, wall,
    theme: { tile: 'earth', mortar: '#23291f', stones: ['#2f3a2a', '#33402d', '#2b3527', '#374331'], patch: 'rgba(150,170,180,0.22)', wall: '#26282c', wallTop: '#3a3d44' },
    obstacles: scatter(7, 2200, 1500, [['tree', 7, 26], ['tomb', 22, 18]]),
    hazard: { kind: 'graspingHands', every: 7, count: 3, radius: 62, delay: 1.3, damage: 14, spread: 170 },
    bosses: ['abbot', 'lich', 'warlord'],
    corpseLifeMult: 2,
  },
  keep: {
    id: 'keep',
    name: 'The Great Keep',
    desc: 'A pillared hall. Tight, loud, and lit by fire.',
    feature: 'Braziers flare on a rhythm and burn friend and foe alike — lure the horde through them.',
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
  },
};

/** The playable maps: each authored arena is the core of a bigger map with wings behind gates (config/regions.ts). */
export const ARENAS = Object.fromEntries(Object.entries(AUTHORED).map(([id, def]) => [id, expandArena(def)])) as Record<ArenaId, ArenaDef>;
export const ARENA_IDS = Object.keys(ARENAS) as ArenaId[];
