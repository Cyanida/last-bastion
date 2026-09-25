import { FAMILIES, type RelicId, type SetLevel } from '../../config/relics';
import type { Enemy, Game, Player } from '../../core/types';
import { addField } from '../../entities/hazards';
import { damageEnemy, nearestEnemy } from '../combat';
import { burst, line } from '../effects';
import { addBurn, attackHit, awakened, bonus, burnStacks, cone, flash, maxBurn, nOf, nova, relicDamage, type RelicHooks, sOf } from '../relicCore';

/**
 * 🔥 Flame (RELICS.md): burn stacks and fire bursts. Every relic adds burn stacks or rewards them; the sets make burns stack higher (Stoked),
 * burst on death (Pyre) and spread (Inferno).
 */
const F = FAMILIES.flame;

/** Pyre (4) and Solar Flare: a burning enemy's death bursts for a share of its max HP (+1% per point of S). */
function pyre(g: Game, p: Player, e: Enemy): void {
  const n = F.n;
  const dmg = e.maxHp * (n.pyreFrac + n.pyrePerS * sOf(p));
  nova(g, e.x, e.y, n.pyreRadius, dmg, 120, F.color, 'fire');
  burst(g, e.x, e.y, F.color, 14, 240);
}

export const FLAME_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  brimstoneOil: {
    onHit(g, ev, p) {
      const n = nOf(p, 'brimstoneOil');
      if (ev.source === 'ability' && awakened(p, 'brimstoneOil')) addBurn(g, p, ev.enemy, 2, ev.amount * n.power); // Hellfire
      if (!attackHit(p, ev.source) || p.rng() >= n.chance) return;
      addBurn(g, p, ev.enemy, 1, ev.amount * n.power);
      flash(g, p, 'brimstoneOil'); // its burn's ticks are credited to it as they land (systems/status.ts)
    },
  },

  emberheart: {
    tick(g, _dt, p) {
      const n = nOf(p, 'emberheart');
      const burning = g.hash.query(p.x, p.y, n.radius, []).filter((e) => burnStacks(e) > 0).length;
      bonus(p, 'damage', Math.min(n.max, burning) * n.per);
      p.vars['emberheart.kindled'] = awakened(p, 'emberheart') && burning >= 5 ? 1 : 0;
    },
    onHit(g, ev, p) {
      if (p.vars['emberheart.kindled'] && attackHit(p, ev.source)) addBurn(g, p, ev.enemy, 1, ev.amount * 0.2); // Kindled
    },
  },

  cinderCharm: {
    onKill(g, ev, p) {
      if (burnStacks(ev.enemy) === 0) return;
      const n = nOf(p, 'cinderCharm');
      const throws = awakened(p, 'cinderCharm') ? 3 : 1; // Ember Storm
      const hit: Enemy[] = [ev.enemy];
      for (let i = 0; i < throws; i++) {
        const to = nearestEnemy(g, ev.enemy.x, ev.enemy.y, n.range, hit);
        if (!to) return;
        line(g, ev.enemy.x, ev.enemy.y, to.x, to.y, F.color);
        addBurn(g, p, to, n.stacks, relicDamage(p, 4));
        flash(g, p, 'cinderCharm'); // its burn's ticks are credited to it as they land (systems/status.ts)
        hit.push(to);
      }
    },
  },

  salamanderScale: {
    onHit(g, ev, p) {
      const n = nOf(p, 'salamanderScale');
      if (ev.source === 'relic' || burnStacks(ev.enemy) < n.stacks) return;
      damageEnemy(g, ev.enemy, ev.amount * n.bonus, false, 0, 0, 'relic', 'fire'); // the bonus as relic damage on top (credited to the Scale)
    },
    onKill(g, ev, p) {
      if (!awakened(p, 'salamanderScale') || burnStacks(ev.enemy) < maxBurn(p)) return;
      addField(g, { x: ev.enemy.x, y: ev.enemy.y, r: 60, life: 3, dps: relicDamage(p, 8), hostile: false, color: F.color, dtype: 'fire', apply: { id: 'burn', stacks: 1, power: relicDamage(p, 3) } }); // Scorched Earth
    },
  },

  dragonsTongue: {
    tick(_g, dt, p) {
      p.vars['dragon.t'] = (p.vars['dragon.t'] ?? 0) + dt;
    },
    onHit(g, ev, p) {
      const n = nOf(p, 'dragonsTongue');
      if (ev.source !== 'attack' || (p.vars['dragon.t'] ?? 0) < n.every) return;
      p.vars['dragon.t'] = 0;
      const angle = Math.atan2(ev.enemy.y - p.y, ev.enemy.x - p.x);
      for (const e of cone(g, p, angle, n.range, n.arc)) {
        if (awakened(p, 'dragonsTongue') && e.statuses.burn) {
          // Wyrmfire: the burn's remaining damage, at once
          const rest = e.statuses.burn.power * e.statuses.burn.stacks * e.statuses.burn.time;
          delete e.statuses.burn;
          damageEnemy(g, e, rest, false, 0, 0, 'relic', 'fire');
        }
        addBurn(g, p, e, n.stacks, ev.amount * 0.2);
        flash(g, p, 'dragonsTongue'); // its burn's ticks are credited to it as they land (systems/status.ts)
      }
      burst(g, p.x + Math.cos(angle) * 60, p.y + Math.sin(angle) * 60, F.color, 24, 320);
    },
  },

  fireArrows: {
    onHit(g, ev, p) {
      if (ev.source !== 'ability') return;
      const power = ev.amount * 0.2 * (1 + nOf(p, 'fireArrows').perFocus * sOf(p));
      addBurn(g, p, ev.enemy, 1, power);
      flash(g, p, 'fireArrows'); // its burn's ticks are credited to it as they land (systems/status.ts)
    },
    onAbilityUsed(g, _ev, p) {
      if (!awakened(p, 'fireArrows')) return;
      addField(g, { x: g.input.aimX, y: g.input.aimY, r: 110, life: 3, dps: relicDamage(p, 10), hostile: false, color: F.color, dtype: 'fire' }); // Rain of Cinders
    },
  },

  sunfireCenser: {
    onHit(g, ev, p) {
      if (ev.source !== 'ability') return;
      const stacks = 1 + Math.floor(sOf(p) / nOf(p, 'sunfireCenser').per);
      addBurn(g, p, ev.enemy, stacks, ev.amount * 0.15);
      flash(g, p, 'sunfireCenser'); // its burn's ticks are credited to it as they land (systems/status.ts)
    },
    onKill(g, ev, p) {
      if (awakened(p, 'sunfireCenser') && ev.source === 'ability') pyre(g, p, ev.enemy); // Solar Flare
    },
  },

  radiantBrand: {
    onHit(g, ev, p) {
      if (ev.source !== 'ability') return;
      const n = nOf(p, 'radiantBrand');
      const stacks = n.base + Math.floor(sOf(p) / n.per);
      addBurn(g, p, ev.enemy, stacks, ev.amount * 0.1);
      flash(g, p, 'radiantBrand'); // its burn's ticks are credited to it as they land (systems/status.ts)
    },
    tick(g, dt, p) {
      if (!awakened(p, 'radiantBrand') || !p.invulnerable) return;
      // Pillar of Dawn: while the shield holds, burning enemies touching you take their burn again every second
      if ((p.vars['dawn.t'] = (p.vars['dawn.t'] ?? 0) + dt) < 1) return;
      p.vars['dawn.t'] = 0;
      for (const e of g.hash.query(p.x, p.y, p.r + 40, [])) {
        const b = e.statuses.burn;
        if (b) damageEnemy(g, e, b.power * b.stacks, false, 0, 0, 'relic', 'fire');
      }
    },
  },
};

export const FLAME_SETS: Partial<Record<SetLevel, RelicHooks>> = {
  // 2 Stoked lives in addBurn (relicCore): one more stack, 1% burn damage per point of S
  4: {
    onKill(g, ev, p) {
      if (burnStacks(ev.enemy) > 0 && !ev.enemy.def.boss) pyre(g, p, ev.enemy); // Pyre
    },
  },
  6: {
    onHit(g, ev, p) {
      if (ev.source !== 'relic') addBurn(g, p, ev.enemy, 1, ev.amount * 0.1); // Inferno: all your damage burns
    },
    tick(g, dt, p) {
      const n = F.n;
      if ((p.vars['inferno.t'] = (p.vars['inferno.t'] ?? 0) + dt) < n.spreadEvery) return;
      p.vars['inferno.t'] = 0;
      for (const e of g.enemies) {
        if (e.dead || !e.statuses.burn) continue;
        const to = nearestEnemy(g, e.x, e.y, n.spreadRange, e);
        if (to) addBurn(g, p, to, 1, e.statuses.burn.power);
      }
    },
  },
};

