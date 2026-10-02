import { describe, expect, it } from 'vitest';
import { ENEMIES, type EnemyId } from '../src/config/enemies';
import { FOE_FAMILY, FOE_SOUNDS, REALM_TINTS, type FoeEvent, type FoeFamily } from '../src/config/foeSounds';
import { REALMS } from '../src/config/world';
import { foeBy, foeLayers, foeVoice, layersEnd } from '../src/logic/foeSounds';
import { cuePriority, pickVoice, type Voice } from '../src/logic/voices';
import { VOICES } from '../src/config/voices';
import { sfx } from '../src/sim/view';
import type { Game } from '../src/core/types';

// #285: each enemy family sounds its own (its attack, a blow landing on it, its death), the realms' kin through their realm's tint
const EVENTS: FoeEvent[] = ['attack', 'hit', 'death'];
const ids = Object.keys(ENEMIES) as EnemyId[];
const at = (id: EnemyId) => ({ x: 10, y: 20, def: ENEMIES[id] });

describe('enemy family sounds (#285)', () => {
  it('every foe but a boss has a family; a boss keeps his own sounds', () => {
    for (const id of ids) {
      if (ENEMIES[id].boss) expect(FOE_FAMILY[id], id).toBeUndefined();
      else expect(FOE_FAMILY[id], id).toBeDefined();
    }
  });

  it("every family has a sound for each event: short layers, quiet enough for a crowd, each one heard", () => {
    for (const family of Object.keys(FOE_SOUNDS) as FoeFamily[]) {
      for (const ev of EVENTS) {
        const layers = foeLayers(`${family}.${ev}`);
        expect(layers?.length, `${family}.${ev}`).toBeGreaterThan(0);
        for (const l of layers!) {
          expect(l.dur).toBeGreaterThan(0);
          expect(l.vol).toBeGreaterThan(0);
          expect(l.vol).toBeLessThanOrEqual(0.1); // below the plain hit (0.12): a swarm's sounds sit under the champion's
          if (l.wave !== 'noise') expect(Math.min(l.f0, l.f1)).toBeGreaterThan(20);
        }
        expect(layersEnd(layers!)).toBeLessThan(0.5);
      }
    }
  });

  it("the families' attacks sound different from each other", () => {
    const sig = (f: FoeFamily) => JSON.stringify(FOE_SOUNDS[f].attack);
    const all = (Object.keys(FOE_SOUNDS) as FoeFamily[]).map(sig);
    expect(new Set(all).size).toBe(all.length);
  });

  it('the plan names its sounds: a priest chants, cavalry hooves drum, a crossbow twangs', () => {
    expect(FOE_FAMILY.priest?.family).toBe('holy');
    expect(FOE_SOUNDS.holy.attack.every((l) => l.wave === 'sine' && l.f0 === l.f1)).toBe(true); // held notes, a chord
    expect(FOE_FAMILY.cavalry?.family).toBe('cavalry');
    expect(FOE_SOUNDS.cavalry.attack.filter((l) => l.wave === 'noise').length).toBeGreaterThanOrEqual(3); // hoof beats one after another
    expect(new Set(FOE_SOUNDS.cavalry.attack.map((l) => l.at ?? 0)).size).toBe(FOE_SOUNDS.cavalry.attack.length);
    expect(FOE_FAMILY.crossbow?.family).toBe('bow');
    expect(FOE_SOUNDS.bow.attack.some((l) => l.wave === 'triangle' && l.dur >= 0.1)).toBe(true); // the string rings on
  });

  it("a realm's own foes sound their family through the realm's tint (the Iron Hold, the Cinderlands, the Barrowvale)", () => {
    const realmOf = { ironHold: 'iron', cinderlands: 'cinder', barrowvale: 'barrow' } as const;
    for (const [realm, tint] of Object.entries(realmOf)) {
      const foes = REALMS[realm as keyof typeof realmOf].foes ?? {};
      expect(Object.keys(foes).length, realm).toBeGreaterThan(0);
      for (const [plain, kin] of Object.entries(foes) as [EnemyId, EnemyId][]) {
        expect(FOE_FAMILY[kin]?.family, kin).toBe(FOE_FAMILY[plain]?.family);
        expect(FOE_FAMILY[kin]?.realm, kin).toBe(tint);
        for (const ev of EVENTS) {
          const base = foeLayers(foeVoice(plain, ev)!)!;
          const own = foeLayers(foeVoice(kin, ev)!)!;
          expect(own.length).toBe(base.length + 1); // the realm's own layer on top
          expect(own[own.length - 1]).toEqual(REALM_TINTS[tint].layer);
          base.forEach((l, i) => expect(own[i].f0).toBeCloseTo(l.f0 * REALM_TINTS[tint].pitch));
        }
      }
    }
  });

  it('voice keys: family and event, a realm between; a key that names no sound plays the plain one', () => {
    expect(foeVoice('cavalry', 'attack')).toBe('cavalry.attack');
    expect(foeVoice('ironKnight', 'death')).toBe('steel/iron.death');
    expect(foeVoice('barrowKing', 'hit')).toBeUndefined();
    expect(foeLayers('nobody.attack')).toBeNull();
    expect(foeLayers('steel/moon.attack')).toBeNull();
    expect(foeLayers('steel.sing')).toBeNull();
    expect(foeLayers('steel.hit')).toBe(foeLayers('steel.hit')); // worked out once
  });

  it("a foe's cue carries its family's voice into the queue; a boss's carries none", () => {
    const g = { out: [] } as unknown as Game;
    sfx(g, 'kill', foeBy(at('priest'), 'death'));
    sfx(g, 'boom', foeBy(at('barrowKing'), 'death'));
    expect(g.out[0]).toEqual({ name: 'kill', src: 'foe', x: 10, y: 20, voice: 'holy.death' });
    expect(g.out[1]).toMatchObject({ name: 'boom', src: 'boss', voice: undefined });
  });

  it("a swarm's sounds weigh least: the champion's swing and a boss's cue take their voice, and a crowd never cuts the champion off", () => {
    const foe = Math.max(...(['swing', 'shoot', 'hit', 'kill'] as const).map((n) => cuePriority(n, 'foe')));
    const swarm: Voice[] = Array.from({ length: VOICES.max }, (_, i) => ({ prio: foe, start: i * 0.01, ends: 1 }));
    expect(cuePriority('swing', 'player')).toBeGreaterThan(foe);
    expect(pickVoice(swarm, cuePriority('swing', 'player'), 0.5)).toBe(0);
    expect(pickVoice(swarm, cuePriority('warn', 'boss'), 0.5)).toBe(0);
    expect(pickVoice(swarm, foe, 0.5)).toBe('drop');
    const champion: Voice[] = swarm.map((v) => ({ ...v, prio: cuePriority('swing', 'player') }));
    expect(pickVoice(champion, foe, 0.5)).toBe('drop');
  });
});
