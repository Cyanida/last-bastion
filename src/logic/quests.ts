import { EVENT_KINDS, EVENT_ROLL, EVENTS, type EventKind } from '../config/events';
import { QUEST_BOARD, QUEST_KINDS, QUESTS, REWARD_ROLL, type QuestKind, type RewardKind } from '../config/quests';
import type { Game, Quest } from '../core/types';
import { waveRng } from './director';
import { isBossWave, pacingOf } from './waves';

/**
 * v0.5 side quests and wave events: the seeded rolls, and read-only views of their state (map marks, tracker text). The rolls
 * come from waveRng with their own salts, so they depend on the seed alone and not on how the run went: a Daily Trial offers
 * everyone the same boards and the same events.
 */
const BOARD_SALT = 0x5eedb0a2;
const EVENT_SALT = 0x0e7e4711;
const PLACE_SALT = 0x91ace5;

/** The Act's board: distinct quests, each with the reward it pays. */
export function rollBoard(seed: number, act: number): { kind: QuestKind; reward: RewardKind }[] {
  const rng = waveRng(seed ^ BOARD_SALT, act);
  const left = [...QUEST_KINDS];
  const out: { kind: QuestKind; reward: RewardKind }[] = [];
  while (out.length < QUEST_BOARD.offered && left.length) {
    out.push({ kind: left.splice(Math.floor(rng() * left.length), 1)[0], reward: REWARD_ROLL[Math.floor(rng() * REWARD_ROLL.length)] });
  }
  return out;
}

/** This wave's event, or null: always on a breather, EVENT_ROLL.chance on other waves from EVENT_ROLL.fromWave, never on a boss wave. */
export function rollEvent(seed: number, wave: number): EventKind | null {
  if (isBossWave(wave) || wave < EVENT_ROLL.fromWave) return null;
  const rng = waveRng(seed ^ EVENT_SALT, wave);
  if (pacingOf(wave) !== 'breather' && rng() >= EVENT_ROLL.chance) return null;
  return EVENT_KINDS[Math.floor(rng() * EVENT_KINDS.length)];
}

/** Where a quest (key 1000 * act + slot) or an event (key = wave) puts its things. */
export const placeRng = (seed: number, key: number) => waveRng(seed ^ PLACE_SALT, key);

export interface Mark {
  x: number;
  y: number;
  icon: string;
  lift: number; // how far above the point its icon floats (over a unit's head, or 0 on the ground)
  hidden?: boolean; // the hidden chest: no marker anywhere (only the bot knows)
}

/** Where the active quests want the player: world icons, minimap dots, screen-edge arrows, and the bot's walks. */
export function questMarks(g: Game): Mark[] {
  const out: Mark[] = [];
  for (const q of g.quests) {
    if (q.state !== 'active') continue;
    const icon = QUESTS[q.kind].icon;
    if (q.unit) out.push({ x: q.unit.x, y: q.unit.y, icon, lift: q.unit.r + 44 });
    if (q.kind === 'monk') out.push({ x: q.x, y: q.y, icon: '⛪', lift: 0 });
    if (q.kind === 'shrine' || q.kind === 'chest') out.push({ x: q.x, y: q.y, icon, lift: 0, hidden: q.kind === 'chest' });
    for (const e of q.foes) if (!e.dead) out.push({ x: e.x, y: e.y, icon, lift: e.r + 50 });
  }
  return out;
}

/** The tracker's progress text: "wave 1/2", "1/3", "23/60 s". */
export function questProgress(q: Quest): string {
  const hp = q.unit ? ` · ${Math.max(0, Math.ceil(q.unit.hp))} HP` : '';
  if (q.kind === 'caravan') return `wave ${Math.min(q.progress, QUESTS.caravan.waves)}/${QUESTS.caravan.waves}${hp}`;
  if (q.kind === 'camps') return `${q.progress}/${QUESTS.camps.count}`;
  if (q.kind === 'monk') return `${q.unit?.speed ? 'walking' : 'waiting'}${hp}`;
  if (q.kind === 'elite') return q.foes.length ? 'on the field' : `comes with wave ${q.since}`;
  if (q.kind === 'shrine') return `${Math.floor(q.progress)}/${QUESTS.shrine.seconds} s`;
  return 'hidden';
}

/** This wave's event on the map: the peddler, an unopened cursed chest, the cart. */
export function eventMarks(g: Game): Mark[] {
  const ev = g.event;
  if (!ev) return [];
  const icon = EVENTS[ev.kind].icon;
  if (ev.kind === 'peddler') return [{ x: ev.x, y: ev.y, icon, lift: 60 }];
  if (ev.kind === 'cursedChest' && !ev.used) return [{ x: ev.x, y: ev.y, icon, lift: 0 }];
  if (ev.foe && !ev.foe.dead) return [{ x: ev.foe.x, y: ev.foe.y, icon, lift: ev.foe.r + 44 }];
  return [];
}
