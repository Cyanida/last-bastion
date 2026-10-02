import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/config/bosses';
import type { EnemyId } from '../src/config/enemies';
import { BOSS_THEMES, BOSS_VARIANT_THEMES, THEMES, type BossTheme } from '../src/config/music';
import { createGame } from '../src/game';
import { composeBossBar, composeMusicBar, COMPOSERS } from '../src/logic/bossMusic';
import { RANGES } from '../src/logic/music';
import { barSeconds, bossMusicIds, composeRunBar, conduct, moodOf, musicTheme, newConductor, type Bar, type Layer, type Mood, type MusicId } from '../src/logic/runMusic';
import { spawnEnemy } from '../src/systems/spawning';

// #289: a boss's own theme takes over from the arena's music, builds with its phases and hands back when it falls
const FOUR: EnemyId[] = ['blackKnight', 'warlord', 'lich', 'abbot'];
const VARIANTS = ['dreadKnight', 'headsman', 'frostLich', 'siegeMarshal'];
const LAYERS: Layer[] = [1, 2, 3];

describe('boss themes: the scores (#289)', () => {
  it('the Black Knight, the Warlord, the Lich and the Plague Abbot each have a theme with a composer; every variant has a shift', () => {
    for (const id of FOUR) {
      const t = BOSS_THEMES[id]!;
      expect(t).toBeDefined();
      expect(COMPOSERS[t.composer]).toBeTypeOf('function');
      expect(BOSSES[id].from).toBe(id);
    }
    expect(new Set(FOUR.map((id) => BOSS_THEMES[id]!.composer)).size).toBe(4); // each its own part
    for (const k of VARIANTS) {
      expect(BOSS_VARIANT_THEMES[k]).toBeDefined();
      expect(FOUR).toContain(BOSSES[k].from);
    }
    for (const k of Object.keys(BOSS_VARIANT_THEMES)) expect(BOSS_THEMES[BOSSES[k].from]).toBeDefined();
    expect(bossMusicIds()).toEqual(expect.arrayContaining([...FOUR, ...VARIANTS].map((k) => `boss:${k}`))); // #290, #291 add more
  });

  it('no boss theme sounds like an arena: its own key, mode and tempo', () => {
    const sig = (t: { root: number; mode: number[]; bpm: number }) => `${t.root}/${t.mode.join()}/${t.bpm}`;
    const arenas = new Set(Object.values(THEMES).map(sig));
    const all = bossMusicIds().map((id) => sig(musicTheme(id)));
    for (const s of all) expect(arenas.has(s)).toBe(false);
    expect(new Set(all).size).toBe(all.length);
  });

  it('a variant plays its base theme shifted: the same progression, its key and tempo moved, under its own name', () => {
    for (const k of VARIANTS) {
      const base = BOSS_THEMES[BOSSES[k].from]!;
      const t = musicTheme(`boss:${k}`) as BossTheme;
      const v = BOSS_VARIANT_THEMES[k];
      expect(t.chords).toEqual(base.chords);
      expect(t.composer).toBe(base.composer);
      expect(t.root).toBe((((base.root + v.shift) % 12) + 12) % 12);
      expect(t.root).not.toBe(base.root);
      expect(t.bpm).toBe(Math.round(base.bpm * v.tempo));
      expect(t.name).toBe(BOSSES[k].name);
    }
  });

  it('every note is in its mode, its voice range and its bar, in every phase', () => {
    for (const id of bossMusicIds()) {
      const t = musicTheme(id);
      const scale = t.mode.map((s) => (t.root + s) % 12);
      for (let bar = 0; bar < 40; bar++) {
        for (const layer of [0, ...LAYERS] as Layer[]) {
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

  it('it builds with the phases: more each layer, the boss drum and bass at the last; its own part right after the drone', () => {
    for (const id of FOUR) {
      const t = BOSS_THEMES[id]!;
      const count = (layer: Layer) => Array.from({ length: 16 }, (_, bar) => composeBossBar(t, 9, bar, layer).length).reduce((a, b) => a + b);
      expect(count(1)).toBeGreaterThan(composeRunBar(t, 9, 0, 1).length); // its own part over the run music's base layer
      expect(count(2)).toBeGreaterThan(count(1));
      expect(count(3)).toBeGreaterThan(count(2));
      const last = composeBossBar(t, 9, 0, 3);
      expect(last.some((n) => n.voice === 'bass')).toBe(true);
      expect(last.some((n) => n.voice === 'drum' && n.midi === t.boss.midi)).toBe(true);
      for (let bar = 0; bar < 8; bar++) {
        const own = COMPOSERS[t.composer](t, 9, bar, 1);
        const notes = composeBossBar(t, 9, bar, 1);
        const drone = bar % 2 === 0 ? 2 : 0;
        expect(notes.slice(0, drone).every((n) => n.voice === t.drone)).toBe(true);
        expect(notes.slice(drone, drone + own.length)).toEqual(own);
      }
    }
  });

  it('the same seed gives the same theme', () => {
    for (const id of bossMusicIds()) expect(composeMusicBar(id, 4, 7, 3)).toEqual(composeMusicBar(id, 4, 7, 3));
  });
});

describe('boss themes: the takeover (#289)', () => {
  it('a themed boss takes over from its first phase; its last phase plays the full boss layer', () => {
    const g = createGame('viking', 4, { arena: 'courtyard' });
    g.wave = 5;
    expect(moodOf(g).arena).toBe('courtyard');
    const b = spawnEnemy(g, 'blackKnight', 300, 300);
    expect(moodOf(g)).toEqual({ arena: 'boss:blackKnight', layer: 1, cue: null });
    b.phase = 2; // his last of two
    expect(moodOf(g).layer).toBe(3);
    b.def = { ...b.def, phases: 3 }; // an elite's phase more: the middle one plays the second layer
    expect(moodOf(g).layer).toBe(2);
    b.phase = 3;
    expect(moodOf(g).layer).toBe(3);
    g.enemies = g.enemies.filter((e) => e !== b); // he falls
    expect(moodOf(g).arena).toBe('courtyard');
  });

  it('a variant plays its own shifted theme; a boss with no theme yet keeps the arena and its boss layer', () => {
    const g = createGame('viking', 4, { arena: 'graveyard' });
    g.wave = 5;
    g.bossesSeen = ['frostLich'];
    spawnEnemy(g, 'lich', 300, 300);
    expect(moodOf(g).arena).toBe('boss:frostLich');
    expect(musicTheme(moodOf(g).arena).name).toBe('The Frost Lich');
    const h = createGame('viking', 4, { arena: 'graveyard' });
    h.wave = 5;
    const none = spawnEnemy(h, 'gravedigger', 300, 300); // #292: every boss has his own now: a stand-in with none
    none.def = { ...none.def, id: 'nobody' as typeof none.def.id };
    expect(moodOf(h)).toEqual({ arena: 'graveyard', layer: 3, cue: null });
  });

  it('a side boss does not take the wave boss’s place; the Merchant and the cues still win', () => {
    const g = createGame('viking', 4, { arena: 'keep' });
    g.wave = 5;
    const side = spawnEnemy(g, 'abbot', 200, 200);
    side.side = true;
    spawnEnemy(g, 'warlord', 300, 300);
    expect(moodOf(g).arena).toBe('boss:warlord');
    g.pendingMerchant = true;
    expect(moodOf(g)).toEqual({ arena: 'keep', layer: 0, cue: null });
    g.pendingMerchant = false;
    g.victory = 'pending';
    expect(moodOf(g)).toEqual({ arena: 'keep', layer: 0, cue: 'victory' });
  });

  it('the conductor crossfades into the boss theme on the next bar line, builds with it, and hands back to the arena from its first bar', () => {
    const arena: Mood = { arena: 'courtyard', layer: 1, cue: null };
    const boss = (layer: Layer): Mood => ({ arena: 'boss:dreadKnight', layer, cue: null });
    const moods: [number, Mood][] = [[0, arena], [6.1, boss(1)], [20.3, boss(3)], [33.7, arena]];
    let c = newConductor(arena, 1, 0.1);
    const bars: Bar[] = [];
    for (let now = 0; now < 45; now += 0.1) {
      const want = moods.filter(([at]) => at <= now).at(-1)![1];
      const r = conduct(c, want, now, 0.4);
      c = r.c;
      bars.push(...r.bars);
    }
    for (let i = 1; i < bars.length; i++) expect(bars[i].at).toBeCloseTo(bars[i - 1].at + barSeconds(musicTheme(bars[i - 1].arena)), 9);
    const into = bars.find((b) => b.arena === 'boss:dreadKnight')!;
    expect(into.at).toBeGreaterThan(6.1);
    expect([into.bar, into.from]).toEqual([0, 'courtyard']);
    expect(bars.find((b) => b.layer === 3)!.at).toBeGreaterThan(20.3);
    const back = bars.find((b) => b.at > 33.7 && b.arena === 'courtyard')!;
    expect([back.bar, back.from as MusicId]).toEqual([0, 'boss:dreadKnight']);
    expect(bars.filter((b) => b.from).length).toBe(2);
  });
});
