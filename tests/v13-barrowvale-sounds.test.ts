import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/config/bosses';
import { BOSS_SOUNDS } from '../src/config/bossSounds';
import { ENEMIES, RISING, type EnemyId } from '../src/config/enemies';
import { FOE_FAMILY, FOE_OWN, FOE_OWN_SOUNDS, type FoeMoment } from '../src/config/foeSounds';
import { BOSS_THEMES, THEMES } from '../src/config/music';
import { cuePriority } from '../src/logic/voices';
import { createGame } from '../src/game';
import { composeBossBar, composeMusicBar, COMPOSERS } from '../src/logic/bossMusic';
import { bossTones, hasBossSounds } from '../src/logic/bossSounds';
import { foeLayers, foeOwnVoice, layersEnd } from '../src/logic/foeSounds';
import { RANGES } from '../src/logic/music';
import { corpseRise, stepRising } from '../src/logic/risingCorpse';
import { bossMusicIds, composeRunBar, moodOf, musicTheme, type Layer } from '../src/logic/runMusic';
import { killEnemy, updateRisingCorpses } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';
import { updateBossSounds } from '../src/systems/bossSounds';

// #292: the Barrowvale's bosses their themes, signatures and phase cues; its new foes their own moments
const BARROW: EnemyId[] = ['gravedigger', 'barrowKing'];
const LAYERS: Layer[] = [0, 1, 2, 3];
const MOMENTS: FoeMoment[] = ['rise', 'trample', 'plague'];

describe('the Barrowvale bosses: their themes (#292)', () => {
  it('the Gravedigger and the Barrow King each have a theme, with a composer of his own, on the jukebox', () => {
    for (const id of BARROW) {
      const t = BOSS_THEMES[id]!;
      expect(t, id).toBeDefined();
      expect(t.name).toBe(ENEMIES[id].name);
      expect(BOSSES[id].from).toBe(id);
      expect(COMPOSERS[t.composer]).toBeTypeOf('function');
      expect(bossMusicIds()).toContain(`boss:${id}`);
    }
    const composers = Object.values(BOSS_THEMES).map((t) => t!.composer);
    expect(new Set(composers).size).toBe(composers.length); // no two bosses share one
    expect(Object.values(ENEMIES).filter((d) => d.boss && !BOSS_THEMES[d.id])).toEqual([]); // every boss has his own now
  });

  it("each plays on the Barrowvale theme's voices", () => {
    const r = THEMES.barrowvale;
    const realmVoices = new Set([r.drone, r.pad, r.pulse?.voice, r.lead, 'drum', 'bass']);
    for (const id of BARROW) {
      const t = BOSS_THEMES[id]!;
      expect([t.drone, t.pad, t.pulse?.voice ?? r.pulse?.voice, t.lead], id).toEqual([r.drone, r.pad, r.pulse?.voice, r.lead]);
      const voices = new Set(Array.from({ length: 16 }, (_, bar) => COMPOSERS[t.composer](t, 3, bar, 3)).flat().map((n) => n.voice));
      for (const v of voices) expect(realmVoices.has(v), `${id} ${v}`).toBe(true);
    }
  });

  it('neither sounds like an arena, a realm or another boss: its own key, mode and tempo', () => {
    const sig = (t: { root: number; mode: number[]; bpm: number }) => `${t.root}/${t.mode.join()}/${t.bpm}`;
    const others = new Set([...Object.values(THEMES).map(sig), ...bossMusicIds().filter((id) => !BARROW.some((b) => id === `boss:${b}`)).map((id) => sig(musicTheme(id)))]);
    const mine = BARROW.map((id) => sig(BOSS_THEMES[id]!));
    for (const s of mine) expect(others.has(s)).toBe(false);
    expect(new Set(mine).size).toBe(2);
  });

  it('every note is in its mode, its voice range and its bar, in every phase', () => {
    for (const id of BARROW) {
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

  it('it builds with the phases; the Barrow King’s organ walks a lament down a step a bar', () => {
    for (const id of BARROW) {
      const t = BOSS_THEMES[id]!;
      const count = (layer: Layer) => Array.from({ length: 16 }, (_, bar) => composeBossBar(t, 9, bar, layer).length).reduce((a, b) => a + b);
      expect(count(1)).toBeGreaterThan(Array.from({ length: 16 }, (_, bar) => composeRunBar(t, 9, bar, 1).length).reduce((a, b) => a + b));
      expect(count(2), id).toBeGreaterThan(count(1));
      expect(count(3), id).toBeGreaterThan(count(2));
      const last = composeBossBar(t, 9, 0, 3);
      expect(last.some((n) => n.voice === 'bass')).toBe(true);
      expect(last.some((n) => n.voice === 'drum' && n.midi === t.boss.midi)).toBe(true);
    }
    const king = BOSS_THEMES.barrowKing!;
    const lament = [0, 1, 2, 3].map((bar) => COMPOSERS.dirge(king, 1, bar, 1)[0].midi);
    for (let i = 1; i < 4; i++) expect(lament[i]).toBeLessThan(lament[i - 1]);
  });

  it("each takes over from the Barrowvale's theme in his level, builds with his three phases and hands back when he falls", () => {
    for (const [id, level] of [['gravedigger', 3], ['barrowKing', 5]] as const) {
      const g = createGame('viking', 4, { level: { realm: 'barrowvale', level } });
      g.wave = 10;
      expect(moodOf(g).arena).toBe('barrowvale');
      const b = spawnEnemy(g, id, 300, 300);
      expect(moodOf(g)).toEqual({ arena: `boss:${id}`, layer: 1, cue: null });
      b.phase = 2;
      expect(moodOf(g).layer).toBe(2);
      b.phase = 3;
      expect(moodOf(g).layer).toBe(3);
      g.enemies = g.enemies.filter((e) => e !== b);
      expect(moodOf(g).arena).toBe('barrowvale');
    }
  });
});

describe('the Barrowvale bosses: their sounds (#292)', () => {
  it('each has his own signature, big move and phase cue, his signature unlike any other boss’s', () => {
    for (const id of BARROW) {
      expect(hasBossSounds(id), id).toBe(true);
      const set = BOSS_SOUNDS[id as keyof typeof BOSS_SOUNDS];
      for (const tones of [set.arrive, set.move, set.phase]) {
        expect(tones.length).toBeGreaterThanOrEqual(2);
        for (const t of tones) expect(t.vol).toBeLessThanOrEqual(0.25);
      }
      const others = Object.entries(BOSS_SOUNDS).filter(([k]) => k !== id).map(([, s]) => JSON.stringify(s.arrive));
      expect(others).not.toContain(JSON.stringify(set.arrive));
    }
    expect(bossTones('boss:barrowKing:phase3')[0].f0).toBeGreaterThan(bossTones('boss:barrowKing:phase2')[0].f0); // the third phase worse
  });

  it('in the game: he arrives with his signature, a warning sounds his big move, a new phase its cue', () => {
    for (const id of BARROW) {
      const g = createGame('viking', 4, { level: { realm: 'barrowvale', level: id === 'gravedigger' ? 3 : 5 } });
      const b = spawnEnemy(g, id, 300, 300);
      g.out.length = 0;
      updateBossSounds(g);
      expect(g.out.map((c) => c.name)).toEqual([`boss:${id}:arrive`]);
      g.out.length = 0;
      b.phase = 3;
      updateBossSounds(g);
      expect(g.out.map((c) => c.name)).toEqual([`boss:${id}:phase3`]);
    }
  });
});

describe('the Barrowvale foes: their own moments (#292)', () => {
  it("a thrall's corpse rises and is trampled in its own sounds, a blight hound fouls the ground in its own; nobody else's do", () => {
    expect(FOE_OWN).toEqual({ barrowThrall: ['rise', 'trample'], blightHound: ['plague'] });
    expect(foeOwnVoice('barrowThrall', 'rise')).toBe('own.rise');
    expect(foeOwnVoice('blightHound', 'plague')).toBe('own.plague');
    expect(foeOwnVoice('blightHound', 'rise')).toBeUndefined();
    expect(foeOwnVoice('peasant', 'trample')).toBeUndefined();
    expect(Object.keys(RISING)).toEqual(['barrowThrall']); // the corpses that rise are the ones that sound it
    for (const m of MOMENTS) {
      const layers = foeLayers(`own.${m}`)!;
      expect(layers).toBe(FOE_OWN_SOUNDS[m]);
      for (const l of layers) {
        expect(l.vol).toBeGreaterThan(0);
        expect(l.vol).toBeLessThanOrEqual(0.1); // a crowd's sound, under the champion's
        if (l.wave !== 'noise') expect(Math.min(l.f0, l.f1)).toBeGreaterThan(20);
      }
      expect(layersEnd(layers)).toBeLessThan(0.6);
    }
    expect(foeLayers('own/barrow.rise')).toBeNull();
    expect(foeLayers('own.sing')).toBeNull();
    expect(new Set(MOMENTS.map((m) => JSON.stringify(FOE_OWN_SOUNDS[m]))).size).toBe(3);
    // they keep their families' voices for their attacks, blows and deaths
    expect(FOE_FAMILY.barrowThrall).toEqual({ family: 'folk', realm: 'barrow' });
    expect(FOE_FAMILY.blightHound).toEqual({ family: 'beast', realm: 'barrow' });
  });

  it('stepRising tells who would have risen from a trampled corpse', () => {
    const c = { x: 0, y: 0, t: 0, rise: corpseRise({ id: 'barrowThrall', side: false, maxHp: 22 }) };
    const heard: string[] = [];
    stepRising([c], { x: 0, y: 0, r: 14 }, (_c, id) => heard.push(id));
    expect(heard).toEqual(['barrowThrall']);
    expect(c.rise).toBeUndefined();
  });

  it('in a Barrowvale fight: a corpse rising is a warning in its moan, one trampled the champion’s stamp, new plague ground a warning in its hiss', () => {
    const g = createGame('paladin', 5, { level: { realm: 'barrowvale', level: 2 } });
    const p = g.player;
    const age = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) {
        for (const c of g.corpses) c.t += 1 / 60;
        updateRisingCorpses(g);
      }
    };
    const thrall = spawnEnemy(g, 'peasant', p.x + 200, p.y);
    const other = spawnEnemy(g, 'peasant', p.x - 200, p.y);
    killEnemy(g, thrall);
    killEnemy(g, other);
    g.out.length = 0;
    p.x = other.x;
    p.y = other.y;
    age(1 / 60);
    expect(g.out).toContainEqual({ name: 'kill', src: 'player', x: other.x, y: other.y, voice: 'own.trample' });
    p.x -= 400;
    g.out.length = 0;
    age(RISING.barrowThrall!.delay + 0.1);
    expect(g.out).toContainEqual({ name: 'warn', src: 'foe', x: thrall.x, y: thrall.y, voice: 'own.rise' });
    expect(cuePriority('warn', 'foe')).toBeGreaterThan(cuePriority('kill', 'foe')); // a corpse rising outranks the crowd's deaths

    g.out.length = 0;
    const hound = spawnEnemy(g, 'wolf', p.x + 300, p.y);
    expect(hound.def.id).toBe('blightHound');
    killEnemy(g, hound);
    expect(g.out.filter((c) => c.voice === 'own.plague')).toEqual([{ name: 'warn', src: 'foe', x: hound.x, y: hound.y, voice: 'own.plague' }]);
    g.out.length = 0;
    killEnemy(g, spawnEnemy(g, 'wolf', hound.x + 4, hound.y)); // falls on the same patch: renewed, not new ground, no second hiss
    expect(g.out.filter((c) => c.voice === 'own.plague')).toEqual([]);
  });
});
