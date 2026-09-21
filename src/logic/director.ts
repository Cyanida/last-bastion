import type { ClassId } from '../config/classes';
import { CLASS_BIAS, DIRECTOR, MODIFIER_BIAS, SQUADS, type SquadTemplate } from '../config/director';
import type { AffixId } from '../config/elites';
import { ENEMIES, type EnemyId } from '../config/enemies';
import type { ModifierId } from '../config/waves';
import { clamp, mulberry32, pickWeighted } from '../core/math';
import { eliteChance, rollAffixes } from './elites';
import { enemyDmgMult, enemyHpMult } from './formulas';
import type { Formation } from './squads';
import { bossFor, enemyCount, rollModifier, spawnIntervalFor, unlockedPool } from './waves';

export interface DirectorInput {
  seed: number; // run seed: with the same inputs, the same wave comes out
  wave: number;
  classId?: ClassId;
  performance?: number; // -1 struggling .. +1 cruising
  bosses?: EnemyId[];
  eliteMult?: number; // difficulty tier
  themeBias?: Partial<Record<EnemyId, number>>; // the current Act's theme
  budgetMult?: number; // curses
  squadMult?: number;
  eliteCommanders?: boolean;
}

export interface SpawnUnit {
  id: EnemyId;
  affixes: AffixId[];
  squad: number; // index into squads, -1 = on its own
  commander: boolean;
}

export interface SquadPlan {
  template: string;
  formation: Formation;
  spacing: number;
  holdUntil: number;
}

export interface DirectedWave {
  wave: number;
  boss: EnemyId | null;
  units: SpawnUnit[]; // spawn order; the boss first, squads contiguous
  squads: SquadPlan[];
  modifier: ModifierId | null;
  budget: number;
  hpMult: number;
  dmgMult: number;
  spawnInterval: number;
}

export const enemyCost = (id: EnemyId) => Math.max(1, ENEMIES[id].xp);

/** Per-wave rng that does not depend on anything that happened during play. */
export const waveRng = (seed: number, wave: number) => mulberry32((Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(wave, 0x85ebca6b)) >>> 0);

export function waveBudget(wave: number, performance = 0, budgetMult = 1): number {
  const c = DIRECTOR.costPerHead;
  const perHead = Math.min(c.max, c.base + c.perWave * wave);
  const struggling = Math.max(0, -performance);
  return Math.round(enemyCount(wave) * perHead * budgetMult * (1 - struggling * DIRECTOR.rubberBand.budgetCut));
}

function squadCost(t: SquadTemplate): number {
  return (t.commander ? enemyCost(t.commander) : 0) + t.members.reduce((sum, [id, n]) => sum + enemyCost(id) * n, 0);
}

/** Recent performance, smoothed: how much HP was left and whether the wave was cleared quickly. */
export function updatePerformance(prev: number, hpFrac: number, clearTime: number, expectedTime: number): number {
  const r = DIRECTOR.rubberBand;
  const score = hpFrac * 0.7 + (clearTime < expectedTime * r.fastClear ? 0.3 : clearTime > expectedTime * 1.5 ? 0 : 0.15);
  return clamp(prev * r.smoothing + (score - 0.5) * 2 * (1 - r.smoothing), -1, 1);
}

export function directWave(input: DirectorInput): DirectedWave {
  const { wave } = input;
  const rng = waveRng(input.seed, wave);
  const performance = clamp(input.performance ?? 0, -1, 1);
  const modifier = rollModifier(wave, rng);
  const boss = bossFor(wave, input.bosses);
  const budget = waveBudget(wave, performance, input.budgetMult ?? 1); // boss waves: enemyCount already shrinks the escort
  let left = budget;

  // class, modifier and Act theme all tilt the weights (Siege's crossbows are already handled by unlockedPool)
  const bias = (id: EnemyId) => (input.classId ? (CLASS_BIAS[input.classId][id] ?? 1) : 1) * (modifier ? (MODIFIER_BIAS[modifier][id] ?? 1) : 1) * (input.themeBias?.[id] ?? 1);
  const pool = unlockedPool(wave, modifier).map((p) => ({ value: p.value, weight: p.weight * bias(p.value) }));

  const chance = eliteChance(wave, input.eliteMult ?? 1) * (1 + Math.max(0, performance) * DIRECTOR.rubberBand.eliteBonus);
  const affixesFor = (force: boolean): AffixId[] => (force || rng() < chance ? rollAffixes(wave, rng) : []);

  const units: SpawnUnit[] = [];
  const squads: SquadPlan[] = [];
  const sq = DIRECTOR.squads;
  if (wave >= sq.fromWave) {
    const templates = SQUADS.filter((t) => wave >= t.from).map((t) => ({ value: t, weight: t.weight * (t.commander ? bias(t.commander) : 1) * bias(t.members[0][0]) }));
    const squadChance = Math.min(0.95, (sq.chance + sq.perWave * (wave - sq.fromWave)) * (input.squadMult ?? 1));
    let squadBudget = budget * sq.maxShare;
    while (templates.length > 0 && squads.length < sq.maxPerWave && rng() < squadChance) {
      const t = pickWeighted(templates, rng);
      const cost = squadCost(t);
      if (cost > squadBudget) break;
      squadBudget -= cost;
      left -= cost;
      const index = squads.push({ template: t.id, formation: t.formation, spacing: t.spacing, holdUntil: t.holdUntil }) - 1;
      if (t.commander) units.push({ id: t.commander, affixes: affixesFor(input.eliteCommanders === true), squad: index, commander: true });
      for (const [id, n] of t.members) for (let i = 0; i < n; i++) units.push({ id, affixes: affixesFor(false), squad: index, commander: false });
    }
  }

  const maxUnits = DIRECTOR.maxUnits - (boss ? 1 : 0);
  while (left > 0 && units.length < maxUnits) {
    const id = pickWeighted(pool, rng);
    left -= enemyCost(id);
    units.push({ id, affixes: affixesFor(false), squad: -1, commander: false });
  }
  if (boss) units.unshift({ id: boss, affixes: [], squad: -1, commander: false });

  return { wave, boss, units, squads, modifier, budget, hpMult: enemyHpMult(wave), dmgMult: enemyDmgMult(wave), spawnInterval: spawnIntervalFor(units.length, units.length) };
}
