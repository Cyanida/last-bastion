import { SKILL } from '../config/game';
import { sfx } from '../core/audio';
import { addListener, type GameEvents } from '../core/events';
import type { Enemy, Game } from '../core/types';
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
export function perfectDodge(g: Game): void {
  const s = SKILL.perfect;
  if (g.time < (g.vars.perfectReady ?? 0)) return;
  const p = g.player;
  g.vars.perfectReady = g.time + s.every;
  g.vars.perfectUntil = g.time + s.time;
  p.abilityCd = Math.max(cooldownFloor(g), p.abilityCd - p.abilityCdMax * s.refund);
  g.vars.perfects = (g.vars.perfects ?? 0) + 1;
  floatText(g, p.x, p.y - 48, 'PERFECT DODGE', SKILL.colors.perfect, 18);
  ring(g, p.x, p.y, 90, SKILL.colors.perfect, 0.45);
  shake(g, 3);
  sfx('xp');
}

/** Rolled, blinked or leapt through it just now: it counts even though the body is still inside. */
const throughIt = (g: Game) => g.player.invulnT > 0 && g.time - (g.vars.mobilityAt ?? -9) <= SKILL.perfect.window + 0.1;

/** A zone strikes (combat.ts updateZones): was that a perfect dodge? */
export function zoneStruck(g: Game, lastIn: number, inside: boolean): void {
  if (isPerfectDodge(lastIn, g.time, inside) || (inside && throughIt(g))) perfectDodge(g);
}

/**
 * Line and aim telegraphs (charges, lunges, volleys): while one winds up, remember when the player stood in it; when it fires (the
 * telegraph ran its full course and went away), a player who stepped out in the last moment dodged it perfectly.
 */
export function watchTelegraph(g: Game, e: Enemy): void {
  const p = g.player;
  const t = e.telegraph;
  if (t) {
    if (inTelegraph(t, e.x, e.y, p.x, p.y, p.r)) e.lineIn = g.time;
    e.lastTele = t;
    return;
  }
  const last = e.lastTele;
  if (!last) return;
  e.lastTele = null;
  if (last.t < last.dur - 0.05) return; // interrupted (stunned, feared, slain): nothing came
  const inside = inTelegraph(last, e.x, e.y, p.x, p.y, p.r);
  if (isPerfectDodge(e.lineIn, g.time, inside) || (inside && throughIt(g))) perfectDodge(g);
  e.lineIn = -1;
}

/** Every tick, after the mods are rebuilt: the perfect-dodge buff. */
export function dodgePassives(g: Game): void {
  if (g.time < (g.vars.perfectUntil ?? 0)) g.player.mods.damage *= SKILL.perfect.damage;
}

/** The Last Stand: combat.ts calls this when a hit would kill. True when it caught the blow. */
export function lastStand(g: Game): boolean {
  if (g.lastStand !== 'ready') return false;
  const p = g.player;
  g.lastStand = 'used';
  p.hp = 1;
  p.invulnT = Math.max(p.invulnT, SKILL.lastStand.time);
  g.vars.lastStandUntil = g.time + SKILL.lastStand.time;
  g.banner = { text: 'Last Stand', t: 2.5 };
  floatText(g, p.x, p.y - 50, 'LAST STAND', '#f4a595', 22);
  ring(g, p.x, p.y, 160, '#c23a2e', 0.8);
  shake(g, 14);
  sfx('warn');
  markStand(g);
  return true;
}

/** While the Last Stand lasts the signature ability cools down faster (abilities.ts). */
export const lastStandActive = (g: Game): boolean => g.time < (g.vars.lastStandUntil ?? 0);

addListener((g, name, ev) => {
  if (name === 'onUtilityUsed' && MOBILITY.has((ev as GameEvents['onUtilityUsed']).id)) g.vars.mobilityAt = g.time;
});
