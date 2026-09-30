import './ui/style.css';
import './ui/kit.css'; // #184: the new look's UI kit
import * as kit from './ui/kit';
import { ARENAS, type ArenaId } from './config/arenas';
import type { ClassId } from './config/classes';
import { TIERS, type MetaId } from './config/economy';
import { GAME, VIEW } from './config/game';
import { effectsLevel, initAudio, isMuted, setEffectsLevel, sfx, toggleMute } from './core/audio';
import { musicLevel, musicStats, refreshMusic, runMusic, runMusicOn, setMusicLevel, setRunMusic, startMenuMusic, stinger, stopMenuMusic } from './core/music';
import { addListener, type EventName } from './core/events';
import { moodOf, type Stinger } from './logic/runMusic';
import { showWhatsNewNow } from './logic/whatsNew';
import { showTourNow } from './logic/tour';
import type { ChampionTab } from './config/glossary';
import { inTutorial, nextCard, statusSeen, tutorialCard } from './logic/cards';
import { CARD_IDS, CARDS, type CardId } from './config/cards';
import { clamp } from './core/math';
import { platform, type UpdateStatus } from './core/platform';
import { registerServiceWorker } from './core/pwa';
import { begin, end, frameDone, overlayText, perf, resetHistory, setEnabled as setPerfOverlay, summary } from './core/perf';
import { particleBudget, quality, sampleFrame, setQuality } from './core/quality';
import { backupSave, loadSave, prefs, readBackups, restoreBackup, storeSave, wipeSave } from './core/storage';
import type { Enemy, Game } from './core/types';
import { createGame } from './game';
import { banked, createTestRun, isTestRun, type TestSetup } from './systems/testMode';
import { initInput, inspectPoint, onAction, onFirstGesture, pollInput, pumpGamepad, setTouchControls } from './input';
import { upgradeOptions } from './logic/abilityUpgrades';
import { rewardText, tierKey, withAchievements } from './logic/achievements';
import { dailySetup, formatSeed, todayString, type DailySetup } from './logic/acts';
import { dailyOpen, dailyOpensText } from './logic/daily';
import { closestGoals } from './logic/goals';
import { currentProgress, weekKey, weeklyContracts } from './logic/contracts';
import { nextAct, reforgeChoices } from './systems/acts';
import { questTake } from './systems/quests';
import { spawnEnemy } from './systems/spawning';
import { densestCluster, resolveAim } from './logic/aim';
import { masteryBonus, masteryRank, rerollCost, accountLevel, bonusTalentPoints, buildingLevel } from './logic/economy';
import { buildOf as championBuild, buyAbilityTier, buyUtilityTier, inRun, levelCap, levelForXp, levelProgress, newGrowth, resetPoints, spendStat, spendTalent, statPointsFree, talentPointsFree, xpFromWorld } from './logic/championLevels';
import type { ChampionStat } from './config/champion';
import type { AbilityUpgradeId } from './config/abilityUpgrades';
import type { UtilityUpgradeId } from './config/utility';
import type { WorldProgress } from './logic/world';
import { buyMeta, defaultSave, type Save, buyBuilding, today } from './logic/save';
import { buildArena, loadProps, propsLoaded } from './render/arena';
import { ENEMIES, type EnemyId } from './config/enemies';
import { cameraFor, foeAnim, foesDying, minionAnim, peddlerAnim, playerAnim, render, renderBackdrop, setSpotlight, spotlightOn, type View } from './render/renderer';
import { frameCacheStats, loadSheets, SHEETS, sheetLoaded } from './render/sprites';
import { botInput, botStep } from './sim/bot';
import { playCues, view as simView } from './sim/view';
import { choiceCommand, intentCommand, levelHand, levelRerolls, step, type Choice, type Intent } from './sim/commands';
import { abilityAimRadius } from './systems/abilities';
import { relicOfferLine, relicPreview, relicShares, skipReward } from './systems/relics';
import { initTooltips } from './ui/tooltip';
import { buildHud, resetHud, setMuteIcon, showHud, toast, updateHud, updateInspect } from './ui/hud';
import { clearOverlay, showAbilityUpgrade, showBoard, showChronicle, showClassSelect, showCompendium, showDaily, showKeep, showWorldMap, showRealmRoad, showChampion, pickClass, pickedClass, showLevelUp, showMerchant, showPause, showPeddler, showRelicOffer, showRarePick, showCrownPick, showResults, showRoutes, showRunHistory, showSaveDialog, type RunResult, showSettings, showShrine, showTalents, showTitle, showTreasures, showUtilityUpgrade, showMastery, showWhatsNew, showGlossary, showFlashCard, showTestMode, showCrash, type TitleInfo } from './ui/screens';
import { crashReport } from './logic/crash';
import { levelPanel, mapRealms, roadLevels, roadTier } from './logic/world';
import { REALMS, WORLD, type LevelReward, type RealmId } from './config/world';
import { championBonus, championSlots, fitLoadout, freshRelics, grantRelic, newChampion, nextStop, rarePickOptions, runAt, runFor, runLevel, runStarts, type Champion } from './logic/champions';
import { checkpoint } from './logic/realmRun';
import { TALENT_ROW_CAP } from './config/economy';
import { takeCarry, type LevelStart } from './systems/levels';
import { isCompactLayout, textScale } from './logic/textSize';
import { TREASURE_RULES, TREASURES, treasureDesc } from './config/treasures';
import { inText } from './logic/treasures';
import { RELIC_MOMENTS, SIGNATURE, TIER_NUMERALS } from './config/relics';
import { BOOK_IDS } from './config/acts';
import { looseRelics } from './logic/relics';
import { TRAITS } from './config/traits';
import { CLASS_ORDER } from './config/classes';
import { MASTERY } from './config/economy';
import { markBored } from './systems/runlog';
import { buildState } from './systems/evolutions';
import { recipeLines, setRecipeBuild } from './ui/relicText';
import { endlessScore } from './systems/victory';
import { peddlerPrice, peddlerTokenPrice } from './systems/events';
import { utilityUnlocked, utilityUpgradeOptions } from './systems/utility';

type State = 'menu' | 'playing' | 'choice' | 'paused' | 'results';

/** v0.7.1: the moments the run music marks with a stinger. The simulation only emits them; this screen is what plays them. */
const STINGERS: Partial<Record<EventName, Stinger>> = { onRelicTier: 'tier', onSetBonus: 'set', onDuoFormed: 'duo', onEvolved: 'evolution', onBossPhase: 'phase' };
addListener((g, name) => {
  if (g === game && STINGERS[name]) stinger(STINGERS[name]);
});
// v0.8 (#26): the simulation stays pure; this screen gives it sound (its g.out cues, #114), the perf timers and the particle budget
Object.assign(simView, { sfx, begin, end, particleBudget });

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const view: View = { w: 0, h: 0, zoom: 1, dpr: 1 };
const DT = 1 / GAME.tickRate;
const MAX_STEPS = 5; // after a long stall, drop time instead of spiralling
const DEFAULT_CAST_RANGE = 320; // auto-aim reach for abilities without a castRange of their own

let state: State = 'menu';
let game: Game | null = null;
const loaded = loadSave();
let save: Save = loaded.save;
let onTitle = false;
let notice: TitleInfo['notice'] = null; // "new version available", shown on the title screen only
let updateStatus = 'No check yet.';
let devMode = new URLSearchParams(location.search).get('dev') === '1'; // v0.7.1 test mode: ?dev=1, or tap the version in Settings five times
let testSetup: TestSetup = { classId: 'viking', arena: 'courtyard', act: 1, wave: 1, level: 1, talents: [], relics: {} };

const arenaCache = new Map<ArenaId, HTMLCanvasElement>();
function arenaCanvas(id: ArenaId): HTMLCanvasElement {
  let c = arenaCache.get(id);
  if (!c) arenaCache.set(id, (c = buildArena(ARENAS[id])));
  return c;
}

/** Every change to the save goes through here: achievements are re-checked and it is written to disk. */
function commit(next: Save): ReturnType<typeof withAchievements>['earned'] {
  const checked = withAchievements(next);
  save = checked.save;
  storeSave(save);
  return checked.earned;
}

// ---------- menus ----------
function menu(): void {
  state = 'menu';
  game = null;
  setRecipeBuild(null); // v0.6: no run, no recipes in the tooltips
  onTitle = false;
  showHud(false);
  setTouchControls(false);
  startMenuMusic();
}

/** v0.6: this week's contracts and how far along they are. */
function titleContracts() {
  const week = weekKey(today(new Date()));
  const progress = currentProgress(save.contracts, week);
  return weeklyContracts(week).map((c, i) => ({ text: c.text, progress: progress[i], target: c.target, runes: c.runes }));
}

function toTitle(): void {
  menu();
  onTitle = true;
  showTitle(
    { gold: save.gold, runes: save.runes, label: `V${platform.version.replace(/\.\d+$/, (p) => (p === '.0' ? '' : p))} · ${platform.name}`, mobile: platform.touch, buildDate: `${platform.buildDate} · v${platform.version}`, notice, daily: { date: todayString(new Date()), best: save.daily[todayString(new Date())] ?? 0, open: dailyOpen(save), opens: dailyOpensText() }, title: save.title, contracts: titleContracts(), whatsNew: platform.whatsNew !== null },
    { start: toSelect, champion: () => toChampion(), map: () => toMap(toTitle), daily: toDaily, keep: toKeep, chronicle: () => toChronicle(toTitle), settings: toSettings, whatsNew: toWhatsNew },
  );
}

/** v0.7.1: What's new, from the title screen; and once by itself on the first start of a new version (its own localStorage key). */
function toWhatsNew(): void {
  menu();
  showWhatsNew(platform.whatsNew!, toTitle);
}
const CHAMPION_TOUR_KEY = 'lastbastion.championTour'; // #240
function whatsNewOnce(): void {
  const key = 'lastbastion.whatsNew';
  const seen = prefs.get(key);
  const show = showWhatsNewNow(seen, platform.whatsNew?.version, platform.version, CLASS_ORDER.some((id) => save.classes[id].runs > 0));
  if (seen !== platform.version) prefs.set(key, platform.version);
  if (show) toWhatsNew();
}

/** The Chronicle, from the title screen or the Keep. Equipping a title commits and re-opens it. */
function toChronicle(back: () => void): void {
  menu();
  showChronicle(save, back, (title) => {
    commit({ ...save, title });
    toChronicle(back);
  });
}

/**
 * Same seed, class, arena and curses for everyone on a given date. Locks do not apply: it is a fixed challenge. #204: the fixed pool, no
 * loadout, and shut until the Marches crown (the title says what opens it).
 */
function toDaily(): void {
  if (!dailyOpen(save)) return toTitle();
  initAudio();
  menu();
  const setup = dailySetup(todayString(new Date()));
  showDaily(setup, save.daily[setup.date] ?? 0, () => startRun(setup.classId, { seed: setup.seed, daily: setup }), toTitle);
}

/** Updates never interrupt anything: they only ever surface as a notice on the title screen. */
function setNotice(next: TitleInfo['notice']): void {
  notice = next;
  if (onTitle) toTitle();
}

/** #65: the champion select. #204: no Classic run any more: a champion picked here opens its champion screen. */
function toSelect(): void {
  initAudio();
  menu();
  showClassSelect(save, {
    pick: (id) => (pickClass(id), toChampion()),
    back: toTitle,
    palette(id, n) {
      if (n !== 0 && !masteryBonus(save.classes[id].xp).palettes.includes(n) && !save.palettes.includes(n)) return;
      commit({ ...save, settings: { ...save.settings, palettes: { ...save.settings.palettes, [id]: n } } });
      toSelect();
    },
    treasure(id) {
      const rec = save.treasures[id];
      if (rec.tier === 0) return;
      commit({ ...save, treasures: { ...save.treasures, [id]: { ...rec, equipped: !rec.equipped } } });
      toSelect();
    },
  });
}

/** #198: the world map, for the picked champion's progress; an open realm opens its road. #197: Back goes where the map was opened from. */
let mapBack: () => void = toTitle;
function toMap(back = mapBack): void {
  menu();
  mapBack = back;
  showWorldMap(mapRealms(champOf(pickedClass(save)).world), { realm: (id) => toRoad(id), back });
}

/**
 * #199: the realm road and its level panel, for the picked champion. FIGHT starts the level through the level runner with the champion's
 * loadout for the realm and its talent plan, on the picked tier; #197: Loadout opens the champion screen on this level.
 */
function toRoad(realm: RealmId, level?: number, tier?: number): void {
  menu();
  const id = pickedClass(save);
  const progress = champOf(id).world;
  const t = roadTier(progress, realm, tier ?? save.settings.tier);
  const n = level ?? runLevel(champOf(id), realm, t); // #237: the realm run's checkpoint, else level 1
  const bonus = championBonus(save.meta, save.classes[id].xp);
  const panel = levelPanel(progress, realm, n, t, bonus);
  const carry = runAt(champOf(id), realm, n, t)?.carry;
  const starts = runStarts(champOf(id), realm, n, t); // #237: a run starts at level 1 or goes on at its checkpoint; no other level can be fought
  showRealmRoad({ realm, realmName: REALMS[realm].name, level: n, tier: t, champion: champOf(id).name, road: roadLevels(progress, realm, t), panel, fell: fellAt(id, realm, n, t), run: carry && { level: carry.level, relics: carry.relics.held.length }, starts }, {
    level: (next) => toRoad(realm, next, t),
    tier: (next) => toRoad(realm, undefined, next),
    fight: () => panel.open && starts && playLevel(id, realm, n, t),
    loadout: () => toChampion({ realm, level: starts ? n : 1, tier: t }),
    back: () => toMap(),
  });
}

/** #197: a class's champion; one never played gets a fresh one (saved once its screen opens). */
const champOf = (id: ClassId): Champion => save.champions[id] ?? newChampion(id);
const setChampion = (id: ClassId, c: Champion) => commit({ ...save, champions: { ...save.champions, [id]: c } });
/** #238: the account's permanent talent points, a champion's on top of its levels' (the Keep, its mastery, account perks, deeds). */
const talentBonus = (id: ClassId): number => bonusTalentPoints(save.meta, save.classes[id].xp, accountLevel(CLASS_ORDER.map((c) => save.classes[c].xp)), save.talentPoints);
/** #238: a spend on the picked champion (logic/championLevels: the same object back when it can't be done); true when it took. */
const spendOn = (f: (c: Champion) => Champion): boolean => {
  const id = pickedClass(save), next = f(champOf(id));
  return next !== champOf(id) && (setChampion(id, next), true);
};
const rowCapNow = (): number => TALENT_ROW_CAP[Math.min(TALENT_ROW_CAP.length - 1, buildingLevel(save.buildings, 'library'))];

/**
 * #197: a level lost this session, for the wave it fell at. #237: its restart comes from the realm run's checkpoint in the save (the same
 * seed and the state it entered with), so it survives a reload.
 */
let fall: { classId: ClassId; realm: RealmId; level: number; tier: number; wave: number } | null = null;
const fellAt = (id: ClassId, realm: RealmId, level: number, tier: number): number | null =>
  fall && fall.classId === id && fall.realm === realm && fall.level === level && fall.tier === tier ? fall.wave : null;

/**
 * #197: a realm level with the champion's saved loadout for the realm (the level fits it to its slots) and its build (#238): the one way a
 * level starts. #237: a realm is one run. The level its run stands at goes on from that checkpoint (a death plays it again from there, on
 * the same seed); anything else starts the realm's run afresh at level 1, wave 1, replacing the one in progress (#242 asks first): the
 * head start is gone, so no level past the first starts without its run.
 */
function playLevel(id: ClassId, realm: RealmId, level: number, tier: number): void {
  const champ = champOf(id);
  const run = runFor(champ, realm, level, tier, Date.now() >>> 0);
  if (champ.runs[realm] !== run) setChampion(id, { ...champ, runs: { ...champ.runs, [realm]: run } });
  startRun(id, { seed: run.seed, tier, level: { realm, level: run.level, relics: champ.loadouts[realm] ?? [], champion: championBuild(champ, talentBonus(id)), carry: run.carry } });
}

/**
 * #197: the champion screen: the picked champion on its pedestal, the loadout for the level it plays next (`at`: a level from the road's
 * Loadout button), the inventory, its level and talents (#238), PLAY, and the main tabs.
 */
function toChampion(at?: { realm: RealmId; level: number; tier: number }, tab: ChampionTab = 'loadout'): void {
  menu();
  // #240: the tour opens by itself the first time a champion screen does; its own key, like What's new, not the save
  const tour = showTourNow(prefs.get(CHAMPION_TOUR_KEY));
  if (tour) prefs.set(CHAMPION_TOUR_KEY, '1');
  const id = pickedClass(save);
  if (!save.champions[id]) setChampion(id, newChampion(id)); // made the first time its screen opens
  const champ = champOf(id);
  const { realm, level, tier } = at ?? nextStop(champ, save.settings.tier);
  const finale = realm === 'lastBastion';
  const loadout = champ.loadouts[realm] ?? [];
  const again = (on: ChampionTab = 'loadout') => toChampion(at, on);
  const saveLoadout = (ids: typeof loadout) => {
    setChampion(id, { ...champOf(id), loadouts: { ...champOf(id).loadouts, [realm]: fitLoadout(id, ids, WORLD.maxSlots, finale) } });
    again();
  };
  showChampion({
    classId: id, name: champ.name, palette: save.settings.palettes[id] ?? 0, gold: save.gold, runes: save.runes, realm, realmName: REALMS[realm].name,
    level, tier, slots: runAt(champ, realm, level, tier)?.carry ? 0 : championSlots(save.meta, save.classes[id].xp, realm, level), loadout, // #237: a run past its level 1 takes no loadout: it went in there
    inventory: champ.inventory, talents: champ.talents, fell: fellAt(id, realm, level, tier), tab, tour,
    champion: { ...levelProgress(champ), xp: levelProgress(champ).into, statPoints: statPointsFree(champ), talentPoints: talentPointsFree(champ, talentBonus(id)), canReset: !inRun(champ) },
  }, {
    slot: (r) => saveLoadout([...loadout, r]),
    unslot: (r) => saveLoadout(loadout.filter((x) => x !== r)),
    // #238: real talent points, spent by hand on the tree; a talent taken is in the champion's next level
    talents: () => {
      showTalents({ classId: id, taken: champ.talents, points: talentPointsFree(champ, talentBonus(id)), rowCap: rowCapNow(), champion: true }, {
        spend: (t) => spendOn((c) => spendTalent(c, id, t, talentBonus(id), rowCapNow())),
        back: () => again('talents'),
      });
    },
    resetPoints: () => (setChampion(id, resetPoints(champOf(id))), again('talents')),
    play: () => playLevel(id, realm, level, tier),
    champ: (step) => (pickClass(CLASS_ORDER[(CLASS_ORDER.indexOf(id) + step + CLASS_ORDER.length) % CLASS_ORDER.length]), toChampion()),
    tab: (t) => (t === 'map' ? toMap(() => again()) : t === 'keep' ? toKeep() : t === 'relics' ? showCompendium(save, () => again()) : t === 'deeds' ? toChronicle(() => again()) : again()),
    back: toTitle,
  });
}


function toKeep(): void {
  menu();
  showKeep(save, {
    back: toTitle,
    compendium: () => showCompendium(save, toKeep),
    chronicle: () => toChronicle(toKeep),
    mastery: (id) => showMastery(save, id, toKeep),
    treasures: () => showTreasures(save, null, toKeep),
    history: () => showRunHistory(save.runs, toKeep),
    glossary: () => showGlossary(toKeep, save.cards),
    buy(id: MetaId) {
      commit(buyMeta(save, id));
      toKeep();
    },
    raise(id) {
      commit(buyBuilding(save, id));
      toKeep();
    },
  });
  if (save.refund) commit({ ...save, refund: null }); // v0.6: the rework's refund notice shows once
}

function toSettings(): void {
  menu();
  const d = platform.desktop;
  showSettings(
    { quality: save.settings.quality, effective: quality.level, muted: isMuted(), music: musicLevel(), effects: effectsLevel(), runMusic: runMusicOn(), manualAim: save.settings.manualAim, textSize: save.settings.textSize, version: platform.version, dev: devMode, perf: perf.enabled, desktop: d ? { version: platform.version, status: updateStatus, prerelease: save.settings.prerelease } : null },
    {
      back: toTitle,
      saveData: toSaveDialog,
      quality(q) {
        commit({ ...save, settings: { ...save.settings, quality: q } });
        setQuality(q);
        resize();
        toSettings();
      },
      mute() {
        mute();
        toSettings();
      },
      music(level) {
        setMusicLevel(level);
        toSettings();
      },
      effects(level) {
        setEffectsLevel(level);
        toSettings();
      },
      runMusic() {
        setRunMusic(!runMusicOn());
        toSettings();
      },
      textSize(size) {
        commit({ ...save, settings: { ...save.settings, textSize: size } });
        resize();
        toSettings();
      },
      aim(manual) {
        commit({ ...save, settings: { ...save.settings, manualAim: manual } });
        toSettings();
      },
      dev() {
        devMode = true;
        toSettings();
      },
      testMode: toTestMode,
      perf() {
        togglePerf();
        toSettings();
      },
      checkUpdates: () => void d?.checkForUpdates(save.settings.prerelease),
      prerelease(v) {
        commit({ ...save, settings: { ...save.settings, prerelease: v } });
        void d?.checkForUpdates(v);
        toSettings();
      },
    },
  );
}

/** v0.7.1 test mode: start a run anywhere (it never reaches the save: systems/testMode.ts), and the music jukebox. */
function toTestMode(): void {
  menu();
  showTestMode(testSetup, {
    start(setup) {
      testSetup = setup;
      startRun(setup.classId, { test: setup });
    },
    play(mood) {
      initAudio();
      stopMenuMusic();
      runMusic(mood, true);
    },
    stop() {
      runMusic(null);
      startMenuMusic();
    },
    sting: stinger,
    back: toSettings,
  });
}

function toSaveDialog(): void {
  menu();
  showSaveDialog(save, {
    back: toSettings,
    import(imported) {
      backupSave(); // v0.8.3 (#175): the save it replaces stays restorable
      commit(imported);
      toSaveDialog(); // the Restore list now shows it
    },
    reset() {
      wipeSave();
      save = defaultSave();
      toTitle();
    },
    backups: readBackups(),
    restore(b) {
      restoreBackup(b); // v0.7: the load migrates it, and the save it replaced becomes a backup
      location.reload();
    },
  });
}

// ---------- run ----------
function startRun(id: ClassId, opts: { seed?: number; daily?: DailySetup; test?: TestSetup; level?: LevelStart; tier?: number } = {}): void {
  initAudio();
  stopMenuMusic();
  clearOverlay();
  toasted.clear();
  resetHud();
  lastToastCheck = '';
  lastChain = '';
  const d = opts.daily;
  const rec = save.treasures[id];
  game = opts.test ? createTestRun(opts.test, opts.seed ?? Date.now() >>> 0) : createGame(id, opts.seed ?? Date.now() >>> 0, {
    arena: d ? d.arena : save.settings.arena, // a level plays its realm's arena
    tier: d ? 0 : opts.tier ?? save.settings.tier,
    level: opts.level, // #199: a realm level from the road
    inventory: opts.level ? save.champions[id]?.inventory : undefined, // #194: a level's pool follows the champion
    fresh: opts.level && save.champions[id] ? freshRelics(save.champions[id]!, save.relicPicks) : undefined,
    meta: save.meta,
    classXp: save.classes[id].xp,
    // #204: a run is a level or the Daily Trial now. The Classic select's curses, traits and Oath stay in the save's settings for the
    // Last Bastion, but no run takes them: nothing on screen could switch them off
    curses: d ? d.curses : [],
    daily: d?.date,
    trait: 'none',
    trait2: 'none',
    oath: 0,
    accountLevel: accountLevel(CLASS_ORDER.map((c) => save.classes[c].xp)),
    libraryLevel: buildingLevel(save.buildings, 'library'),
    palette: save.settings.palettes[id] ?? 0,
    palettes: save.palettes,
    bonusTalentPoints: save.talentPoints,
    treasure: d || !rec.equipped ? 0 : rec.tier, // the Daily Trial is the same for everyone: no treasure, no chain
    chain: d ? undefined : rec,
  });
  play();
  showHud(true);
  updateHud(game); // the new run's HUD (its TEST tag too) at once, not on the first real frame: a busy or throttled page may draw none for a while
}

function play(): void {
  state = 'playing';
  onTitle = false;
  if (game) setTouchControls(true, abilityAimRadius(game.player) > 0);
}

function resume(): void {
  clearOverlay();
  play(); // the loop opens the next queued choice, if any
}

/** v0.8: a choice screen's answer, as a command for player 0, stepped now without advancing: the run is paused while a screen is open. */
const choose = (g: Game, choice: Choice): boolean => step(g, [choiceCommand(g, choice)], false);

function openLevelUp(g: Game): void {
  const p = g.player;
  const hand = levelHand(g);
  const r = levelRerolls(g);
  showLevelUp(p.level - g.pendingLevelUps + 1, hand, p.cls, p.stats, { free: r.free, cost: rerollCost(r.paid), gold: g.gold }, {
    pick(o) {
      choose(g, { c: 'levelUp', index: hand.indexOf(o) });
      resume();
    },
    banish: g.banishes > 0 ? (o) => choose(g, { c: 'levelBanish', index: hand.indexOf(o) }) && openLevelUp(g) : undefined, // v0.6: struck for good, and a fresh hand
    reroll: () => void (choose(g, { c: 'levelReroll' }) && openLevelUp(g)),
  }, p.relics.tiers);
}

/** Relics first (they are lying on the ground), then ability tiers, a shrine, the quest board, the peddler, then boons. */
function openChoice(g: Game): void {
  state = 'choice';
  setTouchControls(false);
  setRecipeBuild(buildState(g)); // v0.6: relic and talent tooltips point out the missing half of an evolution recipe
  if (g.victory === 'pending' && isTestRun(g)) endRun(g); // v0.7.1: no victory screen: it would show what banking pays
  else if (g.victory === 'pending') {
    // v0.6: the Usurper fell. The screen shows the run as it would bank now; going on keeps it running into Endless.
    showResults(runResult(g, false), {
      endless() {
        choose(g, { c: 'endless' });
        resume();
      },
      bank: () => endRun(g),
      restart: () => (endRun(g), again(g)),
    });
  } else if (g.player.relics.offers.length > 0) {
    const p = g.player;
    showRelicOffer(p.relics.offers[0], p.relics.held, p.relics.tiers, { skip: skipReward(g), preview: (id) => relicPreview(p, id), line: (id) => relicOfferLine(p, id, recipeLines({ relic: id }).length > 0) }, {
      take: (id) => void (choose(g, { c: 'relicTake', id }), resume()),
      skip: () => void (choose(g, { c: 'relicSkip' }), resume()),
      reroll: () => void (choose(g, { c: 'relicReroll' }), openChoice(g)),
    });
  } else if (g.level?.cleared) endRun(g); // #191: a cleared level ends once its spoils are taken (the realm road shows what it pays)
  else if (g.pendingAbilityTiers.length > 0) {
    const tier = g.pendingAbilityTiers[0];
    showAbilityUpgrade(tier, upgradeOptions(g.player.cls.id, tier), g.player.cls, (id) => {
      choose(g, { c: 'abilityUpgrade', id });
      resume();
    });
  } else if (g.pendingUtilityTiers.length > 0) {
    showUtilityUpgrade(g.pendingUtilityTiers[0], utilityUpgradeOptions(g), g.player.cls, (id) => {
      choose(g, { c: 'utilityUpgrade', id });
      resume();
    });
  } else if (g.pendingShrine) {
    showShrine(g.pendingShrine, (id) => {
      choose(g, { c: 'blessing', id });
      resume();
    });
  } else if (g.pendingBoard) {
    const trial = TREASURES[g.player.cls.id].trial;
    showBoard(g.act, g.quests.filter((q) => q.state === 'offered').map((q) => (q.kind === 'trial' ? { ...q, desc: trial.desc } : q)), questTake(g), (picks) => {
      choose(g, { c: 'quests', picks });
      resume();
    });
  } else if (g.pendingRoute) {
    const routes = g.pendingRoute;
    showRoutes(g.act, routes, (i) => {
      choose(g, { c: 'route', index: i });
      resume();
    });
  } else if (g.pendingShop) openPeddler(g);
  else if (g.pendingLevelUps > 0) openLevelUp(g);
  else openMerchant(g);
}

/** v0.5: the wandering merchant's wares; it re-opens after every purchase, like the Merchant. */
function openPeddler(g: Game): void {
  showPeddler({ stock: g.event?.stock ?? 0, price: peddlerPrice(g), tokenPrice: peddlerTokenPrice(g), gold: g.gold, hurt: g.player.hp < g.player.stats.hp }, {
    buy() {
      if (choose(g, { c: 'peddlerBuy' })) openPeddler(g);
    },
    token() {
      if (choose(g, { c: 'peddlerToken' })) openPeddler(g);
    },
    leave() {
      choose(g, { c: 'peddlerLeave' });
      resume();
    },
  });
}

/** Between Acts: spend run gold (which would otherwise be banked), then on to the next arena. */
function openMerchant(g: Game): void {
  const act = g.act;
  const again = (ok: boolean) => ok && openMerchant(g);
  showMerchant(
    { act, gold: g.gold, hp: g.player.hp, maxHp: g.player.stats.hp, relics: looseRelics(g.player.relics.held, g.player.relics.duos), tiers: g.player.relics.tiers, attune: g.player.relics.attune, reforgeable: g.player.relics.held.filter((id) => reforgeChoices(g, id).length > 0), salvage: g.salvage, relicsLeft: g.midMerchant && !g.vars.caravanRelic ? 0 : RELIC_MOMENTS.merchantPerVisit - (g.vars.merchantRelics ?? 0), mid: g.midMerchant, books: g.midMerchant && !g.vars.caravanRelic ? BOOK_IDS : [], booksLeft: BOOK_IDS.filter((b) => !g.vars[`book.${b}`]) },
    {
      heal: () => again(choose(g, { c: 'merchantHeal' })),
      book: (book) => again(choose(g, { c: 'merchantBook', book })), // v0.8.1 #144: the caravan's books
      buy: (rarity) => void (choose(g, { c: 'merchantBuy', rarity }) && openChoice(g)), // v0.7: the pick of three opens, then the Merchant again
      reroll: (id) => again(choose(g, { c: 'merchantReroll', id })),
      reforge: (id) => again(choose(g, { c: 'merchantReforge', id })), // v0.7.1 B7
      sell: (id) => again(choose(g, { c: 'merchantSell', id })),
      salvage: (id) => again(choose(g, { c: 'merchantSalvage', id })),
      leave() {
        choose(g, { c: 'merchantLeave' }); // on with the Act, or (v0.6) to the fork in the road
        resume();
      },
    },
  );
}

const buildOf = (g: Game) => ({ relics: g.player.relics.held, tiers: g.player.relics.tiers, attune: g.player.relics.attune, duos: g.player.relics.duos, upgrades: g.player.upgrades, classId: g.player.cls.id, talents: g.player.talents, talentPoints: g.talentPoints, utilityUpgrades: g.player.utilityUpgrades, trait: g.trait, sacred: sacredLines(g), evolutions: g.evolutions });

/** v0.5: the sacred treasure carried, and what this run has done for the class's chain so far (pause and results). */
function sacredLines(g: Game): { name: string; desc: string }[] {
  const t = TREASURES[g.player.cls.id];
  const c = g.chain;
  const out = g.treasure ? [{ name: `${t.icon} ${t.name} ${TIER_NUMERALS[g.treasure.tier]}`, desc: treasureDesc(g.player.cls.id, g.treasure.tier) }] : [];
  const trial = g.quests.find((q) => q.kind === 'trial' && q.state === 'active');
  const news = [
    ...(c?.found ? [`${c.found} fragment${c.found > 1 ? 's' : ''} found (${c.fragments}/${TREASURE_RULES.fragments})`] : []),
    ...(trial ? [`${trial.name}: ${Math.floor(trial.progress)}/${trial.since}`] : c?.passed ? [`${t.trial.name} passed`] : []),
    ...(c?.slain ? [`${t.guardian.name} slain`] : c?.guardian ? [`${t.guardian.name} is awake`] : g.regionOpen.vault ? ['the hidden vault is open'] : []),
  ];
  return news.length ? [...out, { name: '🧩 Treasure quest this run', desc: news.join(' · ') }] : out;
}

const hasChoice = (g: Game) => g.victory === 'pending' || !!g.level?.cleared || g.pendingShrine !== null || g.player.relics.offers.length > 0 || g.pendingAbilityTiers.length > 0 || g.pendingUtilityTiers.length > 0 || g.pendingBoard || g.pendingShop || g.pendingLevelUps > 0 || g.pendingMerchant || g.pendingRoute !== null;

/** A screen opened from the pause menu (Talents, Glossary, Treasures) is up: its own Esc goes back to the pause menu, so this one must not resume. */
let pauseSub = false;

function togglePause(): void {
  if (pauseSub) return;
  if (state === 'playing' && game) {
    const g = game;
    state = 'paused';
    setTouchControls(false);
    pauseMenu(g);
  } else if (state === 'paused') resume();
}

function pauseMenu(g: Game): void {
  pauseSub = false;
  setRecipeBuild(buildState(g));
  showPause(buildOf(g), {
    resume: togglePause,
    quit: () => endRun(g),
    talents: () => { pauseSub = true; openTalents(g); },
    treasures: () => { pauseSub = true; showTreasures(banked(save, g, new Date())?.save ?? save, g.player.cls.id, () => pauseMenu(g)); }, // the log as it would stand if the run ended now
    glossary: () => { pauseSub = true; showGlossary(() => pauseMenu(g), save.cards); },
    bored: () => markBored(g),
  });
}

/** v0.6 playtest aid: F8 stamps "bored here" into the run log (the pause menu has a button for touch). */
function bored(): void {
  if (!game || state === 'menu' || state === 'results') return;
  markBored(game);
  toast('Noted', 'Marked in the run log: bored here.', '😴');
}

/** The talent tree, from the pause menu (the game stays paused). */
function openTalents(g: Game): void {
  showTalents({ classId: g.player.cls.id, taken: g.player.talents, points: g.talentPoints, rowCap: g.talentRowCap, treasure: g.treasure?.id }, {
    spend: (id) => choose(g, { c: 'talent', id }),
    back: () => pauseMenu(g),
  });
}

/**
 * What the results screen shows: the run banked (commitIt), or as it would bank right now (the victory screen, before the player
 * chooses between banking and Endless). Both go through the same applyRun (banked), so the preview is what banking pays. Never a test run.
 */
function runResult(g: Game, commitIt: boolean): RunResult {
  const id = g.player.cls.id;
  const prevBest = save.classes[id].bestWave;
  const prevRank = masteryRank(save.classes[id].xp);
  const result = banked(save, g, new Date())!;
  const checked = commitIt ? { save: result.save, earned: commit(result.save) } : withAchievements(result.save);
  const after = commitIt ? save : checked.save;
  const newRank = masteryRank(after.classes[id].xp);
  return {
    cls: g.player.cls, wave: g.wave, kills: g.kills, time: g.time, level: g.player.level,
    best: after.classes[id].bestWave, newBest: after.classes[id].bestWave > prevBest, // #205: a level's best counts the waves played
    gold: result.gold, goldRaw: Math.max(0, g.gold - g.goldStart), runes: result.runes, classXp: result.classXp, masteryRank: newRank,
    masteryName: newRank > prevRank ? MASTERY[newRank - 1].name : null,
    masteryNext: MASTERY[newRank] ? { name: MASTERY[newRank].name, need: Math.max(0, Math.round(MASTERY[newRank].xp - after.classes[id].xp)) } : null,
    tier: g.tier.name, tierUnlocked: result.tierUnlocked ? TIERS[after.tierUnlocked].name : null, earned: checked.earned, title: after.title, slain: g.over,
    seed: formatSeed(g.seed), curseMult: g.vars.curseMult ?? 1, daily: g.daily, build: buildOf(g),
    act: g.act, won: g.victory !== 'none', firstWin: result.firstWin, wins: after.wins[id], oath: g.oath.level, oathKept: result.oathKept, contracts: result.contracts,
    goals: closestGoals(after, id, weekKey(today(new Date()))),
    relicShares: relicShares(g),
    restart: g.daily ? `the Daily Trial ${g.daily}` : g.level ? `${REALMS[g.level.realm].name} · Level ${g.level.cleared ? (g.level.level < REALMS[g.level.realm].levels.length ? g.level.level + 1 : 1) : g.level.level}` : [g.player.cls.name, ...[g.trait, g.trait2].filter((t) => t !== 'none').map((t) => TRAITS[t].name), g.oath.level ? `Oath ${g.oath.level}` : ''].filter(Boolean).join(' · '),
    endless: g.victory === 'endless' ? { score: endlessScore(g), rank: result.endlessRank, board: after.endless[id] } : null,
    road: g.level?.cleared ? REALMS[g.level.realm].name : null, // a cleared level goes back to its road; a lost one to the champion screen (endRun)
    onward: !!g.level?.cleared && g.level.level < REALMS[g.level.realm].levels.length, // #237: its realm run goes on at the next level; its last level ends the run, and a restart is a new run from level 1
    levelRewards: result.levelRewards.level,
    championXp: g.level?.cleared ? result.champion : null, // #238: what the clear banked, and the level it brought
    crownRewards: result.levelRewards.crown,
  };
}

/**
 * v0.6 Quick Restart: today's Daily Trial again. #197/#200: a level again through playLevel, on the same seed after a fall (endRun
 * remembers it) and a fresh one once it is cleared. #204: there is no Classic run to restart any more; anything else opens the champion.
 */
const again = (g: Game): void =>
  g.daily ? toDaily() : g.level ? playLevel(g.player.cls.id, g.level.realm, g.level.cleared ? runLevel(champOf(g.player.cls.id), g.level.realm, g.tierIndex) : g.level.level, g.tierIndex) : toChampion(); // #237: a clear goes on from its checkpoint

/** Death, "end run", or banking a win: the run is banked. */
function endRun(g: Game): void {
  if (isTestRun(g)) return toTestMode(); // v0.7.1: a test run leaves no trace and goes back to where it was set up
  state = 'results';
  setTouchControls(false);
  showHud(false); // the run is over: at a phone's height a HUD left up pushes the results and a level's rare pick below the fold
  startMenuMusic();
  // #197: a level lost is remembered for its restart; one cleared forgets it
  if (g.level) fall = g.level.cleared ? null : { classId: g.player.cls.id, realm: g.level.realm, level: g.level.level, tier: g.tierIndex, wave: Math.max(1, g.wave) }; // lost in the lull before wave 1 counts as wave 1
  const r = runResult(g, true);
  // #237: a cleared level is the realm run's checkpoint: the next level goes on from the run as it stands (the last one ends the run)
  const run = g.level?.cleared ? runAt(champOf(g.player.cls.id), g.level.realm, g.level.level, g.tierIndex) : null;
  if (run && run.seed === g.seed) {
    const c = champOf(g.player.cls.id), { [g.level!.realm]: _done, ...rest } = c.runs;
    const next = checkpoint(run, g.level!.realm, takeCarry(g), Date.now() >>> 0);
    setChampion(g.player.cls.id, { ...c, runs: next ? { ...rest, [g.level!.realm]: next } : rest });
  }
  const lv = g.level, tier = g.tierIndex;
  // a cleared level goes back to the realm road; a lost one to the champion screen on that level, whose RESTART plays its seed again
  const home = lv ? (lv.cleared ? () => toRoad(lv.realm) : () => toChampion({ realm: lv.realm, level: lv.level, tier })) : toTitle; // #204: a Daily Trial goes home
  const results = () => showResults(r, { retry: () => again(g), menu: home });
  // #200: a Marches level's first clear lets the champion keep one of its family's rares. Its clear is banked already, so closing the
  // game on this screen loses the pick (ponytail: a pending-reward field in the save would keep it; the save format isn't this issue's)
  const pick = r.levelRewards.find((x): x is Extract<LevelReward, { kind: 'rarePick' }> => x.kind === 'rarePick');
  const id = g.player.cls.id;
  // #202: then a first Marches crown shows the signature relic it won (banked with the run already), and the results after it
  const crowned = lv && r.crownRewards.some((x) => x.kind === 'signature') ? () => showCrownPick(REALMS[lv.realm].name, champOf(id).name, SIGNATURE.relic[id], results) : results;
  if (!lv || !pick) return crowned();
  showRarePick(`${REALMS[lv.realm].name} · Level ${lv.level}`, pick.family, rarePickOptions(champOf(id), pick.family, pick.of), WORLD.keepLockedRunes, (relic) => {
    commit(relic ? { ...save, champions: { ...save.champions, [id]: grantRelic(champOf(id), relic) } } : { ...save, runes: save.runes + WORLD.keepLockedRunes });
    crowned();
  });
}

function mute(): void {
  setMuteIcon(toggleMute());
  refreshMusic();
}

// ---------- simulation step ----------
/** The input layer speaks in intents and screen pixels; this turns them into the game's world-space intent (v0.8: a command, #25). */
function sampleInput(g: Game): Intent {
  const intent = pollInput();
  const cam = cameraFor(g, view);
  const pxToWorld = view.dpr / view.zoom;
  const p = g.player;
  const ability = p.cls.ability;
  const castRange = 'castRange' in ability ? ability.castRange : DEFAULT_CAST_RANGE;
  const needsAuto = intent.aim.kind !== 'screen' && (intent.ability || intent.showAim);
  const auto = needsAuto ? densestCluster(g.enemies, p, castRange, abilityAimRadius(p) || 120) : null;
  // v0.7.5 (#81): Manual aims basic attacks at the mouse or the right stick; touch and an idle stick stay on auto-aim
  const manualAim = save.settings.manualAim && (intent.aim.kind === 'screen' || intent.aim.kind === 'stick');
  const aim = resolveAim(intent.aim, p, auto, castRange, (x, y) => ({ x: cam.x + x * pxToWorld, y: cam.y + y * pxToWorld }), pxToWorld);
  return { moveX: intent.moveX, moveY: intent.moveY, aimX: aim.x, aimY: aim.y, ability: intent.ability, utility: intent.utility, showAim: intent.showAim, manualAim };
}

/**
 * Achievement tiers earned mid-run, toasted as they happen. Checked only when a wave or a boss went down (a full
 * provisional applyRun + withAchievements is too much for every tick); the real commit still happens at run end.
 */
const toasted = new Set<string>();
let lastToastCheck = '';
function checkToasts(g: Game): void {
  const key = `${g.wavesCleared}:${g.bossesKilled.length}:${g.questsDone}:${g.eventsSeen}`;
  if (key === lastToastCheck) return;
  lastToastCheck = key;
  const b = banked(save, g, new Date()); // v0.7.1: null for a test run, which earns nothing
  for (const e of b ? withAchievements(b.save).earned : []) {
    if (toasted.has(tierKey(e.id, e.tier))) continue;
    toasted.add(tierKey(e.id, e.tier));
    toast(`${e.def.name} · ${['Bronze', 'Silver', 'Gold'][e.tier - 1]}`, `${e.def.desc} — ${rewardText(e.reward)}`);
  }
}

/** v0.5: the treasure chain's moments, toasted once each: a fragment, the guardian (the trial is a quest: the HUD toasts it). */
let lastChain = '';
function chainToasts(g: Game): void {
  const c = g.chain;
  const key = c ? `${c.found}:${c.slain}` : '';
  if (!c || key === lastChain) return;
  const found = Number(lastChain.split(':')[0] || 0);
  lastChain = key;
  const t = TREASURES[g.player.cls.id];
  if (c.found > found) toast(`A fragment of ${inText(t.name)}`, `${c.fragments} of ${TREASURE_RULES.fragments} found. ${c.fragments < TREASURE_RULES.fragments ? 'The next lies with another Act boss.' : 'Its trial waits on the next quest board.'}`, '🧩');
  else if (c.slain) toast(`${t.guardian.name} has fallen`, `${t.icon} ${t.name} is yours${c.tier > 0 ? ' — whole at last' : ''}. ◆ ${TREASURE_RULES.guardianRunes} Runes when the run ends.`, t.icon);
}

function afterStep(g: Game): void {
  playCues(g);
  if (g.over) endRun(g);
  else {
    checkToasts(g);
    chainToasts(g);
    if (hasChoice(g)) {
      if (!tutorial(g, true)) openChoice(g); // #60: the level-up card comes before its screen, which opens once it is closed
    } else flashCard(g);
  }
}

/** #60: the Marches' levels 1 and 2 teach the basics on flash cards (logic/cards tutorialCard). Returns whether a card opened. */
function tutorial(g: Game, choice: boolean): boolean {
  if (!g.level || !inTutorial(g.level) || isTestRun(g)) return false; // everywhere else: nothing to build
  const p = g.player;
  const id = tutorialCard({
    realm: g.level.realm,
    level: g.level.level,
    tick: g.tick,
    held: p.relics.held.length,
    setLevel: Math.max(0, ...Object.values(p.relics.sets).map((s) => s?.level ?? 0)),
    utility: utilityUnlocked(p),
    levelUp: p.xp > 0,
    status: !choice && statusSeen(g.enemies, p.x, p.y, p.statuses),
  }, save.cards, choice);
  if (!id) return false;
  openCard(id);
  return true;
}

/** v0.8 (#124): a card the first time a foe, a boss or a mechanic is met; the run waits under it. A test run leaves no trace, so it shows none. */
function flashCard(g: Game): void {
  if (g.tick % CARDS.checkEvery || isTestRun(g) || tutorial(g, false)) return;
  const met = nextCard(g.enemies, g.player.x, g.player.y, save.cards);
  if (met) openCard(met.id, met.foe);
}

function openCard(id: CardId, foe?: Enemy): void {
  commit({ ...save, cards: [...save.cards, id] }); // seen as soon as it shows: a reload never shows it twice
  state = 'choice';
  setTouchControls(false);
  setSpotlight(foe ?? null); // #133: the arena dims round the foe while its card is open (a tutorial card has none)
  showFlashCard(id, foe, (pause) => {
    setSpotlight(null);
    resume();
    if (pause) togglePause(); // Esc is the pause key: it closes the card and pauses
  });
}

function tick(): void {
  if (state !== 'playing' || !game) return;
  playCues(game); // a pick made since the last frame: step clears the queue
  step(game, [intentCommand(game, sampleInput(game))]);
  afterStep(game);
}

// ---------- fixed-timestep loop, rendering decoupled ----------
let last = performance.now();
let acc = 0;
function draw(now: number): void {
  if (game) {
    playCues(game); // a pick on a choice screen sounds while no step runs (paused, or the next screen is up)
    render(ctx, game, view, arenaCanvas(game.arena.id), abilityAimRadius(game.player));
    const t = begin();
    updateHud(game);
    inspect(game);
    end('hud', t);
  } else renderBackdrop(ctx, view, arenaCanvas(save.settings.arena), now / 1000, ARENAS[save.settings.arena]);
}
/** Hovering (or tapping) an enemy shows what it is, what it resists and what is on it. */
function inspect(g: Game): void {
  const pt = state === 'playing' ? inspectPoint() : null;
  if (!pt) return updateInspect(null, 0, 0);
  const cam = cameraFor(g, view);
  const k = view.dpr / view.zoom;
  const found = g.hash.query(cam.x + pt.x * k, cam.y + pt.y * k, 10, []).find((e) => !e.dead && !e.hidden) ?? null;
  updateInspect(found, pt.x, pt.y);
}

const perfEl = document.getElementById('perf')!;
function togglePerf(): void {
  setPerfOverlay(!perf.enabled, ctx);
  perfEl.classList.toggle('hidden', !perf.enabled);
}

function frame(now: number): void {
  requestAnimationFrame(frame); // v0.7.5 (#106): first, so an error in this frame doesn't stop the next one
  const elapsed = now - last;
  acc += elapsed / 1000;
  last = now;
  // #182: a new pixel ratio (another monitor, browser zoom) can leave the CSS size alone and fire no resize event
  if (window.devicePixelRatio !== shownDpr) resize();
  pumpGamepad();
  let steps = 0;
  const t0 = performance.now(); // always measured (not begin()): the dynamic quality needs it with the overlay off
  while (acc >= DT) {
    if (steps++ < MAX_STEPS) tick();
    acc -= DT;
  }
  const t1 = performance.now();
  // ponytail: no render interpolation; at 60 Hz sim it is not visible. Add alpha lerp if tickRate drops.
  draw(now);
  const t2 = performance.now();
  const g = game;
  if (g) runMusic(state === 'playing' || state === 'choice' ? moodOf(g) : null); // v0.7.1: paused or over, it fades out
  if (state === 'playing' && g) {
    const before = quality.level;
    sampleFrame(t2 - t0, g.wave); // the work this frame took, not the vsync interval: that is what the detail level reacts to
    if (quality.level !== before) resize(); // auto quality dropped: also lowers the pixel ratio
  }
  frameDone(elapsed, t1 - t0, t2 - t1, g ? { enemies: g.enemies.length, projectiles: g.projectiles.length, particles: g.particles.length, fields: g.fields.length, zones: g.zones.length, texts: g.texts.length } : { enemies: 0, projectiles: 0, particles: 0, fields: 0, zones: 0, texts: 0 });
  if (perf.enabled) perfEl.textContent = overlayText();
}

/** v0.7.5 (#106): any uncaught error shows the error overlay; a run is paused under it, so Continue lands on the pause menu. */
function crashed(error: unknown): void {
  if (document.getElementById('crash')) return; // the browser has logged it already
  try {
    if (state === 'playing') togglePause();
  } catch {
    /* the overlay still comes up */
  }
  showCrash(crashReport(error, platform.version));
}
window.addEventListener('error', (e) => crashed(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => crashed(e.reason));

// ---------- boot ----------
let shownDpr = 0; // the raw devicePixelRatio the canvas was last sized for
function resize(): void {
  // innerWidth/innerHeight, not 100vh: on iOS 100vh includes the area under the browser chrome
  const w = window.innerWidth;
  const h = window.innerHeight;
  shownDpr = window.devicePixelRatio;
  view.dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
  view.w = canvas.width = Math.round(w * view.dpr);
  view.h = canvas.height = Math.round(h * view.dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  view.zoom = clamp(Math.min(w / VIEW.targetW, h / VIEW.targetH), VIEW.minZoom, VIEW.maxZoom) * view.dpr;
  // v0.8 (#123): Settings › Text size zooms the HUD and the screens (style.css --ui-scale); the layout then has w/scale × h/scale to fill
  const scale = textScale(save.settings.textSize, w, h);
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.documentElement.classList.toggle('scaled', scale !== 1);
  document.documentElement.classList.toggle('compact', isCompactLayout(h)); // #172: by window height alone, not the text-size scale
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});
matchMedia('(orientation: portrait)').addEventListener('change', (e) => {
  if (e.matches && platform.touch && state === 'playing') togglePause(); // the "rotate your device" overlay is up
});

setQuality(save.settings.quality);
void loadProps().then((ok) => ok && arenaCache.clear()); // #159: the arenas are rebuilt with the rigged props
void loadSheets(); // #155: the rigged sprite sheets, long loaded before a run starts; until then the letter grids stand in
resize();
initInput(canvas);
document.documentElement.classList.toggle('touch', platform.touch);
onFirstGesture(() => {
  initAudio(); // iOS: the AudioContext may only start from a touch
  refreshMusic();
});
onAction((a) => {
  if (a === 'pause') togglePause();
  if (a === 'mute') mute();
  if (a === 'perf') togglePerf();
  if (a === 'bored') bored();
});
buildHud(togglePause, mute);
initTooltips();
setMuteIcon(isMuted());
commit(save); // writes the migrated save once, and grants anything an older record already earned

if (platform.desktop) {
  platform.desktop.onUpdateStatus((s: UpdateStatus) => {
    if (s.state === 'error') updateStatus = `Update check failed: ${s.message}`;
    else if (s.state === 'downloading') updateStatus = `Downloading v${s.version}… ${Math.round(s.percent)}%`;
    else if ('version' in s) updateStatus = s.state === 'ready' ? `v${s.version} is ready to install.` : `v${s.version} found, downloading…`;
    else updateStatus = s.state === 'checking' ? 'Checking…' : 'You are up to date.';
    // #182: an open Settings shows it as it comes in (textContent: the message comes from outside the game)
    const shown = document.querySelector('[data-update-status]');
    if (shown) shown.textContent = updateStatus;
    if (s.state === 'ready') setNotice({ text: `Update to v${s.version} ready`, button: 'Restart', action: () => platform.desktop!.quitAndInstall() });
  });
  void platform.desktop.checkForUpdates(save.settings.prerelease);
} else registerServiceWorker((apply) => setNotice({ text: 'New version available', button: 'Tap to reload', action: apply }));
if (loaded.restored) setNotice({ text: `Your save could not be read; the backup from ${new Date(loaded.restored.at).toLocaleString()} was loaded instead (the unreadable one is kept as a backup)`, button: 'OK', action: () => setNotice(null) });

toTitle();
whatsNewOnce();
requestAnimationFrame(frame);

// Handle for automated smoke and perf tests: drive the sim without real time or real input. Dev builds always; a production build with ?debug.
if (import.meta.env.DEV || location.search.includes('debug')) {
  Object.assign(window, {
    __lb: {
      get state() {
        return state;
      },
      get game() {
        return game;
      },
      get save() {
        return save;
      },
      /**
       * #238: the play test's way to spend stat points until the level-cleared screen and the Build tab (#241) do: each goes through
       * logic/championLevels on the picked champion and says whether it took. `grown`: the growth a champion with this progress has.
       */
      build: {
        spend: (stat: ChampionStat) => spendOn((c) => spendStat(c, stat)),
        ability: (id: AbilityUpgradeId) => spendOn((c) => buyAbilityTier(c, pickedClass(save), id)),
        utility: (id: UtilityUpgradeId) => spendOn((c) => buyUtilityTier(c, pickedClass(save), id, masteryBonus(save.classes[pickedClass(save)].xp).utilityTier ? 2 : 1)),
        reset: () => spendOn(resetPoints),
        grown: (world: WorldProgress) => ({ ...newGrowth(), xp: xpFromWorld(world), level: levelForXp(xpFromWorld(world), levelCap(world)) }),
      },
      quality,
      kit, // #185: the play test and the kit sheet preview build components with the UI kit's helpers
      cardIds: CARD_IDS, // v0.8 (#124): the perf test marks every flash card seen
      get spotlight() {
        return spotlightOn(); // #133: the play test checks the spotlight is on the card's foe
      },
      setQuality, // v0.8: the play test compares particle budgets
      anim: playerAnim, // #155: the champion's animation and frame, as last drawn
      sheets: () => Object.keys(SHEETS).filter(sheetLoaded), // #155: the rigged sprite sheets that have loaded
      frameCache: frameCacheStats, // #168: the play test checks a run's hit rate and that the gallery leaves the cache alone
      foeAnim, // #157: a foe kind's animation and frame, as last drawn
      foesDying, // #157: the slain foes whose death is playing
      minionAnim, // #156: an ally kind's animation and frame, as last drawn
      peddlerAnim, // #178: the peddler's sheet frame, as last drawn
      enemyDef: (id: EnemyId) => ENEMIES[id], // #157: the play test turns a foe into a given kind
      spawn: (id: EnemyId, x: number, y: number) => game && spawnEnemy(game, id, x, y), // #214: a foe brought in the way a wave brings it (a realm's variant included)
      props: propsLoaded, // #159: the arenas' rigged props have loaded
      arenaCanvas, // #159: the play test reads the baked ground under the props
      camera: () => game && { ...cameraFor(game, view), zoom: view.zoom }, // #159: where a world point lands on the canvas
      view: simView, // v0.8: the play test wraps view.sfx to hear what the simulation plays
      perf,
      music: musicStats, // v0.7.1
      stinger, // v0.7.1
      resetPerf: resetHistory,
      perfSummary: summary,
      setPerf: (on: boolean) => setPerfOverlay(on, ctx),
      /** N scripted frames (one sim step + one render each) with the profiler on; returns averages, p95 and the section breakdown. */
      profile(frames: number) {
        if (!game) return null;
        const g = game;
        setPerfOverlay(true, ctx);
        const sums: Record<string, number> = {};
        const counts: Record<string, number> = {};
        const times: number[] = [];
        const series: (number | string)[][] = [];
        let update = 0;
        let rendering = 0;
        for (let i = 0; i < frames; i++) {
          const t0 = performance.now();
          step(g, [intentCommand(g, sampleInput(g))]);
          const t1 = performance.now();
          draw(t1);
          const t2 = performance.now();
          frameDone(t2 - t0, t1 - t0, t2 - t1, { enemies: g.enemies.length, projectiles: g.projectiles.length, particles: g.particles.length, fields: g.fields.length, zones: g.zones.length, texts: g.texts.length });
          sampleFrame(t2 - t0, g.wave); // the dynamic detail level reacts here exactly as in the real loop
          times.push(t2 - t0);
          const heaviest = Object.entries(perf.sections).sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
          series.push([+(t2 - t0).toFixed(1), +(t1 - t0).toFixed(1), +(t2 - t1).toFixed(1), g.enemies.length, g.texts.length, g.particles.length, heaviest[0], +heaviest[1].toFixed(1)]);
          update += t1 - t0;
          rendering += t2 - t1;
          for (const [k, v] of Object.entries(perf.sections)) sums[k] = (sums[k] ?? 0) + v;
          for (const [k, v] of Object.entries(perf.counts)) counts[k] = (counts[k] ?? 0) + v;
        }
        times.sort((a, b) => a - b);
        const avg = (n: number) => +(n / frames).toFixed(2);
        return {
          frames,
          series,
          avgMs: avg(times.reduce((a, b) => a + b, 0)),
          p95: +times[Math.floor(frames * 0.95)].toFixed(1),
          max: +times[frames - 1].toFixed(1),
          updateMs: avg(update),
          renderMs: avg(rendering),
          counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round(v / frames)])),
          sections: Object.fromEntries(Object.entries(sums).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, avg(v)])),
          detail: +quality.detail.toFixed(2),
        };
      },
      start: startRun,
      /** v0.6: jump ahead for tests: straight on to `act` (no Merchant visits), with `wave` next to start. */
      skipTo(act: number, wave: number) {
        if (!game) return;
        while (game.act < act) nextAct(game);
        game.wave = game.wavesCleared = wave - 1;
        game.breather = 0.01;
      },
      /** What the balance bot would do right now. Tests turn this into real touch or key events and step with mode 'input'. */
      botIntent() {
        if (!game) return null;
        const i = botInput(game);
        return { moveX: i.moveX, moveY: i.moveY, ability: i.ability };
      },
      draw: () => draw(performance.now()),
      /** Advance n ticks with real UI flow; choice screens are answered by clicking their first option. mode: 'input' reads the real input layer. */
      run(n: number, ability = false, mode: boolean | 'input' = false) {
        for (let i = 0; i < n && game && state !== 'results'; i++) {
          if (state === 'choice') (document.querySelector('[data-pick], [data-leave], [data-bank]') as HTMLElement).click(); // v0.6: a win is banked
          playCues(game); // the pick's sound, before step clears the queue
          if (state !== 'playing') continue;
          const intent = mode === 'input' ? sampleInput(game) : mode ? botInput(game) : { ...game.input, ability }; // the bot moves and casts, but the real choice screens still open
          step(game, [intentCommand(game, intent)]);
          afterStep(game);
        }
      },
      /** Let the balance bot play n ticks (it answers choices itself, so no screens open). */
      bot(n: number, variant = 0) {
        for (let i = 0; i < n && game && state === 'playing' && game.victory !== 'pending'; i++) {
          botStep(game, variant);
          if (game.over) endRun(game);
        }
      },
    },
  });
}
