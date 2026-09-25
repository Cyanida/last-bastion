import type { Cfg } from '../config/classes';
import { RUNES } from '../config/economy';
import { featureSpot } from '../config/regions';
import { TREASURE_RULES, TREASURES, treasureN, type TreasureId } from '../config/treasures';
import { sfx } from '../sim/view';
import { addListener, dispatch, type GameEvents, type Handlers } from '../core/events';
import { dist2, TAU } from '../core/math';
import type { Enemy, Game } from '../core/types';
import { createMinion } from '../entities/actors';
import { addField } from '../entities/hazards';
import { isActEnd } from '../logic/acts';
import { attackDamage } from '../logic/formulas';
import { regionAt } from '../logic/regions';
import { guardianDue, inText, nextFragmentBoss } from '../logic/treasures';
import { damageEnemy, healPlayer } from './combat';
import { burst, floatText, line, ring, shake } from './effects';
import { openRegion, regionsOf } from './regions';
import { spawnEnemy } from './spawning';

/**
 * v0.5 sacred treasures (config/treasures.ts): the chain as it plays out in a run (fragments, the vault, the guardian; the trial is a
 * quest, systems/quests.ts) and the equipped treasure's effect, one hook set per treasure. Hooks read the tier's numbers.
 */
interface TreasureHooks extends Handlers {
  /** Every tick, after p.mods has been reset. */
  tick?(g: Game, n: Record<string, number>): void;
}

const n = (g: Game) => treasureN(g.player.cls.id, g.treasure!.tier);
const treasureOf = (g: Game) => TREASURES[g.player.cls.id];

const HOOKS: Record<TreasureId, TreasureHooks> = {
  // Divine Shield ends: heal part of what it soaked (and more with Faith); the burst leaves holy ground behind
  holyGrail: {
    onAbilityEnd(g) {
      const p = g.player;
      const c = n(g);
      healPlayer(g, p.absorbed * c.heal + p.stats.hp * c.perFaith * p.stats.secondary);
      addField(g, { x: p.x, y: p.y, r: (p.cls.ability as Cfg<'divineShield'>).burstRadius, life: c.ground, dps: attackDamage(c.dps, p.stats.str, p.mods.damage), hostile: false, color: '#f2d675', dtype: 'holy' });
    },
  },

  // Berserker Rage: a Rage-scaled chance per hit to call lightning down, jumping to the nearest enemy not struck yet
  mjolnirShard: {
    onHit(g, ev, p) {
      const c = n(g);
      if (ev.source !== 'attack' || p.abilityTime <= 0 || p.rng() >= Math.min(c.cap, c.chance * p.stats.secondary)) return;
      const struck: Enemy[] = [ev.enemy];
      let from = ev.enemy;
      ring(g, from.x, from.y, 40, '#9fd8ff', 0.3);
      for (let i = 0; i < c.chains; i++) {
        let next: Enemy | null = null;
        for (const e of g.hash.query(from.x, from.y, c.range, [])) {
          if (!e.dead && !struck.includes(e) && (!next || dist2(e.x, e.y, from.x, from.y) < dist2(next.x, next.y, from.x, from.y))) next = e;
        }
        if (!next) break;
        line(g, from.x, from.y, next.x, next.y, '#9fd8ff');
        damageEnemy(g, next, ev.amount * c.mult, false, 0, 0, 'relic');
        struck.push(next);
        from = next;
      }
    },
  },

  // Heavenly Radiance leaves a sun where it was cast: it heals you and burns what stands in it; Grace widens it
  haloOfDawn: {
    onAbilityUsed(g) {
      const p = g.player;
      const c = n(g);
      const dps = attackDamage(c.dps, p.stats.int, p.mods.damage);
      addField(g, { x: p.x, y: p.y, r: c.radius + c.perGrace * p.stats.secondary, life: c.time, dps, heal: c.heal, hostile: false, color: '#ffd76a', dtype: 'fire', apply: { id: 'burn', power: dps * 0.25 } });
    },
  },

  // more minions, and every one that falls (or crumbles) explodes, harder with Soul Power
  bookOfTheDead: {
    tick(g, c) {
      g.player.mods.minionMax += c.minions;
      const blast = c.blast + c.perSoul * g.player.stats.secondary;
      for (const m of g.minions) if (!m.kind && m.volatile < blast) m.volatile = blast;
    },
  },

  // combat.ts splits every g.player.vars.splitEvery-th arrow; Arrow Volley calls spectral hounds (they have a kind: no skeleton slots)
  wildHuntBow: {
    tick(g, c) {
      g.player.vars.splitEvery = Math.max(c.min, c.every - Math.floor(g.player.stats.secondary / c.perFocus));
    },
    onAbilityUsed(g) {
      const p = g.player;
      const c = n(g);
      for (let i = 0; i < c.hounds; i++) {
        const a = (i / c.hounds) * TAU;
        const m = createMinion(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30, { hp: c.hp, damage: attackDamage(c.damage, p.stats.dex), speed: 230, attackCd: 0.6, life: c.time });
        m.kind = 'hound';
        g.minions.push(m);
        burst(g, m.x, m.y, '#9fe0c8', 8);
      }
    },
  },
};

// ---------------------------------------------------------------- the chain

/** A fragment picked up (or a quest's). Past the last one it is a Rune instead. */
export function takeFragment(g: Game): void {
  const c = g.chain;
  const p = g.player;
  if (!c || c.fragments >= TREASURE_RULES.fragments) {
    g.questRunes += RUNES.quest;
    floatText(g, p.x, p.y - 50, '◆ A Rune', '#9fe07b', 15);
    return;
  }
  c.fragments++;
  c.found++;
  g.banner = { text: `A fragment of ${inText(treasureOf(g).name)} (${c.fragments}/${TREASURE_RULES.fragments})`, t: 3 };
  ring(g, p.x, p.y, 110, '#7ec8d8', 0.6);
  sfx(g, 'levelup');
}

/** The trial is done: from now on (this run too) the vault opens after the mid-Act boss. */
export function passTrial(g: Game): void {
  if (!g.chain) return;
  g.chain.trial = g.chain.passed = true;
  g.banner = { text: `${treasureOf(g).trial.name} is passed — the vault will open`, t: 3 };
}

function openVault(g: Game): void {
  if (!g.regionOpen.east) openRegion(g, 'east'); // the vault's corridor runs from the east wing
  openRegion(g, 'vault');
  g.banner = { text: `The hidden vault opens: ${treasureOf(g).guardian.name} waits`, t: 3.5, top: true }; // whichever kill listener runs first
}

/** The guardian: its base boss's def and script, renamed and tinted, x TREASURE_RULES.guardianHp, side content (it does not hold waves or open wings). */
function wakeGuardian(g: Game): void {
  const t = treasureOf(g).guardian;
  const vault = regionsOf(g).find((r) => r.id === 'vault')!;
  const at = featureSpot(vault);
  const e = spawnEnemy(g, t.from, at.x, at.y);
  e.def = { ...e.def, name: t.name, palette: t.palette };
  e.maxHp = e.hp = Math.round(e.hp * TREASURE_RULES.guardianHp);
  e.side = true;
  g.chain!.guardian = e;
  g.banner = { text: `${t.name} wakes`, t: 3 };
  shake(g, 10);
  sfx(g, 'warn');
}

/** Every tick after the talents: the vault's guardian wakes when you walk in; the equipped treasure's tick hook. */
export function updateTreasures(g: Game): void {
  const c = g.chain;
  if (c?.guardian?.dead && !c.slain) c.guardian = null; // swept off the field with the Act: it waits for the next opening
  if (c && g.regionOpen.vault && !c.guardian && !c.slain && regionAt(regionsOf(g), g.player.x, g.player.y)?.id === 'vault') wakeGuardian(g);
  if (g.treasure) HOOKS[g.treasure.id].tick?.(g, n(g));
}

addListener((g, name, ev, p) => {
  if (g.treasure) dispatch(HOOKS[g.treasure.id], g, name, ev, p);
  const c = g.chain;
  if (name !== 'onKill' || !c) return;
  const e = (ev as GameEvents['onKill']).enemy;
  const cls = g.player.cls.id;
  if (e === c.guardian) {
    c.slain = true;
    g.questRunes += TREASURE_RULES.guardianRunes;
    g.banner = { text: `${treasureOf(g).name} is yours${c.tier > 0 ? ', whole at last' : ''}`, t: 4 };
    ring(g, e.x, e.y, 200, '#7ec8d8', 0.9);
  } else if (!e.side && e.def.id === nextFragmentBoss(cls, c)) {
    g.pickups.push({ x: e.x, y: e.y - 12, value: 1, kind: 'fragment' });
    floatText(g, e.x, e.y - 60, '🧩 A fragment!', '#7ec8d8', 17);
  } else if (e.def.boss && !e.side && !isActEnd(g.wave) && !g.regionOpen.vault && guardianDue(cls, c, g.tierIndex)) openVault(g);
});
