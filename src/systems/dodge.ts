import { SKILL } from '../config/game';
import { sfx } from '../sim/view';
import { addListener, type GameEvents } from '../core/events';
import type { Enemy, Game, Player } from '../core/types';
import { cooldownFloor } from '../logic/formulas';
import { inTelegraph, isPerfectDodge } from '../logic/telegraph';
import { floatText, ring, shake } from './effects';
import { markStand } from './runlog';

/**
 * v0.6 combat that asks for skill: the perfect dodge (leave a telegraphed attack at the last moment, or roll, blink or leap through
 * it) and the Last Stand (once a run, at 0 HP). Numbers in config/game.ts SKILL.
 */
const MOBILITY = new Set(['dodgeRoll', 'blink', 'leap']);

/** A telegraphed attack landed and missed by a hair: a damage buff, part of the signature ability's cooldown back, and a flash. */
export function perfectDodge(g: Game, p: Player): void {
  const s = SKILL.perfect;
  if (g.time < (p.vars.perfectReady ?? 0)) return;
  p.vars.perfectReady = g.time + s.every;
  p.vars.perfectUntil = g.time + s.time;
  p.abilityCd = Math.max(cooldownFloor({ player: p, time: g.time }), p.abilityCd - p.abilityCdMax * s.refund);
  p.vars.perfects = (p.vars.perfects ?? 0) + 1;
  floatText(g, p.x, p.y - 48, 'PERFECT DODGE', SKILL.colors.perfect, 18);
  ring(g, p.x, p.y, 90, SKILL.colors.perfect, 0.45);
  shake(g, 3);
  sfx(g, 'xp');
}

/** Rolled, blinked or leapt through it just now: it counts even though the body is still inside. */
const throughIt = (g: Game, p: Player) => p.invulnT > 0 && g.time - (p.vars.mobilityAt ?? -9) <= SKILL.perfect.window + 0.1;

/** A zone strikes (combat.ts updateZones): was that a perfect dodge, for player `p` (v0.8 #28: every player)? */
export function zoneStruck(g: Game, p: Player, lastIn: number, inside: boolean): void {
  if (isPerfectDodge(lastIn, g.time, inside) || (inside && throughIt(g, p))) perfectDodge(g, p);
}

/**
 * Line and aim telegraphs (charges, lunges, volleys): while one winds up, remember when the player stood in it; when it fires (the
 * telegraph ran its full course and went away), a player who stepped out in the last moment dodged it perfectly.
 */
export function watchTelegraph(g: Game, e: Enemy): void {
  const t = e.telegraph;
  if (t) {
    g.players.forEach((p, i) => inTelegraph(t, e.x, e.y, p.x, p.y, p.r) && (e.lineIn[i] = g.time)); // v0.8 (#28): every player, by seat
    e.lastTele = t;
    return;
  }
  const last = e.lastTele;
  if (!last) return;
  e.lastTele = null;
  if (last.t < last.dur - 0.05) return; // interrupted (stunned, feared, slain): nothing came
  g.players.forEach((p, i) => {
    const inside = inTelegraph(last, e.x, e.y, p.x, p.y, p.r);
    if (isPerfectDodge(e.lineIn[i] ?? -1, g.time, inside) || (inside && throughIt(g, p))) perfectDodge(g, p);
  });
  e.lineIn = [];
}

/** Every tick, after the mods are rebuilt: the perfect-dodge buff. */
export function dodgePassives(g: Game, p: Player): void {
  if (g.time < (p.vars.perfectUntil ?? 0)) p.mods.damage *= SKILL.perfect.damage;
}

/** The Last Stand: combat.ts calls this when a hit would kill. True when it caught the blow. */
export function lastStand(g: Game, p: Player): boolean {
  if (p.lastStand !== 'ready') return false;
  p.lastStand = 'used';
  p.hp = 1;
  p.invulnT = Math.max(p.invulnT, SKILL.lastStand.time);
  p.vars.lastStandUntil = g.time + SKILL.lastStand.time;
  g.banner = { text: 'Last Stand', t: 2.5 };
  floatText(g, p.x, p.y - 50, 'LAST STAND', '#f4a595', 22);
  ring(g, p.x, p.y, 160, '#c23a2e', 0.8);
  shake(g, 14);
  sfx(g, 'warn');
  markStand(g);
  return true;
}

/** While the Last Stand lasts the signature ability cools down faster (abilities.ts). */
export const lastStandActive = (g: Game, p: Player): boolean => g.time < (p.vars.lastStandUntil ?? 0);

addListener((g, name, ev, p) => {
  if (name === 'onUtilityUsed' && MOBILITY.has((ev as GameEvents['onUtilityUsed']).id)) p.vars.mobilityAt = g.time;
});
