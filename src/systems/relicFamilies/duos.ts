import type { Player } from '../../core/types';
import { DUOS, FAMILIES, relicN, type DuoId } from '../../config/relics';
import { damageEnemy } from '../combat';
import { ring } from '../effects';
import { addBleed, addBurn, addChill, attackHit, chainFrom, gainWard, isBleeding, isCursed, isFrozen, nova, raiseSkeleton, relicDamage, relicHeal, skeletonsBy, tierOf, type RelicHooks } from '../relicCore';
import { freeze } from './frost';

/**
 * v0.7 A5 duo relics (RELICS.md): each joins the core mechanics of its two families. Lightning Rod lives in the Shockwave Sigil (steel.ts) and
 * Consecration's ward half in relicCore.gainWard, where the thing they change happens.
 */
const n = <D extends DuoId>(d: D) => DUOS[d].n;
const every = (p: Player, key: string, dt: number, period: number) => (p.vars[key] = (p.vars[key] ?? 0) + dt) >= period && ((p.vars[key] = 0), true);

export const DUO_HOOKS: Partial<Record<DuoId, RelicHooks>> = {
  thermalShock: {
    onFreeze(g, ev) {
      const burn = ev.enemy.statuses.burn;
      if (!burn) return;
      delete ev.enemy.statuses.burn; // the rest of the burn, twice, at once
      damageEnemy(g, ev.enemy, burn.power * burn.stacks * burn.time * n('thermalShock').mult, false, 0, 0, 'relic', 'fire');
    },
  },

  wildfire: {
    onChain(g, ev, p) {
      const burn = ev.from.statuses.burn;
      if (burn) addBurn(g, p, ev.enemy, burn.stacks, burn.power);
    },
  },

  boilingBlood: {
    tick(g, dt, p) {
      const d = n('boilingBlood');
      if (!every(p, 'boil.t', dt, d.every)) return;
      for (const e of g.enemies) {
        const burn = e.statuses.burn;
        const bleed = e.statuses.bleed;
        if (!burn || !bleed || e.dead) continue; // both ticks, half again as fast: the extra half as relic damage
        damageEnemy(g, e, (burn.power * burn.stacks + bleed.power * bleed.stacks) * d.every * d.faster, false, 0, 0, 'relic', 'fire');
      }
    },
  },

  funeralPyre: {
    tick(g, dt, p) {
      const d = n('funeralPyre');
      if (!every(p, 'pyre.t', dt, d.every)) return;
      const fire = [...g.enemies.filter((e) => !e.dead && e.statuses.burn), ...g.fields.filter((f) => !f.hostile && f.dtype === 'fire')];
      for (let i = g.corpses.length - 1; i >= 0; i--) {
        const c = g.corpses[i];
        if (!fire.some((f) => Math.hypot(f.x - c.x, f.y - c.y) < f.r + d.touch)) continue;
        g.corpses.splice(i, 1); // a Pyre explosion
        nova(g, c.x, c.y, FAMILIES.flame.n.pyreRadius, relicDamage(p, d.damage), 120, FAMILIES.flame.color, 'fire');
      }
    },
  },

  hailstorm: {
    onChain(g, ev, p) {
      const d = n('hailstorm');
      addChill(g, p, ev.enemy, d.chill);
      if (isFrozen(g, ev.enemy)) chainFrom(g, p, ev.enemy, ev.amount, d.jumps, d.range); // proc depth keeps it from chaining forever
    },
  },

  rimeDead: {
    onHit(g, ev, p) {
      if (ev.source === 'minion') addChill(g, p, ev.enemy, n('rimeDead').chill);
    },
    onKill(g, ev, p) {
      const d = n('rimeDead');
      if (isFrozen(g, ev.enemy) && skeletonsBy(g, 'rimeDead') < d.max) raiseSkeleton(g, p, ev.enemy.x, ev.enemy.y, 'rimeDead', { hp: d.hp, damage: d.damage, life: d.life });
    },
  },

  glacierPlate: {
    onBlock(g, ev) {
      if (ev.attacker && !ev.attacker.dead) freeze(g, ev.attacker, n('glacierPlate').freeze);
    },
  },

  redLightning: {
    onChain(g, ev, p) {
      const d = n('redLightning');
      addBleed(g, p, ev.enemy, d.bleed, ev.amount * d.power);
    },
    onHit(g, ev, p) {
      const d = n('redLightning');
      if (ev.crit && attackHit(p, ev.source) && isBleeding(ev.enemy)) chainFrom(g, p, ev.enemy, ev.amount * d.mult, d.jumps, d.range);
    },
  },

  martyrsCovenant: {
    onDamageTaken(_g, ev, p) {
      p.vars['covenant.pool'] = (p.vars['covenant.pool'] ?? 0) + ev.amount * n('martyrsCovenant').share;
    },
    tick(g, dt, p) {
      const pool = p.vars['covenant.pool'] ?? 0;
      if (pool <= 0) return;
      const give = Math.min(pool, (pool * dt) / n('martyrsCovenant').over + dt); // it drains over about 3 s
      p.vars['covenant.pool'] = pool - give;
      gainWard(g, p, give);
    },
  },

  requiem: {
    onKill(g, ev, p) {
      if (!isCursed(ev.enemy)) return;
      ring(g, ev.enemy.x, ev.enemy.y, 26, FAMILIES.holy.color, 0.4); // a mercy orb, as Halo of Mercy's (at its tier)
      relicHeal(g, p, p.stats.hp * relicN('haloOfMercy', Math.max(1, tierOf(p, 'haloOfMercy'))).heal, true);
    },
  },

  consecration: {
    onBlock(g, _ev, p) {
      relicHeal(g, p, p.stats.hp * n('consecration').heal);
    },
  },
};
