import { DUOS, FAMILIES, type RelicId, type SetLevel } from '../../config/relics';
import type { Enemy, Game, Player } from '../../core/types';
import { bodkinShare, bodkinStep, haloStacks, holdThorns, inFront, keepReprisal, perStack, rivetStep } from '../../logic/relics';
import * as scale from '../../logic/abilities';
import { attackDamage } from '../../logic/formulas';
import { talentMods } from '../../logic/talents';
import { relicContext } from '../relicContext';
import { applyStatus, damageEnemy } from '../combat';
import { addBleed, aOf, attackHit, awakened, bonus, credit, fullArmorStacks, gainArmorStacks, hasDuo, nOf, nova, relicDamage, relicHeal, sOf, strike, type RelicHooks } from '../relicCore';
import { burst, floatText } from '../effects';

/**
 * 🛡️ Steel (RELICS.md): armor stacks, block and thorns. Relics block hits (combat.damagePlayer's onIncoming), throw damage back or build armor
 * stacks; the sets give an armor stack for every hit or block (Bulwark), turn armor into thorns (Spiked) and release full stacks as a
 * shockwave (Juggernaut).
 */
const F = FAMILIES.steel;
const armorOf = (p: { cls: { armor: number }; mods: { armor: number }; armorStacks: number }) => p.cls.armor + p.mods.armor + p.armorStacks * F.n.stackArmor;
/**
 * Talent armor lands in p.mods only after relics' tick() phase runs (talentPassives, systems/talents.ts, folds it in later the same frame).
 * Anvil Heart and Adamant read armor from inside their own tick and so never saw it (#173); pull it from the talent mods cache directly.
 * Hooks that fire later in the frame (onDamageTaken, onHit...) already see it in p.mods.armor and don't need this.
 */
const talentArmor = (g: Game, p: Player) => (g.talentModsCache ??= talentMods(p.talents)).armor;

export const STEEL_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  towerShield: {
    onIncoming(g, ev, p) {
      if (!ev.blocked && g.rng() < nOf(p, 'towerShield').chance) {
        ev.blocked = true;
        credit(g, p, 'towerShield', 'prevented', ev.amount, true);
      }
    },
    onBlock(g, ev, p) {
      const e = ev.attacker;
      if (!awakened(p, 'towerShield') || !e || e.dead) return;
      const a = aOf('towerShield');
      const angle = Math.atan2(e.y - p.y, e.x - p.x); // Shield Wall
      e.kx += Math.cos(angle) * a.knockback * (1 - e.def.knockbackResist);
      e.ky += Math.sin(angle) * a.knockback * (1 - e.def.knockbackResist);
      applyStatus(e, { apply: [{ id: 'stun', time: a.stun }] }, g);
    },
  },

  thornMail: {
    onDamageTaken(g, ev, p) {
      if (ev.attacker) damageEnemy(g, ev.attacker, ev.amount * nOf(p, 'thornMail').mult, false, 0, 0, 'relic');
    },
    onBlock(g, ev, p) {
      if (awakened(p, 'thornMail') && ev.attacker) damageEnemy(g, ev.attacker, ev.amount * nOf(p, 'thornMail').mult, false, 0, 0, 'relic'); // Briar Plate
    },
  },

  anvilHeart: {
    tick(g, _dt, p) {
      bonus(p, 'damage', ((armorOf(p) + talentArmor(g, p)) * 100) / nOf(p, 'anvilHeart').per / 100);
    },
    onHit(g, ev, p) {
      if (awakened(p, 'anvilHeart') && ev.source === 'attack' && fullArmorStacks(p)) applyStatus(ev.enemy, { apply: [{ id: 'slow', stacks: aOf('anvilHeart').stacks, time: aOf('anvilHeart').time }] }, g); // Forgefire
    },
  },

  shockSigil: {
    onDamageTaken(g, _ev, p) {
      const n = nOf(p, 'shockSigil');
      if (g.time < (g.vars.shockReady ?? 0)) return;
      g.vars.shockReady = g.time + n.cooldown;
      const rod = hasDuo(p, 'lightningRod') ? DUOS.lightningRod.n : null; // Lightning Rod: a strike on every enemy the shockwave hits
      const strikeAt = (e: Enemy) => {
        relicContext.acting = 'lightningRod';
        strike(g, e.x, e.y, relicDamage(p, n.damage) * rod!.mult, rod!.radius);
        relicContext.acting = 'shockSigil';
      };
      const hit = nova(g, p.x, p.y, n.radius, relicDamage(p, n.damage), n.knockback, '#7ec8d8', 'physical', rod ? strikeAt : undefined);
      if (awakened(p, 'shockSigil')) gainArmorStacks(g, p, hit); // Quake Plate
    },
  },

  unbreakable: {
    onIncoming(g, ev, p) {
      const n = nOf(p, 'unbreakable');
      if (ev.blocked || g.time < (g.vars['unbreakable.ready'] ?? 0) || ev.amount <= p.hp * n.over) return;
      ev.blocked = true;
      g.vars['unbreakable.ready'] = g.time + n.every;
      credit(g, p, 'unbreakable', 'prevented', ev.amount, true);
      if (awakened(p, 'unbreakable')) g.vars['adamant.until'] = g.time + aOf('unbreakable').time; // Adamant
    },
    tick(g, _dt, p) {
      if (g.time < (g.vars['adamant.until'] ?? 0)) bonus(p, 'armor', (p.cls.armor + p.mods.armor + talentArmor(g, p)) * aOf('unbreakable').armor);
    },
  },

  aegisFaithful: {
    onAbilityEnd(g, _ev, p) {
      gainArmorStacks(g, p, Math.floor(sOf(p) / nOf(p, 'aegisFaithful').per));
    },
    onHit(g, ev, p) {
      if (awakened(p, 'aegisFaithful') && ev.source === 'ability' && fullArmorStacks(p)) damageEnemy(g, ev.enemy, ev.amount * aOf('aegisFaithful').bonus, false, 0, 0, 'relic', 'holy'); // Consecrated Steel
    },
  },

  ironhide: {
    tick(g, dt, p) {
      if (p.abilityTime <= 0) return;
      if ((g.vars['ironhide.t'] = (g.vars['ironhide.t'] ?? 0) + dt) < nOf(p, 'ironhide').every) return;
      g.vars['ironhide.t'] = 0;
      gainArmorStacks(g, p, 1);
    },
    onBlock(g, _ev, p) {
      if (awakened(p, 'ironhide') && p.abilityTime > 0) relicHeal(g, p, p.stats.hp * aOf('ironhide').heal); // Unstoppable
    },
  },
  // ---------------------------------------------------------------- v0.11 (#217): the Iron Hold
  rivetHammer: {
    onHit(g, ev, p) {
      if (!attackHit(p, ev.source) || ev.enemy.dead) return;
      const n = nOf(p, 'rivetHammer');
      const step = rivetStep(g.vars['rivet.n'] ?? 0, n.every);
      g.vars['rivet.n'] = step.count;
      if (!step.rivet) return;
      const e = ev.enemy;
      if (awakened(p, 'rivetHammer') && !e.def.boss && e.armorHp > 0) {
        e.armorHp = 0; // Sunder: the plate or the shield goes at once, from any side
        floatText(g, e.x, e.y - e.r - 22, 'SUNDERED', F.color, 15);
        burst(g, e.x, e.y, F.color, 10, 200);
      }
      damageEnemy(g, e, relicDamage(p, n.damage), false, 0, 0, 'relic'); // no direction: a rivet is not turned by a shield's front
      gainArmorStacks(g, p, 1);
    },
  },

  pavise: {
    onIncoming(g, ev, p) {
      const e = ev.attacker;
      const n = nOf(p, 'pavise');
      if (ev.blocked || !e || !inFront(p.facing, e.x - p.x, e.y - p.y, n.arc) || g.rng() >= n.chance) return;
      ev.blocked = true;
      g.vars['pavise.front'] = 1; // Riposte answers this block, not another relic's
      credit(g, p, 'pavise', 'prevented', ev.amount, true);
    },
    onBlock(g, ev, p) {
      const front = g.vars['pavise.front'] === 1;
      g.vars['pavise.front'] = 0;
      if (front && awakened(p, 'pavise') && ev.attacker && !ev.attacker.dead) damageEnemy(g, ev.attacker, ev.amount * aOf('pavise').mult, false, 0, 0, 'relic'); // Riposte
    },
  },

  reprisalCuirass: {
    onIncoming(g, ev, p) {
      // the hit's full force, before armor, ward or a block: at the damage taken after armor it read 0.6% in the sim (#217)
      g.vars['reprisal.kept'] = keepReprisal(g.vars['reprisal.kept'] ?? 0, ev.amount, p.stats.hp * nOf(p, 'reprisalCuirass').cap);
    },
    onHit(g, ev, p) {
      const kept = g.vars['reprisal.kept'] ?? 0;
      if (ev.source !== 'attack' || kept <= 0 || ev.enemy.dead) return;
      g.vars['reprisal.kept'] = 0;
      const amount = kept * nOf(p, 'reprisalCuirass').mult;
      const at = ev.enemy;
      damageEnemy(g, at, amount, false, 0, 0, 'relic');
      if (awakened(p, 'reprisalCuirass')) nova(g, at.x, at.y, aOf('reprisalCuirass').radius, amount * aOf('reprisalCuirass').frac, 0, F.color); // Vengeance
      if (hasDuo(p, 'ironTithe')) {
        // Iron Tithe (#218): the reprisal is paid back in blood; its bleed and heal are the duo's work, as Lightning Rod's strikes are
        const d = DUOS.ironTithe.n;
        relicContext.acting = 'ironTithe';
        if (!at.dead) addBleed(g, p, at, d.bleed, amount * d.power);
        relicHeal(g, p, amount * d.heal, true);
        relicContext.acting = 'reprisalCuirass';
      }
    },
  },

  heartOfTheHold: {
    onDamageTaken(g, ev, p) {
      gainArmorStacks(g, p, 1);
      if (ev.attacker && !ev.attacker.dead) damageEnemy(g, ev.attacker, holdThorns(p.armorStacks, relicDamage(p, nOf(p, 'heartOfTheHold').per)), false, 0, 0, 'relic');
    },
    onBlock(g, ev, p) {
      gainArmorStacks(g, p, 1);
      if (ev.attacker && !ev.attacker.dead) damageEnemy(g, ev.attacker, holdThorns(p.armorStacks, relicDamage(p, nOf(p, 'heartOfTheHold').per)), false, 0, 0, 'relic');
    },
    onIncoming(g, ev, p) {
      if (ev.blocked || !awakened(p, 'heartOfTheHold') || !fullArmorStacks(p)) return; // Iron Keep
      const cut = ev.amount * aOf('heartOfTheHold').cut;
      ev.amount -= cut;
      credit(g, p, 'heartOfTheHold', 'prevented', cut, true);
    },
  },

  // ---------------------------------------------------------------- v0.11 (#218): the Iron Hold's class relics
  ironHalo: {
    onAbilityUsed(g, _ev, p) {
      const ability = p.cls.ability;
      if (ability.id !== 'heavenlyRadiance') return;
      gainArmorStacks(g, p, haloStacks(sOf(p), nOf(p, 'ironHalo').per)); // before Radiance's hits land (onHit below), so its first cast strikes too
      if (awakened(p, 'ironHalo')) relicHeal(g, p, perStack(attackDamage(scale.heavenlyRadiance(ability, sOf(p)).heal, p.stats.int), p.armorStacks, aOf('ironHalo').heal), true); // Aureole
    },
    onHit(g, ev, p) {
      if (ev.source !== 'ability' || ev.enemy.dead || p.armorStacks <= 0) return;
      damageEnemy(g, ev.enemy, relicDamage(p, nOf(p, 'ironHalo').damage) * p.armorStacks, false, 0, 0, 'relic', 'holy');
    },
  },

  legionPlate: {
    onHit(g, ev, p) {
      if (ev.source !== 'minion') return;
      const n = nOf(p, 'legionPlate');
      const step = rivetStep(g.vars['legion.n'] ?? 0, n.every);
      g.vars['legion.n'] = step.count;
      if (p.armorStacks > 0 && !ev.enemy.dead) damageEnemy(g, ev.enemy, perStack(ev.amount, p.armorStacks, n.per), false, 0, 0, 'relic');
      if (step.rivet) gainArmorStacks(g, p, 1);
    },
    tick(g, _dt, p) {
      if (!awakened(p, 'legionPlate')) return;
      const hp = aOf('legionPlate').hp;
      for (const m of g.minions) {
        // Iron Legion: every skeleton you raised (not the quest and event units, nor a relic's) gets its plate once
        if (m.kind || m.relicBy || m.ironLegion) continue;
        m.ironLegion = true;
        m.maxHp *= 1 + hp;
        m.hp *= 1 + hp;
      }
    },
  },

  bodkinPoints: {
    onHit(g, ev, p) {
      if (ev.source !== 'attack' || ev.enemy.dead) return;
      const n = nOf(p, 'bodkinPoints');
      const step = bodkinStep(g.vars['bodkin.n'] ?? 0, n.every, awakened(p, 'bodkinPoints') && fullArmorStacks(p)); // Armor-Piercer
      g.vars['bodkin.n'] = step.count;
      if (!step.bodkin) return;
      damageEnemy(g, ev.enemy, ev.amount * bodkinShare(n.mult, n.perFocus, sOf(p)), false, 0, 0, 'relic'); // no direction: no shield's front turns it
      gainArmorStacks(g, p, 1);
    },
  },
};

export const STEEL_SETS: Partial<Record<SetLevel, RelicHooks>> = {
  2: {
    onBlock(g, _ev, p) {
      gainArmorStacks(g, p, 1); // Bulwark
    },
    onDamageTaken(g, _ev, p) {
      gainArmorStacks(g, p, 1);
    },
  },
  4: {
    onDamageTaken(g, ev, p) {
      if (ev.attacker) damageEnemy(g, ev.attacker, ev.amount * F.n.thornsMult * armorOf(p), false, 0, 0, 'relic'); // Spiked
    },
  },
  6: {
    onHit(g, ev, p) {
      if (ev.source !== 'attack' || !fullArmorStacks(p)) return; // Juggernaut: full stacks go out as a shockwave
      nova(g, ev.enemy.x, ev.enemy.y, F.n.quakeRadius, relicDamage(p, F.n.quakePerStack) * p.armorStacks, 300, F.color);
      p.armorStacks = 0;
    },
  },
};
