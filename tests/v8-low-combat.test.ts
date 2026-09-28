import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/config/enemies';
import { TIERS } from '../src/config/economy';
import type { Game } from '../src/core/types';
import { createGame } from '../src/game';
import { updateAbility } from '../src/systems/abilities';
import { shootAt } from '../src/systems/aiHelpers';
import { addField } from '../src/entities/hazards';
import { killEnemy, updateFields, updateProjectiles } from '../src/systems/combat';
import { SPECIALS } from '../src/systems/specials';
import { spawnEnemy } from '../src/systems/spawning';

function stage(tier = 0): Game {
  const g = createGame('paladin', 7, { tier });
  g.pendingBoard = false;
  g.breather = 1e9;
  g.player.attackTimer = 1e9;
  return g;
}

describe('the remaining low combat items of the 28-09 check (#182)', () => {
  it("the plague doctor's pool and its poison follow the difficulty tier", () => {
    const g = stage(3);
    const doc = spawnEnemy(g, 'plagueDoctor', g.player.x + 200, g.player.y);
    SPECIALS.plague(g, doc, g.player, 1 / 60);
    const pool = g.zones.at(-1)!.leaveField!;
    const mult = g.waveDmgMult * TIERS[3].enemyDmg;
    expect(pool.dps).toBeCloseTo(ENEMIES.plagueDoctor.poolDps! * mult);
    expect(pool.apply!.power).toBeCloseTo(ENEMIES.plagueDoctor.poolDps! * 0.5 * mult);
  });

  it("a priest's heal follows the difficulty tier, as the HP it mends does", () => {
    const g = stage(3);
    const priest = spawnEnemy(g, 'priest', g.player.x + 200, g.player.y);
    const hurt = spawnEnemy(g, 'knight', priest.x + 20, priest.y);
    hurt.hp = 1;
    g.hash.clear();
    for (const e of g.enemies) g.hash.insert(e);
    SPECIALS.heal(g, priest, g.player, 1 / 60);
    expect(hurt.hp).toBeCloseTo(1 + ENEMIES.priest.healAmount! * g.waveHpMult * TIERS[3].enemyHp);
  });

  it("an enemy's bolt is its own: the Abbot's poisons, even after he falls", () => {
    const g = stage();
    const abbot = spawnEnemy(g, 'abbot', g.player.x + 120, g.player.y);
    shootAt(g, abbot, Math.PI);
    expect(g.projectiles.at(-1)!.owner).toBe(abbot);
    abbot.dead = true; // the shot is already in the air
    for (let i = 0; i < 120 && g.projectiles.length; i++) updateProjectiles(g, 1 / 60);
    expect(g.player.hp).toBeLessThan(g.player.stats.hp);
    expect(g.player.statuses.poison).toBeTruthy();
  });

  it('a burning field only sets you alight when its damage gets through, as a blow does', () => {
    for (const shielded of [true, false]) {
      const g = stage();
      const p = g.player;
      p.invulnerable = shielded; // Divine Shield
      addField(g, { x: p.x, y: p.y, r: 80, life: 5, dps: 10, hostile: true, color: '#e07b28', dtype: 'fire', apply: { id: 'burn', power: 4 } });
      updateFields(g, 1 / 60);
      expect(!!p.statuses.burn).toBe(!shielded);
    }
  });

  it("a side elite's split copies are side content too, and do not hold the wave open", () => {
    const g = stage();
    const e = spawnEnemy(g, 'knight', g.player.x + 300, g.player.y, ['splitting']);
    e.side = true; // a lair's sleeper, a quest's named elite, a cursed chest's guard
    killEnemy(g, e);
    const kids = g.enemies.filter((c) => c !== e && c.def.id === 'knight');
    expect(kids.length).toBeGreaterThan(0);
    expect(kids.every((c) => c.side)).toBe(true);
  });

  it('the Aegis of Dawn dome lasts exactly as long as the shield: stretched with it, gone with an early detonation', () => {
    const g = stage();
    g.evolutions = ['aegisOfDawn'];
    const press = (on: boolean) => ((g.input.ability = on), updateAbility(g, 1 / 60));
    press(true);
    const dome = () => g.fields.find((f) => f.follow);
    expect(dome()).toBeTruthy();
    g.player.abilityTime += 3; // Sanctuary holding the shield up longer
    press(false);
    expect(dome()!.life).toBeCloseTo(g.player.abilityTime);
    press(true); // detonate early
    expect(g.player.abilityTime).toBe(0);
    expect(dome()).toBeUndefined();
  });
});
