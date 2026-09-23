import type { ArenaDef, Obstacle } from './arenas';

/**
 * Map expansion (v0.5): every arena is its old floor (the core) with four wings around it behind gates, and a hidden vault
 * in one corner. A run starts with only the core open; gates open when a quest is done or the mid-Act boss falls, and each
 * wing holds one feature (a shrine, a chest, a lair or a hazard field with a cache). The vault opens for the sacred treasure's
 * guardian (v0.5 treasures). All sizes in world pixels.
 */
export const REGIONS = {
  wingDepth: 480, // how far a wing reaches out from the core's wall
  gateWidth: 220, // corridor through a wall; bodies wider than this cannot pass
  gateReach: 90, // a corridor reaches this far into both floors, so crossing it is continuous
  shrineRadius: 70, // stand this close to use a shrine, open a chest
  lairGuards: 4,
  hazardEvery: 3.5, // seconds between vent bursts in a hazard wing
  hazardDamage: 16, // scaled by the wave like enemy damage
  cacheGold: 60, // the hazard wing's cache, times the Act
  chestGold: 40,
  lairBoss: { hpMult: 7, damageMult: 1.4, gold: 120 },
  shrineBlessings: 3, // choices offered by a shrine
};

export type RegionId = 'core' | 'north' | 'east' | 'south' | 'west' | 'vault';
export const WING_IDS = ['north', 'east', 'south', 'west'] as const;
export type WingId = (typeof WING_IDS)[number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** For a corridor: the axis it runs along. Bodies are kept inside it only across that axis, so walking through is seamless. */
  along?: 'x' | 'y';
}

export interface RegionDef {
  id: RegionId;
  name: string;
  floor: Rect;
  gate: Rect | null; // the corridor to the region it opens from (null for the core)
  hidden?: boolean; // the vault: drawn as solid wall until it opens
}

export type FeatureKind = 'shrine' | 'chest' | 'lair' | 'hazard';

export const FEATURES: Record<FeatureKind, { name: string; icon: string; desc: string }> = {
  shrine: { name: 'Shrine', icon: '⛩️', desc: 'An old altar. Kneel for a blessing that lasts the whole run.' },
  chest: { name: 'Strongbox', icon: '🧰', desc: 'A strongbox left behind in the retreat: gold and a relic.' },
  lair: { name: 'Lair', icon: '💀', desc: 'Something big sleeps here. Waking it is worth a relic.' },
  hazard: { name: 'Vents', icon: '♨️', desc: 'Scalding vents guard a forgotten cache of gold.' },
};

/** Shrine blessings: permanent for the run, one of REGIONS.shrineBlessings offered. Plain mods, folded into the run's base mods. */
export const BLESSINGS = {
  valor: { name: 'Blessing of Valor', desc: '+12% damage.', mods: { damage: 1.12 } },
  haste: { name: 'Blessing of Haste', desc: '+10% attack speed.', mods: { atkSpd: 1.1 } },
  ward: { name: 'Blessing of the Ward', desc: '+6% armor.', mods: { armor: 0.06 } },
  swiftness: { name: 'Blessing of Swiftness', desc: '+8% movement speed.', mods: { moveSpd: 1.08 } },
  focus: { name: 'Blessing of Focus', desc: 'Signature ability recharges 10% faster.', mods: { abilityCd: 0.9 } },
  plenty: { name: 'Blessing of Plenty', desc: '+20% gold and +10% experience.', mods: { gold: 1.2, xp: 1.1 } },
  mending: { name: 'Blessing of Mending', desc: '+2 HP regeneration a second.', mods: { regen: 2 } },
  fortune: { name: 'Blessing of Fortune', desc: '+6% crit chance.', mods: { crit: 0.06 } },
} as const;
export type BlessingId = keyof typeof BLESSINGS;
export const BLESSING_IDS = Object.keys(BLESSINGS) as BlessingId[];

const WING_NAMES: Record<RegionId, string> = { core: 'the heart', north: 'the north wing', east: 'the east wing', south: 'the south wing', west: 'the west wing', vault: 'the hidden vault' };

/**
 * An authored arena (its floor = the core) -> the full map: bigger bounds, the core's obstacles moved into place, the regions,
 * and a few of the arena's own obstacles scattered in each wing. Deterministic: the same arena always gives the same map.
 */
export function expandArena(def: ArenaDef): ArenaDef {
  const d = REGIONS.wingDepth;
  const { w, h, wall } = def;
  const W = w + 2 * d;
  const H = h + 2 * d;
  const gw = REGIONS.gateWidth;
  const reach = REGIONS.gateReach;
  const cx = W / 2;
  const cy = H / 2;
  const core: Rect = { x: d + wall, y: d + wall, w: w - 2 * wall, h: h - 2 * wall };
  const floors: Record<Exclude<RegionId, 'core'>, Rect> = {
    north: { x: d + wall, y: wall, w: w - 2 * wall, h: d - wall },
    south: { x: d + wall, y: d + h, w: w - 2 * wall, h: d - wall },
    west: { x: wall, y: d + wall, w: d - wall, h: h - 2 * wall },
    east: { x: d + w, y: d + wall, w: d - wall, h: h - 2 * wall },
    vault: { x: d + w, y: wall, w: d - wall, h: d - wall },
  };
  const vertical = (x: number, y0: number, y1: number): Rect => ({ x: x - gw / 2, y: y0 - reach, w: gw, h: y1 - y0 + 2 * reach, along: 'y' });
  const horizontal = (y: number, x0: number, x1: number): Rect => ({ x: x0 - reach, y: y - gw / 2, w: x1 - x0 + 2 * reach, h: gw, along: 'x' });
  const gates: Record<Exclude<RegionId, 'core'>, Rect> = {
    north: vertical(cx, d, d + wall),
    south: vertical(cx, d + h - wall, d + h),
    west: horizontal(cy, d, d + wall),
    east: horizontal(cy, d + w - wall, d + w),
    vault: vertical(d + w + (d - wall) / 2, d, d + wall), // from the east wing, through the corner's wall
  };
  const regions: RegionDef[] = [
    { id: 'core', name: WING_NAMES.core, floor: core, gate: null },
    ...(['north', 'east', 'south', 'west', 'vault'] as const).map((id) => ({ id, name: WING_NAMES[id], floor: floors[id], gate: gates[id], hidden: id === 'vault' || undefined })),
  ];
  const shift = <T extends { x: number; y: number }>(o: T): T => ({ ...o, x: o.x + d, y: o.y + d });
  const shifted = def.obstacles.map(shift);
  const scatterKind = def.obstacles.find((o) => o.kind !== 'brazier' && o.kind !== 'throne');
  const wingObstacles: Obstacle[] = [];
  if (scatterKind) {
    for (const id of WING_IDS) {
      const f = floors[id];
      for (let i = 0; i < 4; i++) {
        // fixed, even spots along the wing, clear of its gate and its feature (the centre)
        const t = (i + 0.5) / 4;
        const x = f.w > f.h ? f.x + f.w * (i < 2 ? t * 0.8 : 0.2 + t * 0.8) : f.x + f.w * (i % 2 ? 0.25 : 0.75);
        const y = f.w > f.h ? f.y + f.h * (i % 2 ? 0.28 : 0.72) : f.y + f.h * (i < 2 ? t * 0.8 : 0.2 + t * 0.8);
        wingObstacles.push({ kind: scatterKind.kind, x, y, r: scatterKind.r });
      }
    }
  }
  const final = def.final && { throne: shift(def.final.throne), flames: def.final.flames.map(shift) };
  return { ...def, w: W, h: H, obstacles: [...shifted, ...wingObstacles], regions, final };
}

/** The point a wing's feature stands on: the middle of its floor. */
export const featureSpot = (r: RegionDef): { x: number; y: number } => ({ x: r.floor.x + r.floor.w / 2, y: r.floor.y + r.floor.h / 2 });
