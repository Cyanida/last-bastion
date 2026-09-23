import { CLASS_ORDER, CLASSES, type ClassId } from '../config/classes';
import { CONTRACT_KINDS, CONTRACTS, CONTRACTS_PER_WEEK, type ContractKind } from '../config/contracts';
import { mulberry32 } from '../core/math';
import { hashSeed } from './acts';

export interface Contract { kind: ContractKind; target: number; classId: ClassId | null; runes: number; text: string }
export interface ContractState { week: string; progress: number[] }

/** What a banked run brings to a contract (a subset of RunSummary, so this file does not import the save). */
export interface ContractRun { classId: ClassId; kills: number; elites: number; bosses: number; quests: number; commanders: number; wave: number; acts: number; evolutions: number; relics: number }

/** The week a date falls in, Monday to Sunday (1970-01-01 was a Thursday, so +3 days puts the boundary on Monday). */
export function weekKey(date: string): string {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  return `W${Math.floor((days + 3) / 7)}`;
}

/** The week's three contracts: seeded by the week alone, so everyone gets the same ones. */
export function weeklyContracts(week: string): Contract[] {
  const rng = mulberry32(hashSeed(`last-bastion:contracts:${week}`));
  const kinds = [...CONTRACT_KINDS];
  return Array.from({ length: CONTRACTS_PER_WEEK }, () => {
    const kind = kinds.splice(Math.floor(rng() * kinds.length), 1)[0];
    const c = CONTRACTS[kind];
    const level = Math.floor(rng() * 3);
    const classId = kind === 'waveWith' ? CLASS_ORDER[Math.floor(rng() * CLASS_ORDER.length)] : null;
    const target = c.targets[level];
    return { kind, target, classId, runes: c.runes + level, text: c.text.replace('{n}', target.toLocaleString('en')).replace('{class}', classId ? CLASSES[classId].name : '') };
  });
}

function measure(c: Contract, run: ContractRun): number {
  switch (c.kind) {
    case 'waveWith': return run.classId === c.classId ? run.wave : 0;
    case 'evolve': return run.evolutions;
    default: return run[c.kind];
  }
}

/** This week's progress (a new week starts from nothing). */
export const currentProgress = (state: ContractState, week: string): number[] => (state.week === week ? state.progress : Array(CONTRACTS_PER_WEEK).fill(0));

/** Fold a banked run into the week's contracts. A contract pays its Runes once, when the run completes it. */
export function advanceContracts(state: ContractState, week: string, run: ContractRun): { state: ContractState; runes: number; completed: Contract[] } {
  const contracts = weeklyContracts(week);
  const before = currentProgress(state, week);
  const completed: Contract[] = [];
  const progress = contracts.map((c, i) => {
    const v = measure(c, run);
    const next = CONTRACTS[c.kind].sum ? before[i] + v : Math.max(before[i], v);
    if (before[i] < c.target && next >= c.target) completed.push(c);
    return Math.min(c.target, next);
  });
  return { state: { week, progress }, runes: completed.reduce((n, c) => n + c.runes, 0), completed };
}
