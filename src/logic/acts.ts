import { ACT_THEMES, ACTS, FINAL, MERCHANT } from '../config/acts';
import { ARENA_IDS, ARENAS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, type ClassId } from '../config/classes';
import { CURSE_IDS, type CurseId } from '../config/curses';
import type { EnemyId } from '../config/enemies';
import type { Rarity } from '../config/relics';
import { WAVES } from '../config/waves';
import { mulberry32 } from '../core/math';

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

/** Wave x0 ends the Act with an Act boss; wave x5 brings a boss from the current arena's rotation. */
export function bossForWave(wave: number, arena: ArenaId): EnemyId | null {
  if (wave % WAVES.bossEvery !== 0) return null;
  const act = actOf(wave);
  if (isActEnd(wave)) return act === FINAL.act ? FINAL.boss : ACTS.bosses[(act - 1) % ACTS.bosses.length];
  const rotation = ARENAS[arena].bosses;
  return rotation[(act - 1) % rotation.length];
}

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

export const todayString = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
