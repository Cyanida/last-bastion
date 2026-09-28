import { describe, expect, it } from 'vitest';
import { RELICS, relicN } from '../src/config/relics';
import { createGame, updateGame } from '../src/game';
import { branchPlan } from '../src/logic/talents';
import { damagePlayer } from '../src/systems/combat';
import { addRelic } from '../src/systems/relics';
import { spendTalent } from '../src/systems/talents';

const DT = 1 / 60;
const TALENT_ARMOR = 0.06; // viking.jarl.1 "Shield Arm": +6% armor

// #173: Anvil Heart and Adamant compute their bonus from the player's armor inside their own tick() hook, which runs
// before talentPassives folds talent armor into p.mods (systems/talents.ts runs later the same frame) -- so a talent's
// +armor never reached them.
describe('relics count talent armor (#173)', () => {
  it("Anvil Heart's damage bonus grows with a talent that gives armor", () => {
    const plain = createGame('viking', 1);
    addRelic(plain, 'anvilHeart');
    updateGame(plain, DT);
    const before = plain.player.relics.raw.anvilHeart!.damage!;

    const g = createGame('viking', 1);
    addRelic(g, 'anvilHeart');
    g.talentPoints = 1;
    const [, shieldArm] = branchPlan('viking', 2); // jarl: Hardy, Shield Arm, Thick Hide
    expect(spendTalent(g, shieldArm)).toBe(true);
    updateGame(g, DT);
    const after = g.player.relics.raw.anvilHeart!.damage!;

    expect(after - before).toBeCloseTo(TALENT_ARMOR / relicN('anvilHeart', 1).per);
  });

  it("Adamant's armor bonus grows with a talent that gives armor", () => {
    const plain = createGame('viking', 1);
    addRelic(plain, 'unbreakable', 'other', 3); // tier III: awakened
    updateGame(plain, DT); // settle the relic's dirty flag
    damagePlayer(plain, plain.player.hp * 0.9, true); // Unbreakable blocks it and arms Adamant
    updateGame(plain, DT);
    const before = plain.player.relics.raw.unbreakable!.armor!;

    const g = createGame('viking', 1);
    addRelic(g, 'unbreakable', 'other', 3);
    g.talentPoints = 1;
    const [, shieldArm] = branchPlan('viking', 2);
    expect(spendTalent(g, shieldArm)).toBe(true);
    updateGame(g, DT);
    damagePlayer(g, g.player.hp * 0.9, true);
    updateGame(g, DT);
    const after = g.player.relics.raw.unbreakable!.armor!;

    expect(after - before).toBeCloseTo(TALENT_ARMOR * RELICS.unbreakable.awaken.n.armor);
  });
});
