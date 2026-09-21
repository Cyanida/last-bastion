/**
 * Curses: optional handicaps chosen before a run. Each adds `bonus` to the gold and class-XP multiplier
 * (they add up: three +20% curses = x1.6). Unlocked through achievements (config/achievements.ts `unlocks.curse`).
 */
export type CurseId = 'ironHorde' | 'glassBones' | 'noRespite' | 'timedWaves' | 'eliteCommanders' | 'blind' | 'frenzy' | 'swarm';

export const CURSES: Record<CurseId, { name: string; desc: string; bonus: number; n: Record<string, number> }> = {
  ironHorde: { name: 'Iron Horde', desc: 'Enemies have +20% HP.', bonus: 0.15, n: { hp: 1.2 } },
  glassBones: { name: 'Glass Bones', desc: 'You take +25% damage.', bonus: 0.2, n: { damage: 1.25 } },
  noRespite: { name: 'No Respite', desc: 'No regeneration or healing between waves, and the breather is 1 second.', bonus: 0.15, n: { breather: 1 } },
  timedWaves: { name: 'Hourglass', desc: 'The next wave arrives 25 seconds after the last spawn, ready or not.', bonus: 0.2, n: { overtime: 25 } },
  eliteCommanders: { name: 'Officer Corps', desc: 'Every commander is an elite, and squads are twice as common.', bonus: 0.25, n: { squadWeight: 2 } },
  blind: { name: 'Blindfold', desc: 'No minimap.', bonus: 0.1, n: {} },
  frenzy: { name: 'Frenzy', desc: 'Enemies move 15% faster.', bonus: 0.2, n: { speed: 1.15 } },
  swarm: { name: 'Swarm', desc: 'The spawn budget is 30% larger.', bonus: 0.3, n: { budget: 1.3 } },
};
export const CURSE_IDS = Object.keys(CURSES) as CurseId[];
