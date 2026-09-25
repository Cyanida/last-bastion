import { describe, expect, it } from 'vitest';
import { EVOLUTIONS } from '../src/config/evolutions';
import { ACTS } from '../src/config/acts';
import { ATTUNEMENT, RELIC_MAX_TIER, type RelicId } from '../src/config/relics';
import { addListener, emit } from '../src/core/events';
import type { Game } from '../src/core/types';
import { createGame, updateGame } from '../src/game';
import { requirementMet, requirementText } from '../src/logic/evolutions';
import { addField, fireProjectile } from '../src/entities/hazards';
import { damageEnemy, healPlayer, killEnemy } from '../src/systems/combat';
import { relicContext } from '../src/systems/relicContext';
import { credit, raiseSkeleton } from '../src/systems/relicCore';
import { addRelic, updateRelics } from '../src/systems/relics';
import { buildState } from '../src/systems/evolutions';
import { spawnEnemy } from '../src/systems/spawning';

function game(relics: RelicId[]): Game {
  const g = createGame('necromancer', 1);
  for (const id of relics) addRelic(g, id);
  g.vars.waveDealtRef = 1000;
  return g;
}
const tick = (g: Game) => {
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
};
const att = (g: Game, id: RelicId) => g.player.relics.attune[id] ?? 0;

describe('attunement (v0.7 A4)', () => {
  it('work attunes the relic that did it: damage as a share of a wave, healing and prevention in max HP, skeletons raised', () => {
    const g = game(['frostBrand', 'rallyBanner', 'towerShield', 'gravePact']);
    const p = g.player;
    credit(g, p, 'frostBrand', 'damage', 50);
    expect(att(g, 'frostBrand')).toBeCloseTo(0.05 * ATTUNEMENT.damage);
    credit(g, p, 'rallyBanner', 'healing', p.stats.hp * 0.1);
    expect(att(g, 'rallyBanner')).toBeCloseTo(0.1 * ATTUNEMENT.support);
    credit(g, p, 'towerShield', 'prevented', p.stats.hp * 0.1);
    expect(att(g, 'towerShield')).toBeCloseTo(0.1 * ATTUNEMENT.support);
    raiseSkeleton(g, p, p.x, p.y, 'gravePact', { hp: 10, damage: 1, life: 5 });
    expect(att(g, 'gravePact')).toBeCloseTo(ATTUNEMENT.summon);
    expect(att(g, 'thornMail' as RelicId)).toBe(0); // not held: nothing
  });

  it("utility is work too: a status the relic puts on an enemy, the ward it gives, Blessed Water's share of a heal", () => {
    const g = game(['hexDoll', 'guardiansAegis', 'blessedWater']);
    const p = g.player;
    const e = spawnEnemy(g, 'knight', p.x + 300, p.y);
    damageEnemy(g, e, 1, false, 0, 0, 'ability'); // Hex Doll curses what the ability hits
    expect(e.statuses.curse).toBeTruthy();
    expect(att(g, 'hexDoll')).toBeCloseTo(ATTUNEMENT.proc);
    g.player.vars['aegis.t'] = 99;
    tick(g); // Guardian's Aegis: ward now
    expect(p.ward).toBeGreaterThan(0);
    expect(att(g, 'guardiansAegis')).toBeCloseTo((ATTUNEMENT.support * p.ward) / p.stats.hp);
    p.hp = p.stats.hp / 2;
    healPlayer(g, 30, false);
    expect(g.player.relics.stats.blessedWater!.healing).toBeGreaterThan(0);
    expect(att(g, 'blessedWater')).toBeGreaterThan(0);
  });

  it("a bolt or a field a relic leaves behind stays that relic's work", () => {
    const g = game(['seraphHalo']);
    relicContext.acting = 'seraphHalo';
    fireProjectile(g, 0, 0, 0, { damage: 1, crit: false, hostile: false, pierce: 0, shape: 'orb', color: '#fff', r: 5, speed: 100, range: 100, source: 'relic' });
    addField(g, { x: 0, y: 0, r: 10, life: 1, dps: 1, hostile: false, color: '#fff' });
    relicContext.acting = null;
    fireProjectile(g, 0, 0, 0, { damage: 1, crit: false, hostile: false, pierce: 0, shape: 'orb', color: '#fff', r: 5, speed: 100, range: 100 });
    expect(g.projectiles.map((pr) => pr.by)).toEqual(['seraphHalo', undefined]);
    expect(g.fields.at(-1)!.by).toBe('seraphHalo');
  });

  it('work counts up to a cap a wave; a new wave opens it again', () => {
    const g = game(['frostBrand']);
    credit(g, g.player, 'frostBrand', 'damage', 1e6);
    expect(att(g, 'frostBrand')).toBeCloseTo(ATTUNEMENT.workCap);
    emit(g, 'onWaveStart', { wave: 2 });
    credit(g, g.player, 'frostBrand', 'damage', 1e6);
    expect(att(g, 'frostBrand')).toBeCloseTo(2 * ATTUNEMENT.workCap);
  });

  it('every held relic gains a little per wave cleared and per elite killed', () => {
    const g = game(['frostBrand', 'rallyBanner']);
    g.vars.dealt = 3000;
    g.vars.dealtAtWave = 1000;
    emit(g, 'onWaveCleared', { wave: 1 });
    expect(att(g, 'frostBrand')).toBeCloseTo(ATTUNEMENT.wave);
    expect(att(g, 'rallyBanner')).toBeCloseTo(ATTUNEMENT.wave);
    expect(g.vars.waveDealtRef).toBe(2000); // the next wave's damage is measured against this one
    const elite = spawnEnemy(g, 'knight', g.player.x + 300, g.player.y);
    elite.elite = true;
    elite.affixes = ['swift'];
    killEnemy(g, elite);
    expect(att(g, 'rallyBanner')).toBeCloseTo(ATTUNEMENT.wave + ATTUNEMENT.elite);
  });

  it('a full bar raises the tier (II, then III awakens), logs it and emits onRelicTier; the top tier attunes no further', () => {
    const g = game(['frostBrand']);
    const seen: [RelicId, number][] = [];
    addListener((_g, name, ev) => {
      if (name === 'onRelicTier' && _g === g) seen.push([(ev as { id: RelicId }).id, (ev as { tier: number }).tier]);
    });
    g.player.relics.attune.frostBrand = 1;
    tick(g);
    expect(g.player.relics.tiers.frostBrand).toBe(2);
    expect(att(g, 'frostBrand')).toBe(0);
    g.player.relics.attune.frostBrand = 1;
    tick(g);
    expect(g.player.relics.tiers.frostBrand).toBe(RELIC_MAX_TIER);
    expect(seen).toEqual([['frostBrand', 2], ['frostBrand', 3]]);
    updateGame(g, 1 / 60); // the run log reads the events
    expect(g.log.marks.filter((m) => m[1] === 'attune').map((m) => m[2])).toEqual(['Frost Brand II', 'Frost Brand III, awakened: Hoarfrost']);
    credit(g, g.player, 'frostBrand', 'damage', 1e6);
    emit(g, 'onWaveCleared', { wave: 3 });
    expect(att(g, 'frostBrand')).toBe(0);
  });

  it('Charnel (Grave 2): walking over a corpse attunes every Grave relic, once per corpse', () => {
    const g = game(['soulLantern', 'hexDoll', 'frostBrand']);
    tick(g);
    g.corpses.push({ x: g.player.x, y: g.player.y, t: 0, life: 10 } as Game['corpses'][number]);
    tick(g);
    tick(g);
    expect(att(g, 'soulLantern')).toBeCloseTo(ATTUNEMENT.corpse);
    expect(att(g, 'hexDoll')).toBeCloseTo(ATTUNEMENT.corpse);
    expect(att(g, 'frostBrand')).toBe(0);
  });

  it('normalized: a relic doing 5-10% of the damage from wave 5 reaches tier II in Act II and tier III in Act III; one doing nothing does not', () => {
    const wavesPerTier = (share: number) => 1 / (Math.min(ATTUNEMENT.workCap, share * ATTUNEMENT.damage) + ATTUNEMENT.wave);
    const act = (wave: number) => Math.ceil(wave / ACTS.length);
    for (const share of [0.05, 0.1]) {
      expect(act(5 + wavesPerTier(share)), `II at ${share}`).toBe(2);
      expect(act(5 + 2 * wavesPerTier(share)), `III at ${share}`).toBe(3);
    }
    expect(5 + wavesPerTier(0)).toBeGreaterThan(3 * ACTS.length);
  });

  it('evolution recipes ask for a relic attuned to tier II', () => {
    const g = game(['thunderDrum']);
    const req = EVOLUTIONS.dayOfJudgement.requires.find((r) => r.kind === 'relic')!;
    expect(requirementText(req)).toBe('Thunder Drum attuned to tier II');
    expect(requirementMet(buildState(g), req)).toBe(false);
    g.player.relics.attune.thunderDrum = 1;
    tick(g);
    expect(requirementMet(buildState(g), req)).toBe(true);
  });
});
