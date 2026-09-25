import { describe, expect, it } from 'vitest';
import { defaultSave, exportSave, importSave, migrate, READABLE_VERSIONS, SAVE_VERSION } from '../src/logic/save';
import { readFixture as read, SAVE_FIXTURES as FIXTURES } from './fixtures/saves';

/**
 * #115: one frozen save per save format, written by that release's own save code (its defaultSave with every field set to something
 * other than the default, through its migrate and exportSave). Built from today's defaultSave() instead, a fixture would already have
 * every new field and prove nothing about old players. Never regenerate these: add a file when the format changes.
 */

/** Every leaf of a value, by path. An empty object or array counts as a leaf. */
function leaves(v: unknown, path = '', out = new Map<string, unknown>()): Map<string, unknown> {
  if (v && typeof v === 'object' && Object.keys(v).length) for (const [k, x] of Object.entries(v)) leaves(x, `${path}.${k}`, out);
  else out.set(path, v);
  return out;
}

/** What a format had that the game has since dropped on purpose, so its value does not come through as it was. */
const V06_TRACKS = ['.meta.str', '.meta.dex', '.meta.int', '.meta.atkSpd']; // v0.6 removed the Armory's damage tracks, refunded as gold
const V07_RELICS = ['.relicPicks.whetstone', '.relicPicks.swiftBoots', '.relicPicks.luckyCoin', '.relicPicks.scholarTome']; // gone in the v0.7 rework
const DROPPED: Record<number, string[]> = {
  2: [...V06_TRACKS, ...V07_RELICS],
  3: [...V06_TRACKS, ...V07_RELICS],
  4: [...V06_TRACKS, ...V07_RELICS],
  5: [...V07_RELICS, '.refund.gold', '.refund.runes'], // a v0.6 save's refund notice is worked out again from its Keep ranks
};

describe('frozen saves from every format (#115)', () => {
  it('there is one for every readable format', () => {
    expect([...new Set(FIXTURES.map((f) => read(f).version))]).toEqual(READABLE_VERSIONS);
  });

  for (const f of FIXTURES)
    describe(f, () => {
      const raw = read(f);
      const save = migrate(raw);

      it('reads as the current format, and round-trips through export and import unchanged', () => {
        expect(save.version).toBe(SAVE_VERSION);
        expect(importSave(exportSave(save))).toEqual(save);
        expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save);
      });

      it('keeps every value it had: nothing comes back as the default', () => {
        const def = leaves(defaultSave());
        const now = leaves(save);
        // a path today's save has too, or an entry of a map that is empty by default (meta, relicPicks, daily...)
        const known = (p: string) => def.has(p) || [...def.keys()].some((d) => p.startsWith(`${d}.`));
        const lost = [...leaves(raw).keys()].filter((p) => p !== '.version' && known(p) && JSON.stringify(now.get(p)) === JSON.stringify(def.get(p)));
        expect(lost).toEqual(DROPPED[raw.version as number] ?? []);
      });

      if ((raw.version as number) < 5)
        it("pays back the Keep ranks v0.6 took away", () => {
          expect(save.gold).toBeGreaterThan(raw.gold as number);
          expect(save.refund?.version).toBe('v0.6');
        });
    });
});
