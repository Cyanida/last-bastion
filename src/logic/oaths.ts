import type { CurseId } from '../config/curses';
import { OATH_REWARD, OATHS, type OathKnob } from '../config/oaths';

export interface OathStack { level: number; curses: CurseId[]; n: Record<OathKnob, number> }

const MULTIPLY: readonly OathKnob[] = ['hp', 'damage', 'eliteMult', 'bossHp', 'modifierChance'];
const NEUTRAL: Record<OathKnob, number> = { hp: 1, damage: 1, eliteMult: 1, bossHp: 1, modifierChance: 1, modifierFrom: 0, secondWind: 0, affixes: 0, noMerchant: 0, noLastStand: 0, rerollsLess: 0 };

/** Everything Oath `level` asks, levels 1..level stacked. 0 (a custom run) asks nothing. */
export function oathStack(level: number): OathStack {
  const lv = Math.max(0, Math.min(OATHS.length, Math.floor(level)));
  const n = { ...NEUTRAL };
  const curses: CurseId[] = [];
  for (const o of OATHS.slice(0, lv)) {
    if (o.curse) curses.push(o.curse);
    for (const [k, v] of Object.entries(o.n ?? {}) as [OathKnob, number][]) n[k] = MULTIPLY.includes(k) ? n[k] * v : v;
  }
  return { level: lv, curses, n };
}

/** The highest Oath a class may swear: none before its first win, then one above the highest it has kept. */
export const oathCap = (wins: number, cleared: number): number => (wins > 0 ? Math.min(OATHS.length, cleared + 1) : 0);

/** What keeping Oath `level` for the first time with a class pays. */
export const oathReward = (level: number) => ({
  runes: OATH_REWARD.runes + Math.floor(level / 5) * OATH_REWARD.runesPer5,
  gold: OATH_REWARD.gold + level * OATH_REWARD.goldPerLevel,
});
