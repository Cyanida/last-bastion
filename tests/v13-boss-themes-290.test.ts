import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/config/bosses';
import type { EnemyId } from '../src/config/enemies';
import { BOSS_THEMES, BOSS_VARIANT_THEMES, THEMES, type BossTheme } from '../src/config/music';
import { createGame } from '../src/game';
import { composeBossBar, composeMusicBar, COMPOSERS } from '../src/logic/bossMusic';
import { RANGES } from '../src/logic/music';
import { bossMusicIds, composeRunBar, moodOf, musicTheme, type Layer } from '../src/logic/runMusic';
import { spawnEnemy } from '../src/systems/spawning';

// #290: themes for the Grand Inquisitor, the Dragon, the Warden and the Usurper, on the boss-theme system from #289
const FOUR: EnemyId[] = ['inquisitor', 'dragon', 'warden', 'usurper'];
const VARIANTS = { heretic: 'inquisitor', ashWyrm: 'dragon' } as const;
const IDS = [...FOUR, ...Object.keys(VARIANTS)].map((k) => `boss:${k}` as const);

describe('boss themes: the Grand Inquisitor, the Dragon, the Warden and the Usurper (#290)', () => {
  it('each has its own theme and composer, named after him; the Heretic and the Ash Wyrm play their base theme shifted', () => {
    const others = Object.entries(BOSS_THEMES).filter(([id]) => !FOUR.includes(id as EnemyId)).map(([, t]) => t!.composer);
    for (const id of FOUR) {
      const t = BOSS_THEMES[id]!;
      expect(t.name).toMatch(/^The /);
      expect(COMPOSERS[t.composer]).toBeTypeOf('function');
      expect(others).not.toContain(t.composer);
    }
    expect(new Set(FOUR.map((id) => BOSS_THEMES[id]!.composer)).size).toBe(4);
    expect(BOSS_THEMES.inquisitor!.drone).toBe('organ'); // the organ
    for (const [k, base] of Object.entries(VARIANTS)) {
      expect(BOSSES[k].from).toBe(base);
      const t = musicTheme(`boss:${k}`) as BossTheme;
      expect(t.name).toBe(BOSSES[k].name);
      expect(t.composer).toBe(BOSS_THEMES[base]!.composer);
      expect(t.root).toBe((((BOSS_THEMES[base]!.root + BOSS_VARIANT_THEMES[k].shift) % 12) + 12) % 12);
      expect(t.root).not.toBe(BOSS_THEMES[base]!.root);
    }
  });

  it('the jukebox lists all six, the Usurper too though he is outside the boss pool', () => {
    expect(BOSSES.usurper).toBeUndefined();
    expect(bossMusicIds()).toEqual(expect.arrayContaining(IDS));
    expect(new Set(bossMusicIds()).size).toBe(bossMusicIds().length);
    expect(musicTheme('boss:usurper').name).toBe('The Usurper');
  });

  it('no theme sounds like an arena or another boss: its own key, mode and tempo', () => {
    const sig = (t: { root: number; mode: number[]; bpm: number }) => `${t.root}/${t.mode.join()}/${t.bpm}`;
    const arenas = new Set(Object.values(THEMES).map(sig));
    const all = bossMusicIds().map((id) => sig(musicTheme(id)));
    for (const id of IDS) expect(arenas.has(sig(musicTheme(id)))).toBe(false);
    expect(new Set(all).size).toBe(all.length);
  });

  it('the Dragon has drums and brass; the Inquisitor an organ chorale; the Warden keys and a tread; the Usurper a horn fanfare', () => {
    const voices = (id: EnemyId, layer: Layer) => new Set(Array.from({ length: 8 }, (_, bar) => COMPOSERS[BOSS_THEMES[id]!.composer](BOSS_THEMES[id]!, 3, bar, layer)).flat().map((n) => n.voice));
    expect([...voices('dragon', 2)]).toEqual(expect.arrayContaining(['drum', 'horn']));
    expect([...voices('inquisitor', 1)]).toEqual(['organ']);
    expect([...voices('warden', 1)]).toEqual(expect.arrayContaining(['drum', 'bass']));
    expect([...voices('usurper', 1)]).toEqual(['horn']);
  });

  it('every note is in its mode, its voice range and its bar, in every phase', () => {
    for (const id of IDS) {
      const t = musicTheme(id);
      const scale = t.mode.map((s) => (t.root + s) % 12);
      for (let bar = 0; bar < 40; bar++) {
        for (const layer of [0, 1, 2, 3] as Layer[]) {
          for (const n of composeMusicBar(id, 5, bar, layer)) {
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

  it('it builds with the phases, the boss drum and bass at the last; the same seed gives the same theme', () => {
    for (const id of FOUR) {
      const t = BOSS_THEMES[id]!;
      const count = (layer: Layer) => Array.from({ length: 16 }, (_, bar) => composeBossBar(t, 9, bar, layer).length).reduce((a, b) => a + b);
      expect(count(1)).toBeGreaterThan(Array.from({ length: 16 }, (_, bar) => composeRunBar(t, 9, bar, 1).length).reduce((a, b) => a + b));
      expect(count(2)).toBeGreaterThan(count(1));
      expect(count(3)).toBeGreaterThan(count(2));
      const last = composeBossBar(t, 9, 0, 3);
      expect(last.some((n) => n.voice === 'bass')).toBe(true);
      expect(last.some((n) => n.voice === 'drum' && n.midi === t.boss.midi)).toBe(true);
      expect(composeMusicBar(`boss:${id}`, 4, 7, 3)).toEqual(composeMusicBar(`boss:${id}`, 4, 7, 3));
    }
  });

  it('each takes over from the arena while he is up, builds over his three phases (the Inquisitor his two) and hands back', () => {
    for (const id of FOUR) {
      const g = createGame('viking', 4, { arena: 'keep' });
      g.wave = 5;
      const b = spawnEnemy(g, id, 300, 300);
      expect(moodOf(g), id).toEqual({ arena: `boss:${id}`, layer: 1, cue: null });
      const phases = b.def.phases ?? 2;
      expect(phases).toBe(id === 'inquisitor' ? 2 : 3);
      b.phase = phases;
      expect(moodOf(g).layer).toBe(3);
      g.enemies = g.enemies.filter((e) => e !== b);
      expect(moodOf(g).arena).toBe('keep');
    }
  });

  it('the Heretic and the Ash Wyrm play their own shifted themes', () => {
    for (const [k, base] of Object.entries(VARIANTS)) {
      const g = createGame('viking', 4, { arena: 'keep' });
      g.wave = 5;
      g.bossesSeen = [k];
      spawnEnemy(g, base, 300, 300);
      expect(moodOf(g).arena).toBe(`boss:${k}`);
    }
  });
});
