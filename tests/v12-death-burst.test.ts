import { describe, expect, it } from 'vitest';
import { AI } from '../src/config/ai';
import { CINDER_COLOSSUS } from '../src/config/bosses';
import { CARD_IDS, cardInfo } from '../src/config/cards';
import { DEATH_BURSTS, ENEMY_STATUS, RESISTS } from '../src/config/damage';
import { ENEMIES } from '../src/config/enemies';
import { createGame } from '../src/game';
import { deathBurst, deathBurstOf } from '../src/logic/deathBurst';
import { realmFoe } from '../src/logic/world';
import { killEnemy, updateZones } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

// #226: the Cinderlands' Cinder Hounds, which burst into fire where they die
const cfg = DEATH_BURSTS.cinderHound!;

describe('a death burst (#226)', () => {
  it('is a blast where the foe fell, as wide and as late as its config says, for a share of its own blow', () => {
    expect(deathBurst({ id: 'cinderHound', x: 120, y: -40, damage: 10 })).toEqual({ x: 120, y: -40, r: cfg.radius, delay: cfg.delay, damage: 10 * cfg.damage });
  });

  it('only the kinds that have one burst', () => {
    expect(deathBurstOf('cinderHound')).toBe(cfg);
    for (const id of ['wolf', 'peasant', 'torchbearer', 'cultist'] as const) {
      expect(deathBurstOf(id)).toBeUndefined();
      expect(deathBurst({ id, x: 0, y: 0, damage: 10 })).toBeNull();
    }
  });

  it('gives way to the Cinder Colossus\'s own blast in his heat, in his burst phase only', () => {
    const hound = { id: 'cinderHound' as const, x: 100, y: 0, damage: 10 };
    const reach = CINDER_COLOSSUS.burst.reach;
    expect(deathBurst(hound, { phase: CINDER_COLOSSUS.burstFrom, x: 0, y: 0 })).toBeNull(); // his blast bursts it
    expect(deathBurst(hound, { phase: CINDER_COLOSSUS.burstFrom - 1, x: 0, y: 0 })).not.toBeNull(); // not yet his lesson
    expect(deathBurst({ ...hound, x: reach + 1 }, { phase: CINDER_COLOSSUS.burstFrom, x: 0, y: 0 })).not.toBeNull(); // out of his heat
    expect(deathBurst(hound, null)).not.toBeNull();
  });

  it('leaves time to step out, and is no harder than a Cultist\'s blast',() => {
    expect(cfg.delay).toBeGreaterThanOrEqual(0.7); // the Colossus's burst: a marked attack you can read
    expect(cfg.radius).toBeLessThan(ENEMIES.cultist.blastRadius!);
    expect(ENEMIES.cinderHound.damage * cfg.damage).toBeLessThan(ENEMIES.cultist.damage / 3); // a pack of three falling at once stays under one Cultist
  });
});

describe('the Cinderlands march cinder hounds (#226)', () => {
  const fight = (realm: 'cinderlands' | 'marches' = 'cinderlands') => createGame('paladin', 5, { level: { realm, level: 2 } });
  const tick = (g: ReturnType<typeof fight>, seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      g.time += 1 / 60;
      updateZones(g, 1 / 60);
    }
  };

  it('swaps the wolf for the Cinder Hound in the Cinderlands only', () => {
    expect(realmFoe('cinderlands', 'wolf')).toBe('cinderHound');
    expect(realmFoe('marches', 'wolf')).toBe('wolf');
    expect(realmFoe('ironHold', 'wolf')).toBe('wolf');
    expect(realmFoe(undefined, 'wolf')).toBe('wolf');
  });

  it('is the wolf in body and hunt, without his bleed, and shrugs off fire where the wolf fears it', () => {
    const { id: _i, name: _n, sprite: _s, ...hound } = ENEMIES.cinderHound;
    const { id: _wi, name: _wn, sprite: _ws, ...wolf } = ENEMIES.wolf;
    expect(hound).toEqual(wolf);
    expect(AI.cinderHound).toEqual(AI.wolf);
    expect(ENEMY_STATUS.cinderHound).toBeUndefined();
    expect(RESISTS.cinderHound!.fire!).toBeLessThan(1);
    expect(RESISTS.cinderHound!.frost!).toBeGreaterThan(1);
  });

  it('bursts where he dies: a marked blast that burns the champion who stays in it', () => {
    const g = fight();
    const p = g.player;
    const e = spawnEnemy(g, 'wolf', p.x + 30, p.y);
    expect(e.def.id).toBe('cinderHound');
    killEnemy(g, e);
    expect(g.zones).toHaveLength(1);
    expect(g.zones[0]).toMatchObject({ x: e.x, y: e.y, r: cfg.radius, delay: cfg.delay, hostile: true, dtype: 'fire', owner: null, damage: e.damage * cfg.damage });
    expect(g.vars['deathBursts']).toBe(1);
    const hp = p.hp;
    tick(g, cfg.delay - 0.05);
    expect(p.hp).toBe(hp); // marked, not yet struck
    tick(g, 0.1);
    expect(p.hp).toBeLessThan(hp);
    expect(g.zones).toHaveLength(0);
  });

  it('spares the champion who steps out of the mark', () => {
    const g = fight();
    const p = g.player;
    const e = spawnEnemy(g, 'wolf', p.x + 30, p.y);
    killEnemy(g, e);
    p.x = e.x + cfg.radius + p.r + 1;
    const hp = p.hp;
    tick(g, cfg.delay + 0.1);
    expect(p.hp).toBe(hp);
    expect(g.zones).toHaveLength(0);
  });

  it('bursts whatever felled him, and once', () => {
    const g = fight();
    const e = spawnEnemy(g, 'wolf', g.player.x + 300, g.player.y);
    killEnemy(g, e, 'hazard');
    killEnemy(g, e, 'hazard');
    expect(g.zones).toHaveLength(1);
  });

  it('names the burst when it fells the champion', () => {
    const g = fight();
    const p = g.player;
    const e = spawnEnemy(g, 'wolf', p.x + 30, p.y);
    killEnemy(g, e);
    p.hp = 0.01;
    g.lastStand = 'used'; // no second chance left
    tick(g, cfg.delay + 0.1);
    expect(g.over).toBe(true);
    expect(g.log.cause).toBe('a Cinder Hound\'s burst');
  });

  it('in the Cinder Colossus\'s heat his blast takes the hound\'s place: one death, one burst',() => {
    const g = fight();
    const p = g.player;
    const c = spawnEnemy(g, 'cinderColossus', p.x + 200, p.y);
    c.phase = CINDER_COLOSSUS.burstFrom;
    const e = spawnEnemy(g, 'wolf', p.x + 100, p.y);
    killEnemy(g, e);
    expect(g.zones).toHaveLength(1);
    expect(g.zones[0]).toMatchObject({ owner: c, r: CINDER_COLOSSUS.burst.radius });
    expect(g.vars['deathBursts']).toBeUndefined();
  });

  it('the plain wolf leaves nothing behind', () => {
    const g = fight('marches');
    const e = spawnEnemy(g, 'wolf', g.player.x + 30, g.player.y);
    expect(e.def.id).toBe('wolf');
    killEnemy(g, e);
    expect(g.zones).toHaveLength(0);
  });

  it('brings a flash card of his own', () => {
    expect(CARD_IDS).toContain('cinderHound');
    expect(cardInfo('cinderHound')).toMatchObject({ name: 'Cinder Hound', boss: false });
  });
});
