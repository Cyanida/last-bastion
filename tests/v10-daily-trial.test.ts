import { describe, expect, it } from 'vitest';
import { MASTERY } from '../src/config/economy';
import { REALMS, WORLD } from '../src/config/world';
import { createGame } from '../src/game';
import { dailySetup } from '../src/logic/acts';
import { newChampion } from '../src/logic/champions';
import { dailyOpen, dailyOpensText, startRelicGifts } from '../src/logic/daily';
import { relicPoolFor } from '../src/logic/relics';
import { recordClear, type WorldProgress } from '../src/logic/world';

const crown = (tier: number, upTo = REALMS.marches.levels.length): WorldProgress =>
  Array.from({ length: upTo }, (_, i) => i + 1).reduce((p, n) => recordClear(p, 'marches', n, tier), {} as WorldProgress);
const champ = (world: WorldProgress) => ({ ...newChampion('viking'), world });

describe('the Daily Trial opens with the Marches crown (#204, rule 6)', () => {
  it('shut on a new save and while the Marches are not crowned', () => {
    expect(WORLD.daily.opensWith).toBe('marches');
    expect(dailyOpen({ champions: {}, daily: {} })).toBe(false);
    expect(dailyOpen({ champions: { viking: champ(crown(0, REALMS.marches.levels.length - 1)) }, daily: {} })).toBe(false);
  });

  it('open once any champion holds the crown, on any tier', () => {
    expect(dailyOpen({ champions: { viking: champ(crown(0)) }, daily: {} })).toBe(true);
    expect(dailyOpen({ champions: { angel: { ...newChampion('angel'), world: crown(1) } }, daily: {} })).toBe(true); // a Knight crown counts too
  });

  it('a save that already took a trial keeps it open', () => {
    expect(dailyOpen({ champions: {}, daily: { '2026-09-01': 12 } })).toBe(true);
  });

  it('says what opens it', () => {
    expect(dailyOpensText()).toBe('Opens with the Marches crown');
  });
});

describe('the Daily Trial: the fixed pool and no loadout (#204)', () => {
  const keepsake = MASTERY[MASTERY.findIndex((r) => r.reward.kind === 'relic')].xp;
  const day = dailySetup('2026-09-29');

  it("today's 40-wave run: every relic its class may find, nothing slotted, no level", () => {
    const g = createGame(day.classId, day.seed, { daily: day.date, arena: day.arena, curses: day.curses });
    expect(g.player.relics.pool).toEqual(relicPoolFor(day.classId));
    expect(g.player.relics.held).toEqual([]);
    expect(g.level).toBeFalsy();
    expect(g.daily).toBe(day.date);
  });

  it("no Armorer's offer and no Keepsake common: they are slots now, and a trial has none", () => {
    const opts = { meta: { startRelic: 1 }, classXp: keepsake };
    const trial = createGame(day.classId, day.seed, { ...opts, daily: day.date });
    expect(trial.player.relics.offers).toEqual([]);
    expect(trial.player.relics.held).toEqual([]);
    const plain = createGame(day.classId, day.seed, opts); // a run with neither (the sims) keeps both, as before
    expect(plain.player.relics.offers.length).toBe(1);
    expect(plain.player.relics.held.length).toBe(1);
  });

  it('the start gifts: only outside a level and outside a trial', () => {
    expect(startRelicGifts({ level: false, daily: false })).toBe(true);
    expect(startRelicGifts({ level: true, daily: false })).toBe(false);
    expect(startRelicGifts({ level: false, daily: true })).toBe(WORLD.daily.startRelics);
  });
});
