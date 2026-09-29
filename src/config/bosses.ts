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
 * - 'realm' (#215): never drawn; only a realm level that names it as its end boss (config/world.ts) brings it.
 */
export interface BossDef {
  from: EnemyId;
  slot: 'mid' | 'act' | 'realm';
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
  // the realms' own bosses (#215)
  forgemaster: { from: 'forgemaster', slot: 'realm', weight: 0 },
};
export type BossKey = string;

export const BOSS_RULES = {
  arenaBias: 2,
  poolFromAct: 2, // Act I's mid-Act boss is still its arena's first one (the gentle opener); the draw starts in Act II
};

/**
 * The Act bosses' scripts (systems/bosses.ts): the numbers their def (config/enemies.ts) does not carry. Seconds and world pixels;
 * `damage` is x the boss's special (zones) or hit damage (bolts).
 */
export const DRAGON = {
  burnStacks: 0.12, // his fire fields' burn, x their dps
  fan: { count: 5, spread: 0.72, windup: 0.55, damage: 0.5, range: 640 }, // the breath: a fan of bolts, lines marked first
  fanReach: 1.6, // x his range: he breathes only this close
  phase3Rate: 1.5, // fires this much faster in phase 3
  meteors: { count: 3, scatter: 220, radius: 70, delay: 1.1, stagger: 0.2, damage: 0.7 }, // phase 3, around the player
  lineStagger: 0.06, // the line of fire lands zone by zone
  flight: { every: 2, time: 2.2, speed: 3 }, // from phase 2, every 2nd special: airborne (x his speed) for `time`
  landing: { radius: 190, delay: 0.9 },
  band: { start: 60, step: 170, radius: 105, delay: 1.6, damage: 0.6 }, // after landing: a burning strip through the player
};

export const WARDEN = {
  reach: 700, // seals only this close
  stone: { radius: 24, gap: 6, gapWidth: 3 }, // the ring's stones, the space between them, and a gap's width in stones
  seal: { radius: 300, gaps: [3, 2, 2], life: 8 }, // around the player; gaps per phase
  sweep: { hands: 8, zones: 5, step: 55, delay: 0.4 }, // phase 2+: a clock hand of force, one hand every `delay` s
  close: { after: 2.5, radius: 175, gaps: 2, life: 5.5 }, // phase 3: a tighter circle closes in
  /**
   * #202: the Marches' crown boss (level 7) fights a third phase of his own, the Judgement: a second ring inside the first with one gap
   * (find it, then one of the outer ring's), and rings of force rolling out from his hammer in place of the clock hands and the closing
   * circle. His seals come quicker, his knights every other seal. Every phase also runs WORLD.crownBoss.minPhaseSeconds.
   */
  crown: {
    specialCd: 6, // his seals in the Judgement (phases 1-2 keep his def's 7.5)
    inner: { radius: 165, gaps: 1, life: 7 },
    hammer: { rings: 3, step: 115, radius: 34, first: 1.0, gap: 0.5, damage: 0.8 }, // ring k lands at `first + (k-1) * gap` s, x his special damage
    summonEvery: 2, // knights on every 2nd seal
  },
};

/**
 * #215: the Forgemaster, the Iron Hold's level-3 boss (logic/forgemaster.ts, systems/bosses.ts). Three phases like an Act boss, since his
 * level ends on an Act's last wave; no minimum phase time (that is the crown boss's). Phase 1: his hammer comes down in a marked arc in
 * front of him. From phase 2 every other blow is his forge presses instead: a checkerboard of marked tiles round you that slam one colour,
 * then the other (step onto a tile that just struck), and the hammer throws a fan of sparks too. Phase 3: a third press stroke, quicker
 * blows, and the hammer leaves molten slag. His plate (config/damage.ts PLATES) is reforged whole at each new phase.
 */
export const FORGEMASTER = {
  specialCd: [5.5, 5, 4.2], // by phase; his def's specialCd is the first blow
  reach: 640, // he swings and presses only this close
  slam: { zones: 5, arc: 1.5, reach: 62, radius: 46, damage: 1 }, // the hammer: zones on an arc `reach` past his edge, x his special damage
  sparks: { count: 5, spread: 0.7, windup: 0.5, damage: 0.45, range: 560 }, // phase 2+: bolts after the hammer, x his hit damage
  press: { size: 5, cell: 92, radius: 50, first: 1.1, gap: 0.9, damage: 0.8, strokes: [0, 2, 3] }, // tiles size x size round you; strokes by phase
  slagFrom: 3, // the hammer's zones leave burning slag (his def's poolLife, poolDps) from this phase
};
