import { describe, expect, it } from 'vitest';
import { CLASS_ORDER, CLASSES, type Cfg } from '../src/config/classes';
import { ENEMIES } from '../src/config/enemies';
import { GAME } from '../src/config/game';
import { UPGRADES } from '../src/config/upgrades';
import { WAVES } from '../src/config/waves';
import { mulberry32 } from '../src/core/math';
import { SpatialHash } from '../src/core/spatial';
import { STAT_KEYS } from '../src/core/types';
import * as ability from '../src/logic/abilities';
import { abilityCooldown, applyGrowth, attackDamage, critChance, enemyDmgMult, enemyHpMult, mitigate, rollCrit, xpToNext } from '../src/logic/formulas';
import { applyStatUpgrade, rollUpgrades, upgradeText } from '../src/logic/upgrades';
import { enemyCount, generateWave, isBossWave } from '../src/logic/waves';
import { SPRITES } from '../src/render/sprites';

describe('damage formulas', () => {
  it('scales linearly with the attack stat', () => {
    expect(attackDamage(10, 0)).toBe(10);
    expect(attackDamage(10, 10)).toBeCloseTo(10 * (1 + 10 * GAME.statDamageScale));
    expect(attackDamage(10, 10, 1.5)).toBeCloseTo(attackDamage(10, 10) * 1.5);
  });

  it('crit chance grows with dexterity and is capped', () => {
    expect(critChance(0)).toBe(GAME.baseCrit);
    expect(critChance(20)).toBeGreaterThan(critChance(10));
    expect(critChance(10_000)).toBe(GAME.critCap);
  });

  it('rollCrit multiplies on a crit and only on a crit', () => {
    expect(rollCrit(10, 0, () => 0)).toEqual({ amount: 10 * GAME.critMult, crit: true });
    expect(rollCrit(10, 0, () => 0.999)).toEqual({ amount: 10, crit: false });
  });

  it('intelligence shortens cooldowns down to a floor', () => {
    expect(abilityCooldown(10, 0)).toBe(10);
    expect(abilityCooldown(10, 20)).toBeLessThan(abilityCooldown(10, 10));
    expect(abilityCooldown(10, 1e6)).toBe(10 * GAME.cdrFloor);
  });

  it('armor mitigates but never below 1', () => {
    expect(mitigate(100, 0.4)).toBe(60);
    expect(mitigate(1, 0.9)).toBe(1);
  });
});

describe('stat scaling', () => {
  it('xp curve strictly increases', () => {
    for (let l = 1; l < 60; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('growth adds per-level values without mutating', () => {
    const c = CLASSES.paladin;
    const grown = applyGrowth(c.base, c.growth);
    expect(grown.hp).toBe(c.base.hp + c.growth.hp);
    expect(c.base.hp).toBe(CLASSES.paladin.base.hp);
  });

  it('every class defines all seven stats and the classes are actually different', () => {
    for (const id of CLASS_ORDER) for (const k of STAT_KEYS) expect(CLASSES[id].base[k]).toBeGreaterThan(0);
    expect(CLASSES.paladin.base.hp).toBeGreaterThan(CLASSES.archer.base.hp * 1.5);
    expect(CLASSES.archer.base.moveSpd).toBeGreaterThan(CLASSES.paladin.base.moveSpd);
  });

  it('every signature ability gets stronger with its secondary stat', () => {
    const lo = 5;
    const hi = 15;

    const shield = CLASSES.paladin.ability as Cfg<'divineShield'>;
    expect(ability.divineShield(shield, hi).duration).toBeGreaterThan(ability.divineShield(shield, lo).duration);
    expect(ability.divineShield(shield, hi).burstDamage).toBeGreaterThan(ability.divineShield(shield, lo).burstDamage);

    const rage = CLASSES.viking.ability as Cfg<'berserkerRage'>;
    expect(ability.berserkerRage(rage, hi, 1).damage).toBeGreaterThan(ability.berserkerRage(rage, lo, 1).damage);
    expect(ability.berserkerRage(rage, hi, 1).duration).toBeGreaterThan(ability.berserkerRage(rage, lo, 1).duration);
    // ...and with missing HP
    expect(ability.berserkerRage(rage, lo, 0.2).atkSpd).toBeGreaterThan(ability.berserkerRage(rage, lo, 1).atkSpd);
    expect(ability.berserkerRage(rage, lo, 0.2).lifesteal).toBeGreaterThan(ability.berserkerRage(rage, lo, 1).lifesteal);

    const rad = CLASSES.angel.ability as Cfg<'heavenlyRadiance'>;
    expect(ability.heavenlyRadiance(rad, hi).radius).toBeGreaterThan(ability.heavenlyRadiance(rad, lo).radius);
    expect(ability.heavenlyRadiance(rad, hi).heal).toBeGreaterThan(ability.heavenlyRadiance(rad, lo).heal);

    const dead = CLASSES.necromancer.ability as Cfg<'raiseDead'>;
    expect(ability.raiseDead(dead, hi).maxMinions).toBeGreaterThan(ability.raiseDead(dead, lo).maxMinions);
    expect(ability.raiseDead(dead, hi).damage).toBeGreaterThan(ability.raiseDead(dead, lo).damage);
    expect(ability.raiseDead(dead, hi).lifetime).toBeGreaterThan(ability.raiseDead(dead, lo).lifetime);

    const volley = CLASSES.archer.ability as Cfg<'arrowVolley'>;
    expect(ability.arrowVolley(volley, hi).arrows).toBeGreaterThan(ability.arrowVolley(volley, lo).arrows);
    expect(ability.arrowVolley(volley, hi).pierce).toBeGreaterThan(ability.arrowVolley(volley, lo).pierce);
  });
});

describe('wave generation', () => {
  const rng = () => mulberry32(42);

  it('wave 1 is only the basic chaser', () => {
    expect(new Set(generateWave(1, rng()).spawns)).toEqual(new Set(['peasant']));
  });

  it('never spawns a type before its unlock wave, and eventually spawns all of them', () => {
    const seen = new Set<string>();
    for (let w = 1; w <= 30; w++) {
      const plan = generateWave(w, mulberry32(w));
      for (const id of plan.spawns) {
        seen.add(id);
        const rule = WAVES.pool.find((p) => p.id === id);
        if (rule) expect(w).toBeGreaterThanOrEqual(rule.from);
      }
    }
    for (const p of WAVES.pool) expect(seen.has(p.id)).toBe(true);
  });

  it('every 5th wave is a boss wave, bosses cycle, and it never stops', () => {
    expect(generateWave(4, rng()).boss).toBeNull();
    expect(generateWave(5, rng()).boss).toBe('blackKnight');
    expect(generateWave(10, rng()).boss).toBe('warlord');
    expect(generateWave(15, rng()).boss).toBe('lich');
    expect(generateWave(20, rng()).boss).toBe('blackKnight');
    const far = generateWave(500, rng());
    expect(far.boss).not.toBeNull();
    expect(far.spawns[0]).toBe(far.boss);
    expect(ENEMIES[far.boss!].boss).toBe(true);
  });

  it('count, hp and damage scale up with the wave', () => {
    for (let w = 1; w < 40; w++) {
      if (!isBossWave(w) && !isBossWave(w + 1)) expect(enemyCount(w + 1)).toBeGreaterThan(enemyCount(w));
      expect(enemyHpMult(w + 1)).toBeGreaterThan(enemyHpMult(w));
      expect(enemyDmgMult(w + 1)).toBeGreaterThan(enemyDmgMult(w));
    }
    expect(enemyHpMult(1)).toBe(1);
    expect(enemyCount(9)).toBeGreaterThan(50); // Act I ramps the count up... (v0.4: later Acts scale stats and composition instead, so wave 31 alone is no longer 200+)
    expect(enemyCount(31)).toBeGreaterThan(enemyCount(10)); // ...and it still creeps up afterwards
    expect(enemyCount(5)).toBeLessThan(enemyCount(4)); // boss waves bring a smaller escort
  });

  it('is deterministic for a seed and spawns the whole wave within the time budget', () => {
    expect(generateWave(12, mulberry32(7))).toEqual(generateWave(12, mulberry32(7)));
    const plan = generateWave(40, rng());
    expect(plan.spawnInterval * plan.spawns.length).toBeLessThanOrEqual(WAVES.spawn.maxDuration + 1e-9);
  });
});

describe('level-up pool', () => {
  it('offers 3 distinct, valid options', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const picks = rollUpgrades(rng);
      expect(picks).toHaveLength(3);
      expect(new Set(picks).size).toBe(3);
      for (const k of picks) expect(STAT_KEYS).toContain(k);
    }
  });

  it('the secondary stat is in the pool and is labelled per class', () => {
    const rng = mulberry32(2);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) rollUpgrades(rng).forEach((k) => seen.add(k));
    expect(seen).toEqual(new Set(STAT_KEYS));
    expect(upgradeText('secondary', CLASSES.paladin).title).toBe('Faith');
    expect(upgradeText('secondary', CLASSES.archer).title).toBe('Focus');
    expect(new Set(CLASS_ORDER.map((id) => CLASSES[id].secondary.name)).size).toBe(5);
  });

  it('applies add and mult upgrades without mutating', () => {
    const base = CLASSES.viking.base;
    expect(applyStatUpgrade(base, 'str').str).toBe(base.str + UPGRADES.str.amount);
    expect(applyStatUpgrade(base, 'atkSpd').atkSpd).toBeCloseTo(base.atkSpd * UPGRADES.atkSpd.amount);
    expect(base.str).toBe(CLASSES.viking.base.str);
  });
});

describe('spatial hash', () => {
  it('matches a brute-force circle query', () => {
    const rng = mulberry32(9);
    const items = Array.from({ length: 400 }, () => ({ x: rng() * 2000, y: rng() * 1400, r: 8 + rng() * 22 }));
    const hash = new SpatialHash<(typeof items)[number]>(64);
    items.forEach((i) => hash.insert(i));
    for (let q = 0; q < 50; q++) {
      const x = rng() * 2000;
      const y = rng() * 1400;
      const r = rng() * 200;
      const brute = items.filter((i) => Math.hypot(i.x - x, i.y - y) <= r + i.r);
      expect(new Set(hash.query(x, y, r, []))).toEqual(new Set(brute));
    }
  });
});

describe('sprite data', () => {
  it('every sprite is a rectangle', () => {
    for (const [id, rows] of Object.entries(SPRITES)) {
      for (const row of rows) expect(row.length, `${id}: "${row}"`).toBe(rows[0].length);
    }
  });
});
