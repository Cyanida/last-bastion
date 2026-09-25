import { GAME } from '../../config/game';
import { FAMILIES, type RelicId, type SetLevel } from '../../config/relics';
import type { Enemy } from '../../core/types';
import { applyStatus, damageEnemy, nearestEnemy } from '../combat';
import { addBleed, attackHit, awakened, bonus, cutMaxHp, flash, isBleeding, nOf, relicHeal, type RelicHooks, sOf } from '../relicCore';

/**
 * 🩸 Blood (RELICS.md): bleed, and HP for power. Relics open wounds, reward bleeding enemies or turn missing HP into power; the sets add a
 * stack to every bleed (Open Wounds, in combat.applyStatus), feed on low HP (Bloodlust) and let HP pay for the ability (Blood Magic).
 */
const F = FAMILIES.blood;
const missing = (p: { hp: number; stats: { hp: number } }) => Math.max(0, 1 - p.hp / p.stats.hp);

export const BLOOD_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  serratedEdge: {
    onHit(g, ev, p) {
      if (!attackHit(p, ev.source) || !ev.crit) return;
      const n = nOf(p, 'serratedEdge');
      if (awakened(p, 'serratedEdge') && isBleeding(ev.enemy)) damageEnemy(g, ev.enemy, (ev.amount * 0.2) / GAME.critMult, false, 0, 0, 'relic'); // Haemorrhage
      addBleed(g, p, ev.enemy, n.stacks, ev.amount * n.power);
      flash(g, p, 'serratedEdge'); // its bleed's ticks are credited to it as they land (systems/status.ts)
    },
  },

  butchersHook: {
    tick(g, _dt, p) {
      g.vars['relic.bleedSlow'] = nOf(p, 'butchersHook').slow; // enemyAI reads it for bleeding enemies
    },
    onHit(g, ev, p) {
      if (ev.source !== 'attack' || !isBleeding(ev.enemy)) return;
      damageEnemy(g, ev.enemy, ev.amount * nOf(p, 'butchersHook').bonus, false, 0, 0, 'relic');
    },
    onKill(g, ev, p) {
      const b = ev.enemy.statuses.bleed;
      if (!awakened(p, 'butchersHook') || !b) return;
      // Gutting: its bleed passes to the two enemies nearest it
      const hit: Enemy[] = [ev.enemy];
      for (let i = 0; i < 2; i++) {
        const to = nearestEnemy(g, ev.enemy.x, ev.enemy.y, 180, hit);
        if (!to) break;
        applyStatus(to, { apply: [{ id: 'bleed', stacks: b.stacks, power: b.power }] }, g);
        hit.push(to);
      }
    },
  },

  berserkerTooth: {
    tick(_g, _dt, p) {
      const n = nOf(p, 'berserkerTooth');
      bonus(p, 'atkSpd', Math.min(n.max, missing(p) / n.per)); // Last Blood lives in relicCore.addBleed
    },
  },

  vampireFang: {
    onHit(g, ev, p) {
      if (ev.source === 'relic' || ev.source === 'hazard' || !isBleeding(ev.enemy)) return;
      const thirst = awakened(p, 'vampireFang') && p.hp < p.stats.hp * 0.5 ? 2 : 1; // Thirst
      relicHeal(g, p, ev.amount * nOf(p, 'vampireFang').leech * thirst);
    },
  },

  bloodPact: {
    acquire(g, p) {
      cutMaxHp(g, p, 'bloodPactHp', nOf(p, 'bloodPact').hp); // the cut follows the tier: a tier-up gives the difference back
    },
    remove(g, p) {
      cutMaxHp(g, p, 'bloodPactHp', 1);
    },
    onKill(g, _ev, p) {
      if (awakened(p, 'bloodPact') && p.hp < p.stats.hp * 0.5) relicHeal(g, p, p.stats.hp * 0.01); // Covenant
    },
  },

  wolfskin: {
    onAbilityUsed(_g, _ev, p) {
      p.vars.frenzy = 0;
    },
    onHit(g, ev, p) {
      if (ev.source !== 'attack' || p.abilityTime <= 0) return;
      addBleed(g, p, ev.enemy, 1 + Math.floor(sOf(p) / nOf(p, 'wolfskin').per), ev.amount * 0.1);
    },
    onKill(_g, ev, p) {
      if (awakened(p, 'wolfskin') && p.abilityTime > 0 && isBleeding(ev.enemy)) p.vars.frenzy = Math.min(5, (p.vars.frenzy ?? 0) + 1); // Blood Frenzy
    },
    tick(_g, _dt, p) {
      if (p.abilityTime > 0) bonus(p, 'atkSpd', (p.vars.frenzy ?? 0) * 0.05);
    },
  },
};

export const BLOOD_SETS: Partial<Record<SetLevel, RelicHooks>> = {
  // 2 Open Wounds lives in combat.applyStatus: every bleed from the player gets a stack more
  4: {
    tick(_g, _dt, p) {
      bonus(p, 'damage', Math.min(F.n.lustMax, missing(p) * F.n.perMissing)); // Bloodlust
    },
    onKill(g, ev, p) {
      if (isBleeding(ev.enemy)) relicHeal(g, p, p.stats.hp * F.n.killHeal);
    },
  },
  6: {
    // Blood Magic: with the ability cooling down, pressing it pays HP instead (once per cooldown)
    onAbilityUsed(_g, _ev, p) {
      if (p.vars['bloodMagic.paid']) p.vars['bloodMagic.paid'] = 0; // this was the paid cast: the lock stays until a natural one
      else p.vars['bloodMagic.lock'] = 0;
    },
    tick(g, _dt, p) {
      if (!g.input.ability || p.abilityCd <= 0 || p.vars['bloodMagic.lock']) return;
      p.hp -= p.hp * F.n.hpCost;
      p.abilityCd = 0;
      p.vars['bloodMagic.paid'] = 1;
      p.vars['bloodMagic.lock'] = 1;
    },
  },
};
