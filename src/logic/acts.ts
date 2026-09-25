import { ACT_THEMES, ACTS, FINAL, MERCHANT } from '../config/acts';
import { ARENA_IDS, ARENAS, type ArenaId } from '../config/arenas';
import { BOSS_RULES, BOSSES, type BossDef, type BossKey } from '../config/bosses';
import { CLASS_ORDER, type ClassId } from '../config/classes';
import { CURSE_IDS, type CurseId } from '../config/curses';
import type { EnemyId } from '../config/enemies';
import type { QuestKind } from '../config/quests';
import type { Rarity } from '../config/relics';
import { WAVES } from '../config/waves';
import { mulberry32, pickWeighted } from '../core/math';
import type { Rng } from '../core/types';
import { waveRng } from './director';

// ---------- Acts ----------
export const actOf = (wave: number) => Math.max(1, Math.ceil(wave / ACTS.length));
export const isActEnd = (wave: number) => wave > 0 && wave % ACTS.length === 0;
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const actName = (act: number) => `Act ${ROMAN[act - 1] ?? act}`;

/** Act I is always The Levy and Act IV the Usurper's host; the others walk the rest of the themes, starting at a seed-dependent one. */
export function themeFor(act: number, seed: number): (typeof ACT_THEMES)[number] {
  if (act <= 1) return ACT_THEMES[0];
  if (act === FINAL.act) return FINAL.theme;
  const rest = ACT_THEMES.length - 1;
  return ACT_THEMES[1 + ((act - 2 - (act > FINAL.act ? 1 : 0) + (Math.abs(seed) % rest)) % rest)];
}

/** Each Act moves on to the next arena, starting from the one the run began in. Act IV is the Last Bastion; Endless (Act V on) carries on the rotation. */
export function arenaFor(act: number, start: ArenaId): ArenaId {
  if (act === FINAL.act) return FINAL.arena;
  return ARENA_IDS[(ARENA_IDS.indexOf(start) + act - 1 - (act > FINAL.act ? 1 : 0)) % ARENA_IDS.length];
}

/** #99: what a boss wave draws from: the run's seed and arena, the bosses met so far and the quests taken this Act. */
export interface BossDraw {
  seed: number;
  arena: ArenaId;
  seen: BossKey[];
  quests: QuestKind[];
}

/** Wave x0 ends the Act with an Act boss (config/bosses.ts, in order; the Usurper in Act IV); wave x5 draws a mid-Act boss. */
export function bossForWave(wave: number, draw: BossDraw): BossKey | null {
  if (wave % WAVES.bossEvery !== 0) return null;
  const act = actOf(wave);
  if (isActEnd(wave)) return act === FINAL.act ? FINAL.boss : ACT_BOSSES[(act - 1) % ACT_BOSSES.length];
  return pickMidBoss(act, draw, waveRng(draw.seed ^ 0xb055, wave));
}

const ACT_BOSSES = Object.keys(BOSSES).filter((k) => BOSSES[k].slot === 'act');
const MID_BOSSES = Object.keys(BOSSES).filter((k) => BOSSES[k].slot === 'mid');

/**
 * A mid-Act boss: weighted, never one already met this run until every boss it could draw has been met (then anyone but the last one).
 * Act I keeps the arena's opener. Rare ones wait for their Act; quest ones need their quest taken; the arena's own rotation weighs more.
 */
export function pickMidBoss(act: number, draw: BossDraw, rng: Rng): BossKey {
  if (act < BOSS_RULES.poolFromAct) return ARENAS[draw.arena].bosses[0];
  const open = MID_BOSSES.filter((k) => (BOSSES[k].fromAct ?? 1) <= act && (!BOSSES[k].quest || draw.quests.includes(BOSSES[k].quest!)));
  let left = open.filter((k) => !draw.seen.includes(k));
  if (left.length === 0) {
    const last = [...draw.seen].reverse().find((k) => open.includes(k));
    left = open.filter((k) => k !== last);
  }
  const rotation: readonly string[] = ARENAS[draw.arena].bosses;
  return pickWeighted(left.map((k) => ({ value: k, weight: BOSSES[k].weight * (rotation.includes(k) ? BOSS_RULES.arenaBias : 1) })), rng);
}

/** The boss a key names: its table entry, or a plain boss by its enemy id (the Usurper). */
export const bossDef = (key: BossKey): BossDef => BOSSES[key] ?? { from: key as EnemyId, slot: 'act', weight: 0 };

// ---------- Merchant ----------
export type MerchantItem = 'heal' | 'reroll' | 'reforge' | `buy:${Rarity}`;

export function merchantPrice(item: MerchantItem, act: number): number {
  const base = item.startsWith('buy:') ? MERCHANT.buy[item.slice(4) as Rarity] : item === 'heal' ? MERCHANT.heal.cost : item === 'reforge' ? MERCHANT.reforge : MERCHANT.reroll;
  return Math.round(base * (1 + MERCHANT.priceGrowth * (act - 1)));
}

// ---------- seeds and the Daily Trial ----------
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export const formatSeed = (seed: number) => (seed >>> 0).toString(36).toUpperCase();
/** What the player typed: a seed code from a results screen, or any word (hashed). Empty = null. */
export function parseSeed(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const code = /^[0-9a-z]{1,7}$/i.test(t) ? parseInt(t, 36) : NaN;
  return Number.isFinite(code) && code <= 0xffffffff ? code : hashSeed(t);
}

export const todayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface DailySetup {
  date: string;
  seed: number;
  classId: ClassId;
  arena: ArenaId;
  curses: CurseId[];
}
/** Everyone gets the same trial on the same date: class, arena and two curses all follow from it. */
export function dailySetup(date: string): DailySetup {
  const seed = hashSeed(`last-bastion:${date}`);
  const rng = mulberry32(seed);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
  const first = pick(CURSE_IDS);
  return { date, seed, classId: pick(CLASS_ORDER), arena: pick(ARENA_IDS), curses: [first, pick(CURSE_IDS.filter((c) => c !== first))] };
}
