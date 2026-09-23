import type { Rarity } from './relics';
import type { Bias } from './director';
import type { EnemyId } from './enemies';
import type { ArenaId } from './arenas';

/** Runs are cut into Acts of `length` waves. The last wave of an Act is its boss; then the Merchant, then a new arena. */
export const ACTS = {
  length: 10,
  bosses: ['dragon', 'warden'] as EnemyId[], // Act-end bosses, in turn. Mid-Act bosses (wave x5) come from the arena's own rotation.
};

/** Announced when the Act starts; tilts what the spawn director buys. Act I is always the first one, the rest rotate by seed. */
export const ACT_THEMES: { name: string; desc: string; bias: Bias }[] = [
  { name: 'The Levy', desc: 'Peasants, bolts and banners.', bias: { peasant: 1.5, crossbow: 1.3, bannerman: 1.5 } },
  { name: 'The Hunt', desc: 'Fast things with teeth, and things you do not see coming.', bias: { wolf: 2.2, assassin: 2.2, cavalry: 1.7, houndmaster: 2.5 } },
  { name: 'The Crusade', desc: 'Steel, shields and men who heal them.', bias: { knight: 2, shieldBearer: 1.8, mirrorKnight: 2, priest: 1.8, chaplain: 2, shieldwall: 2 } },
  { name: 'The Plague', desc: 'Poison, fire and the hungry dead.', bias: { plagueDoctor: 2.5, cultist: 2, boneCollector: 2.2 } },
  { name: 'The Siege', desc: 'Engines of war roll in.', bias: { engineer: 2.5, siegeTower: 3, crossbow: 1.8, drummer: 1.5 } },
];

/**
 * v0.6: the run's ending. Act IV is always fought in the Last Bastion against the Usurper's own host, and its last wave is the Usurper
 * (systems/bosses.ts). His fall wins the run; the player then banks it or goes on into Endless (the old infinite scaling, Act V on).
 * All his timings are in seconds, distances in world pixels.
 */
export const FINAL = {
  act: 4,
  arena: 'bastion' as ArenaId,
  boss: 'usurper' as EnemyId,
  theme: { name: 'The Usurper’s Host', desc: 'His own guard holds the walls: plate, crossbows and banners.', bias: { knight: 2, crossbow: 1.6, bannerman: 1.8, mirrorKnight: 1.8, shieldwall: 1.8, cavalry: 1.5 } as Bias },
  usurper: {
    // phase 1, and between the others: a cleave in front of him, a lunge down a marked line, and his guard called in
    cleave: { windup: 0.9, reach: 95, arc: 1.3, zones: 5, radius: 62 }, // zones in an arc `reach` in front, `arc` radians wide
    lunge: { windup: 0.85, dist: 520, speed: 760, recover: 0.8, chain: 2 }, // chain: charges back to back in phase 3
    guards: { every: 3, id: 'knight' as EnemyId, count: 2 }, // every 3rd attack in phase 1 calls this many
    // phase 2: back to the throne behind a ward that only the Royal Flames keep alive
    ward: {
      flameId: 'royalFlame' as EnemyId,
      stand: 95, // he stands this far in front of the throne
      retreatSpeed: 3, // times his speed on the way back
      pitch: { every: 2.4, count: 5, spread: 230, radius: 72, delay: 1.3 }, // burning pitch from the walls, around the player
      volley: { every: 3.2, bolts: 7, spread: 0.9, speed: 330, windup: 0.6 }, // crossbows on the dais: a fan at the player, lines marked first
      pulse: { every: 5, radius: 135, delay: 1.1 }, // each flame flares around itself
      stagger: 3, // seconds he stands dazed when the last flame dies
    },
    // phase 3: the royal decree (two burning bands that cross where you stand) and the quake (rings rolling out from him)
    decree: { windup: 1.5, radius: 90, spacing: 165 },
    quake: { rings: 3, step: 115, radius: 66, first: 0.8, gap: 0.45 },
    specialCd: [3.4, 3.4, 2.6], // seconds between attacks, per phase
    // the shortest a phase can last: until then his HP holds at the next threshold (and he cannot fall in phase 3), so even a
    // huge build sees his attacks. Phase 2 needs no minimum: the Royal Flames take their time.
    minPhase: [20, 0, 25],
  },
};

/** The Merchant between Acts. Prices rise by priceGrowth per Act. Gold spent here is gold the Keep never sees. */
export const MERCHANT = {
  priceGrowth: 0.35,
  heal: { cost: 40, frac: 0.5 },
  reroll: 45, // swap one of your relics for a random one of the same rarity (selling and salvage pay you instead: config/relics.ts RELIC_DROPS)
  buy: { common: 70, rare: 150, legendary: 330 } as Record<Rarity, number>,
};
