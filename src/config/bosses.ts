import type { EnemyId } from './enemies';
import type { QuestKind } from './quests';

/**
 * #99: every boss a run can meet (not the Usurper: config/acts.ts FINAL). One table, so other boss data (a relic family, #100) goes here too.
 * A variant fights with its base boss's def and script (`from`), renamed, tinted and stronger, like a treasure guardian; its enemy id
 * stays the base one, so resistances, patterns and treasure fragments follow the base boss.
 * - 'mid': the wave x5 boss, a weighted draw (logic/bosses.ts pickMidBoss). No boss comes back in a run until every one it could draw
 *   has been met. The arena's own rotation (config/arenas.ts) weighs `arenaBias` times more. Act I keeps its arena's opener.
 * - 'act': the wave x0 boss, in table order (Act I, II, III, then round again in Endless).
 * - `rare`: low weight and only from `fromAct` on: a strong one. `quest`: only drawn in an Act where that quest was taken.
 */
export interface BossDef {
  from: EnemyId;
  slot: 'mid' | 'act';
  weight: number; // mid-Act draw weight
  name?: string;
  palette?: number; // render/sprites SPRITE_PALETTES
  hp?: number; // x the base boss's HP
  damage?: number; // x its damage
  rare?: boolean;
  fromAct?: number;
  quest?: QuestKind;
}

export const BOSSES: Record<string, BossDef> = {
  blackKnight: { from: 'blackKnight', slot: 'mid', weight: 10 },
  warlord: { from: 'warlord', slot: 'mid', weight: 10 },
  lich: { from: 'lich', slot: 'mid', weight: 10 },
  inquisitor: { from: 'inquisitor', slot: 'mid', weight: 10 },
  abbot: { from: 'abbot', slot: 'mid', weight: 10 },
  // rare and strong
  dreadKnight: { from: 'blackKnight', slot: 'mid', weight: 3, rare: true, fromAct: 2, name: 'The Dread Knight', palette: 3, hp: 1.6, damage: 1.25 },
  frostLich: { from: 'lich', slot: 'mid', weight: 3, rare: true, fromAct: 2, name: 'The Frost Lich', palette: 4, hp: 1.5, damage: 1.25 },
  // quest-gated: answer a quest taken at the Act's start
  siegeMarshal: { from: 'warlord', slot: 'mid', weight: 60, quest: 'camps', name: 'The Siege Marshal', palette: 1, hp: 1.2 },
  headsman: { from: 'blackKnight', slot: 'mid', weight: 60, quest: 'elite', name: 'The Headsman', palette: 5, hp: 1.2 },
  heretic: { from: 'inquisitor', slot: 'mid', weight: 60, quest: 'monk', name: 'The Heretic', palette: 2, hp: 1.2 },
  // Act ends
  dragon: { from: 'dragon', slot: 'act', weight: 0 },
  warden: { from: 'warden', slot: 'act', weight: 0 },
  ashWyrm: { from: 'dragon', slot: 'act', weight: 0, name: 'The Ash Wyrm', palette: 1, hp: 1.15, damage: 1.1 },
};
export type BossKey = string;

export const BOSS_RULES = {
  arenaBias: 2,
  poolFromAct: 2, // Act I's mid-Act boss is still its arena's first one (the gentle opener); the draw starts in Act II
};
