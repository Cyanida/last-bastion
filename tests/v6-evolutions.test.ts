import { describe, expect, it } from 'vitest';
import { ABILITY_TRACKS } from '../src/config/abilityUpgrades';
import { CLASS_ORDER, type ClassId } from '../src/config/classes';
import { EVOLUTION_IDS, EVOLUTIONS, type EvolutionId } from '../src/config/evolutions';
import { RELIC_MAX_TIER, relicDef } from '../src/config/relics';
import { TALENT_BRANCHES, TALENT_BY_ID } from '../src/config/talents';
import { UTILITY_TRACKS } from '../src/config/utility';
import type { Game } from '../src/core/types';
import { fireProjectile } from '../src/entities/hazards';
import { createGame, summarizeRun, updateGame } from '../src/game';
import { completes, nearlyReady, readyEvolutions, recipeProgress, requirementMet, type BuildState } from '../src/logic/evolutions';
import { applyRun, defaultSave, migrate } from '../src/logic/save';
import { buildState } from '../src/systems/evolutions';
import { chooseLevelUp, levelUpOptions } from '../src/systems/leveling';
import { spawnEnemy } from '../src/systems/spawning';

const DT = 1 / 60;
const build = (b: Partial<BuildState> & { classId: ClassId }): BuildState => ({ upgrades: [], utilityUpgrades: [], talents: [], relicTiers: {}, evolutions: [], ...b });
const keystoneOf = (branch: string) => Object.values(TALENT_BY_ID).find((n) => n.branch === branch && n.keystone)!.id;

describe('evolution recipes (v0.6)', () => {
  it('three signature and two utility evolutions per class, every requirement pointing at something that exists for that class', () => {
    for (const c of CLASS_ORDER) {
      const mine = EVOLUTION_IDS.filter((id) => EVOLUTIONS[id].classId === c);
      expect(mine.filter((id) => EVOLUTIONS[id].slot === 'signature')).toHaveLength(3);
      expect(mine.filter((id) => EVOLUTIONS[id].slot === 'utility')).toHaveLength(2);
      for (const id of mine) {
        for (const r of EVOLUTIONS[id].requires) {
          if (r.kind === 'upgrade') expect(ABILITY_TRACKS[c].flat()).toContain(r.id);
          if (r.kind === 'utility') expect(UTILITY_TRACKS[c].flat()).toContain(r.id);
          if (r.kind === 'keystone' || r.kind === 'branch') expect(TALENT_BRANCHES[c].map((b) => b.id)).toContain(r.branch);
          if (r.kind === 'relic') {
            expect(r.tier).toBeLessThanOrEqual(RELIC_MAX_TIER);
            expect([undefined, c]).toContain(relicDef(r.id).classId);
          }
        }
      }
    }
  });

  it('detects each kind of requirement', () => {
    const b = build({ classId: 'paladin', upgrades: ['mirrorShield'], utilityUpgrades: ['chains'], talents: ['paladin.bulwark.0', 'paladin.bulwark.2'], relicTiers: { rallyBanner: 1 } });
    expect(requirementMet(b, { kind: 'upgrade', id: 'mirrorShield' })).toBe(true);
    expect(requirementMet(b, { kind: 'upgrade', id: 'zeal' })).toBe(false);
    expect(requirementMet(b, { kind: 'utility', id: 'chains' })).toBe(true);
    expect(requirementMet(b, { kind: 'branch', branch: 'paladin.bulwark' })).toBe(true); // a talent past the first row
    expect(requirementMet(build({ classId: 'paladin', talents: ['paladin.bulwark.0'] }), { kind: 'branch', branch: 'paladin.bulwark' })).toBe(false); // first row only
    expect(requirementMet(b, { kind: 'keystone', branch: 'paladin.bulwark' })).toBe(false);
    expect(requirementMet({ ...b, talents: [keystoneOf('paladin.bulwark')] }, { kind: 'keystone', branch: 'paladin.bulwark' })).toBe(true);
    expect(requirementMet(b, { kind: 'relic', id: 'rallyBanner', tier: 2 })).toBe(false);
    expect(requirementMet({ ...b, relicTiers: { rallyBanner: 2 } }, { kind: 'relic', id: 'rallyBanner', tier: 2 })).toBe(true);
  });

  it('a recipe is ready with both halves, one step away with one, and the tooltips know the missing half', () => {
    const half = build({ classId: 'paladin', upgrades: ['mirrorShield'] });
    expect(recipeProgress(half, 'aegisOfDawn')).toBe(1);
    expect(readyEvolutions(half)).toEqual([]);
    expect(nearlyReady(half).map((n) => n.id)).toContain('aegisOfDawn');
    expect(completes(half, { talent: keystoneOf('paladin.bulwark') })).toContain('aegisOfDawn');
    expect(completes(half, { talent: 'paladin.bulwark.0' })).toEqual([]); // a first-row talent completes nothing
    const whole = { ...half, talents: [keystoneOf('paladin.bulwark')] };
    expect(readyEvolutions(whole)).toEqual(['aegisOfDawn']);
    const relicHalf = build({ classId: 'angel', utilityUpgrades: ['afterimage'] });
    expect(completes(relicHalf, { relic: 'thunderDrum' })).toEqual(['starfall']);
  });

  it('one signature and one utility evolution a run', () => {
    const b = build({ classId: 'viking', upgrades: ['undying', 'whirlwind'], talents: [keystoneOf('viking.berserk')], relicTiers: { stormPennant: 2 } });
    expect(readyEvolutions(b).sort()).toEqual(['avatarOfWrath', 'maelstrom']);
    expect(readyEvolutions({ ...b, evolutions: ['maelstrom'] })).toEqual([]); // the signature slot is filled
    expect(readyEvolutions({ ...b, utilityUpgrades: ['earthshatter'], relicTiers: { stormPennant: 2, shockSigil: 2 }, evolutions: ['maelstrom'] })).toEqual(['thunderfall']);
  });
});

describe('the gold card (v0.6)', () => {
  it('a complete recipe is the first card of the next level-up, rerolls keep it, and taking it evolves the ability', () => {
    const g = createGame('archer', 4);
    g.player.upgrades = ['doubleVolley'];
    g.player.relics.tiers.stormPennant = 2;
    g.player.relics.held.push('stormPennant');
    g.player.pendingLevelUps = 1;
    const first = levelUpOptions(g);
    expect(first[0]).toEqual({ kind: 'evolution', id: 'stormVolley' });
    expect(levelUpOptions(g)[0]).toEqual({ kind: 'evolution', id: 'stormVolley' }); // a reroll
    chooseLevelUp(g, first[0]);
    expect(g.player.evolutions).toEqual(['stormVolley']);
    expect(g.log.marks.at(-1)?.[1]).toBe('evolution');
    expect(levelUpOptions(g).some((o) => o.kind === 'evolution')).toBe(false); // taken: no more
  });

  it('the save remembers every evolution ever taken, and reads only real ones back', () => {
    const g = createGame('archer', 4);
    g.player.evolutions = ['stormVolley'];
    const save = applyRun(defaultSave(), summarizeRun(g), 'd').save;
    expect(save.evolutions).toEqual(['stormVolley']);
    expect(migrate({ ...JSON.parse(JSON.stringify(save)), evolutions: ['stormVolley', 'nonsense', 3] }).evolutions).toEqual(['stormVolley']);
    expect(migrate({ ...JSON.parse(JSON.stringify(save)), evolutions: undefined }).evolutions).toEqual([]); // a v0.5 save
  });
});

/** A quiet field with sturdy enemies around the player, the evolution taken, and its ability (or utility) cast at the first of them. */
function fieldWith(id: EvolutionId): { g: Game } {
  const e = EVOLUTIONS[id];
  const g = createGame(e.classId, 12);
  g.pendingBoard = false;
  g.breather = 1e9;
  const p = g.player;
  p.level = 20;
  p.invulnT = 1e9;
  g.baseMods.xp = 0; // no level-ups mid-test
  const foes = [0, 1, 2, 3, 4, 5].map((i) => {
    const f = spawnEnemy(g, 'knight', p.x + Math.cos(i) * (70 + i * 25), p.y + Math.sin(i) * (70 + i * 25));
    f.hp = f.maxHp = 1e7;
    f.armorHp = 0;
    return f;
  });
  for (let i = 0; i < 6; i++) g.corpses.push({ x: p.x + 40 * Math.cos(i), y: p.y + 40 * Math.sin(i), t: 0 });
  g.player.evolutions = [id];
  g.input.aimX = foes[0].x;
  g.input.aimY = foes[0].y;
  if (e.slot === 'signature') g.input.ability = true;
  else g.input.utility = true;
  return { g };
}

/** What each evolution, and only it, leaves behind: checked every tick of a five-second fight. */
const SIGNS: Record<EvolutionId, (g: Game, start: { x: number; y: number }) => boolean> = {
  aegisOfDawn: (g) => g.fields.some((f) => f.follow),
  dayOfJudgement: (g) => g.texts.some((t) => t.text === 'JUDGED'),
  crusadersCharge: (g, s) => Math.hypot(g.player.x - s.x, g.player.y - s.y) > 60,
  lionsRoar: (g) => g.enemies.some((e) => e.statuses.curse !== undefined), // marks are Cursed stacks since v0.3
  standardOfFaith: (g) => g.minions.some((m) => m.kind === 'standard'),
  avatarOfWrath: (g) => g.player.vars.avatar === 1,
  maelstrom: (g) => g.effects.some((e) => e.kind === 'arc' && e.arc > 6),
  bloodTide: (g) => g.effects.some((e) => e.kind === 'ring' && e.color === '#8e1b1b'), // the tide of blood where one fell
  thunderfall: (g) => g.enemies.some((e) => e.statuses.stun !== undefined),
  valkyrie: (g) => g.fields.some((f) => !f.hostile && f.dtype === 'fire'),
  sunburst: (g) => g.fields.some((f) => f.vx !== undefined),
  choir: (g) => g.glows.some((l) => !l.ring && l.r === 6), // the wisps (the Angel's own bolts are holy too)
  sanctuaryWings: (g) => g.glows.some((l) => l.ring),
  starfall: (g) => g.zones.some((z) => z.arrow && z.dtype === 'holy'),
  phaseWalk: (g) => g.minions.some((m) => m.kind === 'decoy'),
  boneColossus: (g) => g.minions.some((m) => (m.cleave ?? 0) > 0),
  plagueLegion: (g) => g.minions.some((m) => !m.kind && m.onEnd !== undefined),
  soulHarvest: (g) => g.projectiles.some((pr) => pr.seek === true),
  corpseLance: (g) => g.projectiles.some((pr) => !pr.hostile && pr.pierce > 100),
  deathsDoor: (g) => g.texts.some((t) => t.text.includes('return')),
  meteorArrow: (g) => g.zones.some((z) => !z.hostile && z.leaveField !== null && z.dtype === 'fire'),
  stormVolley: (g) => g.effects.some((e) => e.kind === 'line' && e.color === '#a9d8ef'),
  huntersMark: (g) => g.prey !== null,
  shadowStep: (g) => g.minions.some((m) => m.kind === 'shade'),
  frostTrap: (g) => g.zones.some((z) => z.dtype === 'frost'),
};

describe('every evolution does its thing (v0.6)', () => {
  for (const id of EVOLUTION_IDS) {
    it(`${EVOLUTIONS[id].name}: seen with it, never without it`, () => {
      const run = (evolved: boolean) => {
        const { g } = fieldWith(id);
        if (!evolved) g.player.evolutions = [];
        if (id === 'soulHarvest') g.player.vars.souls = 3; // souls come from minion kills; start with a few to loose
        if (id === 'bloodTide') for (const e of g.enemies.slice(0, 3)) e.hp = 1; // kills while raging
        const start = { x: g.player.x, y: g.player.y };
        let seen = false;
        for (let i = 0; i < 60 * 5 && !seen; i++) {
          updateGame(g, DT);
          seen = SIGNS[id](g, start);
        }
        return seen;
      };
      expect(run(true)).toBe(true);
      expect(run(false)).toBe(false);
    });
  }

  it('Aegis of Dawn turns enemy shots in its dome around', () => {
    const { g } = fieldWith('aegisOfDawn');
    for (let i = 0; i < 3; i++) updateGame(g, DT);
    const p = g.player;
    fireProjectile(g, p.x + 60, p.y, Math.PI, { damage: 20, crit: false, hostile: true, pierce: 0, shape: 'orb', color: '#fff', r: 5, speed: 100, range: 400 });
    updateGame(g, DT);
    expect(g.projectiles.at(-1)!.hostile).toBe(false);
  });

  it('Bone Colossus fuses the skeletons into one, and raising again feeds it', () => {
    const { g } = fieldWith('boneColossus');
    updateGame(g, DT);
    const colossus = g.minions.find((m) => m.cleave)!;
    expect(colossus).toBeDefined();
    const hp = colossus.maxHp;
    g.player.abilityCd = 0;
    g.corpses.push({ x: g.player.x, y: g.player.y, t: 0 });
    for (let i = 0; i < 60; i++) updateGame(g, DT);
    expect(g.minions.filter((m) => m.cleave)).toHaveLength(1);
    expect(colossus.maxHp).toBeGreaterThan(hp);
  });

  it("Valkyrie's Descent hands the Leap straight back once, then its cooldown returns", () => {
    const { g } = fieldWith('valkyrie');
    updateGame(g, DT);
    expect(g.player.utilityCd).toBe(0);
    g.input.utility = false;
    for (let i = 0; i < 60 * 2; i++) updateGame(g, DT);
    expect(g.player.utilityCd).toBeGreaterThan(0);
  });

  it('buildState reads a run', () => {
    const { g } = fieldWith('maelstrom');
    expect(buildState(g)).toMatchObject({ classId: 'viking', evolutions: ['maelstrom'] });
  });
});
