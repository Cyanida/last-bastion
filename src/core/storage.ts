import { LEGACY_BEST_KEY, migrate, SAVE_KEY, type Save } from '../logic/save';

function read(key: string): unknown {
  try {
    const text = localStorage.getItem(key);
    return text === null ? undefined : JSON.parse(text);
  } catch {
    return undefined; // blocked storage or corrupt JSON: start from the legacy records / a fresh save
  }
}

/** The v0.1 key is only ever read, never deleted: it stays as a backup of the old records. */
export function loadSave(): Save {
  return migrate(read(SAVE_KEY), read(LEGACY_BEST_KEY));
}

export function storeSave(save: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode: the session still works, progress just isn't kept */
  }
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_BEST_KEY);
  } catch {
    /* nothing to wipe */
  }
}
