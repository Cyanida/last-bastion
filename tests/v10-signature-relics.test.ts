import { describe, expect, it } from 'vitest';
import { CLASS_ORDER } from '../src/config/classes';
import { keyColor, relicDef, SIGNATURE, SIGNATURE_IDS, type RelicId } from '../src/config/relics';
import type { Enemy, Game } from '../src/core/types';
import { emit } from '../src/core/events';
import { createGame } from '../src/game';
import { grantSignature, newChampion, ownable, readChampion, slotBlock } from '../src/logic/champions';
import { championPool, familySets, relicCardLine, relicPoolFor } from '../src/logic/relics';
import { applyRun, defaultSave, type RunSummary, type Save } from '../src/logic/save';
import { damagePlayer } from '../src/systems/combat';
import { addRelic, updateRelics } from '../src/systems/relics';
import { spawnEnemy } from '../src/systems/spawning';

/** A headless game of `classId` holding `id` at `tier`, with bare knights next to the player. */
function arena(classId: Parameters<typeof createGame>[0], id: RelicId, at: [number, number][], tier = 1): { g: Game; foes: Enemy[] } {
  const g = createGame(classId, 1);
  g.rng = Object.assign(() => 0, { s: 0 }); // every chance procs
  addRelic(g, id, 'other', tier);
  const foes = at.map(([dx, dy]) => spawnEnemy(g, 'knight', g.player.x + dx, g.player.y + dy));
  for (const f of foes) (f.armorHp = 0), g.hash.insert(f);
  g.player.mods = { ...g.baseMods };
  updateRelics(g, 1 / 60);
  return { g, foes };
}
const hurt = (e: Enemy) => e.hp < e.maxHp;
const credited = (g: Game, id: RelicId) => g.player.relics.stats[id]?.damage ?? 0;

describe('relics: five signature relics (#201)', () => {
  it('one per champion: rare, its class only, no family, gold', () => {
    expect(SIGNATURE_IDS).toHaveLength(CLASS_ORDER.length);
    for (const c of CLASS_ORDER) {
      const d = relicDef(SIGNATURE.relic[c]);
      expect(d).toMatchObject({ signature: true, classId: c, rarity: 'rare' });
      expect(d.family).toBeUndefined();
      expect(keyColor(SIGNATURE.relic[c])).toBe(SIGNATURE.color);
      for (const o of CLASS_ORDER) expect(ownable(o, SIGNATURE.relic[c])).toBe(o === c);
    }
    expect(familySets(['jarlsTorc', 'serratedEdge'])).toEqual({ blood: { count: 1, level: 0 } }); // counts toward no set
    expect(relicCardLine('jarlsTorc', 0, { upgrade: false, duo: false, evolution: false })).toContain('signature');
  });

  it('never in a pool without a champion; in a champion pool once it owns it', () => {
    for (const c of CLASS_ORDER) expect(relicPoolFor(c).some((id) => relicDef(id).signature)).toBe(false);
    expect(championPool('viking', [])).not.toContain('jarlsTorc');
    expect(championPool('viking', ['jarlsTorc'])).toContain('jarlsTorc');
    expect(championPool('viking', ['jarlsTorc'], 'steel')).toContain('jarlsTorc');
  });

  it('takes 1 slot beside the 2 class relics', () => {
    expect(slotBlock('archer', ['fireArrows', 'rimebow'], 'eagleFletching', 3)).toBeNull();
    expect(slotBlock('archer', ['fireArrows', 'eagleFletching'], 'rimebow', 3)).toBeNull();
    expect(slotBlock('archer', ['fireArrows', 'rimebow'], 'eagleFletching', 2)).toBe('slots');
    expect(slotBlock('viking', [], 'eagleFletching', 3)).toBe('otherClass');
  });

  it('the Marches crown wins it, once, into the inventory; a read save keeps them together', () => {
    const run = (level: number): RunSummary => ({ classId: 'necromancer', tier: 0, wave: 1, wavesCleared: 0, kills: 0, time: 60, level: 1, gold: 0, bosses: [], elites: 0, flawlessBosses: 0, relics: [], abilityUpgrades: 0, wave10Time: 0, realmLevel: { realm: 'marches', level, cleared: true } });
    let save: Save = defaultSave();
    for (let l = 1; l <= 6; l++) save = applyRun(save, run(l)).save;
    expect(save.champions.necromancer!.signature).toBe(false);
    save = applyRun(save, run(7)).save;
    expect(save.champions.necromancer).toMatchObject({ signature: true, inventory: ['phylactery'] });
    expect(grantSignature(save.champions.necromancer!, 'necromancer').inventory).toEqual(['phylactery']);
    expect(readChampion({ signature: true }, 'angel').inventory).toEqual(['dawnstar']);
    expect(newChampion('angel').inventory).toEqual([]);
  });
});

describe('what each one does', () => {
  it("Oathkeeper's Seal: Divine Shield keeps the blows it turns away and strikes with them when it ends", () => {
    const { g, foes } = arena('paladin', 'oathkeepersSeal', [[60, 0]]);
    const p = g.player;
    emit(g, 'onAbilityUsed', { cooldown: 18 });
    p.abilityTime = 2;
    p.invulnerable = true;
    damagePlayer(g, 30, true, foes[0]);
    expect(g.vars['seal.kept']).toBe(30);
    damagePlayer(g, 1e6, true, foes[0]);
    expect(g.vars['seal.kept']).toBe(p.stats.hp); // up to 100% of max HP
    p.abilityTime = 0;
    emit(g, 'onAbilityEnd', {});
    expect(hurt(foes[0])).toBe(true);
    expect(credited(g, 'oathkeepersSeal')).toBeGreaterThan(0);
  });

  it("Jarl's Torc: attacks cleave during Berserker Rage only; awakened, kills stretch the Rage up to 3 s", () => {
    const { g, foes } = arena('viking', 'jarlsTorc', [[60, 0], [100, 0], [600, 0]], 3);
    const p = g.player;
    emit(g, 'onHit', { enemy: foes[0], amount: 100, crit: false, source: 'attack' });
    expect(hurt(foes[1])).toBe(false);
    p.abilityTime = 1;
    emit(g, 'onAbilityUsed', { cooldown: 13 });
    emit(g, 'onHit', { enemy: foes[0], amount: 100, crit: false, source: 'attack' });
    expect(foes[1].maxHp - foes[1].hp).toBeCloseTo(50); // tier II+: 50%
    expect(hurt(foes[0]) || hurt(foes[2])).toBe(false); // not the target, not a far one
    for (let i = 0; i < 20; i++) emit(g, 'onKill', { enemy: foes[2], source: 'attack' });
    expect(p.abilityTime).toBeCloseTo(4);
  });

  it('Dawnstar: Heavenly Radiance calls beams on the strongest enemies in reach', () => {
    const { g, foes } = arena('angel', 'dawnstar', [[100, 0], [-150, 0], [0, 200], [0, -250], [800, 0]]);
    foes[0].hp -= 10; // the weakest of the four in reach: 3 beams go elsewhere
    emit(g, 'onAbilityUsed', { cooldown: 16 });
    expect(foes.slice(1, 4).every(hurt)).toBe(true);
    expect(foes[0].hp).toBe(foes[0].maxHp - 10);
    expect(hurt(foes[4])).toBe(false);
  });

  it('Phylactery: Raise Dead also raises Bone Knights, two from tier II', () => {
    const one = arena('necromancer', 'phylactery', []).g;
    emit(one, 'onAbilityUsed', { cooldown: 8 });
    expect(one.minions.filter((m) => m.relicBy === 'phylactery')).toHaveLength(1);
    const two = arena('necromancer', 'phylactery', [], 3).g;
    emit(two, 'onAbilityUsed', { cooldown: 8 });
    const knights = two.minions.filter((m) => m.relicBy === 'phylactery');
    expect(knights).toHaveLength(2);
    expect(knights[0].onEnd).toBeTruthy(); // Lich's Crown
  });

  it('Eagle Fletching: an Arrow Volley arrow strikes again; a plain attack does not', () => {
    const { g, foes } = arena('archer', 'eagleFletching', [[80, 0]]);
    emit(g, 'onHit', { enemy: foes[0], amount: 100, crit: false, source: 'attack' });
    expect(hurt(foes[0])).toBe(false);
    emit(g, 'onHit', { enemy: foes[0], amount: 100, crit: false, source: 'ability' });
    expect(foes[0].maxHp - foes[0].hp).toBeCloseTo(80);
  });
});
