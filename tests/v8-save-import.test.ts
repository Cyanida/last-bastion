import { describe, expect, it } from 'vitest';
import { BACKUP_KEY, BACKUPS_KEPT, backupSave, loadSaveFrom, readBackups, restoreBackup, type KV } from '../src/core/storage';
import { SAVE_KEY } from '../src/logic/save';

const store = (init: Record<string, string> = {}): KV & { data: Map<string, string> } => {
  const data = new Map(Object.entries(init));
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
};
const v4 = (gold: number) => JSON.stringify({ version: 4, gold, meta: { hp: 1 } });

describe('save import keeps a backup (v0.8.3, #175)', () => {
  it('the save an import replaces is kept as the newest backup', () => {
    const kv = store({ [SAVE_KEY]: v4(10), [BACKUP_KEY]: JSON.stringify([{ at: 'a', version: 4, text: v4(1) }]) });
    backupSave(kv, 'now');
    expect(readBackups(kv).map((b) => [b.at, b.text])).toEqual([['now', v4(10)], ['a', v4(1)]]);
  });

  it('never stores the same backup twice: an older copy moves up instead', () => {
    const kv = store({ [SAVE_KEY]: v4(10), [BACKUP_KEY]: JSON.stringify([{ at: 'a', version: 4, text: v4(1) }, { at: 'b', version: 4, text: v4(10) }]) });
    backupSave(kv, 'now');
    backupSave(kv, 'later'); // importing twice over the same save
    expect(readBackups(kv).map((b) => b.text)).toEqual([v4(10), v4(1)]);
    expect(readBackups(kv)[0].at).toBe('later');
  });

  it('keeps at most BACKUPS_KEPT, and nothing when there is no save yet', () => {
    const kv = store();
    backupSave(kv, 'x');
    expect(kv.get(BACKUP_KEY)).toBeNull();
    for (let g = 0; g < BACKUPS_KEPT + 2; g++) {
      kv.set(SAVE_KEY, v4(g));
      backupSave(kv, String(g));
    }
    expect(readBackups(kv).map((b) => b.at)).toEqual(['4', '3', '2']);
  });

  it('loading and restoring no longer duplicate a backup deeper in the list', () => {
    const kv = store({ [SAVE_KEY]: v4(7), [BACKUP_KEY]: JSON.stringify([{ at: 'a', version: 4, text: v4(1) }, { at: 'b', version: 4, text: v4(7) }]) });
    loadSaveFrom(kv, 'now');
    expect(readBackups(kv).map((b) => b.text)).toEqual([v4(7), v4(1)]);
    restoreBackup(readBackups(kv)[1], kv); // v4(1) becomes the save; v4(7) is already kept
    expect(readBackups(kv).map((b) => b.text)).toEqual([v4(7)]);
  });
});
