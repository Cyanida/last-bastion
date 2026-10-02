import { describe, expect, it } from 'vitest';
import { BOSS_SOUND, BOSS_SOUNDS, type BossCueKind } from '../src/config/bossSounds';
import { ENEMIES } from '../src/config/enemies';
import { cuePriority, pickVoice } from '../src/logic/voices';
import { bossCueName, bossCuePriority, bossTones, hasBossSounds, isBossCue, nextBossCue, parseBossCue, tonesLength } from '../src/logic/bossSounds';
import { createGame } from '../src/game';
import { spawnEnemy } from '../src/systems/spawning';
import { updateBossSounds } from '../src/systems/bossSounds';
import { sfx, by } from '../src/sim/view';

// #286: every boss a signature as he arrives, a sound for his big moves and a cue on each phase change, at a high voice priority
const LATER = ['gravedigger', 'barrowKing']; // the Barrowvale's own: a later issue
const BOSS_IDS = Object.values(ENEMIES).filter((d) => d.boss && !LATER.includes(d.id)).map((d) => d.id);
const KINDS: BossCueKind[] = ['arrive', 'move', 'phase'];

describe('boss sounds: the sets (#286)', () => {
  it('every boss but the Barrowvale’s has an arrival, a big-move and a phase sound, each a few audible tones', () => {
    expect(BOSS_IDS.length).toBeGreaterThanOrEqual(12);
    for (const id of BOSS_IDS) {
      expect(hasBossSounds(id), id).toBe(true);
      for (const kind of KINDS) {
        const tones = BOSS_SOUNDS[id as keyof typeof BOSS_SOUNDS][kind];
        expect(tones.length, `${id} ${kind}`).toBeGreaterThanOrEqual(2);
        for (const t of tones) {
          expect(t.dur).toBeGreaterThan(0);
          expect(t.vol).toBeGreaterThan(0);
          expect(t.vol).toBeLessThanOrEqual(0.25); // no louder than the loudest effect
          if (t.wave !== 'noise') expect(Math.min(t.f0, t.f1)).toBeGreaterThan(0); // an exponential slide needs both ends above 0
        }
        expect(tonesLength(tones)).toBeLessThanOrEqual(1.5); // a cue, not a theme
      }
    }
  });

  it('each boss’s signature is his own', () => {
    const sig = BOSS_IDS.map((id) => JSON.stringify(BOSS_SOUNDS[id as keyof typeof BOSS_SOUNDS].arrive));
    expect(new Set(sig).size).toBe(BOSS_IDS.length);
  });
});

describe('boss sounds: the cues (#286)', () => {
  it('names a cue and reads it back; a later phase sounds higher', () => {
    expect(bossCueName('lich', 'arrive')).toBe('boss:lich:arrive');
    expect(bossCueName('lich', 'phase', 3)).toBe('boss:lich:phase3');
    expect(bossCueName('lich', 'phase', 9)).toBe(`boss:lich:phase${BOSS_SOUND.maxPhase}`);
    expect(parseBossCue('boss:warden:phase3')).toEqual({ id: 'warden', kind: 'phase', phase: 3 });
    expect(parseBossCue('boss:warden:move')).toEqual({ id: 'warden', kind: 'move', phase: 1 });
    expect(isBossCue('boss:warden:move')).toBe(true);
    expect(isBossCue('warn')).toBe(false);
    expect(bossTones('boss:dragon:phase2')).toEqual(BOSS_SOUNDS.dragon.phase);
    const p2 = bossTones('boss:dragon:phase2')[0], p3 = bossTones('boss:dragon:phase3')[0];
    expect(p3.f0).toBeCloseTo(p2.f0 * BOSS_SOUND.phaseRise);
  });

  it('an arrival or a phase cue outranks any other cue in the voice limit; a big move outranks a foe’s warning', () => {
    const arrive = bossCuePriority('boss:abbot:arrive');
    const phase = bossCuePriority('boss:abbot:phase2');
    const move = bossCuePriority('boss:abbot:move');
    for (const name of ['hit', 'kill', 'boom', 'warn', 'wave', 'levelup']) for (const src of ['foe', 'player', 'world'] as const) expect(arrive).toBeGreaterThan(cuePriority(name, src));
    expect(arrive).toBeGreaterThan(cuePriority('warn', 'boss'));
    expect(phase).toBe(arrive);
    expect(move).toBeGreaterThan(cuePriority('warn', 'foe'));
    // all eight voices playing a boss's own warnings: his phase cue still takes one
    const full = Array.from({ length: 8 }, (_, i) => ({ prio: cuePriority('warn', 'boss'), start: i * 0.01, ends: 5 }));
    expect(pickVoice(full, phase, 1)).toBe(0);
  });

  it('a boss arrives once, makes a phase cue as each phase begins, and his big-move sound when he warns', () => {
    expect(nextBossCue(undefined, 1, true)).toEqual({ kind: 'arrive', phase: 1 });
    expect(nextBossCue(1, 1, false)).toBeNull();
    expect(nextBossCue(1, 1, true)).toEqual({ kind: 'move', phase: 1 });
    expect(nextBossCue(1, 2, true)).toEqual({ kind: 'phase', phase: 2 });
    expect(nextBossCue(2, 2, false)).toBeNull();
  });
});

describe('boss sounds: in the game (#286)', () => {
  it('the step after a boss comes, his signature; a warning, his big move; a new phase, its cue; each from him', () => {
    const g = createGame('viking', 4, { arena: 'courtyard' });
    const b = spawnEnemy(g, 'warlord', 300, 300);
    const names = () => g.out.map((c) => c.name);
    g.out.length = 0;
    updateBossSounds(g);
    expect(names()).toEqual(['boss:warlord:arrive']);
    expect(g.out[0]).toMatchObject({ src: 'boss', x: b.x, y: b.y });
    g.out.length = 0;
    updateBossSounds(g);
    expect(names()).toEqual([]); // he arrives once
    sfx(g, 'warn', by(b));
    updateBossSounds(g);
    expect(names()).toEqual(['warn', 'boss:warlord:move']);
    g.out.length = 0;
    b.phase = 2;
    sfx(g, 'warn', by(b)); // enterPhase warns too: the phase cue, not a move
    updateBossSounds(g);
    expect(names()).toEqual(['warn', 'boss:warlord:phase2']);
    g.out.length = 0;
    updateBossSounds(g);
    expect(names()).toEqual([]);
  });

  it('with two bosses on the field, a warning is the nearer one’s; a boss without his own sounds yet stays as he was', () => {
    const g = createGame('viking', 4, { arena: 'courtyard' });
    const a = spawnEnemy(g, 'lich', 100, 100);
    const c = spawnEnemy(g, 'barrowKing', 900, 900);
    updateBossSounds(g);
    g.out.length = 0;
    sfx(g, 'warn', by(c));
    updateBossSounds(g);
    expect(g.out.map((x) => x.name)).toEqual(['warn']); // the Barrow King's warning: no move sound for the Lich
    g.out.length = 0;
    sfx(g, 'warn', by(a));
    updateBossSounds(g);
    expect(g.out.map((x) => x.name)).toEqual(['warn', 'boss:lich:move']);
  });

  it('a real boss fight: his own phase change makes his phase cue in the same step', async () => {
    const { updateEnemies } = await import('../src/systems/enemyAI');
    const g = createGame('viking', 4, { arena: 'courtyard' });
    const b = spawnEnemy(g, 'blackKnight', 300, 300);
    updateBossSounds(g);
    g.out.length = 0;
    b.hp = b.maxHp * 0.4; // past his halfway mark
    updateEnemies(g, 1 / 60);
    updateBossSounds(g);
    expect(b.phase).toBe(2);
    expect(g.out.map((x) => x.name)).toContain('boss:blackKnight:phase2');
  });
});
