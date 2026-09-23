import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import { ENEMIES } from '../config/enemies';
import { EVENTS } from '../config/events';
import { RUN_LOG } from '../config/game';
import { relicDef, TIER_NUMERALS } from '../config/relics';
import { TALENT_BY_ID } from '../config/talents';
import { UTILITY_UPGRADES } from '../config/utility';
import { addListener, type GameEvents } from '../core/events';
import type { Game } from '../core/types';
import { actName } from '../logic/acts';
import { round1, type MarkKind, type RunLog, type RunLogDraft } from '../logic/runlog';

/**
 * v0.6: records the run log as the run goes. It compares a few counters every tick instead of hooking every system,
 * so a new kind of pick only needs a line here. Wave rows come from the wave-start and damage events.
 */

/** After the run is set up: what it starts with (Veteran Levies, the mastery relic, a trait's talent) is not something that happened. */
export function startRunLog(g: Game): void {
  const s = g.log.seen;
  s.level = g.player.level;
  s.relics = g.relicsFound.length;
  s.talents = g.player.talents.length;
  if ((s.board = g.pendingBoard)) mark(g, 'board', actName(g.act)); // Act I's board is up before the first tick (the bot answers it before one)
}

/** True the tick a flag turns on. */
function rose(s: RunLogDraft['seen'], key: 'board' | 'shrine' | 'merchant', now: boolean): boolean {
  const was = s[key];
  s[key] = now;
  return now && !was;
}

const mark = (g: Game, kind: MarkKind, detail: string) => g.log.marks.push([round1(g.time), kind, detail]);

export function updateRunLog(g: Game, dt: number): void {
  const s = g.log.seen;
  const p = g.player;
  const row = g.log.waves[g.wave - 1];
  if (row && g.enemies.length < RUN_LOG.quietBelow) row[3] += dt;
  for (; s.cleared < g.wavesCleared; s.cleared++) if (g.log.waves[s.cleared]) g.log.waves[s.cleared][1] = round1(g.time);
  while (s.level < p.level) mark(g, 'level', String(++s.level));
  for (; s.relics < g.relicsFound.length; s.relics++) {
    const id = g.relicsFound[s.relics];
    mark(g, 'relic', `${relicDef(id).name} ${TIER_NUMERALS[g.relicTiers[id] ?? 1]}`);
  }
  for (; s.talents < p.talents.length; s.talents++) mark(g, 'talent', TALENT_BY_ID[p.talents[s.talents]]?.name ?? p.talents[s.talents]);
  for (; s.upgrades < p.upgrades.length; s.upgrades++) mark(g, 'upgrade', ABILITY_UPGRADES[p.upgrades[s.upgrades]].name);
  for (; s.utility < p.utilityUpgrades.length; s.utility++) mark(g, 'upgrade', UTILITY_UPGRADES[p.utilityUpgrades[s.utility]].name);
  for (; s.quests < g.questsDone; s.quests++) mark(g, 'quest', g.quests.filter((q) => q.state === 'done').at(-1)?.name ?? '');
  for (; s.events < g.eventsSeen; s.events++) mark(g, 'event', g.event ? EVENTS[g.event.kind].name : '');
  for (; s.bosses < g.bossesKilled.length; s.bosses++) mark(g, 'boss', ENEMIES[g.bossesKilled[s.bosses]].name);
  if (g.act > s.act) mark(g, 'act', actName((s.act = g.act)));
  // choices that open a screen: counted when they come up
  if (rose(s, 'board', g.pendingBoard)) mark(g, 'board', actName(g.act));
  if (rose(s, 'shrine', g.pendingShrine !== null)) mark(g, 'shrine', '');
  if (rose(s, 'merchant', g.pendingMerchant)) mark(g, 'merchant', actName(g.act));
}

/** F8 or the pause menu: "I am bored here", with enough of the moment to find it again. */
export function markBored(g: Game): void {
  const p = g.player;
  mark(g, 'bored', `wave ${g.wave}${g.breather > 0 ? ' (between waves)' : ''} · ${g.enemies.length} enemies · ${Math.round((p.hp / p.stats.hp) * 100)}% HP · level ${p.level}`);
}

export function finishRunLog(g: Game): RunLog {
  const p = g.player;
  return {
    at: '', // stamped when the run is banked (applyRun), so summarizing a run stays deterministic
    classId: p.cls.id,
    tier: g.tierIndex,
    arena: g.startArena,
    seed: g.seed,
    daily: g.daily,
    curses: [...g.curses],
    trait: g.trait,
    time: round1(g.time),
    wave: g.wave,
    level: p.level,
    kills: g.kills,
    end: g.over ? 'slain' : g.victory === 'pending' ? 'won' : 'quit',
    won: g.victory !== 'none',
    cause: g.over ? g.log.cause : '',
    relics: Object.fromEntries(g.relics.map((id) => [id, g.relicTiers[id] ?? 1])),
    talents: [...p.talents],
    upgrades: [...p.upgrades, ...p.utilityUpgrades],
    waves: g.log.waves.map(([a, b, d, q]) => [a, b, Math.round(d), round1(q)]),
    marks: g.log.marks.map((m) => [...m]),
  };
}

addListener((g, name, ev) => {
  if (name === 'onWaveStart') g.log.waves.push([round1(g.time), 0, 0, 0]);
  else if (name === 'onDamageTaken') {
    const row = g.log.waves[g.wave - 1];
    if (row) row[2] += (ev as GameEvents['onDamageTaken']).amount;
  }
});
