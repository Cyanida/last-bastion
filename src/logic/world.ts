// v0.10 (#190): what opens on the world map, a level's slots and ring step, and what a clear pays (config/world.ts)
import { ACTS, FINAL } from '../config/acts';
import { ARENAS, type ArenaId } from '../config/arenas';
import { BOSS_RULES, BOSSES, type BossKey } from '../config/bosses';
import { SQUADS } from '../config/director';
import { TIER_UNLOCK, TIERS } from '../config/economy';
import { ENEMIES, type EnemyId } from '../config/enemies';
import { FAMILIES, relicDef, type FamilyId, type RelicId } from '../config/relics';
import { WAVES } from '../config/waves';
import { isBossWave } from './waves';
import { REALM_IDS, REALMS, WORLD, WORLD_BOSSES, type CrownReward, type EndBoss, type LevelReward, type RealmId } from '../config/world';
import { ACT_BOSSES, actBoss, actOf, hashSeed, isActEnd, pickMidBoss } from './acts';
import { squadOnTier, waveRng } from './director';
import { expectedLevel } from './formulas';
import { championStep } from './championLevels'; // it reads this file too: both only call the other inside functions

// ---------- #191: the level runner's rules (systems/levels.ts plays them) ----------

/**
 * The head start's level at a level's first wave: the level the pace expects once wave `wave - 1` is cleared (BALANCE.md's "level at
 * the end of wave"). Decided: rounded, so 1, 6, 11, 15, 19, 21, 24 at waves 1, 6, 11, 16, 21, 26, 31.
 */
export const headStartLevel = (wave: number): number => Math.round(expectedLevel(wave));

/** Wings open by a start wave: the one this Act's mid-Act boss opens, once it is behind. Decided: quest wings are not counted. */
export const wingsOpenBy = (wave: number): number => ((wave - 1) % ACTS.length >= WAVES.bossEvery ? 1 : 0);

/**
 * #236: every level's end boss in a realm, so no plain boss ends two of its levels. A named one (config/bosses.ts) or the Usurper as
 * named; 'pool' (and a realm boss not built yet) draws from the bosses its wave could bring that no other level of the realm ends on,
 * from the realm's own seed, so a level always ends on the same boss. An elite or crown boss is its own variant: it does not use up
 * its plain boss. Outside the Last Bastion a wave-40 draw is an Act boss, never the Usurper.
 */
export function realmBosses(realm: RealmId): BossKey[] {
  const def = REALMS[realm];
  const seed = hashSeed(realm);
  const arena = (def.arena in ARENAS ? def.arena : 'courtyard') as ArenaId; // a realm arena not built yet plays the courtyard (game.ts)
  const used = def.levels.filter((lv) => !lv.boss.elite && !lv.boss.crown && BOSSES[lv.boss.boss]).map((lv) => lv.boss.boss);
  return def.levels.map(({ boss: end, waves }) => {
    if (end.boss === 'usurper') return FINAL.boss;
    if (BOSSES[end.boss]) return end.boss;
    const key = poolBoss(waves[1], arena, seed, used);
    used.push(key);
    return key;
  });
}

/** A level's end boss on its last wave (realmBosses). */
export const levelBoss = (realm: RealmId, level: number): BossKey => realmBosses(realm)[level - 1];

/** A pool draw on `wave` from the bosses not in `used`: the Act's own Act boss first, Act I's arena opener, else the mid-Act draw. */
function poolBoss(wave: number, arena: ArenaId, seed: number, used: BossKey[]): BossKey {
  const act = actOf(wave);
  const fresh = (keys: readonly BossKey[]) => keys.find((k) => !used.includes(k)) ?? keys[0];
  if (isActEnd(wave)) return fresh([actBoss(act), ...ACT_BOSSES]);
  if (act < BOSS_RULES.poolFromAct) return fresh(ARENAS[arena].bosses);
  return pickMidBoss(act, { seed, arena, seen: used, quests: [] }, waveRng(seed ^ 0xb055, wave)); // Decided: no quest boss ends a level
}

/**
 * #192: what a level's head start hands out for free, so a banked level counts only what was played: the waves before its first
 * (`waves`), the levels the head start grew (`levels`), and its length as a share of a full run (`share`, which scales the gold cap).
 */
export function levelSkip(realm: RealmId, level: number): { waves: number; levels: number; share: number } {
  const [first, last] = REALMS[realm].levels[level - 1].waves;
  return { waves: first - 1, levels: headStartLevel(first) - 1, share: (last - first + 1) / (FINAL.act * ACTS.length) };
}

/** #212: the foe that marches in `realm`'s levels in place of `id` (its realm variant), else `id` itself. No realm: the plain foe. */
export const realmFoe = (realm: RealmId | undefined, id: EnemyId): EnemyId => (realm && REALMS[realm].foes?.[id]) || id;

/**
 * #249: the foes a realm level fields on every difficulty, whatever the tier roster says (config/world.ts `fields`): in the Iron Hold
 * the shieldwall squads march on Squire and Knight too. A plain run (no level) has none.
 */
export const levelFields = (lv: { realm: RealmId } | null | undefined): EnemyId[] | undefined => (lv ? REALMS[lv.realm].fields : undefined);

/** One champion's world progress: per realm, the highest level cleared on each tier (index into config/economy TIERS). */
export type WorldProgress = Partial<Record<RealmId, number[]>>;

/** The highest level of `realm` cleared on `tier` or any higher one: a Knight clear counts as a Squire clear too. */
export function bestCleared(p: WorldProgress, realm: RealmId, tier: number): number {
  return Math.max(0, ...(p[realm] ?? []).slice(tier));
}

/** Crowned: its last level cleared on `tier` or higher (by default on any tier). */
export const isCrowned = (p: WorldProgress, realm: RealmId, tier = 0): boolean => bestCleared(p, realm, tier) >= REALMS[realm].levels.length;

export const crownedRealms = (p: WorldProgress): RealmId[] => REALM_IDS.filter((r) => isCrowned(p, r));

/** A realm opens with its count of crowns (any tier), `fromRing` of them from that ring. */
export function realmOpen(p: WorldProgress, realm: RealmId): boolean {
  const { crowns, fromRing } = REALMS[realm].opens;
  const won = crownedRealms(p);
  return won.length >= crowns && (!fromRing || won.filter((r) => REALMS[r].ring === fromRing[0]).length >= fromRing[1]);
}

/** Squire and Knight open with the realm; Champion once it is crowned on Knight, Legend once crowned on Champion (config/economy TIER_UNLOCK). */
export function tierOpen(p: WorldProgress, realm: RealmId, tier: number): boolean {
  const win = TIER_UNLOCK[tier]?.win;
  return tier >= 0 && tier < TIER_UNLOCK.length && realmOpen(p, realm) && (win === undefined || isCrowned(p, realm, win));
}

/** Levels open in order on each tier: level n (1-based) once n - 1 is cleared on that tier or higher. */
export const levelOpen = (p: WorldProgress, realm: RealmId, level: number, tier: number): boolean =>
  level >= 1 && level <= REALMS[realm].levels.length && tierOpen(p, realm, tier) && bestCleared(p, realm, tier) >= level - 1;

/** Starting relic slots: the level's own plus `extra` (Armorer's Choice, the Keepsake rank), up to WORLD.maxSlots. */
export const slotsFor = (realm: RealmId, level: number, extra = 0): number => Math.min(WORLD.maxSlots, REALMS[realm].levels[level - 1].slots + extra);

/** Enemy HP and damage multipliers for the realm's ring (the finale is ring 5). */
export function ringStep(realm: RealmId): { hp: number; damage: number } {
  const i = REALMS[realm].ring - 1;
  return { hp: WORLD.ringStep.hp[i], damage: WORLD.ringStep.damage[i] };
}

/** #221: enemy HP and damage multipliers for a level's place in its realm (WORLD.levelStep; #232: a relic realm's own where it has them); the Last Bastion keeps 1. */
export function levelStep(realm: RealmId, level: number): { hp: number; damage: number } {
  if (realm === 'lastBastion') return { hp: 1, damage: 1 };
  const s = realm === 'marches' ? WORLD.levelStep.marches : WORLD.levelStep.own[realm] ?? WORLD.levelStep.realm;
  return { hp: s.hp[level - 1] ?? 1, damage: s.damage[level - 1] ?? 1 };
}

/**
 * #250: a tier's own ease in a realm's levels (TierDef.realmEase: Squire's), from its first level's to its last's, even between; 1 on a
 * tier without one and in the Last Bastion (a whole run, its own release tunes it).
 */
export function tierStep(tier: number, realm: RealmId, level: number): { hp: number; damage: number } {
  const e = TIERS[tier]?.realmEase;
  if (!e || realm === 'lastBastion') return { hp: 1, damage: 1 };
  const t = REALMS[realm].levels.length > 1 ? (level - 1) / (REALMS[realm].levels.length - 1) : 0;
  const at = ([a, b]: [number, number]) => Math.round((a + (b - a) * t) * 1000) / 1000;
  return { hp: at(e.hp), damage: at(e.damage) };
}

/** #243: a level's wave length (WORLD.levelWaves): multipliers on the foes a wave brings and on the time they trickle in over; the Last Bastion keeps 1. */
export function levelWaves(realm: RealmId, level: number): { foes: number; pace: number } {
  if (realm === 'lastBastion') return { foes: 1, pace: 1 };
  const s = realm === 'marches' ? WORLD.levelWaves.marches : WORLD.levelWaves.own[realm] ?? WORLD.levelWaves.realm; // #232: a relic realm's own where it has them
  return { foes: s.foes[level - 1] ?? 1, pace: s.pace[level - 1] ?? 1 };
}

/**
 * #243: a realm level runs on its own waves, not the 40-wave scale's Acts: its one boss wave is its last, and an Act that ends inside
 * it moves on with no Merchant and no fork (they are the Last Bastion's, which keeps the scale). Decided: the scale's boss waves inside
 * a level (x5, x0) play as plain waves, so no boss comes twice in a realm (#236) and none stands right before a level's own.
 */
export const ownWaves = (lv: { realm: RealmId } | null | undefined): boolean => !!lv && lv.realm !== 'lastBastion';

/** Is `wave` a boss wave of this run? A realm level: its last wave only (ownWaves). Else the 40-wave scale's (x5, x0). */
export const bossWaveIn = (lv: { realm: RealmId; last: number } | null | undefined, wave: number): boolean => (ownWaves(lv) ? wave === lv!.last : isBossWave(wave));

/** What clearing `level` on `tier` pays, judged by the progress before it: the level's reward on its first clear on any tier, the crown's on a first crown. */
export function clearRewards(p: WorldProgress, realm: RealmId, level: number, tier: number): { level: LevelReward[]; crown: CrownReward[] } {
  const def = REALMS[realm];
  const reward = def.levels[level - 1].reward;
  const out = { level: reward && bestCleared(p, realm, 0) < level ? [reward] : [], crown: [] as CrownReward[] };
  if (level === def.levels.length) {
    if (!isCrowned(p, realm)) out.crown.push(...def.crown.first);
    if (!isCrowned(p, realm, tier)) out.crown.push(...def.crown.tiers[tier]);
  }
  return out;
}

/**
 * #219: what a clear's crown rewards give the account: the realm's title and palette (config/world `legend`), each only when the crown
 * pays it and the realm has one. applyRun banks them with the run; the level-cleared screen names them.
 */
export function crownGifts(realm: RealmId, crown: CrownReward[]): { title?: string; palette?: number } {
  const legend = REALMS[realm].legend;
  if (!legend) return {};
  return { ...(crown.some((r) => r.kind === 'title') ? { title: legend.title } : {}), ...(crown.some((r) => r.kind === 'palette') ? { palette: legend.palette } : {}) };
}

/** Fold one clear into the progress (a new object; the old one is untouched). */
export function recordClear(p: WorldProgress, realm: RealmId, level: number, tier: number): WorldProgress {
  const best = [...(p[realm] ?? [])];
  while (best.length <= tier) best.push(0);
  best[tier] = Math.max(best[tier], level);
  return { ...p, [realm]: best };
}

/**
 * A 'keepLocked' reward's choice: the locked relics of the families held when the level ended. Empty: the level pays
 * WORLD.keepLockedRunes instead.
 */
export function keepLockedOptions(held: RelicId[], locked: RelicId[]): RelicId[] {
  const families = new Set(held.map((id) => relicDef(id).family).filter((f) => f));
  return locked.filter((id) => families.has(relicDef(id).family));
}

/**
 * #198: the world progress a save holds. Save v7 (another issue) adds it; until then, and for any save without it, the progress is
 * empty, so only the Marches are open. Wire the save's field in here once it lands.
 */
export const saveWorldProgress = (save: object): WorldProgress => (save as { world?: WorldProgress }).world ?? {};

/** What opens a shut realm, in words for the map: "Opens with 5 crowns, one from the Frozen Pass or the Stormspire". */
export function opensText(realm: RealmId): string {
  const { crowns, fromRing } = REALMS[realm].opens;
  const from = fromRing ? REALM_IDS.filter((r) => REALMS[r].ring === fromRing[0]).map((r) => REALMS[r].name.replace(/^The /, 'the ')) : [];
  return `Opens with ${crowns} crown${crowns === 1 ? '' : 's'}${fromRing ? `, ${fromRing[1] === 1 ? 'one' : fromRing[1]} from ${from.join(' or ')}` : ''}`;
}

/** #258: what a road says of a realm that isn't built yet (its foes, bosses and relics fall back to the usual draw, #191); nothing for a built one. */
export const unbuiltNotice = (realm: RealmId): string | null =>
  REALMS[realm].built ? null : "This realm's own foes, bosses and relics come in a later version. Until then its levels play with stand-ins.";

/** The world map's realms, in REALM_IDS order: open, or still under clouds with what opens it. */
export const mapRealms = (p: WorldProgress): { id: RealmId; name: string; open: boolean; opens: string }[] =>
  REALM_IDS.map((id) => ({ id, name: REALMS[id].name, open: realmOpen(p, id), opens: opensText(id) }));

// ---------- #199: the realm road and the level panel ----------

/** The road's flags: per level, whether it is open on `tier` and the tiers it is cleared on (a higher clear counts for the lower ones). */
export const roadLevels = (p: WorldProgress, realm: RealmId, tier: number): { n: number; open: boolean; cleared: boolean[] }[] =>
  REALMS[realm].levels.map((_, i) => ({ n: i + 1, open: levelOpen(p, realm, i + 1, tier), cleared: TIERS.map((_, t) => bestCleared(p, realm, t) >= i + 1) }));

/** The level the road opens on: the first one not cleared on `tier`, or the last. */
export const nextLevel = (p: WorldProgress, realm: RealmId, tier: number): number => Math.min(REALMS[realm].levels.length, bestCleared(p, realm, tier) + 1);

/** The tier the road opens on: the one asked for if this realm has it open, else the highest open one below it. */
export function roadTier(p: WorldProgress, realm: RealmId, want: number): number {
  for (let t = Math.min(want, TIERS.length - 1); t > 0; t--) if (tierOpen(p, realm, t)) return t;
  return 0;
}

/**
 * The foes a level features: the squads that first march in its waves (members and commander), newest first; a level with no new
 * squad shows the last ones in by then. Decided: at most `max`, so the panel stays a glance. #249: only squads `tier` fields in
 * `realm`'s levels (no tier: every squad), and the realm's own foes (its variants, config/world.ts `foes`) come first: they are its lesson.
 */
export function featuredFoes(waves: [number, number], max = 3, tier?: number, realm?: RealmId): EnemyId[] {
  const fields = realm && REALMS[realm].fields;
  const inBy = SQUADS.filter((s) => s.from <= waves[1] && squadOnTier(s, tier, fields));
  const fresh = inBy.filter((s) => s.from >= waves[0]);
  const ids = [...new Set((fresh.length ? fresh : inBy).slice().reverse().flatMap((s) => [...(s.commander ? [s.commander] : []), ...s.members.map(([id]) => id)]))];
  const own = (id: EnemyId) => realmFoe(realm, id) !== id;
  return [...ids.filter(own), ...ids.filter((id) => !own(id))].slice(0, max);
}

/**
 * #259: the squads a level brings for sure, and the wave each comes on: one of each squad (fielded on `tier`) that holds a `fields` foe
 * the level's road features, so a road that names the Iron Shieldwall never plays out without a squad of them. Decided: only a realm's
 * `fields` foes (held to `fieldsWeight`); its other own foes come at their full weight. The wave is drawn per seed from the level's
 * first WORLD.featuredSquad.within waves where the squad is fielded (from its own first wave, before the level's boss wave), on the
 * director's per-wave stream (waveRng) salted, so the wave's own draws stay as they were.
 */
export function featuredSquads(realm: RealmId, level: number, tier: number, seed: number): { template: string; wave: number }[] {
  const fields = REALMS[realm].fields;
  const waves = REALMS[realm].levels[level - 1]?.waves;
  if (!fields?.length || !waves) return [];
  const featured = featuredFoes(waves, undefined, tier, realm);
  return SQUADS.filter((s) => s.from <= waves[1] && squadOnTier(s, tier, fields) && s.members.some(([id]) => fields.includes(id) && featured.includes(id))).map((s) => {
    const first = Math.max(waves[0], s.from);
    const last = Math.max(first, Math.min(waves[1] - 1, first + WORLD.featuredSquad.within - 1)); // not the boss wave, where it can be helped
    return { template: s.id, wave: first + Math.floor(waveRng(seed ^ 0x259, first)() * (last - first + 1)) };
  });
}

/** The end boss in words: a named one, or the draw on its wave (a mid-Act boss on a wave x5, the Act's boss on a wave x0). */
export function bossName(end: EndBoss, wave: number): string {
  if (end.boss === 'usurper') return ENEMIES.usurper.name;
  const named = BOSSES[end.boss] ? (BOSSES[end.boss].name ?? ENEMIES[BOSSES[end.boss].from].name) : (WORLD_BOSSES as Record<string, { name: string }>)[end.boss]?.name;
  return named ?? (isActEnd(wave) ? 'An Act boss' : 'A mid-Act boss'); // as poolBoss draws it
}

const familyName = (f?: FamilyId) => (f ? FAMILIES[f].name : 'a');
const REWARD_TEXT: Record<LevelReward['kind'] | CrownReward['kind'], (r: LevelReward | CrownReward, family?: FamilyId, legend?: { title: string }) => string> = {
  rarePick: (r) => `Pick 1 of ${(r as { of: number }).of} ${familyName((r as { family: FamilyId }).family)} rares`,
  keepLocked: () => `Keep a locked relic of a family you held (or ${WORLD.keepLockedRunes} Runes)`,
  classRelic: (_, f) => `Your class relic of ${familyName(f)}`,
  win: () => 'The win',
  signature: () => 'Your signature relic',
  legendaryPick: (_, f) => `Pick 1 of 2 ${familyName(f)} legendaries`,
  legendaryOther: (_, f) => `The other ${familyName(f)} legendary`,
  title: (_, __, legend) => (legend ? `The title ${legend.title}` : 'A title'), // #219: a realm that names its own
  palette: () => 'A palette',
};

/**
 * Everything the level panel shows for `level` of `realm` on `tier`: the realm run's slots (with the Keep's and mastery's, `bonus`; #237:
 * the head start is gone), enemy HP against Squire in the Marches, the featured family and foes, the end boss, and what a clear pays now (empty once taken).
 */
export function levelPanel(p: WorldProgress, realm: RealmId, level: number, tier: number, bonus: { slots: number; levels: number } = { slots: 0, levels: 0 }) {
  const def = REALMS[realm], lv = def.levels[level - 1];
  const r = clearRewards(p, realm, level, tier);
  return {
    name: `${def.name} · Level ${level}`,
    waves: lv.waves,
    slots: slotsFor(realm, level, bonus.slots),
    enemyHp: Math.round(TIERS[tier].enemyHp * ringStep(realm).hp * levelStep(realm, level).hp * championStep(realm, level).hp * tierStep(tier, realm, level).hp * 100), // #238: with the champion level it expects, as the level plays; #250: and Squire's ease
    family: lv.family,
    foes: featuredFoes(lv.waves, undefined, tier, realm).map((id) => ENEMIES[realmFoe(realm, id)].name), // #212: as they march there; #249: only what this tier fields
    boss: bossName(lv.boss, lv.waves[1]),
    crownBoss: !!lv.boss.crown,
    eliteBoss: !!lv.boss.elite, // #219: it comes as an elite, a phase more
    rewards: [...r.level, ...r.crown].map((x) => REWARD_TEXT[x.kind](x, def.family, def.legend)),
    tiers: TIERS.map((t, i) => ({ name: t.name, open: tierOpen(p, realm, i), cleared: bestCleared(p, realm, i) >= level })),
    open: levelOpen(p, realm, level, tier),
  };
}
export type RoadLevel = ReturnType<typeof roadLevels>[number];
export type LevelPanel = ReturnType<typeof levelPanel>;

// ---------- #206: test mode starts any realm level ----------

/** A realm level test mode can start, as its select shows it: `realm:level`, with the realm, level and waves. Every realm, built or not. */
export const testLevels = (): { value: string; realm: RealmId; level: number; label: string }[] =>
  REALM_IDS.flatMap((realm) => REALMS[realm].levels.map((lv, i) => ({
    value: `${realm}:${i + 1}`, realm, level: i + 1,
    label: `${REALMS[realm].name} · Level ${i + 1} (waves ${lv.waves[0]}–${lv.waves[1]})`,
  })));

/** Test mode's start select read back: a realm level, or null for a start at an Act and wave (anything it doesn't know). */
export function parseTestLevel(value: string): { realm: RealmId; level: number } | null {
  const [realm, n] = value.split(':');
  const level = Number(n);
  if (!(realm in REALMS) || !Number.isInteger(level) || level < 1 || level > REALMS[realm as RealmId].levels.length) return null;
  return { realm: realm as RealmId, level };
}
