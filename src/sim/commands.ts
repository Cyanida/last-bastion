import type { AbilityUpgradeId } from '../config/abilityUpgrades';
import { GAME } from '../config/game';
import type { BlessingId } from '../config/regions';
import type { DuoId, RelicId } from '../config/relics';
import type { Rarity } from '../config/relics';
import type { UtilityUpgradeId } from '../config/utility';
import type { Game } from '../core/types';
import { updateGame } from '../game';
import { rerollCost } from '../logic/economy';
import type { LevelUpOption } from '../logic/upgrades';
import { chooseAbilityUpgrade } from '../systems/abilities';
import { chooseRoute, leaveMerchant, merchantBuy, merchantHeal, merchantReforge, merchantReroll, merchantSalvage, merchantSell } from '../systems/acts';
import { peddlerBuy } from '../systems/events';
import { banishOption, chooseLevelUp, levelUpOptions } from '../systems/leveling';
import { takeQuests } from '../systems/quests';
import { chooseBlessing } from '../systems/regions';
import { rerollRelicOffer, resolveRelicOffer, skipRelicOffer } from '../systems/relics';
import { spendTalent } from '../systems/talents';
import { chooseUtilityUpgrade } from '../systems/utility';
import { goEndless } from '../systems/victory';

/**
 * v0.8 (#25, ARCHITECTURE.md step 1): everything a player does is a command with a player id and a tick. The keyboard, gamepad,
 * touch and the bot all produce them; only step() and applyChoice() turn them into changes to the Game.
 */

const DT = 1 / GAME.tickRate;

export type Intent = Game['input'];

/** One variant per choice screen. Level-up cards are named by their place in levelHand(g). */
export type Choice =
  | { c: 'levelUp'; index: number }
  | { c: 'levelBanish'; index: number }
  | { c: 'levelReroll' }
  | { c: 'relicTake'; id: RelicId | DuoId | null }
  | { c: 'relicSkip' }
  | { c: 'relicReroll' }
  | { c: 'abilityUpgrade'; id: AbilityUpgradeId }
  | { c: 'utilityUpgrade'; id: UtilityUpgradeId }
  | { c: 'talent'; id: string }
  | { c: 'blessing'; id: BlessingId }
  | { c: 'quests'; picks: number[] }
  | { c: 'route'; index: number }
  | { c: 'peddlerBuy' }
  | { c: 'peddlerLeave' }
  | { c: 'merchantHeal' }
  | { c: 'merchantBuy'; rarity: Rarity }
  | { c: 'merchantReroll'; id: RelicId }
  | { c: 'merchantReforge'; id: RelicId }
  | { c: 'merchantSell'; id: RelicId }
  | { c: 'merchantSalvage'; id: RelicId }
  | { c: 'merchantLeave' }
  | { c: 'endless' };

export type Command = { tick: number; player: number } & ({ kind: 'intent'; intent: Intent } | { kind: 'choice'; choice: Choice });

/**
 * The level-up cards on offer, dealt from g.rng on first read (the screen, the bot, or a replayed command) and kept until a pick,
 * banish or reroll. Nothing else draws between the end of a tick and that read, so single-player draws exactly as before.
 */
export function levelHand(g: Game): LevelUpOption[] {
  return (g.levelHand ??= levelUpOptions(g));
}

/** This level-up screen's rerolls: the free ones first, then paid ones that double in price. */
export function levelRerolls(g: Game): { free: number; paid: number } {
  return (g.levelRerolls ??= { free: g.rerolls, paid: 0 });
}

/** Apply one choice now; false when it could not be made (the screens re-open or stay as they are). */
export function applyChoice(g: Game, ch: Choice): boolean {
  switch (ch.c) {
    case 'levelUp': {
      const o = levelHand(g)[ch.index];
      if (!o) return false;
      chooseLevelUp(g, o);
      g.levelHand = g.levelRerolls = null;
      return true;
    }
    case 'levelBanish': {
      const o = levelHand(g)[ch.index];
      if (!o || !banishOption(g, o)) return false;
      g.levelHand = null; // v0.6: struck for good, and a fresh hand
      return true;
    }
    case 'levelReroll': {
      levelHand(g); // the hand being rerolled was dealt, even if nobody looked at it (a replay)
      const r = levelRerolls(g);
      if (r.free > 0) r.free--;
      else if (g.gold >= rerollCost(r.paid)) g.gold -= rerollCost(r.paid++);
      else return false;
      g.levelHand = null;
      return true;
    }
    case 'relicTake':
      if (resolveRelicOffer(g, ch.id)) return true;
      g.player.relics.offers.shift(); // never stuck on a moment
      return false;
    case 'relicSkip':
      return skipRelicOffer(g);
    case 'relicReroll':
      return rerollRelicOffer(g);
    case 'abilityUpgrade':
      if (chooseAbilityUpgrade(g, ch.id)) return true;
      g.pendingAbilityTiers.shift(); // never leave the player stuck on a choice that cannot be made
      return false;
    case 'utilityUpgrade':
      if (chooseUtilityUpgrade(g, ch.id)) return true;
      g.pendingUtilityTiers.shift();
      return false;
    case 'talent':
      return spendTalent(g, ch.id);
    case 'blessing':
      chooseBlessing(g, ch.id);
      return true;
    case 'quests':
      takeQuests(g, ch.picks);
      return true;
    case 'route':
      chooseRoute(g, ch.index);
      return true;
    case 'peddlerBuy':
      return peddlerBuy(g);
    case 'peddlerLeave':
      g.pendingShop = false;
      return true;
    case 'merchantHeal':
      return merchantHeal(g);
    case 'merchantBuy':
      return merchantBuy(g, ch.rarity);
    case 'merchantReroll':
      return merchantReroll(g, ch.id);
    case 'merchantReforge':
      return merchantReforge(g, ch.id);
    case 'merchantSell':
      return merchantSell(g, ch.id);
    case 'merchantSalvage':
      return merchantSalvage(g, ch.id);
    case 'merchantLeave':
      leaveMerchant(g);
      return true;
    case 'endless':
      goEndless(g);
      return true;
  }
}

export const intentCommand = (g: Game, intent: Intent, player = 0): Command => ({ tick: g.tick, player, kind: 'intent', intent });

/**
 * One tick: the choices first, then each player's intent, then the simulation. A player with no intent this tick keeps the last
 * one (what a dropped packet does online). ponytail: one player; commands for other players wait for g.players (#28).
 */
export function step(g: Game, commands: readonly Command[]): void {
  g.out.length = 0; // the last tick's cues were played (or nobody listens: tests, the bot)
  for (const cmd of commands) if (cmd.kind === 'choice') applyChoice(g, cmd.choice);
  for (const cmd of commands) if (cmd.kind === 'intent') g.input = { ...cmd.intent };
  g.tick++;
  updateGame(g, DT);
}
