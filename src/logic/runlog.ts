import { ARENA_IDS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, type ClassId } from '../config/classes';
import { RUN_LOG } from '../config/game';

/**
 * v0.6 run log: a compact timeline of one run, kept in the save (the last RUN_LOG.keep runs), shown in the Keep's Run History,
 * exported as JSON and read by `npm run sim -- pacing`. Times are run seconds rounded to 0.1.
 */
export type MarkKind = 'level' | 'relic' | 'talent' | 'upgrade' | 'board' | 'quest' | 'event' | 'shrine' | 'boss' | 'phase' | 'evolution' | 'merchant' | 'route' | 'act' | 'stand' | 'bored'; // phase: a boss's new phase or objective; stand: the Last Stand
export type Mark = [t: number, kind: MarkKind, detail: string];
/** One per wave, index = wave - 1: when it started, when it was cleared (0 = never), damage taken, seconds with fewer than RUN_LOG.quietBelow enemies alive. */
export type WaveRow = [start: number, end: number, damage: number, quiet: number];
export type RunEnd = 'slain' | 'quit' | 'won'; // won: banked right after the Usurper (a win that went on into Endless ends slain or quit, with `won` set)

export interface RunLog {
  at: string; // when the run was banked (ISO)
  classId: ClassId;
  tier: number;
  arena: ArenaId;
  seed: number;
  daily: string | null;
  curses: string[];
  trait: string;
  time: number;
  wave: number;
  level: number;
  kills: number;
  end: RunEnd;
  won: boolean; // v0.6: the Usurper fell in this run
  cause: string; // what dealt the killing blow ('' when the run was ended from the pause menu)
  relics: Record<string, number>; // id -> tier, in the order they were found
  talents: string[];
  upgrades: string[]; // ability and utility upgrades
  waves: WaveRow[];
  marks: Mark[];
}

/** What the recorder (systems/runlog.ts) holds during a run; `seen` is what it has logged already, so each tick only compares counters. */
export interface RunLogDraft {
  waves: WaveRow[];
  marks: Mark[];
  cause: string; // the killing blow, set by damagePlayer
  seen: { level: number; relics: number; talents: number; upgrades: number; utility: number; quests: number; events: number; bosses: number; act: number; cleared: number; board: boolean; shrine: boolean; merchant: boolean };
}

export const newRunLog = (): RunLogDraft => ({
  waves: [],
  marks: [],
  cause: '',
  seen: { level: 1, relics: 0, talents: 0, upgrades: 0, utility: 0, quests: 0, events: 0, bosses: 0, act: 1, cleared: 0, board: false, shrine: false, merchant: false },
});

export const MARK_KINDS: MarkKind[] = ['level', 'relic', 'talent', 'upgrade', 'board', 'quest', 'event', 'shrine', 'boss', 'phase', 'evolution', 'merchant', 'route', 'act', 'stand', 'bored'];
/** What counts as something new happening, for the pacing rule (a boredom mark is the opposite). */
const BEATS = new Set<MarkKind>(MARK_KINDS.filter((k) => k !== 'bored'));

export const round1 = (t: number) => Math.round(t * 10) / 10;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

/** A stored or imported run log back to a valid one, or null. Only the display and the export read it, so a bad entry is dropped, never repaired. */
export function readRunLog(raw: unknown): RunLog | null {
  if (!isObj(raw) || !CLASS_ORDER.includes(raw.classId as ClassId) || !fin(raw.time) || !fin(raw.wave) || !Array.isArray(raw.waves) || !Array.isArray(raw.marks)) return null;
  const waves = raw.waves.filter((w): w is WaveRow => Array.isArray(w) && w.length === 4 && w.every(fin));
  const marks = raw.marks.filter((m): m is Mark => Array.isArray(m) && fin(m[0]) && MARK_KINDS.includes(m[1]) && typeof m[2] === 'string');
  const relics = isObj(raw.relics) ? Object.fromEntries(Object.entries(raw.relics).filter(([, t]) => fin(t))) as Record<string, number> : {};
  return {
    at: typeof raw.at === 'string' ? raw.at : '',
    classId: raw.classId as ClassId,
    tier: fin(raw.tier) ? raw.tier : 0,
    arena: ARENA_IDS.includes(raw.arena as ArenaId) ? (raw.arena as ArenaId) : 'courtyard',
    seed: fin(raw.seed) ? raw.seed : 0,
    daily: typeof raw.daily === 'string' ? raw.daily : null,
    curses: strs(raw.curses),
    trait: typeof raw.trait === 'string' ? raw.trait : 'none',
    time: raw.time,
    wave: raw.wave,
    level: fin(raw.level) ? raw.level : 1,
    kills: fin(raw.kills) ? raw.kills : 0,
    end: raw.end === 'quit' || raw.end === 'won' ? raw.end : 'slain',
    won: raw.won === true || raw.end === 'won',
    cause: typeof raw.cause === 'string' ? raw.cause : '',
    relics,
    talents: strs(raw.talents),
    upgrades: strs(raw.upgrades),
    waves,
    marks,
  };
}

export const keepRuns = (runs: RunLog[], next?: RunLog): RunLog[] => (next ? [...runs, next] : runs).slice(-RUN_LOG.keep);

/** The export file: the logs plus a legend, so the JSON explains itself. */
export const exportRunLogs = (runs: RunLog[]) =>
  JSON.stringify({ format: 'Last Bastion run log v1', waves: '[start s, cleared s (0 = not cleared), damage taken, seconds with fewer than 5 enemies alive] per wave', marks: '[t s, kind, detail]', runs }, null, 1);

/** Minutes each Act took: from its first wave's start to the next Act's first wave (or the end of the run). */
export function actMinutes(log: RunLog, actLength: number): number[] {
  const out: number[] = [];
  for (let w = 0; w < log.waves.length; w += actLength) {
    const next = log.waves[w + actLength];
    out.push(((next ? next[0] : log.time) - log.waves[w][0]) / 60);
  }
  return out;
}

/** The longest stretches with no new wave and no pick, event, objective or boss (seconds, longest first), each with where it began. */
export function quietStretches(log: RunLog, top = 3): { from: number; length: number; wave: number }[] {
  const beats = [0, ...log.waves.map((w) => w[0]), ...log.marks.filter((m) => BEATS.has(m[1])).map((m) => m[0]), log.time].sort((a, b) => a - b);
  const gaps = beats.slice(1).map((t, i) => ({ from: beats[i], length: round1(t - beats[i]), wave: waveAt(log, beats[i]) }));
  return gaps.sort((a, b) => b.length - a.length).slice(0, top);
}

/** The wave running at time t (0 before the first). */
export function waveAt(log: RunLog, t: number): number {
  let w = 0;
  while (w < log.waves.length && log.waves[w][0] <= t) w++;
  return w;
}
