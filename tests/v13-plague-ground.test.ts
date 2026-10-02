import { describe, expect, it } from 'vitest';
import { AI } from '../src/config/ai';
import { CARD_IDS, cardInfo } from '../src/config/cards';
import { ENEMY_STATUS, PLAGUE_GROUND, PLAGUE_GROUND_RULES, RESISTS } from '../src/config/damage';
import { ENEMIES } from '../src/config/enemies';
import { RENDER } from '../src/config/game';
import { MODIFIERS } from '../src/config/waves';
import { createGame } from '../src/game';
import { plagueGround, plagueGroundOf } from '../src/logic/plagueGround';
import { realmFoe } from '../src/logic/world';
import { killEnemy, updateFields } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

// #276: the Barrowvale's Blight Hounds, which leave plague ground that lasts where they die
const cfg = PLAGUE_GROUND.blightHound!;
const patch = (x: number, y: number, life = cfg.life) => ({ x, y, r: cfg.radius, life, max: cfg.life });

describe('plague ground (#276)', () => {
  it('a fallen hound lays a patch where it fell, as wide and as long as its config says, for a share of its own blow', () => {
    expect(plagueGround({ id: 'blightHound', x: 120, y: -40, damage: 10 }, [])).toEqual({ lay: { x: 120, y: -40, r: cfg.radius, life: cfg.life, dps: 10 * cfg.dps }, drop: null });
  });

  it('only the kinds that have it leave it', () => {
    expect(plagueGroundOf('blightHound')).toBe(cfg);
    for (const id of ['wolf', 'cinderHound', 'peasant', 'plagueDoctor'] as const) {
      expect(plagueGroundOf(id)).toBeUndefined();
      expect(plagueGround({ id, x: 0, y: 0, damage: 10 }, [])).toBeNull();
    }
  });

  it('a hound falling on standing plague ground renews that patch instead of laying another', () => {
    const near = patch(0, 0, 2);
    const r = plagueGround({ id: 'blightHound', x: cfg.radius * PLAGUE_GROUND_RULES.merge - 1, y: 0, damage: 6 }, [patch(500, 0), near]);
    expect(r).toEqual({ renew: near });
    expect(plagueGround({ id: 'blightHound', x: cfg.radius * PLAGUE_GROUND_RULES.merge + 1, y: 0, damage: 6 }, [near])).toMatchObject({ drop: null });
  });

  it('at the cap the patch with the least time left gives way, and spent patches count for nothing', () => {
    const standing = Array.from({ length: PLAGUE_GROUND_RULES.cap }, (_, i) => patch(i * 200, 0, 10 - i));
    const r = plagueGround({ id: 'blightHound', x: 0, y: 500, damage: 6 }, standing);
    expect(r).toMatchObject({ drop: standing[PLAGUE_GROUND_RULES.cap - 1] });
    standing[2].life = 0;
    expect(plagueGround({ id: 'blightHound', x: 0, y: 500, damage: 6 }, standing)).toMatchObject({ drop: null });
    expect(plagueGround({ id: 'blightHound', x: 400, y: 0, damage: 6 }, standing)).toMatchObject({ drop: null }); // where a spent one stood: a new patch
  });

  it('lasts far longer than other ground, hurts less a second, and stays well under the field cap', () => {
    expect(cfg.life).toBeGreaterThanOrEqual(2 * MODIFIERS.plague.n.life);
    expect(ENEMIES.blightHound.damage * cfg.dps).toBeLessThan(MODIFIERS.plague.n.dps);
    expect(PLAGUE_GROUND_RULES.cap).toBeLessThanOrEqual(RENDER.maxFields / 4);
  });
});

describe('the Barrowvale fields blight hounds (#276)', () => {
  const fight = (realm: 'barrowvale' | 'marches' = 'barrowvale') => createGame('paladin', 5, { level: { realm, level: 2 } });
  const tick = (g: ReturnType<typeof fight>, seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
      g.time += 1 / 60;
      updateFields(g, 1 / 60);
    }
  };
  const mine = (g: ReturnType<typeof fight>) => g.fields.filter((f) => f.plague && f.life > 0);

  it('swaps the wolf for the Blight Hound in the Barrowvale only', () => {
    expect(realmFoe('barrowvale', 'wolf')).toBe('blightHound');
    expect(realmFoe('cinderlands', 'wolf')).toBe('cinderHound');
    expect(realmFoe('marches', 'wolf')).toBe('wolf');
    expect(realmFoe(undefined, 'wolf')).toBe('wolf');
  });

  it('is the wolf in body and hunt, without his bleed', () => {
    const { id: _i, name: _n, sprite: _s, ...hound } = ENEMIES.blightHound;
    const { id: _wi, name: _wn, sprite: _ws, ...wolf } = ENEMIES.wolf;
    expect(hound).toEqual(wolf);
    expect(AI.blightHound).toEqual(AI.wolf);
    expect(ENEMY_STATUS.blightHound).toBeUndefined();
    expect(RESISTS.blightHound!.shadow!).toBeLessThan(1);
  });

  it('leaves plague ground where he dies that hurts the champion standing in it, and lasts its time', () => {
    const g = fight();
    const p = g.player;
    const e = spawnEnemy(g, 'wolf', p.x + 20, p.y);
    expect(e.def.id).toBe('blightHound');
    killEnemy(g, e);
    expect(mine(g)).toHaveLength(1);
    expect(mine(g)[0]).toMatchObject({ x: e.x, y: e.y, r: cfg.radius, life: cfg.life, hostile: true, dtype: 'shadow', dps: e.damage * cfg.dps });
    expect(g.vars['plagueGround']).toBe(1);
    const hp = p.hp;
    tick(g, 1);
    expect(p.hp).toBeLessThan(hp);
    p.x += 500; // out of it
    const out = p.hp;
    tick(g, cfg.life - 1.5);
    expect(p.hp).toBe(out);
    expect(mine(g)).toHaveLength(1); // still there
    tick(g, 1);
    expect(mine(g)).toHaveLength(0);
  });

  it('a pack falling in a heap fouls one patch, renewed', () => {
    const g = fight();
    const p = g.player;
    const first = spawnEnemy(g, 'wolf', p.x + 200, p.y);
    killEnemy(g, first);
    tick(g, 5);
    for (let i = 0; i < 4; i++) killEnemy(g, spawnEnemy(g, 'wolf', p.x + 200 + i * 6, p.y + 4));
    expect(mine(g)).toHaveLength(1);
    expect(mine(g)[0].life).toBeCloseTo(cfg.life);
  });

  it('never stands more than its cap at once', () => {
    const g = fight();
    const p = g.player;
    for (let i = 0; i < PLAGUE_GROUND_RULES.cap + 4; i++) killEnemy(g, spawnEnemy(g, 'wolf', p.x + 300 + i * cfg.radius * 2.5, p.y));
    expect(mine(g)).toHaveLength(PLAGUE_GROUND_RULES.cap);
    tick(g, 0.1);
    expect(g.fields.filter((f) => f.plague)).toHaveLength(PLAGUE_GROUND_RULES.cap); // the spent ones are cleared on the next tick
  });

  it('names the plague when it fells the champion', () => {
    const g = fight();
    const p = g.player;
    killEnemy(g, spawnEnemy(g, 'wolf', p.x + 10, p.y));
    p.hp = 0.01;
    g.lastStand = 'used'; // no second chance left
    tick(g, 1);
    expect(g.over).toBe(true);
    expect(g.log.cause).toBe('a Blight Hound\'s plague');
  });

  it('the plain wolf leaves nothing behind', () => {
    const g = fight('marches');
    const e = spawnEnemy(g, 'wolf', g.player.x + 30, g.player.y);
    expect(e.def.id).toBe('wolf');
    killEnemy(g, e);
    expect(g.fields).toHaveLength(0);
  });

  it('brings a flash card of his own', () => {
    expect(CARD_IDS).toContain('blightHound');
    expect(cardInfo('blightHound')).toMatchObject({ name: 'Blight Hound', boss: false });
  });
});
