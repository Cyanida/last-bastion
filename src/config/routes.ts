/**
 * v0.6 route choice: after each Act the road forks three ways (logic/routes.ts rolls them from the run's seed, so a Daily Trial offers
 * everyone the same). A route is the next Act's arena, its theme (which tilts the spawn director) and a focus: what the Act is about.
 * The Last Bastion is always Act IV, so there only the theme and focus change.
 */
export type RouteFocus = 'elite' | 'merchant' | 'pilgrim' | 'siege';

export const ROUTE_FOCUS: Record<RouteFocus, { name: string; icon: string; desc: string }> = {
  elite: { name: 'Elite path', icon: '⚔️', desc: 'More elites, and an extra reroll at every relic moment of the Act.' },
  merchant: { name: 'Merchant path', icon: '🪙', desc: 'The Merchant also waits halfway through the Act, and everything drops more gold.' },
  pilgrim: { name: 'Pilgrim path', icon: '⛩️', desc: 'A shrine blesses you as the Act begins, and you may take one more quest from the board.' },
  siege: { name: 'Siege path', icon: '🏰', desc: 'The enemy is tougher all Act, but its boss pays Runes on top of the usual.' },
};

export const ROUTES = {
  choices: 3,
  elite: { eliteMult: 1.8, rerolls: 1 }, // elite chance times this, and extra rerolls at the Act's relic moments (v0.7: was elites' relic drop chance)
  merchant: { gold: 1.25, midWave: 5, relicChance: 0.1 }, // gold drops times this; the Merchant visits after the Act's wave `midWave`; his caravan sells a relic that visit at relicChance (v0.8.1 #144), else books
  pilgrim: { extraQuests: 1 },
  siege: { hp: 1.15, damage: 1.15, runes: 2 }, // enemy HP and damage times these; Runes when the Act boss falls, outside the cap
};
