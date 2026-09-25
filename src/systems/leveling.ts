import { TRADEOFF_IDS, type TradeoffId } from '../config/upgrades';
import { UTILITY } from '../config/utility';
import { talentPointsForLevel } from '../logic/talents';
import { sfx } from '../sim/view';
import type { Game } from '../core/types';
import { tierForLevel } from '../logic/abilityUpgrades';
import { applyGrowth, catchUpMult, xpToNext } from '../logic/formulas';
import { applyStatUpgrade, applyTradeoff, rollLevelUpOptions, upgradeAmount, type LevelUpOption } from '../logic/upgrades';
import { floatText, ring } from './effects';
import { addRelic } from './relics';
import { readyEvolutions } from '../logic/evolutions';
import { buildState, evolve } from './evolutions';

export function gainXp(g: Game, amount: number): void {
  const p = g.player;
  p.xp += amount * p.mods.xp * catchUpMult(p.level, Math.max(1, g.wave));
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.stats = applyGrowth(p.stats, p.cls.growth);
    p.hp = Math.min(p.stats.hp, p.hp + p.cls.growth.hp);
    p.pendingLevelUps++; // main loop (or the bot) pauses and resolves the choice
    const tier = tierForLevel(p.level);
    if (tier >= 0) p.pendingAbilityTiers.push(tier);
    const utilityTier = UTILITY.tiers.indexOf(p.level);
    if (utilityTier >= 0 && utilityTier < g.utilityTiers) p.pendingUtilityTiers.push(utilityTier); // the second tier is a mastery unlock
    if (talentPointsForLevel(p.level) > talentPointsForLevel(p.level - 1)) {
      p.talentPoints++;
      floatText(g, p.x, p.y - 48, 'TALENT POINT', '#e9c95a', 15);
    }
    ring(g, p.x, p.y, 90, '#c9a227', 0.6);
    floatText(g, p.x, p.y - 30, 'LEVEL UP', '#c9a227', 18);
    sfx(g, 'levelup');
  }
}

const takenTradeoffs = (g: Game) => TRADEOFF_IDS.filter((id) => g.player.vars[`tradeoff.${id}`]) as TradeoffId[];

export function levelUpOptions(g: Game): LevelUpOption[] {
  const options = rollLevelUpOptions(g.player.rng, takenTradeoffs(g), null /* v0.7: no relic cards; relics come at fixed moments */, g.bannedStats, g.player.vars.banTalent === 1);
  // v0.6: a complete evolution recipe is always the first card, until it is taken (rerolls keep it)
  const [ready] = readyEvolutions(buildState(g));
  if (ready) options[0] = { kind: 'evolution', id: ready };
  return options;
}

/** v0.6 Quartermaster's Ledger: strike a level-up card from the run for good (a stat boon, the talent card, a relic, a tradeoff). */
export function banishOption(g: Game, o: LevelUpOption): boolean {
  if (g.player.banishes <= 0 || o.kind === 'evolution') return false;
  if (o.kind === 'stat') g.bannedStats = [...g.bannedStats, o.key];
  else if (o.kind === 'talent') g.player.vars.banTalent = 1;
  else if (o.kind === 'relic') g.player.relics.pool = g.player.relics.pool.filter((id) => id !== o.id);
  else g.player.vars[`tradeoff.${o.id}`] = 1; // counts as taken: never offered again, and changes nothing
  g.player.banishes--;
  return true;
}

export function chooseLevelUp(g: Game, o: LevelUpOption): void {
  const p = g.player;
  if (o.kind === 'talent') p.talentPoints++;
  else if (o.kind === 'evolution') evolve(g, o.id);
  else if (o.kind === 'relic') addRelic(g, o.id); // v0.7: never offered any more (relics come at fixed moments)
  else if (o.kind === 'tradeoff') {
    const next = applyTradeoff(p.stats, g.baseMods, o.id);
    p.stats = next.stats;
    g.baseMods = next.mods;
    p.vars[`tradeoff.${o.id}`] = 1;
  } else {
    p.stats = applyStatUpgrade(p.stats, o.key, o.rarity);
    if (o.key === 'hp') p.hp += upgradeAmount('hp', o.rarity);
  }
  p.hp = Math.min(p.hp, p.stats.hp);
  p.pendingLevelUps--;
}
