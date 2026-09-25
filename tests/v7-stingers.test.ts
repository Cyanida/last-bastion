import { describe, expect, it } from 'vitest';
import { ARENAS, type ArenaId } from '../src/config/arenas';
import { THEMES } from '../src/config/music';
import { addListener, type EventName } from '../src/core/events';
import type { Game } from '../src/core/types';
import { createGame, updateGame } from '../src/game';
import { RANGES } from '../src/logic/music';
import { nextBeat, stingerNotes, type Stinger } from '../src/logic/runMusic';
import { evolve } from '../src/systems/evolutions';
import { addRelic } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

const KINDS: Stinger[] = ['tier', 'set', 'duo', 'evolution', 'phase'];

/** Every stinger event a game emits, in order. */
function heard(g: Game): [EventName, unknown][] {
  const out: [EventName, unknown][] = [];
  addListener((from, name, ev) => {
    if (from === g && ['onRelicTier', 'onSetBonus', 'onDuoFormed', 'onEvolved', 'onBossPhase'].includes(name)) out.push([name, ev]);
  });
  return out;
}

describe('stingers (v0.7.1 B5)', () => {
  it('every stinger is short and soft, in its theme\'s mode and each voice\'s range, in any bar', () => {
    for (const id of Object.keys(ARENAS) as ArenaId[]) {
      const t = THEMES[id];
      const scale = t.mode.map((s) => (t.root + s) % 12);
      for (let bar = 0; bar < t.chords.length * 2; bar++) {
        for (const kind of KINDS) {
          const notes = stingerNotes(t, bar, kind);
          expect(notes.length, `${id} ${kind}`).toBeGreaterThanOrEqual(3);
          for (const n of notes) {
            if (n.voice !== 'drum') expect(scale).toContain(n.midi % 12);
            expect(n.midi).toBeGreaterThanOrEqual(RANGES[n.voice][0]);
            expect(n.midi).toBeLessThanOrEqual(RANGES[n.voice][1]);
            expect(n.time).toBeGreaterThanOrEqual(0);
            expect(n.time).toBeLessThan(2);
            expect(n.velocity).toBeLessThanOrEqual(0.7);
          }
        }
      }
    }
  });

  it('lands on the next beat of the music: counted back from the next bar line, never in the past', () => {
    for (const arena of Object.keys(ARENAS) as ArenaId[]) {
      const beat = 60 / THEMES[arena].bpm;
      const c = { at: 100, arena };
      for (let now = 97; now < 101; now += 0.037) {
        const at = nextBeat(c, now);
        expect(at).toBeGreaterThanOrEqual(now + 0.05 - 1e-9);
        expect(at - beat).toBeLessThan(now + 0.05);
        const beats = (c.at - at) / beat;
        expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-9);
      }
    }
  });

  it('the run emits one event per moment: a set level reached (once), a tier-up, an evolution, a boss phase', () => {
    const g = createGame('viking', 3);
    const events = heard(g);
    addRelic(g, 'brimstoneOil');
    updateGame(g, 1 / 60);
    expect(events).toEqual([]); // one Flame relic: no set yet
    addRelic(g, 'emberheart');
    updateGame(g, 1 / 60);
    updateGame(g, 1 / 60);
    expect(events).toEqual([['onSetBonus', { family: 'flame', level: 2 }]]);
    g.player.relics.attune.brimstoneOil = 1;
    updateGame(g, 1 / 60);
    expect(events.at(-1)).toEqual(['onRelicTier', { id: 'brimstoneOil', tier: 2 }]);
    evolve(g, g.player, 'maelstrom');
    expect(events.at(-1)).toEqual(['onEvolved', { id: 'maelstrom' }]);
    const boss = spawnEnemy(g, 'warlord', g.player.x + 600, g.player.y);
    boss.hp = boss.maxHp * 0.45;
    updateGame(g, 1 / 60);
    expect(events.at(-1)).toEqual(['onBossPhase', { enemy: boss, phase: 2 }]);
  });
});
