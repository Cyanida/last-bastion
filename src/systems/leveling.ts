import { TRADEOFF_IDS, type TradeoffId } from '../config/upgrades';
import { sfx } from '../core/audio';
import type { Game } from '../core/types';
import { tierForLevel } from '../logic/abilityUpgrades';
import { applyGrowth, xpToNext } from '../logic/formulas';
import { applyStatUpgrade, applyTradeoff, rollLevelUpOptions, upgradeAmount, type LevelUpOption } from '../logic/upgrades';
import { floatText, ring } from './effects';

export function gainXp(g: Game, amount: number): void {
  const p = g.player;
  p.xp += amount * p.mods.xp;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.stats = applyGrowth(p.stats, p.cls.growth);
    p.hp = Math.min(p.stats.hp, p.hp + p.cls.growth.hp);
    g.pendingLevelUps++; // main loop (or the bot) pauses and resolves the choice
    const tier = tierForLevel(p.level);
    if (tier >= 0) g.pendingAbilityTiers.push(tier);
    ring(g, p.x, p.y, 90, '#c9a227', 0.6);
    floatText(g, p.x, p.y - 30, 'LEVEL UP', '#c9a227', 18);
    sfx('levelup');
  }
}

const takenTradeoffs = (g: Game) => TRADEOFF_IDS.filter((id) => g.vars[`tradeoff.${id}`]) as TradeoffId[];

export const levelUpOptions = (g: Game): LevelUpOption[] => rollLevelUpOptions(g.rng, takenTradeoffs(g));

export function chooseLevelUp(g: Game, o: LevelUpOption): void {
  const p = g.player;
  if (o.kind === 'tradeoff') {
    const next = applyTradeoff(p.stats, g.baseMods, o.id);
    p.stats = next.stats;
    g.baseMods = next.mods;
    g.vars[`tradeoff.${o.id}`] = 1;
  } else {
    p.stats = applyStatUpgrade(p.stats, o.key, o.rarity);
    if (o.key === 'hp') p.hp += upgradeAmount('hp', o.rarity);
  }
  p.hp = Math.min(p.hp, p.stats.hp);
  g.pendingLevelUps--;
}
