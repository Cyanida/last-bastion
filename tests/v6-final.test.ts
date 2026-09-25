import { describe, expect, it, onTestFinished } from 'vitest';
import { ACHIEVEMENTS } from '../src/config/achievements';
import { FINAL } from '../src/config/acts';
import { ARENA_IDS, ARENAS } from '../src/config/arenas';
import { BOSS_RESOLVE } from '../src/config/damage';
import { VICTORY } from '../src/config/economy';
import type { Game } from '../src/core/types';
import { createGame, summarizeRun, updateGame } from '../src/game';
import { earnedTier, withAchievements } from '../src/logic/achievements';
import { arenaFor, bossForWave } from '../src/logic/acts';
import { inRect } from '../src/logic/regions';
import { applyRun, defaultSave, migrate, type RunSummary } from '../src/logic/save';
import { damageEnemy, killEnemy, nearestEnemy } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/spawning';
import { endlessScore, goEndless } from '../src/systems/victory';

const DT = 1 / 60;
/** v0.7.5 (#95): these blows test phases, not a boss's resolve: it is off for the one test. */
const noResolve = () => {
  const keep = { ...BOSS_RESOLVE };
  Object.assign(BOSS_RESOLVE, { burst: Infinity, cap: Infinity });
  onTestFinished(() => void Object.assign(BOSS_RESOLVE, keep));
};
const tick = (g: Game, n = 1) => {
  for (let i = 0; i < n; i++) updateGame(g, DT);
};

/** A game in the Last Bastion with the waves held back, and the Usurper on the field. */
function throneRoom(): { g: Game; u: ReturnType<typeof spawnEnemy> } {
  const g = createGame('viking', 9, { arena: 'bastion' });
  g.breather = 1e9; // no waves: just him
  g.player.invulnT = 1e9;
  const u = spawnEnemy(g, FINAL.boss, g.player.x, g.player.y - 300);
  return { g, u };
}

describe('the final Act (v0.6)', () => {
  it('Act IV is the Last Bastion and its last wave is the Usurper; it is never a starting arena', () => {
    expect(arenaFor(FINAL.act, 'courtyard')).toBe('bastion');
    expect(bossForWave(40, 'bastion')).toBe('usurper');
    expect(bossForWave(35, 'bastion')).toBe(ARENAS.bastion.bosses[(FINAL.act - 1) % 3]);
    expect(ARENA_IDS).not.toContain('bastion');
  });

  it('the throne and the Royal Flames stand on the open floor of the hall, clear of the pillars', () => {
    const def = ARENAS.bastion;
    const core = def.regions!.find((r) => r.id === 'core')!.floor;
    const spots = [def.final!.throne, ...def.final!.flames];
    expect(def.final!.flames).toHaveLength(3);
    for (const s of spots) expect(inRect(core, s.x, s.y)).toBe(true);
    for (const f of def.final!.flames) for (const o of def.obstacles) expect(Math.hypot(o.x - f.x, o.y - f.y)).toBeGreaterThan(o.r + 40);
  });

  it('phase 2: he hides behind a ward that nothing can pierce until every Royal Flame is out', () => {
    const { g, u } = throneRoom();
    u.hp = u.maxHp * 0.1; // one huge blow straight past the first threshold...
    tick(g, 2);
    expect(u.phase).toBe(2);
    expect(u.warded).toBe(true);
    expect(u.hp).toBeCloseTo(u.maxHp * 0.34); // ...is caught by the ward: phase 3 has to be earned
    const flames = g.enemies.filter((e) => e.def.id === 'royalFlame');
    expect(flames).toHaveLength(3);
    expect(damageEnemy(g, u, 1e6)).toBe(0);
    expect(u.hp).toBeCloseTo(u.maxHp * 0.34);
    expect(nearestEnemy(g, u.x, u.y, 50)).not.toBe(u); // auto-attacks go for something that can be hurt
    for (const f of flames.slice(0, 2)) killEnemy(g, f);
    tick(g, 2);
    expect(u.warded).toBe(true); // one still burns
    killEnemy(g, flames[2]);
    tick(g, 2);
    expect(u.warded).toBe(false);
    expect(damageEnemy(g, u, 100)).toBeGreaterThan(0);
    // each step is a beat in the run log (the pacing rule counts them)
    expect(g.log.marks.filter((m) => m[1] === 'phase').map((m) => m[2])).toEqual(['The Usurper: phase 2', 'A Royal Flame is out (1 left)', 'A Royal Flame is out (0 left)']);
  });

  it('a phase runs its minimum time: until then his HP holds at the threshold, and in phase 3 he cannot fall', () => {
    noResolve();
    const { g, u } = throneRoom();
    tick(g, 1);
    damageEnemy(g, u, 1e9);
    expect(u.dead).toBe(false);
    expect(u.hp).toBeGreaterThan(u.maxHp * (2 / 3)); // held above the phase-2 threshold
    tick(g, 2);
    expect(u.phase).toBe(1);
    tick(g, Math.ceil(FINAL.usurper.minPhase[0] * 60));
    damageEnemy(g, u, u.maxHp * 0.1);
    tick(g, 2);
    expect(u.phase).toBe(2); // the time is up: the blow goes through
    for (const f of g.enemies.filter((e) => e.def.id === 'royalFlame')) killEnemy(g, f);
    tick(g, 2);
    damageEnemy(g, u, u.maxHp * 0.3); // from about 57% to below a third
    tick(g, 2);
    expect(u.phase).toBe(3);
    damageEnemy(g, u, 1e9);
    expect(u.dead).toBe(false);
    expect(u.hp).toBe(1);
    tick(g, Math.ceil(FINAL.usurper.minPhase[2] * 60));
    damageEnemy(g, u, 1e9);
    expect(u.dead).toBe(true);
    expect(g.victory).toBe('pending');
  });

  it('his fall wins the run: his host breaks, nothing more comes, and the choice is up', () => {
    const { g, u } = throneRoom();
    const guard = spawnEnemy(g, 'knight', g.player.x + 200, g.player.y);
    const quest = spawnEnemy(g, 'peasant', g.player.x - 200, g.player.y);
    quest.side = true;
    g.spawnQueue.push({ id: 'peasant', affixes: [], squad: -1 } as never);
    killEnemy(g, u);
    expect(g.victory).toBe('pending');
    expect(guard.dead).toBe(true);
    expect(quest.dead).toBe(false); // side content is not his host
    expect(g.spawnQueue).toHaveLength(0);
    const run = summarizeRun(g);
    expect(run.won).toBe(true);
    expect(run.log!.end).toBe('won');
    expect(run.endlessScore).toBe(0);
    goEndless(g);
    expect(g.victory).toBe('endless');
    g.wavesCleared = 43;
    g.kills += 25;
    expect(endlessScore(g)).toBe(3 * VICTORY.scorePerWave + 25);
    expect(summarizeRun(g).log!.won).toBe(true);
  });
});

describe('what a win pays (v0.6)', () => {
  const run: RunSummary = { classId: 'angel', tier: 0, wave: 40, wavesCleared: 40, kills: 3000, time: 2100, level: 33, gold: 900, bosses: [], elites: 20, flawlessBosses: 0, relics: [], abilityUpgrades: 3, wave10Time: 300 };

  it('the first win with a class pays the most, later ones less, and both count', () => {
    const lost = applyRun(defaultSave(), run, 'd');
    const first = applyRun(defaultSave(), { ...run, won: true }, 'd');
    expect(first.firstWin).toBe(true);
    expect(first.runes - lost.runes).toBe(VICTORY.win.runes + VICTORY.firstWin.runes);
    expect(first.gold - lost.gold).toBe(VICTORY.firstWin.gold);
    expect(first.classXp - lost.classXp).toBe(VICTORY.win.classXp + VICTORY.firstWin.classXp);
    expect(first.save.wins.angel).toBe(1);
    const second = applyRun(first.save, { ...run, won: true }, 'd');
    expect(second.firstWin).toBe(false);
    expect(second.runes - applyRun(first.save, run, 'd').runes).toBe(VICTORY.win.runes);
    expect(second.save.wins.angel).toBe(2);
    expect(applyRun(second.save, { ...run, classId: 'archer', won: true }, 'd').firstWin).toBe(true); // per class
  });

  it('wins earn Kingslayer and count toward Five Crowns', () => {
    const save = withAchievements(applyRun(defaultSave(), { ...run, won: true }, 'd').save).save;
    expect(earnedTier(save, 'usurper')).toBe(1);
    expect(save.titles).toContain('Kingslayer');
    expect(ACHIEVEMENTS.find((a) => a.id === 'crowns')!.progress(save)).toBe(1);
  });

  it('Endless keeps each class’s best scores, best first, and the save keeps them', () => {
    let save = defaultSave();
    const ranks: number[] = [];
    for (const score of [300, 900, 100, 500, 700, 800, 50]) {
      const r = applyRun(save, { ...run, won: true, endlessScore: score }, 'd');
      ranks.push(r.endlessRank);
      save = r.save;
    }
    expect(save.endless.angel.map((e) => e.score)).toEqual([900, 800, 700, 500, 300]);
    expect(ranks).toEqual([1, 1, 3, 2, 2, 2, 0]); // 50 did not make the board
    expect(save.endless.archer).toEqual([]);
    const back = migrate(JSON.parse(JSON.stringify({ ...save, endless: { ...save.endless, angel: [...save.endless.angel, { score: -3 }, 'x'] } })));
    expect(back.endless.angel).toEqual(save.endless.angel);
    expect(back.wins).toEqual(save.wins);
    expect(migrate({ ...JSON.parse(JSON.stringify(save)), wins: undefined, endless: undefined }).wins.angel).toBe(0); // a v0.5 save
  });
});
