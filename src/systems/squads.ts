import { SQUAD_REACTIONS } from '../config/ai';
import { sfx } from '../sim/view';
import { addListener, type GameEvents } from '../core/events';
import { compact, dist2 } from '../core/math';
import type { Enemy, Game, Squad } from '../core/types';
import type { SquadPlan } from '../logic/director';
import { commanderOffset, formationOffsets } from '../logic/squads';
import { floatText, ring } from './effects';

export function createSquad(g: Game, plan: SquadPlan, members: Enemy[], commander: Enemy | null, x: number, y: number): Squad {
  const squad: Squad = {
    formation: plan.formation,
    spacing: plan.spacing,
    holdUntil: plan.holdUntil,
    members,
    commander,
    offsets: formationOffsets(plan.formation, members.length, plan.spacing),
    commanderSlot: commanderOffset(plan.formation, members.length, plan.spacing),
    x, y,
    facing: Math.atan2(g.player.y - y, g.player.x - x),
    target: null,
    marching: true,
    retargetT: 0,
  };
  members.forEach((m, i) => Object.assign(m, { squad, slot: i }));
  if (commander) Object.assign(commander, { squad, slot: -1 });
  g.squads.push(squad);
  return squad;
}

/** Formation march: the anchor walks at the pace of the slowest member; members keep their slots (state 'regroup'). */
export function updateSquads(g: Game, dt: number): void {
  for (const sq of g.squads) {
    compact(sq.members, (m) => !m.dead);
    sq.retargetT -= dt;
    const target = sq.target;
    if (sq.retargetT <= 0 || !target || (target !== g.player && !g.minions.some((m) => m === target))) {
      sq.retargetT = 1;
      sq.target = g.player; // one target for the whole squad: whatever is closest to its anchor
      let best = dist2(sq.x, sq.y, g.player.x, g.player.y);
      for (const m of g.minions) {
        const d = dist2(sq.x, sq.y, m.x, m.y);
        if (d < best) (best = d), (sq.target = m);
      }
    }
    if (!sq.marching || !sq.target) continue;
    const dx = sq.target.x - sq.x;
    const dy = sq.target.y - sq.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d <= sq.holdUntil || sq.members.length < 2) {
      sq.marching = false; // close enough: everyone fights on their own state machine from here
      continue;
    }
    sq.facing = Math.atan2(dy, dx);
    const pace = Math.min(...sq.members.map((m) => m.speed), sq.commander?.speed ?? Infinity) * 0.9;
    sq.x += (dx / d) * pace * dt;
    sq.y += (dy / d) * pace * dt;
  }
  compact(g.squads, (sq) => sq.members.length > 0 || (sq.commander !== null && !sq.commander.dead));
}

/** Kill the commander and the squad reacts: some lose heart, some lose their minds. */
addListener((g, name, ev) => {
  if (name !== 'onKill') return;
  const e = (ev as GameEvents['onKill']).enemy;
  const sq = e.squad;
  if (!sq || sq.commander !== e) return;
  sq.commander = null;
  sq.marching = false;
  const r = SQUAD_REACTIONS[e.def.onDeath ?? 'scatter'];
  for (const m of sq.members) {
    if (r.fear > 0) m.fearT = r.fear;
    else Object.assign(m, { buffDmg: r.damage, buffSpd: r.speed, buffT: r.time });
    floatText(g, m.x, m.y - m.r - 14, r.text, r.fear > 0 ? '#a9d8ef' : '#e07b28', 12);
  }
  ring(g, e.x, e.y, 160, r.fear > 0 ? '#a9d8ef' : '#e07b28', 0.6);
  g.banner = { text: `${e.def.name} slain`, t: 1.6 };
  sfx(g, 'levelup');
});
