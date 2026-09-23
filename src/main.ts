import './ui/style.css';
import { ARENAS, type ArenaId } from './config/arenas';
import type { ClassId } from './config/classes';
import { TIERS, type MetaId } from './config/economy';
import { GAME, VIEW } from './config/game';
import { initAudio, isMuted, toggleMute } from './core/audio';
import { musicLevel, refreshMusic, setMusicLevel, startMenuMusic, stopMenuMusic } from './core/music';
import { clamp } from './core/math';
import { platform, type UpdateStatus } from './core/platform';
import { registerServiceWorker } from './core/pwa';
import { begin, end, frameDone, overlayText, perf, resetHistory, setEnabled as setPerfOverlay, summary } from './core/perf';
import { quality, sampleFrame, setQuality } from './core/quality';
import { loadSave, readBackups, restoreBackup, storeSave, wipeSave } from './core/storage';
import type { Game } from './core/types';
import { createGame, summarizeRun, updateGame } from './game';
import { initInput, inspectPoint, onAction, onFirstGesture, pollInput, pumpGamepad, setTouchControls } from './input';
import { upgradeOptions } from './logic/abilityUpgrades';
import { lockedArenas, lockedRelics, rewardText, tierKey, unlockedCurses, withAchievements } from './logic/achievements';
import { dailySetup, formatSeed, parseSeed, todayString, type DailySetup } from './logic/acts';
import { curseMultiplier } from './logic/curses';
import { oathCap } from './logic/oaths';
import { closestGoals } from './logic/goals';
import { currentProgress, weekKey, weeklyContracts } from './logic/contracts';
import { chooseRoute, leaveMerchant, merchantBuy, merchantHeal, merchantReroll, merchantSalvage, merchantSell, nextAct } from './systems/acts';
import { questTake } from './systems/quests';
import { densestCluster, resolveAim } from './logic/aim';
import { masteryBonus, masteryRank, metaLoadout, rerollCost, accountLevel, buildingLevel } from './logic/economy';
import { applyRun, buyMeta, defaultSave, importSave, type Save, buyBuilding, today } from './logic/save';
import { buildArena } from './render/arena';
import { cameraFor, render, renderBackdrop, type View } from './render/renderer';
import { botInput, botStep } from './sim/bot';
import { abilityAimRadius, chooseAbilityUpgrade } from './systems/abilities';
import { banishOption, chooseLevelUp, levelUpOptions } from './systems/leveling';
import { relicPreview, relicShares, rerollRelicOffer, resolveRelicOffer, skipRelicOffer, skipReward } from './systems/relics';
import { initTooltips } from './ui/tooltip';
import { buildHud, setMuteIcon, showHud, toast, updateHud, updateInspect } from './ui/hud';
import { clearOverlay, showAbilityUpgrade, showBoard, showChronicle, showClassSelect, showCompendium, showDaily, showKeep, showLevelUp, showMerchant, showPause, showPeddler, showRelicOffer, showResults, showRoutes, showRunHistory, showSaveDialog, type RunResult, showSettings, showShrine, showTalents, showTitle, showTreasures, showUtilityUpgrade, showMastery, type TitleInfo } from './ui/screens';
import { TREASURE_RULES, TREASURES, treasureDesc } from './config/treasures';
import { inText } from './logic/treasures';
import { RELIC_MOMENTS, TIER_NUMERALS } from './config/relics';
import { TRAITS } from './config/traits';
import { CLASS_ORDER } from './config/classes';
import { MASTERY } from './config/economy';
import { spendTalent } from './systems/talents';
import { chooseBlessing } from './systems/regions';
import { markBored } from './systems/runlog';
import { buildState } from './systems/evolutions';
import { setRecipeBuild } from './ui/relicText';
import { endlessScore, goEndless } from './systems/victory';
import { takeQuests } from './systems/quests';
import { peddlerBuy, peddlerPrice } from './systems/events';
import { chooseUtilityUpgrade, utilityUpgradeOptions } from './systems/utility';

type State = 'menu' | 'playing' | 'choice' | 'paused' | 'results';

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
  const week = weekKey(today());
  const progress = currentProgress(save.contracts, week);
  return weeklyContracts(week).map((c, i) => ({ text: c.text, progress: progress[i], target: c.target, runes: c.runes }));
}

function toTitle(): void {
  menu();
  onTitle = true;
  showTitle(
    { gold: save.gold, runes: save.runes, label: `V${platform.version.replace(/\.\d+$/, (p) => (p === '.0' ? '' : p))} · ${platform.name}`, mobile: platform.touch, buildDate: `${platform.buildDate} · v${platform.version}`, notice, daily: { date: todayString(), best: save.daily[todayString()] ?? 0 }, title: save.title, contracts: titleContracts() },
    { start: toSelect, daily: toDaily, keep: toKeep, chronicle: () => toChronicle(toTitle), settings: toSettings },
  );
}

/** The Chronicle, from the title screen or the Keep. Equipping a title commits and re-opens it. */
function toChronicle(back: () => void): void {
  menu();
  showChronicle(save, back, (title) => {
    commit({ ...save, title });
    toChronicle(back);
  });
}

/** Same seed, class, arena and curses for everyone on a given date. Locks do not apply: it is a fixed challenge. */
function toDaily(): void {
  initAudio();
  menu();
  const setup = dailySetup(todayString());
  showDaily(setup, save.daily[setup.date] ?? 0, () => startRun(setup.classId, { seed: setup.seed, daily: setup }), toTitle);
}

/** Updates never interrupt anything: they only ever surface as a notice on the title screen. */
function setNotice(next: TitleInfo['notice']): void {
  notice = next;
  if (onTitle) toTitle();
}

function toSelect(): void {
  initAudio();
  menu();
  showClassSelect(save, {
    pick: (id, seedText) => startRun(id, { seed: parseSeed(seedText) ?? undefined }),
    back: toTitle,
    curse(id) {
      if (!unlockedCurses(save).includes(id)) return;
      const on = save.settings.curses;
      commit({ ...save, settings: { ...save.settings, curses: on.includes(id) ? on.filter((c) => c !== id) : [...on, id] } });
      toSelect();
    },
    settings(arena, tier) {
      if (lockedArenas(save).includes(arena) || tier > save.tierUnlocked || tier > buildingLevel(save.buildings, 'watchtower')) return;
      commit({ ...save, settings: { ...save.settings, arena, tier } });
      toSelect();
    },
    oath(level) {
      const max = Math.max(...CLASS_ORDER.map((id) => oathCap(save.wins[id], save.oaths[id])));
      commit({ ...save, settings: { ...save.settings, oath: Math.max(0, Math.min(max, level)) } });
      toSelect();
    },
    palette(id, n) {
      if (n !== 0 && !masteryBonus(save.classes[id].xp).palettes.includes(n) && !save.palettes.includes(n)) return;
      commit({ ...save, settings: { ...save.settings, palettes: { ...save.settings.palettes, [id]: n } } });
      toSelect();
    },
    trait(id) {
      const need = TRAITS[id].unlock.achievement;
      if (need && !save.achievements.includes(need)) return;
      // v0.6: with the Second Banner two traits can be on; a third choice replaces the newer one
      const slots = metaLoadout(save.meta).traitSlots;
      const on = [save.settings.trait, save.settings.trait2].filter((t) => t !== 'none');
      const next = id === 'none' ? [] : on.includes(id) ? on.filter((t) => t !== id) : [...on, id].slice(-slots);
      commit({ ...save, settings: { ...save.settings, trait: next[0] ?? 'none', trait2: next[1] ?? 'none' } });
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

function toKeep(): void {
  menu();
  showKeep(save, {
    back: toTitle,
    compendium: () => showCompendium(save, toKeep),
    chronicle: () => toChronicle(toKeep),
    mastery: (id) => showMastery(save, id, toKeep),
    treasures: () => showTreasures(save, null, toKeep),
    history: () => showRunHistory(save.runs, toKeep),
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
    { quality: save.settings.quality, effective: quality.level, muted: isMuted(), music: musicLevel(), perf: perf.enabled, desktop: d ? { version: platform.version, status: updateStatus, prerelease: save.settings.prerelease } : null },
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

function toSaveDialog(): void {
  menu();
  showSaveDialog(save, {
    back: toSettings,
    import(text) {
      const imported = importSave(text);
      if (imported) commit(imported);
      return imported !== null;
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
function startRun(id: ClassId, opts: { seed?: number; daily?: DailySetup } = {}): void {
  initAudio();
  stopMenuMusic();
  clearOverlay();
  toasted.clear();
  lastToastCheck = '';
  lastChain = '';
  const d = opts.daily;
  const rec = save.treasures[id];
  game = createGame(id, opts.seed ?? Date.now() >>> 0, {
    arena: d ? d.arena : save.settings.arena,
    tier: d ? 0 : save.settings.tier,
    meta: save.meta,
    classXp: save.classes[id].xp,
    lockedRelics: lockedRelics(save),
    curses: d ? d.curses : save.settings.curses.filter((c) => unlockedCurses(save).includes(c)),
    daily: d?.date,
    trait: d ? 'none' : save.settings.trait, // the Daily Trial is the same for everyone
    trait2: d ? 'none' : save.settings.trait2,
    oath: d ? 0 : Math.min(save.settings.oath, oathCap(save.wins[id], save.oaths[id])), // v0.6: a class swears at most one above its highest kept
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

function openLevelUp(g: Game): void {
  let free = g.rerolls;
  let paid = 0;
  const offer = (): void => {
    const p = g.player;
    const options = levelUpOptions(g);
    showLevelUp(p.level - g.pendingLevelUps + 1, options, p.cls, p.stats, { free, cost: rerollCost(paid), gold: g.gold }, {
      pick(o) {
        chooseLevelUp(g, o);
        resume();
      },
      banish: g.banishes > 0 ? (o) => banishOption(g, o) && offer() : undefined, // v0.6: struck for good, and a fresh hand
      reroll() {
        if (free > 0) free--;
        else if (g.gold >= rerollCost(paid)) g.gold -= rerollCost(paid++);
        else return;
        offer();
      },
    }, g.player.relics.tiers);
  };
  offer();
}

/** Relics first (they are lying on the ground), then ability tiers, a shrine, the quest board, the peddler, then boons. */
function openChoice(g: Game): void {
  state = 'choice';
  setTouchControls(false);
  setRecipeBuild(buildState(g)); // v0.6: relic and talent tooltips point out the missing half of an evolution recipe
  if (g.victory === 'pending') {
    // v0.6: the Usurper fell. The screen shows the run as it would bank now; going on keeps it running into Endless.
    showResults(runResult(g, false), {
      endless() {
        goEndless(g);
        resume();
      },
      bank: () => endRun(g),
      restart: () => (endRun(g), again(g)),
    });
  } else if (g.player.relics.offers.length > 0) {
    const p = g.player;
    showRelicOffer(p.relics.offers[0], p.relics.held, p.relics.tiers, { skip: skipReward(g), preview: (id) => relicPreview(p, id) }, {
      take: (id) => void (resolveRelicOffer(g, id, p), resume()),
      skip: () => void (skipRelicOffer(g, p), resume()),
      reroll: () => void (rerollRelicOffer(g, p), openChoice(g)),
    });
  } else if (g.pendingAbilityTiers.length > 0) {
    const tier = g.pendingAbilityTiers[0];
    showAbilityUpgrade(tier, upgradeOptions(g.player.cls.id, tier), g.player.cls, (id) => {
      if (!chooseAbilityUpgrade(g, id)) g.pendingAbilityTiers.shift(); // never leave the player stuck on a choice that cannot be made
      resume();
    });
  } else if (g.pendingUtilityTiers.length > 0) {
    showUtilityUpgrade(g.pendingUtilityTiers[0], utilityUpgradeOptions(g), g.player.cls, (id) => {
      if (!chooseUtilityUpgrade(g, id)) g.pendingUtilityTiers.shift();
      resume();
    });
  } else if (g.pendingShrine) {
    showShrine(g.pendingShrine, (id) => {
      chooseBlessing(g, id);
      resume();
    });
  } else if (g.pendingBoard) {
    const trial = TREASURES[g.player.cls.id].trial;
    showBoard(g.act, g.quests.filter((q) => q.state === 'offered').map((q) => (q.kind === 'trial' ? { ...q, desc: trial.desc } : q)), questTake(g), (picks) => {
      takeQuests(g, picks);
      resume();
    });
  } else if (g.pendingRoute) {
    const routes = g.pendingRoute;
    showRoutes(g.act, routes, (i) => {
      chooseRoute(g, i);
      resume();
    });
  } else if (g.pendingShop) openPeddler(g);
  else if (g.pendingLevelUps > 0) openLevelUp(g);
  else openMerchant(g);
}

/** v0.5: the wandering merchant's wares; it re-opens after every purchase, like the Merchant. */
function openPeddler(g: Game): void {
  showPeddler({ stock: g.event?.stock ?? 0, price: peddlerPrice(g), gold: g.gold, hurt: g.player.hp < g.player.stats.hp }, {
    buy() {
      if (peddlerBuy(g)) openPeddler(g);
    },
    leave() {
      g.pendingShop = false;
      resume();
    },
  });
}

/** Between Acts: spend run gold (which would otherwise be banked), then on to the next arena. */
function openMerchant(g: Game): void {
  const act = g.act;
  const again = (ok: boolean) => ok && openMerchant(g);
  showMerchant(
    { act, gold: g.gold, hp: g.player.hp, maxHp: g.player.stats.hp, relics: g.player.relics.held, tiers: g.player.relics.tiers, salvage: g.salvage, relicsLeft: g.midMerchant ? 0 : RELIC_MOMENTS.merchantPerVisit - (g.vars.merchantRelics ?? 0), mid: g.midMerchant },
    {
      heal: () => again(merchantHeal(g)),
      buy: (r) => void (merchantBuy(g, r) && openChoice(g)), // v0.7: the pick of three opens, then the Merchant again
      reroll: (id) => again(merchantReroll(g, id)),
      sell: (id) => again(merchantSell(g, id)),
      salvage: (id) => again(merchantSalvage(g, id)),
      leave() {
        leaveMerchant(g); // on with the Act, or (v0.6) to the fork in the road
        resume();
      },
    },
  );
}

const buildOf = (g: Game) => ({ relics: g.player.relics.held, tiers: g.player.relics.tiers, attune: g.player.relics.attune, upgrades: g.player.upgrades, classId: g.player.cls.id, talents: g.player.talents, talentPoints: g.talentPoints, utilityUpgrades: g.player.utilityUpgrades, trait: g.trait, sacred: sacredLines(g), evolutions: g.evolutions });

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

const hasChoice = (g: Game) => g.victory === 'pending' || g.pendingShrine !== null || g.player.relics.offers.length > 0 || g.pendingAbilityTiers.length > 0 || g.pendingUtilityTiers.length > 0 || g.pendingBoard || g.pendingShop || g.pendingLevelUps > 0 || g.pendingMerchant || g.pendingRoute !== null;

function togglePause(): void {
  if (state === 'playing' && game) {
    const g = game;
    state = 'paused';
    setTouchControls(false);
    pauseMenu(g);
  } else if (state === 'paused') resume();
}

function pauseMenu(g: Game): void {
  setRecipeBuild(buildState(g));
  showPause(buildOf(g), {
    resume: togglePause,
    quit: () => endRun(g),
    talents: () => openTalents(g),
    treasures: () => showTreasures(applyRun(save, summarizeRun(g)).save, g.player.cls.id, () => pauseMenu(g)), // the log as it would stand if the run ended now
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
    spend: (id) => spendTalent(g, id),
    back: () => pauseMenu(g),
  });
}

/**
 * What the results screen shows: the run banked (commitIt), or as it would bank right now (the victory screen, before the player
 * chooses between banking and Endless). Both go through the same applyRun, so the preview is what banking pays.
 */
function runResult(g: Game, commitIt: boolean): RunResult {
  const id = g.player.cls.id;
  const prevBest = save.classes[id].bestWave;
  const prevRank = masteryRank(save.classes[id].xp);
  const result = applyRun(save, summarizeRun(g));
  const checked = commitIt ? { save: result.save, earned: commit(result.save) } : withAchievements(result.save);
  const after = commitIt ? save : checked.save;
  const newRank = masteryRank(after.classes[id].xp);
  return {
    cls: g.player.cls, wave: g.wave, kills: g.kills, time: g.time, level: g.player.level,
    best: after.classes[id].bestWave, newBest: g.wave > prevBest,
    gold: result.gold, goldRaw: Math.max(0, g.gold - g.goldStart), runes: result.runes, classXp: result.classXp, masteryRank: newRank,
    masteryName: newRank > prevRank ? MASTERY[newRank - 1].name : null,
    masteryNext: MASTERY[newRank] ? { name: MASTERY[newRank].name, need: Math.max(0, Math.round(MASTERY[newRank].xp - after.classes[id].xp)) } : null,
    tier: g.tier.name, tierUnlocked: result.tierUnlocked ? TIERS[after.tierUnlocked].name : null, earned: checked.earned, title: after.title, slain: g.over,
    seed: formatSeed(g.seed), curseMult: curseMultiplier(g.curses), daily: g.daily, build: buildOf(g),
    act: g.act, won: g.victory !== 'none', firstWin: result.firstWin, wins: after.wins[id], oath: g.oath.level, oathKept: result.oathKept, contracts: result.contracts,
    goals: closestGoals(after, id, weekKey(today())),
    relicShares: relicShares(g),
    restart: g.daily ? `the Daily Trial ${g.daily}` : [g.player.cls.name, ...[g.trait, g.trait2].filter((t) => t !== 'none').map((t) => TRAITS[t].name), g.oath.level ? `Oath ${g.oath.level}` : ''].filter(Boolean).join(' · '),
    endless: g.victory === 'endless' ? { score: endlessScore(g), rank: result.endlessRank, board: after.endless[id] } : null,
  };
}

/** v0.6 Quick Restart: the same class, traits and Oath (they live in the settings), or today's Daily Trial again. */
const again = (g: Game): void => (g.daily ? toDaily() : startRun(g.player.cls.id));

/** Death, "end run", or banking a win: the run is banked. */
function endRun(g: Game): void {
  state = 'results';
  setTouchControls(false);
  startMenuMusic();
  showResults(runResult(g, true), { retry: () => again(g), menu: toSelect });
}

function mute(): void {
  setMuteIcon(toggleMute());
  refreshMusic();
}

// ---------- simulation step ----------
/** The input layer speaks in intents and screen pixels; this turns them into the game's world-space input. */
function sampleInput(g: Game): void {
  const intent = pollInput();
  const cam = cameraFor(g, view);
  const pxToWorld = view.dpr / view.zoom;
  const p = g.player;
  const ability = p.cls.ability;
  const castRange = 'castRange' in ability ? ability.castRange : DEFAULT_CAST_RANGE;
  const needsAuto = intent.aim.kind !== 'screen' && (intent.ability || intent.showAim);
  const auto = needsAuto ? densestCluster(g.enemies, p, castRange, abilityAimRadius(p) || 120) : null;
  const aim = resolveAim(intent.aim, p, auto, castRange, (x, y) => ({ x: cam.x + x * pxToWorld, y: cam.y + y * pxToWorld }), pxToWorld);
  g.input = { moveX: intent.moveX, moveY: intent.moveY, aimX: aim.x, aimY: aim.y, ability: intent.ability, utility: intent.utility, showAim: intent.showAim };
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
  for (const e of withAchievements(applyRun(save, summarizeRun(g)).save).earned) {
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
  if (g.over) endRun(g);
  else {
    checkToasts(g);
    chainToasts(g);
    if (hasChoice(g)) openChoice(g);
  }
}

function step(): void {
  if (state !== 'playing' || !game) return;
  sampleInput(game);
  updateGame(game, DT);
  afterStep(game);
}

// ---------- fixed-timestep loop, rendering decoupled ----------
let last = performance.now();
let acc = 0;
function draw(now: number): void {
  if (game) {
    render(ctx, game, view, arenaCanvas(game.arena.id), abilityAimRadius(game.player));
    const t = begin();
    updateHud(game);
    inspect(game);
    end('hud', t);
  } else renderBackdrop(ctx, view, arenaCanvas(save.settings.arena), now / 1000);
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
  const elapsed = now - last;
  acc += elapsed / 1000;
  last = now;
  pumpGamepad();
  let steps = 0;
  const t0 = performance.now(); // always measured (not begin()): the dynamic quality needs it with the overlay off
  while (acc >= DT) {
    if (steps++ < MAX_STEPS) step();
    acc -= DT;
  }
  const t1 = performance.now();
  // ponytail: no render interpolation; at 60 Hz sim it is not visible. Add alpha lerp if tickRate drops.
  draw(now);
  const t2 = performance.now();
  const g = game;
  if (state === 'playing' && g) {
    const before = quality.level;
    sampleFrame(t2 - t0, g.wave); // the work this frame took, not the vsync interval: that is what the detail level reacts to
    if (quality.level !== before) resize(); // auto quality dropped: also lowers the pixel ratio
  }
  frameDone(elapsed, t1 - t0, t2 - t1, g ? { enemies: g.enemies.length, projectiles: g.projectiles.length, particles: g.particles.length, fields: g.fields.length, zones: g.zones.length, texts: g.texts.length } : { enemies: 0, projectiles: 0, particles: 0, fields: 0, zones: 0, texts: 0 });
  if (perf.enabled) perfEl.textContent = overlayText();
  requestAnimationFrame(frame);
}

// ---------- boot ----------
function resize(): void {
  // innerWidth/innerHeight, not 100vh: on iOS 100vh includes the area under the browser chrome
  const w = window.innerWidth;
  const h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
  view.w = canvas.width = Math.round(w * view.dpr);
  view.h = canvas.height = Math.round(h * view.dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  view.zoom = clamp(Math.min(w / VIEW.targetW, h / VIEW.targetH), VIEW.minZoom, VIEW.maxZoom) * view.dpr;
  document.documentElement.classList.toggle('compact', h < 560); // v0.5: phones get a denser HUD layout at full text size, not a scaled-down one
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
    if (s.state === 'ready') setNotice({ text: `Update to v${s.version} ready`, button: 'Restart', action: () => platform.desktop!.quitAndInstall() });
  });
  void platform.desktop.checkForUpdates(save.settings.prerelease);
} else registerServiceWorker((apply) => setNotice({ text: 'New version available', button: 'Tap to reload', action: apply }));
if (loaded.restored) setNotice({ text: `Your save could not be read; the backup from ${new Date(loaded.restored.at).toLocaleString()} was loaded instead (the unreadable one is kept as a backup)`, button: 'OK', action: () => setNotice(null) });

toTitle();
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
      quality,
      perf,
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
          sampleInput(g);
          updateGame(g, DT);
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
        botInput(game);
        return { moveX: game.input.moveX, moveY: game.input.moveY, ability: game.input.ability };
      },
      draw: () => draw(performance.now()),
      /** Advance n ticks with real UI flow; choice screens are answered by clicking their first option. mode: 'input' reads the real input layer. */
      run(n: number, ability = false, mode: boolean | 'input' = false) {
        for (let i = 0; i < n && game && state !== 'results'; i++) {
          if (state === 'choice') (document.querySelector('[data-pick], [data-leave], [data-bank]') as HTMLElement).click(); // v0.6: a win is banked
          if (state !== 'playing') continue;
          if (mode === 'input') sampleInput(game);
          else if (mode) botInput(game); // the bot moves and casts, but the real choice screens still open
          else game.input.ability = ability;
          updateGame(game, DT);
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
