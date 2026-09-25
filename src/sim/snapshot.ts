import { ARENAS } from '../config/arenas';
import { CLASSES } from '../config/classes';
import { ENEMIES } from '../config/enemies';
import { GAME } from '../config/game';
import { mulberry32 } from '../core/math';
import { SpatialHash } from '../core/spatial';
import type { Game } from '../core/types';

/**
 * v0.8 step 3.2 (#27, ARCHITECTURE.md): the whole `Game` as plain JSON and back.
 *
 * ARCHITECTURE.md asks for an `id` on every entity from `g.nextId`. This walks the state instead and numbers every object the first
 * time it meets it; a second meeting (a squad's members, a zone's owner, a quest's foes) writes `{ '@': n }` and restore relinks it.
 * Same result, and no entity type or creation site changes. The walk order is fixed, so equal states give equal JSON (the hash, 3.4).
 *
 * Encoded specially: config definitions by table and key (they stay the shared config objects), random streams by their state,
 * the spatial hash as empty (updateGame rebuilds it every tick), render caches as null, and numbers JSON can't hold.
 * Any other function throws: `g.timers` closures become data in step 3.3.
 */
export type Snapshot = { v: 1; game: unknown };

const TABLES: Record<string, Record<string, object>> = { classes: CLASSES, enemies: ENEMIES, arenas: ARENAS };
const CACHES = new Set(['spr', 'img']); // Enemy.spr, FloatText.img: the renderer fills them again

let configKeys: Map<object, string> | null = null;
function configKey(o: object): string | undefined {
  if (!configKeys) {
    configKeys = new Map();
    for (const [t, table] of Object.entries(TABLES)) for (const [k, def] of Object.entries(table)) configKeys.set(def, `${t}.${k}`);
  }
  return configKeys.get(o);
}

export function snapshot(g: Game): Snapshot {
  const ids = new Map<object, number>();
  const enc = (v: unknown, path: string): unknown => {
    if (v === undefined) return { $u: 1 };
    if (typeof v === 'number') return Number.isFinite(v) ? v : { $n: String(v) };
    if (v === null || typeof v !== 'object') {
      if (typeof v !== 'function') return v;
      if (typeof (v as { s?: unknown }).s === 'number') return { $rng: (v as unknown as { s: number }).s };
      throw new Error(`snapshot: a function at ${path} (timers become data in #27 step 3.3)`);
    }
    const cfg = configKey(v);
    if (cfg) return { $c: cfg };
    if (v instanceof SpatialHash) return { $hash: 1 };
    const seen = ids.get(v);
    if (seen !== undefined) return { '@': seen };
    const id = ids.size;
    ids.set(v, id);
    if (Array.isArray(v)) return { '#': id, a: v.map((x, i) => enc(x, `${path}[${i}]`)) };
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) throw new Error(`snapshot: a ${proto?.constructor?.name ?? 'class'} instance at ${path}`);
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = CACHES.has(k) ? null : enc(x, `${path}.${k}`);
    return { '#': id, o };
  };
  return { v: 1, game: enc(g, 'g') };
}

export function restore(data: Snapshot): Game {
  const objs: unknown[] = [];
  const dec = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    const w = v as Record<string, unknown>;
    if ('$u' in w) return undefined;
    if ('$n' in w) return Number(w.$n);
    if ('$rng' in w) return mulberry32(w.$rng as number);
    if ('$c' in w) {
      const [t, k] = (w.$c as string).split('.');
      return TABLES[t][k];
    }
    if ('$hash' in w) return new SpatialHash(GAME.spatialCell);
    if ('@' in w) return objs[w['@'] as number];
    const id = w['#'] as number;
    if ('a' in w) {
      const a: unknown[] = [];
      objs[id] = a; // before the children, so a child can point back at it
      for (const x of w.a as unknown[]) a.push(dec(x));
      return a;
    }
    const o: Record<string, unknown> = {};
    objs[id] = o;
    for (const [k, x] of Object.entries(w.o as Record<string, unknown>)) o[k] = dec(x);
    return o;
  };
  return dec(data.game) as Game;
}
