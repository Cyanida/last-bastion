import { DUOS, FAMILIES, type RelicId, type SetLevel } from '../../config/relics';
import type { Enemy, Game, Player } from '../../core/types';
import { addField } from '../../entities/hazards';
import { damageEnemy, nearestEnemy } from '../combat';
import { burst, line } from '../effects';
import { baptismHeal, bonefireBurn, leapStacks, pitchDrips, spark, stoke } from '../../logic/relics';
import { relicContext } from '../relicContext';
import { addBurn, aOf, attackHit, awakened, bonus, burnStacks, cone, flash, hasDuo, maxBurn, nOf, nova, relicDamage, relicHeal, type RelicHooks, sOf } from '../relicCore';

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

/**
 * Flashpowder (#229): `e` flares: fire damage and a burn stack to everything round it. Awakened (Chain Reaction), each enemy the flare
 * brings up to the stack count flares too, one link only (`link` false), so a crowd goes up in a ring of bursts and not a runaway.
 */
function flare(g: Game, p: Player, e: Enemy, link: boolean): void {
  const n = nOf(p, 'flashpowder');
  const need = aOf('flashpowder').stacks;
  const caught: Enemy[] = [];
  const hit = nova(g, e.x, e.y, n.radius, relicDamage(p, n.damage), 80, F.color, 'fire', (o) => {
    const before = burnStacks(o);
    addBurn(g, p, o, 1, relicDamage(p, n.power));
    if (o !== e && before < need && burnStacks(o) >= need) caught.push(o);
  });
  burst(g, e.x, e.y, F.color, 16, 260);
  if (hasDuo(p, 'baptismOfFire')) {
    // Baptism of Fire (#230): the flare's fire cleanses; the heal is the duo's work, as Iron Tithe's is in the cuirass's reprisal
    const d = DUOS.baptismOfFire.n;
    const outer = relicContext.acting;
    relicContext.acting = 'baptismOfFire';
    relicHeal(g, p, baptismHeal(p.stats.hp, d.heal, hit, d.max), true);
    relicContext.acting = outer;
  }
  if (link && awakened(p, 'flashpowder')) for (const o of caught) if (!o.dead) flare(g, p, o, false);
}

/**
 * Surtr's Brand (#230): the stoked axe bursts out round the Viking: fire damage per stoke and burn stacks to everything near, and the
 * count starts again.
 */
function erupt(g: Game, p: Player): void {
  const n = nOf(p, 'surtrsBrand');
  const stokes = g.vars['surtr.n'] ?? 0;
  g.vars['surtr.n'] = 0;
  if (stokes <= 0) return;
  nova(g, p.x, p.y, n.radius, relicDamage(p, n.damage) * stokes, 80, F.color, 'fire', (e) => addBurn(g, p, e, n.stacks, relicDamage(p, n.power)));
  burst(g, p.x, p.y, F.color, 24, 320);
}

/** Pitch Pot (#229): does `e` stand in a patch of its burning pitch? */
const inPitch = (g: Game, e: Enemy): boolean => g.fields.some((f) => f.by === 'pitchPot' && (f.x - e.x) ** 2 + (f.y - e.y) ** 2 <= f.r * f.r);

export const FLAME_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  brimstoneOil: {
    onHit(g, ev, p) {
      const n = nOf(p, 'brimstoneOil');
      if (ev.source === 'ability' && awakened(p, 'brimstoneOil')) addBurn(g, p, ev.enemy, aOf('brimstoneOil').stacks, ev.amount * n.power); // Hellfire
      if (!attackHit(p, ev.source) || g.rng() >= n.chance) return;
      addBurn(g, p, ev.enemy, 1, ev.amount * n.power);
      flash(g, p, 'brimstoneOil'); // its burn's ticks are credited to it as they land (systems/status.ts)
    },
  },

  emberheart: {
    tick(g, _dt, p) {
      const n = nOf(p, 'emberheart');
      const burning = g.hash.query(p.x, p.y, n.radius, []).filter((e) => burnStacks(e) > 0).length;
      bonus(p, 'damage', Math.min(n.max, burning) * n.per);
      g.vars['emberheart.kindled'] = awakened(p, 'emberheart') && burning >= aOf('emberheart').count ? 1 : 0;
    },
    onHit(g, ev, p) {
      if (g.vars['emberheart.kindled'] && attackHit(p, ev.source)) addBurn(g, p, ev.enemy, 1, ev.amount * aOf('emberheart').power); // Kindled
    },
  },

  cinderCharm: {
    onKill(g, ev, p) {
      if (burnStacks(ev.enemy) === 0) return;
      const n = nOf(p, 'cinderCharm');
      const throws = awakened(p, 'cinderCharm') ? aOf('cinderCharm').throws : 1; // Ember Storm
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
      const a = aOf('salamanderScale');
      addField(g, { x: ev.enemy.x, y: ev.enemy.y, r: a.radius, life: a.life, dps: relicDamage(p, a.dps), hostile: false, color: F.color, dtype: 'fire', apply: { id: 'burn', stacks: 1, power: relicDamage(p, a.power) } }); // Scorched Earth
    },
  },

  emberMantle: {
    tick(g, dt, p) {
      const n = nOf(p, 'emberMantle');
      if ((g.vars['mantle.t'] = (g.vars['mantle.t'] ?? 0) + dt) >= n.every) {
        g.vars['mantle.t'] = 0;
        const near = g.hash.query(p.x, p.y, n.radius, []);
        for (const e of near) addBurn(g, p, e, n.stacks, relicDamage(p, n.power));
        if (near.length) {
          flash(g, p, 'emberMantle'); // its burn's ticks are credited to it as they land (systems/status.ts)
          burst(g, p.x, p.y, F.color, 10, 200);
        }
      }
      if (!awakened(p, 'emberMantle')) return;
      const a = aOf('emberMantle');
      if ((g.vars['mantle.walk'] = (g.vars['mantle.walk'] ?? 0) + dt) < a.every) return;
      g.vars['mantle.walk'] = 0;
      addField(g, { x: p.x, y: p.y, r: a.radius, life: a.life, dps: relicDamage(p, a.dps), hostile: false, color: F.color, dtype: 'fire' }); // Firewalk
    },
  },

  dragonsTongue: {
    tick(g, dt) {
      g.vars['dragon.t'] = (g.vars['dragon.t'] ?? 0) + dt;
    },
    onHit(g, ev, p) {
      const n = nOf(p, 'dragonsTongue');
      if (ev.source !== 'attack' || (g.vars['dragon.t'] ?? 0) < n.every) return;
      g.vars['dragon.t'] = 0;
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
      const a = aOf('fireArrows');
      addField(g, { x: g.input.aimX, y: g.input.aimY, r: a.radius, life: a.life, dps: relicDamage(p, a.dps), hostile: false, color: F.color, dtype: 'fire' }); // Rain of Cinders
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
      const a = aOf('radiantBrand');
      if ((g.vars['dawn.t'] = (g.vars['dawn.t'] ?? 0) + dt) < a.every) return;
      g.vars['dawn.t'] = 0;
      for (const e of g.hash.query(p.x, p.y, p.r + a.reach, [])) {
        const b = e.statuses.burn;
        if (b) damageEnemy(g, e, b.power * b.stacks, false, 0, 0, 'relic', 'fire');
      }
    },
  },

  // ---------------------------------------------------------------- v0.12 (#229): the Cinderlands
  flashpowder: {
    onHit(g, ev, p) {
      // a hit of yours (an attack, an ability, a hit your minions land with Legion), not a relic's burst or a burn's tick
      if (!attackHit(p, ev.source) && ev.source !== 'ability') return;
      const n = nOf(p, 'flashpowder');
      const does = spark(burnStacks(ev.enemy), n.stacks, g.time, g.vars['powder.t'] ?? -99, n.every);
      if (!does || ev.enemy.dead) return;
      g.vars['powder.t'] = g.time;
      if (does === 'flare') flare(g, p, ev.enemy, true);
      else if (ev.enemy.hp > 0) addBurn(g, p, ev.enemy, n.light, relicDamage(p, n.power)); // not burning enough yet: the powder lights it for the next spark
    },
  },

  pitchPot: {
    tick(g, dt, p) {
      const n = nOf(p, 'pitchPot');
      if ((g.vars['pitch.t'] = (g.vars['pitch.t'] ?? 0) + dt) < n.every) return;
      g.vars['pitch.t'] = 0;
      const laid = g.fields.reduce((c, f) => c + (f.by === 'pitchPot' ? 1 : 0), 0);
      const near = g.hash.query(p.x, p.y, n.reach, []).filter((e) => !e.dead);
      for (const e of pitchDrips(near, (o) => burnStacks(o) > 0, p.x, p.y, n.reach, n.max - laid, (o) => inPitch(g, o))) {
        addField(g, { x: e.x, y: e.y, r: n.radius, life: n.life, dps: relicDamage(p, n.dps), hostile: false, color: F.color, dtype: 'fire', apply: { id: 'burn', stacks: 1, power: relicDamage(p, n.power) } });
        burst(g, e.x, e.y, F.color, 6, 120);
      }
    },
    onKill(g, ev, p) {
      if (awakened(p, 'pitchPot') && inPitch(g, ev.enemy)) pyre(g, p, ev.enemy); // Tar Pit
    },
  },

  crownOfCinders: {
    onHit(g, ev, p) {
      if (attackHit(p, ev.source) && ev.enemy.hp > 0 && burnStacks(ev.enemy) === 0) addBurn(g, p, ev.enemy, 1, relicDamage(p, nOf(p, 'crownOfCinders').power));
    },
    onKill(g, ev, p) {
      // the dead enemy's burn is still on it when onKill runs (killEnemy clears nothing), so its stacks and power pass on as they were
      const b = ev.enemy.statuses.burn;
      if (!b || b.stacks <= 0) return;
      const n = nOf(p, 'crownOfCinders');
      const woke = awakened(p, 'crownOfCinders'); // Conflagration
      const stacks = leapStacks(b.stacks, woke ? aOf('crownOfCinders').extra : 0);
      const power = b.power;
      nova(g, ev.enemy.x, ev.enemy.y, woke ? aOf('crownOfCinders').reach : n.radius, relicDamage(p, n.damage), 60, F.color, 'fire', (e) => addBurn(g, p, e, stacks, power));
      burst(g, ev.enemy.x, ev.enemy.y, F.color, 12, 220);
    },
  },

  // ---------------------------------------------------------------- v0.12 (#230): the Cinderlands' class relics
  surtrsBrand: {
    onAbilityUsed(g) {
      g.vars['surtr.n'] = 0;
    },
    onHit(g, ev, p) {
      if (ev.source !== 'attack' || p.abilityTime <= 0) return;
      const step = stoke(g.vars['surtr.n'] ?? 0, nOf(p, 'surtrsBrand').base, sOf(p));
      g.vars['surtr.n'] = step.count;
      if (step.full && awakened(p, 'surtrsBrand')) erupt(g, p); // Twilight
    },
    onAbilityEnd(g, _ev, p) {
      erupt(g, p);
    },
  },

  bonefire: {
    tick(g, dt, p) {
      const a = aOf('bonefire');
      for (const m of g.minions) {
        // every skeleton you raise (not the quest and event units, nor a relic's) is seen once, as it rises; Balefire bursts there
        if (m.kind || m.relicBy || m.bonefire) continue;
        m.bonefire = true;
        if (!awakened(p, 'bonefire')) continue;
        nova(g, m.x, m.y, a.radius, relicDamage(p, a.damage), 60, F.color, 'fire', (e) => addBurn(g, p, e, a.stacks, relicDamage(p, nOf(p, 'bonefire').power)));
        burst(g, m.x, m.y, F.color, 12, 220);
      }
      const n = nOf(p, 'bonefire');
      if ((g.vars['bonefire.t'] = (g.vars['bonefire.t'] ?? 0) + dt) < n.every) return;
      g.vars['bonefire.t'] = 0;
      const power = bonefireBurn(relicDamage(p, n.power), n.perSoul, sOf(p));
      let lit = false;
      for (const m of g.minions) {
        if (m.kind) continue;
        for (const e of g.hash.query(m.x, m.y, n.radius, [])) {
          if (e.dead) continue;
          addBurn(g, p, e, 1, power);
          lit = true;
        }
      }
      if (lit) flash(g, p, 'bonefire'); // its burn's ticks are credited to it as they land (systems/status.ts)
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
      if ((g.vars['inferno.t'] = (g.vars['inferno.t'] ?? 0) + dt) < n.spreadEvery) return;
      g.vars['inferno.t'] = 0;
      for (const e of g.enemies) {
        if (e.dead || !e.statuses.burn) continue;
        const to = nearestEnemy(g, e.x, e.y, n.spreadRange, e);
        if (to) addBurn(g, p, to, 1, e.statuses.burn.power);
      }
    },
  },
};

