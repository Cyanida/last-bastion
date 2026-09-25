import { DUOS, FAMILIES, type RelicId, type SetLevel } from '../../config/relics';
import type { Enemy } from '../../core/types';
import { relicContext } from '../relicContext';
import { applyStatus, damageEnemy } from '../combat';
import { aOf, awakened, bonus, credit, fullArmorStacks, gainArmorStacks, hasDuo, nOf, nova, relicDamage, relicHeal, sOf, strike, type RelicHooks } from '../relicCore';

/**
 * 🛡️ Steel (RELICS.md): armor stacks, block and thorns. Relics block hits (combat.damagePlayer's onIncoming), throw damage back or build armor
 * stacks; the sets give an armor stack for every hit or block (Bulwark), turn armor into thorns (Spiked) and release full stacks as a
 * shockwave (Juggernaut).
 */
const F = FAMILIES.steel;
const armorOf = (p: { cls: { armor: number }; mods: { armor: number }; armorStacks: number }) => p.cls.armor + p.mods.armor + p.armorStacks * F.n.stackArmor;

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
    tick(_g, _dt, p) {
      bonus(p, 'damage', (armorOf(p) * 100) / nOf(p, 'anvilHeart').per / 100);
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
      if (g.time < (g.vars['adamant.until'] ?? 0)) bonus(p, 'armor', (p.cls.armor + p.mods.armor) * aOf('unbreakable').armor);
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
