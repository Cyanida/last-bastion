import { GAME } from '../../config/game';
import { FAMILIES, type RelicId, type SetLevel } from '../../config/relics';
import type { Enemy, Game, Player } from '../../core/types';
import { timer } from '../../entities/hazards';
import { critChance } from '../../logic/formulas';
import { rollPlayerHit } from '../combat';
import { attackHit, awakened, bonus, chainFrom, nOf, nova, relicDamage, sOf, strike, type RelicHooks } from '../relicCore';

/**
 * ⚡ Storm (RELICS.md): chains and speed. Relics chain hits to more enemies, turn chains and crits into speed, or call lightning; the sets
 * chain every Nth hit (Arc), strike on crits (Thunderstrike) and stretch chains and reset the utility on kill streaks (Tempest).
 */
const F = FAMILIES.storm;
/** The player's own hit, for "3× your hit" strikes. */
const yourHit = (g: Game, p: Player) => rollPlayerHit(g, p.cls.attack.damage, p.cls.attack.scaling).amount;
/** Eye of the Storm: a chain hit crits on the player's own crit chance. */
const chainCrit = (p: Player) => awakened(p, 'tempestEye') && p.rng() < critChance(p.stats.dex) + p.mods.crit;
const hitCount = (p: Player, key: string) => (p.vars[key] = (p.vars[key] ?? 0) + 1);

export const STORM_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  stormPennant: {
    onHit(g, ev, p) {
      const n = nOf(p, 'stormPennant');
      if (!attackHit(p, ev.source) || p.rng() >= n.chance) return;
      const crit = chainCrit(p);
      chainFrom(g, p, ev.enemy, ev.amount * n.mult * (crit ? GAME.critMult : 1), awakened(p, 'stormPennant') ? 2 : 1, n.range, undefined, crit); // Thunderhead
    },
  },

  quicksilverSpurs: {
    onChain(g, _ev, p) {
      spur(g, p);
    },
    onHit(g, ev, p) {
      if (ev.crit && ev.source !== 'relic') spur(g, p);
    },
    tick(g, dt, p) {
      const n = nOf(p, 'quicksilverSpurs');
      if (g.time > (p.vars['spurs.until'] ?? 0)) p.vars['spurs.stacks'] = 0;
      const stacks = p.vars['spurs.stacks'] ?? 0;
      bonus(p, 'atkSpd', stacks * n.per);
      bonus(p, 'moveSpd', stacks * n.per);
      if (awakened(p, 'quicksilverSpurs') && stacks >= n.max) p.utilityCd = Math.max(0, p.utilityCd - dt * 0.5); // Blur
    },
  },

  tempestEye: {
    onHit(g, ev, p) {
      if (!attackHit(p, ev.source) || !ev.crit) return;
      const n = nOf(p, 'tempestEye');
      const crit = chainCrit(p);
      chainFrom(g, p, ev.enemy, ev.amount * n.mult * (crit ? GAME.critMult : 1), 1, n.range, undefined, crit);
    },
  },

  thunderDrum: {
    onAbilityUsed(g, _ev, p) {
      clap(g, p);
      if (awakened(p, 'thunderDrum')) rollingThunder(g, 1, { p }); // Rolling Thunder
    },
  },

  stormcallersHorn: {
    onKill(g, _ev, p) {
      const n = nOf(p, 'stormcallersHorn');
      if (hitCount(p, 'horn.kills') < n.every) return;
      p.vars['horn.kills'] = 0;
      let target: Enemy | null = null;
      for (const e of g.hash.query(p.x, p.y, n.range, [])) if (!target || e.hp > target.hp) target = e;
      if (!target) return;
      const dmg = yourHit(g, p) * n.mult;
      strike(g, target.x, target.y, dmg, n.radius);
      if (awakened(p, 'stormcallersHorn')) chainFrom(g, p, target, dmg * 0.5, 3, 200); // Skyfury
    },
  },

  galeforceQuiver: {
    tick(_g, _dt, p) {
      bonus(p, 'pierce', Math.floor(sOf(p) / nOf(p, 'galeforceQuiver').per));
    },
    onHit(g, ev, p) {
      if (ev.source !== 'attack') return;
      const n = nOf(p, 'galeforceQuiver');
      const count = hitCount(p, 'gale.hits');
      if (awakened(p, 'galeforceQuiver') && count % 10 === 0) chainFrom(g, p, ev.enemy, ev.amount, 5, n.range); // Gale Shot
      else if (count % 3 === 0) chainFrom(g, p, ev.enemy, ev.amount * n.mult, 1, n.range);
    },
  },

  stormbornPelt: {
    onAbilityUsed(_g, _ev, p) {
      p.vars['thunderGod'] = 0;
    },
    onHit(g, ev, p) {
      if (ev.source !== 'attack' || p.abilityTime <= 0) return;
      const n = nOf(p, 'stormbornPelt');
      if (hitCount(p, 'pelt.hits') % n.every === 0) chainFrom(g, p, ev.enemy, ev.amount * (0.5 + n.perRage * sOf(p)), 1, n.range);
    },
    onKill(_g, _ev, p) {
      if (!awakened(p, 'stormbornPelt') || p.abilityTime <= 0) return;
      const ext = 0.03 * sOf(p); // Thunder God
      if ((p.vars['thunderGod'] ?? 0) + ext > p.abilityDur) return;
      p.vars['thunderGod'] = (p.vars['thunderGod'] ?? 0) + ext;
      p.abilityTime += ext;
    },
  },
};

function spur(g: Game, p: Player): void {
  const n = nOf(p, 'quicksilverSpurs');
  p.vars['spurs.stacks'] = Math.min(n.max, (p.vars['spurs.stacks'] ?? 0) + 1);
  p.vars['spurs.until'] = g.time + n.time;
}

function clap(g: Game, p: Player): void {
  const n = nOf(p, 'thunderDrum');
  const dmg = relicDamage(p, n.damage);
  nova(g, p.x, p.y, n.radius, dmg, 240, F.color, 'physical', (e) => chainFrom(g, p, e, dmg * n.mult, 1, n.range));
}
const rollingThunder = timer('thunderDrum.clap', (g, a: { p: Player }) => clap(g, a.p));

export const STORM_SETS: Partial<Record<SetLevel, RelicHooks>> = {
  2: {
    onHit(g, ev, p) {
      if (!attackHit(p, ev.source)) return;
      const every = sOf(p) >= 15 ? F.n.arcEveryAt15 : F.n.arcEvery;
      if (hitCount(p, 'arc.hits') % every === 0) chainFrom(g, p, ev.enemy, ev.amount * F.n.arcMult, 1, F.n.arcRange); // Arc
    },
  },
  4: {
    onHit(g, ev) {
      if (ev.crit && (ev.source === 'attack' || ev.source === 'ability')) strike(g, ev.enemy.x, ev.enemy.y, ev.amount * F.n.strikeMult, F.n.strikeRadius); // Thunderstrike
    },
  },
  6: {
    // Tempest: chains reach 50% further (relicCore.chainFrom); 10 kills within 5 s reset the utility cooldown
    onKill(g, _ev, p) {
      const times = p.relics.streak.filter((t) => g.time - t < F.n.streakWindow);
      times.push(g.time);
      if (times.length >= F.n.streakKills) {
        p.utilityCd = 0;
        times.length = 0;
      }
      p.relics.streak = times;
    },
  },
};
