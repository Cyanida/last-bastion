import { relicDef } from '../src/config/relics';
import { resolveRelicOffer } from '../src/systems/relics';
import { describe, expect, it } from 'vitest';
import { ACT_THEMES, ACTS, FINAL, MERCHANT } from '../src/config/acts';
import { ARENA_IDS } from '../src/config/arenas';
import { CURSE_IDS, CURSES } from '../src/config/curses';
import { ENEMIES } from '../src/config/enemies';
import { createGame, summarizeRun, updateGame } from '../src/game';
import { lockedCurses, unlockedCurses, withAchievements } from '../src/logic/achievements';
import { actOf, arenaFor, bossForWave, dailySetup, formatSeed, hashSeed, isActEnd, merchantPrice, parseSeed, themeFor } from '../src/logic/acts';
import { curseMultiplier, curseValue } from '../src/logic/curses';
import { applyRun, defaultSave } from '../src/logic/save';
import { simulateRun } from '../src/sim/bot';
import { merchantBuy, merchantHeal, merchantReroll, merchantSell, nextAct } from '../src/systems/acts';
import { goldMult, healPlayer } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';

describe('Acts', () => {
  it('ten waves to an Act; the Act ends on its boss wave', () => {
    expect([1, 10, 11, 20, 21].map(actOf)).toEqual([1, 1, 2, 2, 3]);
    expect([9, 10, 15, 20].map(isActEnd)).toEqual([false, true, false, true]);
  });

  it('Act bosses end the Act; mid-Act bosses come from the arena', () => {
    expect(bossForWave(7, 'courtyard')).toBeNull();
    expect(bossForWave(5, 'courtyard')).toBe('blackKnight');
    expect(bossForWave(5, 'graveyard')).toBe('abbot');
    expect(bossForWave(10, 'courtyard')).toBe(ACTS.bosses[0]);
    expect(bossForWave(20, 'keep')).toBe(ACTS.bosses[1]);
    expect(bossForWave(30, 'keep')).toBe(ACTS.bosses[0]);
    for (const id of ACTS.bosses) expect(ENEMIES[id].phases).toBe(3);
  });

  it('every Act moves to the next arena and gets a theme; Act I is always The Levy, Act IV the Last Bastion (v0.6)', () => {
    expect([1, 2, 3, 4, 5].map((a) => arenaFor(a, 'graveyard'))).toEqual(['graveyard', 'keep', 'courtyard', 'bastion', 'graveyard']);
    expect(themeFor(1, 12345)).toBe(ACT_THEMES[0]);
    expect(themeFor(4, 12345)).toBe(FINAL.theme);
    const later = [2, 3, 5, 6].map((a) => themeFor(a, 7).name);
    expect(new Set(later).size).toBe(4); // all four other themes before any repeats
    expect(later).not.toContain(ACT_THEMES[0].name);
  });

  it('in the game: clearing wave 10 calls the Merchant, and leaving him changes the arena', () => {
    const g = createGame('paladin', 11, { arena: 'courtyard' });
    g.wave = 10;
    g.breather = 0;
    g.spawnQueue = [];
    updateGame(g, 1 / 60); // nothing alive, nothing queued: wave 10 is cleared
    expect(g.pendingMerchant).toBe(true);
    const wave = g.wave;
    for (let i = 0; i < 600; i++) updateGame(g, 1 / 60);
    expect(g.wave).toBe(wave); // nothing spawns while he waits
    spawnEnemy(g, 'peasant', 300, 300);
    g.pickups.push({ x: 1, y: 1, value: 40, kind: 'gold' });
    const gold = g.player.gold;
    nextAct(g);
    expect(g.act).toBe(2);
    expect(g.arena.id).toBe('graveyard');
    expect(g.enemies).toHaveLength(0);
    expect(g.player.gold).toBe(gold + 40); // loot on the old field is swept up
    expect(g.player.x).toBe(g.arena.w / 2);
    expect(summarizeRun(g).actsCleared).toBe(1);
  });
});

describe('merchant pricing', () => {
  it('prices come from config and rise per Act', () => {
    expect(merchantPrice('heal', 1)).toBe(MERCHANT.heal.cost);
    expect(merchantPrice('buy:legendary', 1)).toBe(MERCHANT.buy.legendary);
    expect(merchantPrice('reroll', 3)).toBe(Math.round(MERCHANT.reroll * (1 + MERCHANT.priceGrowth * 2)));
    expect(merchantPrice('buy:rare', 2)).toBeGreaterThan(merchantPrice('buy:rare', 1));
    expect(merchantPrice('buy:common', 1)).toBeLessThan(merchantPrice('buy:rare', 1));
  });

  it('spending is real: it leaves the purse, and what is spent is never banked', () => {
    const g = createGame('viking', 3);
    g.player.gold = 500;
    g.player.hp = 10;
    expect(merchantHeal(g)).toBe(true);
    expect(g.player.hp).toBeCloseTo(10 + g.player.stats.hp * MERCHANT.heal.frac);
    expect(merchantBuy(g, 'common')).toBe(true); // v0.7: a relic moment of that rarity, one of three
    expect(g.player.relics.offers.at(-1)).toMatchObject({ from: 'merchant' });
    expect(g.player.relics.offers.at(-1)!.options.every((id) => relicDef(id).rarity === 'common')).toBe(true);
    expect(resolveRelicOffer(g, g.player.relics.offers.at(-1)!.options[0])).toBe(true);
    expect(g.player.relics.held).toHaveLength(1);
    const spent = MERCHANT.heal.cost + MERCHANT.buy.common;
    expect(g.player.gold).toBe(500 - spent);
    expect(g.merchantSpent).toBe(spent);
    expect(summarizeRun(g).gold).toBe(500 - spent);
  });

  it('refuses what cannot be done: no money, full HP, no free slot, nothing to reroll into', () => {
    const g = createGame('viking', 3);
    g.player.gold = 5;
    g.player.hp = 1;
    expect(merchantHeal(g)).toBe(false);
    g.player.gold = 9999;
    g.player.hp = g.player.stats.hp;
    expect(merchantHeal(g)).toBe(false);
    for (let i = 0; i < 2; i++) {
      expect(merchantBuy(g, 'rare')).toBe(true); // v0.4: no cap (a duplicate would be a tier up)
      expect(merchantBuy(g, 'rare')).toBe(false); // v0.7: one relic moment a visit
      expect(resolveRelicOffer(g, g.player.relics.offers[0].options.find((id) => !g.player.relics.held.includes(id))!)).toBe(true);
      g.vars.merchantRelics = 0; // the next visit
    }
    const before = g.player.relics.held[0];
    expect(merchantReroll(g, before)).toBe(true);
    expect(g.player.relics.held).toHaveLength(2);
    expect(g.player.relics.held).not.toContain(before);
    expect(merchantReroll(g, 'reliquary')).toBe(false); // not held
    expect(merchantSell(g, g.player.relics.held[0])).toBe(true);
    expect(g.player.relics.held).toHaveLength(1);
  });
});

describe('curse multipliers', () => {
  it('bonuses add up, duplicates count once, no curses is x1', () => {
    expect(curseMultiplier([])).toBe(1);
    expect(curseMultiplier(['ironHorde'])).toBeCloseTo(1 + CURSES.ironHorde.bonus);
    expect(curseMultiplier(['ironHorde', 'swarm', 'ironHorde'])).toBeCloseTo(1 + CURSES.ironHorde.bonus + CURSES.swarm.bonus);
    expect(curseMultiplier(CURSE_IDS)).toBeGreaterThan(2);
    expect(curseValue(['frenzy'], 'frenzy', 'speed')).toBe(CURSES.frenzy.n.speed);
    expect(curseValue([], 'frenzy', 'speed')).toBe(1);
  });

  it('curses change the run: tougher enemies, more damage taken, no healing between waves, more gold', () => {
    const plain = createGame('paladin', 5);
    const cursed = createGame('paladin', 5, { curses: ['ironHorde', 'glassBones', 'noRespite'] });
    expect(spawnEnemy(cursed, 'peasant', 1, 1).maxHp).toBeGreaterThan(spawnEnemy(plain, 'peasant', 1, 1).maxHp);
    expect(cursed.vars.damageTaken).toBe(CURSES.glassBones.n.damage);
    expect(goldMult(cursed)).toBeCloseTo(goldMult(plain) * curseMultiplier(cursed.curses));
    cursed.wave = 3;
    cursed.breather = 2;
    cursed.player.hp = 50;
    healPlayer(cursed, cursed.player, 30);
    expect(cursed.player.hp).toBe(50);
    cursed.breather = 0;
    healPlayer(cursed, cursed.player, 30);
    expect(cursed.player.hp).toBe(80);
  });

  it('class XP is multiplied too, and curses unlock through achievements', () => {
    const run = { classId: 'archer' as const, tier: 0, wave: 8, wavesCleared: 7, kills: 90, time: 300, level: 8, gold: 100, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 1, wave10Time: 0 };
    const plain = applyRun(defaultSave(), run).classXp;
    expect(applyRun(defaultSave(), { ...run, curses: ['swarm', 'frenzy'] }).classXp).toBe(Math.round(plain * curseMultiplier(['swarm', 'frenzy'])));
    expect(unlockedCurses(defaultSave())).toEqual([]);
    expect(lockedCurses(defaultSave())).toHaveLength(CURSE_IDS.length); // every curse has an achievement behind it
    const after = withAchievements(applyRun(defaultSave(), { ...run, kills: 150, actsCleared: 1, wave: 11, wavesCleared: 10 }).save).save;
    expect(unlockedCurses(after)).toEqual(expect.arrayContaining(['ironHorde', 'timedWaves', 'noRespite']));
  });
});

describe('seeds and the Daily Trial', () => {
  it('seed codes round-trip, words hash, empty means random', () => {
    expect(parseSeed(formatSeed(123456789))).toBe(123456789);
    expect(parseSeed('  ')).toBeNull();
    expect(parseSeed('for the king!')).toBe(hashSeed('for the king!'));
    expect(parseSeed('zzzzzzzzzzzz')).toBe(hashSeed('zzzzzzzzzzzz')); // too big for a code: treated as a word
  });

  it('the same date gives everyone the same trial; another date differs', () => {
    const a = dailySetup('2026-09-22');
    expect(dailySetup('2026-09-22')).toEqual(a);
    expect(a.curses).toHaveLength(2);
    expect(new Set(a.curses).size).toBe(2);
    expect(ARENA_IDS).toContain(a.arena);
    const days = Array.from({ length: 20 }, (_, i) => dailySetup(`2026-10-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(days.map((d) => d.seed)).size).toBe(20);
    expect(new Set(days.map((d) => d.classId)).size).toBeGreaterThan(2);
  });

  it('a seeded run replays identically, and the daily best is kept per day', { timeout: 30000 }, () => {
    const a = simulateRun('paladin', 4242, {}, 0, 200);
    expect(simulateRun('paladin', 4242, {}, 0, 200)).toEqual(a);
    expect(a.seed).toBe(4242);
    const day = dailySetup('2026-09-22');
    const run = { ...a, classId: day.classId, daily: day.date, wave: 9 };
    let save = applyRun(defaultSave(), run).save;
    save = applyRun(save, { ...run, wave: 6 }).save;
    expect(save.daily[day.date]).toBe(9);
    expect(save.counters.dailies).toBe(2);
  });
});
