import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/config/bosses';
import { ENEMIES, type EnemyId } from '../src/config/enemies';
import { BOSS_THEMES, THEMES, type ThemeId } from '../src/config/music';
import { createGame } from '../src/game';
import { composeBossBar, composeMusicBar, COMPOSERS } from '../src/logic/bossMusic';
import { RANGES } from '../src/logic/music';
import { bossMusicIds, composeRunBar, moodOf, musicTheme, type Layer, type MusicId } from '../src/logic/runMusic';
import { spawnEnemy } from '../src/systems/spawning';

// #291: themes for the realm bosses of the Iron Hold and the Cinderlands, each on its realm's theme's voices
const REALM_BOSSES: [EnemyId, ThemeId][] = [['forgemaster', 'ironHold'], ['ironKing', 'ironHold'], ['emberQueen', 'cinderlands'], ['cinderColossus', 'cinderlands']];
const FIRST: EnemyId[] = ['blackKnight', 'warlord', 'lich', 'abbot']; // #289's
const LAYERS: Layer[] = [0, 1, 2, 3];

describe('realm boss themes: the scores (#291)', () => {
  it('the Forgemaster, the Iron King, the Ember Queen and the Cinder Colossus each have a theme, with a composer of their own', () => {
    for (const [id] of REALM_BOSSES) {
      const t = BOSS_THEMES[id]!;
      expect(t, id).toBeDefined();
      expect(t.name).toBe(ENEMIES[id].name);
      expect(BOSSES[id].from).toBe(id);
      expect(COMPOSERS[t.composer]).toBeTypeOf('function');
      expect(bossMusicIds()).toContain(`boss:${id}`);
    }
    const composers = [...REALM_BOSSES.map(([id]) => id), ...FIRST].map((id) => BOSS_THEMES[id]!.composer);
    expect(new Set(composers).size).toBe(8);
  });

  it("each plays on its realm's theme's voices", () => {
    for (const [id, realm] of REALM_BOSSES) {
      const t = BOSS_THEMES[id]!;
      const r = THEMES[realm];
      expect([t.drone, t.pad, t.pulse?.voice ?? r.pulse?.voice, t.lead], id).toEqual([r.drone, r.pad, r.pulse?.voice, r.lead]);
      const voices = new Set(Array.from({ length: 16 }, (_, bar) => COMPOSERS[t.composer](t, 3, bar, 3)).flat().map((n) => n.voice));
      const realmVoices = new Set([r.drone, r.pad, r.pulse?.voice, r.lead, 'drum', 'bass']);
      for (const v of voices) expect(realmVoices.has(v), `${id} ${v}`).toBe(true);
    }
  });

  it('none sounds like an arena or another boss: its own key, mode and tempo', () => {
    const sig = (t: { root: number; mode: number[]; bpm: number }) => `${t.root}/${t.mode.join()}/${t.bpm}`;
    const others = new Set([...Object.values(THEMES).map(sig), ...bossMusicIds().filter((id) => !REALM_BOSSES.some(([b]) => id === `boss:${b}`)).map((id) => sig(musicTheme(id)))]);
    const mine = REALM_BOSSES.map(([id]) => sig(BOSS_THEMES[id]!));
    for (const s of mine) expect(others.has(s)).toBe(false);
    expect(new Set(mine).size).toBe(4);
  });

  it('every note is in its mode, its voice range and its bar, in every phase', () => {
    for (const [id] of REALM_BOSSES) {
      const t = BOSS_THEMES[id]!;
      const scale = t.mode.map((s) => (t.root + s) % 12);
      for (let bar = 0; bar < 48; bar++) {
        for (const layer of LAYERS) {
          for (const n of composeMusicBar(`boss:${id}`, 11, bar, layer)) {
            if (n.voice !== 'drum') expect(scale, `${id} ${n.voice} ${n.midi}`).toContain(n.midi % 12);
            expect(n.midi).toBeGreaterThanOrEqual(RANGES[n.voice][0]);
            expect(n.midi).toBeLessThanOrEqual(RANGES[n.voice][1]);
            expect(n.time).toBeGreaterThanOrEqual(0);
            expect(n.time).toBeLessThan(t.meter);
            expect(n.velocity).toBeGreaterThan(0);
            expect(n.velocity).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('it builds with the phases: more each layer, the boss drum and bass at the last; its own part right after the drone', () => {
    for (const [id] of REALM_BOSSES) {
      const t = BOSS_THEMES[id]!;
      const count = (layer: Layer) => Array.from({ length: 16 }, (_, bar) => composeBossBar(t, 9, bar, layer).length).reduce((a, b) => a + b);
      expect(count(1)).toBeGreaterThan(Array.from({ length: 16 }, (_, bar) => composeRunBar(t, 9, bar, 1).length).reduce((a, b) => a + b));
      expect(count(2), id).toBeGreaterThan(count(1));
      expect(count(3), id).toBeGreaterThan(count(2));
      const last = composeBossBar(t, 9, 0, 3);
      expect(last.some((n) => n.voice === 'bass')).toBe(true);
      expect(last.some((n) => n.voice === 'drum' && n.midi === t.boss.midi)).toBe(true);
      for (let bar = 0; bar < 8; bar++) {
        const own = COMPOSERS[t.composer](t, 9, bar, 1);
        const notes = composeBossBar(t, 9, bar, 1);
        const drone = bar % 2 === 0 ? 2 : 0;
        expect(notes.slice(drone, drone + own.length)).toEqual(own);
      }
      expect(composeMusicBar(`boss:${id}`, 4, 7, 3)).toEqual(composeMusicBar(`boss:${id}`, 4, 7, 3)); // the same seed, the same theme
    }
  });
});

describe('realm boss themes: the takeover in their levels (#291)', () => {
  it("each takes over from his realm's theme in its level, builds with his three phases and hands back when he falls", () => {
    for (const [id, realm] of REALM_BOSSES) {
      const g = createGame('viking', 4, { level: { realm: realm as 'ironHold' | 'cinderlands', level: id === 'forgemaster' || id === 'emberQueen' ? 3 : 5 } });
      g.wave = 10;
      expect(moodOf(g).arena).toBe(realm);
      const b = spawnEnemy(g, id, 300, 300);
      const music: MusicId = `boss:${id}`;
      expect(moodOf(g)).toEqual({ arena: music, layer: 1, cue: null });
      b.phase = 2;
      expect(moodOf(g).layer).toBe(2);
      b.phase = 3;
      expect(moodOf(g).layer).toBe(3);
      g.enemies = g.enemies.filter((e) => e !== b);
      expect(moodOf(g).arena).toBe(realm);
    }
  });
});
