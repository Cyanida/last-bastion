/**
 * Seeded wave events (v0.5): at most one a wave, rolled from the seed so a Daily Trial is the same for everyone. Breather waves
 * (WAVES.pacing) always get one, other non-boss waves from `fromWave` on roll `chance`, boss waves never. They last the wave.
 * Unit HP is scaled like enemy damage, damage like enemy HP. Systems: systems/events.ts.
 */
export const EVENT_ROLL = { fromWave: 3, chance: 0.25 };

export const EVENTS = {
  peddler: { name: 'Wandering merchant', icon: '🧺', desc: 'A peddler sets up his pack for the wave. Walk up to him to trade.', stock: 1, heal: 0.4, token: 25, reach: 50 }, // v0.7: he sells a healing draught (a share of max HP) at the Merchant's heal price; relics come at fixed moments. #128: or a reroll token (one more free reroll on your next level-up), `token` gold times the Merchant's price growth; one sale a visit either way
  cursedChest: { name: 'Cursed chest', icon: '📦', desc: 'A chest that hums. Gold and a Rune shard inside, and the horde’s best around it.', elites: 3, reach: 40, gold: 60 }, // v0.7: gold per Act, no relic
  ambush: { name: 'Ambush', icon: '⚔️', desc: 'Two squads fall on you from both sides at once.', delay: 5, dist: 480, gold: 40 }, // gold times the Act, when the wave is cleared
  knight: { name: 'Lost knight', icon: '🛡️', desc: 'A knight who lost his company fights beside you for the wave.', hp: 900, damage: 28, speed: 120, attackCd: 0.8 },
  plagueCart: { name: 'Plague cart', icon: '☣️', desc: 'A cart of the dead rolls across the field, leaking poison. Burn it for its gold.', speed: 45, poolEvery: 1.1, pool: { r: 50, life: 6, dps: 9 }, gold: 70 },
};
export type EventKind = keyof typeof EVENTS;
export const EVENT_KINDS = Object.keys(EVENTS) as EventKind[];
