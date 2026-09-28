import { LEGACY_BEST_KEY, migrate, READABLE_VERSIONS, SAVE_KEY, SAVE_VERSION, type Save } from '../logic/save';

/** v0.7: the last pre-migration saves, raw, so no migration can lose a save (Settings › Save data › Restore). */
export const BACKUP_KEY = 'lastbastion.save.backups';
export const BACKUPS_KEPT = 3;
export interface SaveBackup {
  at: string; // when it was set aside (ISO)
  version: number; // its save format (0: unreadable)
  text: string; // exactly what was stored
}

/** The storage the save lives in: localStorage in the game, a Map in the tests. */
export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const local: KV = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null; // blocked storage: start from a fresh save
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: the session still works, progress just isn't kept */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nothing to remove */
    }
  },
};

/** v0.7.5 (#106): the small settings (sound, music, What's new) go through the same guarded storage, so blocked site data can't stop the start. */
export const prefs: KV = local;

function parse(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return null; // corrupt JSON
  }
}
const versionOf = (raw: unknown): number => (raw && typeof raw === 'object' && typeof (raw as { version?: unknown }).version === 'number' ? (raw as { version: number }).version : 0);
const readable = (raw: unknown): boolean => READABLE_VERSIONS.includes(versionOf(raw));

export function readBackups(kv: KV = local): SaveBackup[] {
  const list = parse(kv.get(BACKUP_KEY));
  return Array.isArray(list) ? list.filter((b): b is SaveBackup => b && typeof b.text === 'string' && typeof b.at === 'string') : [];
}

/** v0.8.3 (#175): set a save's text aside as the newest backup; an older copy of the same text moves up instead of being kept twice. */
function keepBackup(kv: KV, text: string, now: string): void {
  const rest = readBackups(kv).filter((b) => b.text !== text);
  kv.set(BACKUP_KEY, JSON.stringify([{ at: now, version: versionOf(parse(text)), text }, ...rest].slice(0, BACKUPS_KEPT)));
}

/**
 * Load the save. Anything that is not the current format (an older version, a future one, corrupt text) is set aside raw first, newest
 * first, at most BACKUPS_KEPT, never twice the same text. The stored save is only read here, never written: a migration that fails leaves
 * it as it was, and the game falls back to the newest backup that still reads (`restored` says which one).
 */
export function loadSaveFrom(kv: KV, now = new Date().toISOString()): { save: Save; restored: SaveBackup | null } {
  const text = kv.get(SAVE_KEY);
  const raw = parse(text);
  const legacy = parse(kv.get(LEGACY_BEST_KEY));
  if (text !== null && versionOf(raw) !== SAVE_VERSION) {
    if (readBackups(kv)[0]?.text !== text) keepBackup(kv, text, now);
  }
  if (text === null || readable(raw)) {
    try {
      return { save: migrate(raw, legacy), restored: null };
    } catch {
      /* fall through to the backups */
    }
  }
  for (const b of readBackups(kv)) {
    const old = parse(b.text);
    if (!readable(old)) continue;
    try {
      return { save: migrate(old), restored: b };
    } catch {
      /* try the next one */
    }
  }
  return { save: migrate(undefined, legacy), restored: null };
}

/** The v0.1 key is only ever read, never deleted: it stays as a backup of the old records. */
export function loadSave(): { save: Save; restored: SaveBackup | null } {
  return loadSaveFrom(local);
}

/** Put a backup back as the save; the next load migrates it (and keeps the save it replaces as a backup, if that differs). */
export function restoreBackup(b: SaveBackup, kv: KV = local): void {
  const current = kv.get(SAVE_KEY);
  if (current !== null && current !== b.text) {
    kv.set(BACKUP_KEY, JSON.stringify(readBackups(kv).filter((x) => x.text !== b.text))); // the restored one is the save now
    keepBackup(kv, current, new Date().toISOString());
  }
  kv.set(SAVE_KEY, b.text);
}

/** v0.8.3 (#175): before an imported save replaces the stored one, that one is kept as a backup (Settings › Save data › Restore). */
export function backupSave(kv: KV = local, now = new Date().toISOString()): void {
  const current = kv.get(SAVE_KEY);
  if (current !== null) keepBackup(kv, current, now);
}
export function storeSave(save: Save): void {
  local.set(SAVE_KEY, JSON.stringify(save));
}

export function wipeSave(): void {
  local.remove(SAVE_KEY);
  local.remove(LEGACY_BEST_KEY);
}
