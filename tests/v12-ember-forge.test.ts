import { describe, expect, it } from 'vitest';
import { ARENA_IDS, ARENAS, LAVA } from '../src/config/arenas';
import { GAME } from '../src/config/game';
import { THEMES } from '../src/config/music';
import { featureSpot, WING_IDS } from '../src/config/regions';
import { ARENA_FAMILIES } from '../src/config/relics';
import { REALMS } from '../src/config/world';
import { createGame } from '../src/game';
import { inLava, lavaBanks, lavaTick } from '../src/logic/lava';
import { fixedFeatures, inRect, regionAt } from '../src/logic/regions';
import PROPS from '../src/render/props.json';
import { updateArena } from '../src/systems/arena';
import { spawnEnemy } from '../src/systems/spawning';

const forge = ARENAS.emberForge;
const core = forge.regions!.find((r) => r.id === 'core')!.floor;

describe('#223 the Ember Forge, the Cinderlands arena', () => {
  it('is the Cinderlands arena, and a Cinderlands level plays in it', () => {
    expect(REALMS.cinderlands.arena).toBe('emberForge');
    for (const level of [1, 3, 5]) expect(createGame('viking', 5, { level: { realm: 'cinderlands', level } }).arena.id).toBe('emberForge');
  });

  it('is a realm arena only: never a starting arena or in the Act rotation, like the Last Bastion', () => {
    expect(ARENA_IDS).not.toContain('emberForge');
    expect(ARENA_FAMILIES.emberForge).toEqual(['flame', 'steel', 'blood']);
    expect(THEMES.emberForge.name).toBe('The Ember Forge');
  });

  it('has four named rooms, each with a different feature and its own rigged prop', () => {
    expect(WING_IDS.map((id) => forge.regions!.find((r) => r.id === id)!.name)).toEqual(['the smelter', 'the weaponsmith', 'the ember shrine', 'the quench pits']);
    expect(new Set(Object.values(fixedFeatures(forge.wings)!)).size).toBe(4);
    for (const o of forge.obstacles) expect(PROPS[o.kind], o.kind).toBeDefined();
    const smelter = forge.obstacles.filter((o) => regionAt(forge.regions!, o.x, o.y)?.id === 'north');
    expect(smelter.length).toBe(4);
    expect(smelter.every((o) => o.kind === 'crucible')).toBe(true);
  });

  it('lays two lava channels across the core, wall to wall, each broken by its bridges', () => {
    const lava = forge.lava!;
    const lines = [...new Set(lava.map((c) => c.y))];
    expect(lines.length).toBe(2);
    for (const y of lines) {
      const runs = lava.filter((c) => c.y === y).sort((a, b) => a.x - b.x);
      expect(runs.length).toBe(LAVA.bridges.length + 1);
      expect(runs[0].x).toBe(core.x);
      expect(runs[runs.length - 1].x + runs[runs.length - 1].w).toBe(core.x + core.w);
      for (let i = 1; i < runs.length; i++) expect(runs[i].x - (runs[i - 1].x + runs[i - 1].w)).toBe(LAVA.bridge);
    }
    for (const c of lava) {
      expect(c.h).toBe(LAVA.width);
      expect(inRect(core, c.x, c.y) && inRect(core, c.x + c.w, c.y + c.h)).toBe(true);
    }
  });

  it('keeps the spawn, the side gates\' line, the props and the features out of the lava', () => {
    const spawn = { x: forge.w / 2, y: forge.h / 2 };
    expect(inLava(spawn.x, spawn.y, 60, forge.lava!)).toBe(false);
    for (let x = core.x; x < core.x + core.w; x += 20) expect(inLava(x, spawn.y, 60, forge.lava!)).toBe(false); // east to west, dry
    for (const o of forge.obstacles) expect(inLava(o.x, o.y, o.r * 2, forge.lava!), `${o.kind} ${o.x},${o.y}`).toBe(false);
    for (const r of forge.regions!) expect(inLava(featureSpot(r).x, featureSpot(r).y, 40, forge.lava!), r.id).toBe(false);
  });

  it('a body is in the lava when it steps in, not when its edge brushes the bank', () => {
    const c = [{ x: 100, y: 100, w: 200, h: 56 }];
    expect(inLava(200, 128, 14, c)).toBe(true);
    expect(inLava(200, 100 - 6, 14, c)).toBe(true); // half its radius over the bank
    expect(inLava(200, 100 - 8, 14, c)).toBe(false); // only its edge over the lava
    expect(inLava(99 - 7, 128, 14, c)).toBe(false);
    expect(inLava(320, 128, 14, c)).toBe(false); // on the bridge past the run's end
  });

  it('burns a tick of dps x tick, scaled like enemy damage, x foeMult on foes', () => {
    expect(lavaTick(12, 0.5, 1, 2, false)).toBe(6);
    expect(lavaTick(12, 0.5, 1.5, 2, true)).toBe(18);
  });

  it('leaves #224 the points along its banks where the spreading fire catches', () => {
    const banks = lavaBanks([{ x: 0, y: 100, w: 200, h: 56 }], 50);
    expect(banks.length).toBe(8);
    expect(banks.every((b) => b.y === 100 || b.y === 156)).toBe(true);
  });

  it('in a Cinderlands level it burns the champion standing in it, and a foe there harder, but not one on the bridge', () => {
    const g = createGame('viking', 5, { level: { realm: 'cinderlands', level: 1 } });
    const run = g.arena.lava!.slice().sort((a, b) => a.x - b.x)[0];
    Object.assign(g.player, { x: run.x + run.w / 2, y: run.y + run.h / 2, iFrames: 0, invulnT: 0 });
    const foe = spawnEnemy(g, 'peasant', run.x + run.w / 2 + 60, run.y + run.h / 2);
    const bridged = spawnEnemy(g, 'peasant', run.x + run.w + LAVA.bridge / 2, run.y + run.h / 2);
    const [hp, foeHp, bridgeHp] = [g.player.hp, foe.hp, bridged.hp];
    g.lavaT = 0;
    g.hazardT = 99;
    g.pressT = 99;
    updateArena(g, 1 / 60);
    expect(hp - g.player.hp).toBeGreaterThan(0);
    expect(foeHp - foe.hp).toBeGreaterThan(hp - g.player.hp);
    expect(bridged.hp).toBe(bridgeHp);
    expect(g.lavaT).toBeCloseTo(GAME.fieldTick - 1 / 60);
    const after = g.player.hp;
    updateArena(g, 1 / 60); // the next tick comes a GAME.fieldTick later
    expect(g.player.hp).toBe(after);
  });

  it('a dodge carries you over it', () => {
    const g = createGame('viking', 5, { level: { realm: 'cinderlands', level: 1 } });
    const c = g.arena.lava![0];
    Object.assign(g.player, { x: c.x + 40, y: c.y + c.h / 2, invulnT: 0.3 });
    const hp = g.player.hp;
    g.lavaT = 0;
    updateArena(g, 1 / 60);
    expect(g.player.hp).toBe(hp);
  });

  it('no other arena has lava', () => {
    for (const id of Object.keys(ARENAS) as (keyof typeof ARENAS)[]) if (id !== 'emberForge') expect(ARENAS[id].lava).toBeUndefined();
  });
});
