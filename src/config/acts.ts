import type { Rarity } from './relics';
import type { Bias } from './director';
import type { EnemyId } from './enemies';

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

/** The Merchant between Acts. Prices rise by priceGrowth per Act. Gold spent here is gold the Keep never sees. */
export const MERCHANT = {
  priceGrowth: 0.35,
  heal: { cost: 40, frac: 0.5 },
  reroll: 45, // swap one of your relics for a random one of the same rarity (selling and salvage pay you instead: config/relics.ts RELIC_DROPS)
  buy: { common: 70, rare: 150, legendary: 330 } as Record<Rarity, number>,
};
