import { describe, expect, it } from 'vitest';
import { BACKUP_KEY, BACKUPS_KEPT, loadSaveFrom, readBackups, restoreBackup, type KV } from '../src/core/storage';
import { defaultSave, SAVE_KEY, SAVE_VERSION } from '../src/logic/save';

const store = (init: Record<string, string> = {}): KV & { data: Map<string, string> } => {
  const data = new Map(Object.entries(init));
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
};
const v4 = (gold: number) => JSON.stringify({ version: 4, gold, meta: { hp: 1 } });

describe('save safety (v0.7)', () => {
  it('an older save is set aside raw before it is migrated, and loading never writes the stored save', () => {
    const kv = store({ [SAVE_KEY]: v4(100) });
    const { save, restored } = loadSaveFrom(kv, '2026-09-23T10:00:00.000Z');
    expect(save.gold).toBe(100);
    expect(restored).toBeNull();
    expect(kv.get(SAVE_KEY)).toBe(v4(100)); // untouched until the game commits
    expect(readBackups(kv)).toEqual([{ at: '2026-09-23T10:00:00.000Z', version: 4, text: v4(100) }]);
  });

  it('keeps the last three, newest first, and never the same text twice', () => {
    const kv = store();
    for (const gold of [1, 2, 2, 3, 4]) {
      kv.set(SAVE_KEY, v4(gold));
      loadSaveFrom(kv, `t${gold}`);
    }
    const b = readBackups(kv);
    expect(b).toHaveLength(BACKUPS_KEPT);
    expect(b.map((x) => JSON.parse(x.text).gold)).toEqual([4, 3, 2]);
  });

  it('a current-format save is not backed up', () => {
    const kv = store({ [SAVE_KEY]: JSON.stringify({ ...defaultSave(), gold: 7 }) });
    expect(loadSaveFrom(kv).save.gold).toBe(7);
    expect(kv.get(BACKUP_KEY)).toBeNull();
  });

  it('a save that cannot be read is left as it was, kept as a backup, and the newest readable backup is loaded instead', () => {
    const kv = store({ [BACKUP_KEY]: JSON.stringify([{ at: 'earlier', version: 4, text: v4(55) }]) });
    kv.set(SAVE_KEY, '{"version": 5, "gold": 12'); // corrupt: cut off mid-write
    const { save, restored } = loadSaveFrom(kv, 'now');
    expect(save.gold).toBe(55 + (save.refund?.gold ?? 0));
    expect(restored?.at).toBe('earlier');
    expect(kv.get(SAVE_KEY)).toBe('{"version": 5, "gold": 12'); // never overwritten by the load
    expect(readBackups(kv).map((b) => b.at)).toEqual(['now', 'earlier']); // the unreadable one is kept too
    // a save from a newer game is not readable either: same fallback, not a silent fresh start
    kv.set(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 50, gold: 999 }));
    expect(loadSaveFrom(kv).restored).not.toBeNull();
  });

  it('with no readable backup a broken save gives a fresh one, and the broken text survives as a backup', () => {
    const kv = store({ [SAVE_KEY]: 'not json' });
    const { save, restored } = loadSaveFrom(kv);
    expect(save).toEqual(defaultSave());
    expect(restored).toBeNull();
    expect(readBackups(kv)[0].text).toBe('not json');
  });

  it('restoring puts the backup back as the save and keeps the replaced save as a backup', () => {
    const current = JSON.stringify({ ...defaultSave(), gold: 3000 });
    const kv = store({ [SAVE_KEY]: current, [BACKUP_KEY]: JSON.stringify([{ at: 'a', version: 4, text: v4(10) }]) });
    restoreBackup(readBackups(kv)[0], kv);
    expect(kv.get(SAVE_KEY)).toBe(v4(10));
    expect(readBackups(kv).map((b) => b.text)).toEqual([current]);
    expect(loadSaveFrom(kv).save.gold).toBe(10);
  });
});
