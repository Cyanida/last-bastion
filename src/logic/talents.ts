import type { ClassId } from '../config/classes';
import { TALENT_BY_ID, TALENTS, talentsFor, type TalentNode } from '../config/talents';
import type { Mods } from '../core/types';
import { combineMods, neutralMods } from './mods';

/** Talent points earned by a level: one every `levelsPerPoint` levels (level 3, 6, 9...). */
export const talentPointsForLevel = (level: number): number => Math.floor(level / TALENTS.levelsPerPoint);

export const branchPoints = (taken: string[], branch: string): number => taken.filter((id) => TALENT_BY_ID[id]?.branch === branch).length;

export const takenKeystone = (taken: string[]): TalentNode | undefined => taken.map((id) => TALENT_BY_ID[id]).find((n) => n?.keystone);

/** Why a node cannot be taken right now, or null when it can. */
export function talentBlocker(taken: string[], id: string, unspent: number, rowCap = TALENTS.rows - 1): string | null {
  const node = TALENT_BY_ID[id];
  if (!node) return 'unknown talent';
  if (taken.includes(id)) return 'already taken';
  if (node.row > rowCap) return node.keystone ? 'the Library must be raised for keystones' : 'the Library must be raised for this row';
  if (unspent <= 0) return 'no talent points';
  if (node.requires.length > 0 && !node.requires.some((r) => taken.includes(r))) return `needs ${node.requires.map((r) => TALENT_BY_ID[r].name).join(' or ')}`;
  if (node.keystone) {
    if (branchPoints(taken, node.branch) < TALENTS.keystonePoints) return `needs ${TALENTS.keystonePoints} points in the branch`;
    const other = takenKeystone(taken);
    if (other) return `only one keystone: you have ${other.name}`;
  }
  return null;
}

export const canTakeTalent = (taken: string[], id: string, unspent: number, rowCap = TALENTS.rows - 1): boolean => talentBlocker(taken, id, unspent, rowCap) === null;

/** Every taken node's plain mods folded into one Mods (multiplicative keys multiply, additive keys add). */
export function talentMods(taken: string[]): Mods {
  const mods = neutralMods();
  for (const id of taken) {
    const node = TALENT_BY_ID[id];
    if (node?.mods) combineMods(mods, node.mods);
  }
  return mods;
}

/** The bot's spending plan: walk one branch top to bottom, keystone last. */
export function branchPlan(classId: ClassId, branchIndex: number): string[] {
  const nodes = talentsFor(classId);
  const branches = [...new Set(nodes.map((n) => n.branch))];
  const branch = branches[branchIndex % branches.length];
  return nodes.filter((n) => n.branch === branch).sort((a, b) => a.row - b.row).map((n) => n.id);
}
