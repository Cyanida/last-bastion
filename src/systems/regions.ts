import { ENEMIES, type EnemyId } from '../config/enemies';
import { BLESSING_IDS, BLESSINGS, FEATURES, featureSpot, REGIONS, WING_IDS, type BlessingId, type RegionDef, type RegionId, type WingId } from '../config/regions';
import { sfx } from '../core/audio';
import { addListener, type GameEvents } from '../core/events';
import { TAU } from '../core/math';
import type { Game } from '../core/types';
import { addZone } from '../entities/hazards';
import { isActEnd } from '../logic/acts';
import { rollAffixes } from '../logic/elites';
import { combineMods } from '../logic/mods';
import { boundsOf, inRect, openRects, regionAt, rollWings } from '../logic/regions';
import { waveRng } from '../logic/director';
import { unlockedPool } from '../logic/waves';
import { floatText, ring, shake } from './effects';
import { offerRelics } from './relics';
import { spawnEnemy } from './spawning';

/**
 * Map expansion (v0.5): the core is open, the wings sit behind gates. openNextWing is called by the mid-Act boss's death and
 * by finished quests; a wing is "seen" once the player walks in, and its feature does its thing. All seeded per Act.
 */
export const regionsOf = (g: Game): RegionDef[] => g.arena.regions ?? [];

function refresh(g: Game): void {
  const regions = regionsOf(g);
  g.openRects = openRects(regions, g.regionOpen);
  g.openFloors = regions.filter((r) => g.regionOpen[r.id]).map((r) => r.floor);
  g.bounds = boundsOf(g.openRects);
}

/** A new Act (and a new run): only the core is open; the wings get this Act's features and opening order. */
export function initRegions(g: Game): void {
  const { features, order } = rollWings(g.seed, g.act);
  g.regionOpen = { core: true };
  g.regionSeen = ['core'];
  g.wingOrder = order;
  const byId = Object.fromEntries(regionsOf(g).map((r) => [r.id, r])) as Record<RegionId, RegionDef>;
  g.features = byId.north ? WING_IDS.map((wing) => ({ wing, kind: features[wing], ...featureSpot(byId[wing]), used: false, boss: null, t: REGIONS.hazardEvery })) : [];
  g.pendingShrine = null;
  refresh(g);
}

export function openRegion(g: Game, id: RegionId): void {
  if (g.regionOpen[id]) return;
  g.regionOpen = { ...g.regionOpen, [id]: true };
  refresh(g);
  const region = regionsOf(g).find((r) => r.id === id);
  const feature = g.features.find((f) => f.wing === id);
  if (!(g.banner.top && g.banner.t > 0)) g.banner = { text: `The gate to ${region?.name ?? id} opens${feature ? ` — ${FEATURES[feature.kind].name}` : ''}`, t: 3 };
  sfx('wave');
  shake(g, 6);
}

/** Opens the next closed wing in this Act's order. Returns the wing, or null when all four are open. */
export function openNextWing(g: Game): WingId | null {
  const next = g.wingOrder.find((w) => !g.regionOpen[w]);
  if (next) openRegion(g, next);
  return next ?? null;
}

/** The strongest regular enemy unlocked by now, as the lair's sleeper (and the quests' named elite). */
export function lairKind(g: Game): EnemyId {
  const pool = unlockedPool(Math.max(1, g.wave), null).map((p) => p.value).filter((id) => !ENEMIES[id].boss && !ENEMIES[id].structure);
  return pool.reduce((a, b) => (ENEMIES[b].hp > ENEMIES[a].hp ? b : a), pool[0] ?? 'knight');
}

function wakeLair(g: Game, f: Game['features'][number]): void {
  const rng = waveRng(g.seed ^ 0x1a17, g.act * 100 + g.wave);
  const kind = lairKind(g);
  const affixes = [...new Set([...rollAffixes(10, rng), ...rollAffixes(10, rng)])].slice(0, 2);
  const boss = spawnEnemy(g, kind, f.x, f.y, affixes);
  boss.maxHp = boss.hp = Math.round(boss.hp * REGIONS.lairBoss.hpMult);
  boss.damage *= REGIONS.lairBoss.damageMult;
  boss.side = true;
  f.boss = boss;
  for (let i = 0; i < REGIONS.lairGuards; i++) {
    const a = (i / REGIONS.lairGuards) * TAU;
    const guard = spawnEnemy(g, kind === 'knight' ? 'peasant' : 'knight', f.x + Math.cos(a) * 90, f.y + Math.sin(a) * 90);
    guard.side = true;
  }
  g.banner = { text: `The lair wakes: ${boss.def.name}`, t: 2.5 };
  sfx('warn');
}

/** Every tick: discovery, and the feature of whatever wing the player stands in. */
export function updateRegions(g: Game, dt: number): void {
  const p = g.player;
  const here = regionAt(regionsOf(g), p.x, p.y);
  if (here && !g.regionSeen.includes(here.id)) {
    g.regionSeen = [...g.regionSeen, here.id];
    const f = g.features.find((x) => x.wing === here.id);
    if (f) floatText(g, p.x, p.y - 60, `${FEATURES[f.kind].icon} ${FEATURES[f.kind].name}`, '#e9c95a', 16);
  }
  for (const f of g.features) {
    if (!g.regionOpen[f.wing]) continue;
    const near = Math.hypot(p.x - f.x, p.y - f.y) < REGIONS.shrineRadius;
    const inWing = here?.id === f.wing;
    if (f.kind === 'shrine' && !f.used && near && !g.pendingShrine) {
      f.used = true;
      g.pendingShrine = shrineChoices(g);
    } else if (f.kind === 'chest' && !f.used && near) {
      f.used = true;
      g.gold += REGIONS.chestGold * g.act;
      floatText(g, f.x, f.y - 30, `+${REGIONS.chestGold * g.act}g`, '#c9a227', 15);
      offerRelics(g, 1, 'strongbox');
      ring(g, f.x, f.y, 70, '#c9a227', 0.5);
      sfx('xp');
    } else if (f.kind === 'lair' && !f.used && inWing) {
      f.used = true;
      wakeLair(g, f);
    } else if (f.kind === 'hazard') {
      if (!f.used && near) {
        f.used = true;
        g.gold += REGIONS.cacheGold * g.act;
        floatText(g, f.x, f.y - 30, `+${REGIONS.cacheGold * g.act}g`, '#c9a227', 15);
        sfx('xp');
      }
      if (inWing && g.wave > 0 && (f.t -= dt) <= 0) {
        f.t = REGIONS.hazardEvery;
        const damage = REGIONS.hazardDamage * g.waveDmgMult * g.tier.enemyDmg;
        for (let i = 0; i < 3; i++) {
          const a = g.rng() * TAU;
          const d = i === 0 ? 0 : 60 + g.rng() * 110;
          addZone(g, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 58, delay: 1.1 + i * 0.12, damage, hostile: true, color: '#e07b28', dtype: 'fire' });
        }
      }
    }
  }
}

/** A shrine's offer: REGIONS.shrineBlessings distinct blessings not taken yet this run. */
export function shrineChoices(g: Game): BlessingId[] {
  const left = BLESSING_IDS.filter((id) => !g.blessings.includes(id));
  const out: BlessingId[] = [];
  while (out.length < REGIONS.shrineBlessings && left.length) out.push(left.splice(Math.floor(g.rng() * left.length), 1)[0]);
  return out;
}

export function chooseBlessing(g: Game, id: BlessingId): void {
  if (!g.pendingShrine?.includes(id)) return;
  g.pendingShrine = null;
  g.blessings = [...g.blessings, id];
  combineMods(g.baseMods, BLESSINGS[id].mods);
  floatText(g, g.player.x, g.player.y - 50, BLESSINGS[id].name, '#e9c95a', 16);
  ring(g, g.player.x, g.player.y, 110, '#e9c95a', 0.6);
  sfx('levelup');
}

/** Is a point inside an open region (for spawning things that must be reachable)? */
export const isOpenAt = (g: Game, x: number, y: number): boolean => g.openRects.some((q) => inRect(q, x, y));

addListener((g, name, ev) => {
  if (name !== 'onKill') return;
  const e = (ev as GameEvents['onKill']).enemy;
  // the mid-Act boss (wave x5) opens a wing; the Act boss moves the run on to the next arena anyway
  if (e.def.boss && !e.side && !isActEnd(g.wave)) openNextWing(g);
  const lair = g.features.find((f) => f.boss === e);
  if (lair) {
    lair.boss = null;
    g.gold += REGIONS.lairBoss.gold * g.act;
    floatText(g, e.x, e.y - 40, `+${REGIONS.lairBoss.gold * g.act}g`, '#c9a227', 16);
    offerRelics(g, undefined, 'lair');
  }
});
