import './ui/style.css';
import { ARENAS, type ArenaId } from './config/arenas';
import type { ClassId } from './config/classes';
import { TIERS, type MetaId } from './config/economy';
import { GAME, VIEW } from './config/game';
import { initAudio, isMuted, toggleMute } from './core/audio';
import { clamp } from './core/math';
import { platform, type UpdateStatus } from './core/platform';
import { registerServiceWorker } from './core/pwa';
import { quality, sampleFrame, setQuality } from './core/quality';
import { loadSave, storeSave, wipeSave } from './core/storage';
import type { Game } from './core/types';
import { createGame, summarizeRun, updateGame } from './game';
import { initInput, inspectPoint, onAction, onFirstGesture, pollInput, pumpGamepad, setTouchControls } from './input';
import { upgradeOptions } from './logic/abilityUpgrades';
import { lockedArenas, lockedRelics, unlockedCurses, withAchievements } from './logic/achievements';
import { dailySetup, formatSeed, parseSeed, todayString, type DailySetup } from './logic/acts';
import { curseMultiplier } from './logic/curses';
import { merchantBuy, merchantHeal, merchantRemove, merchantReroll, nextAct } from './systems/acts';
import { densestCluster, resolveAim } from './logic/aim';
import { masteryRank, rerollCost } from './logic/economy';
import { applyRun, buyMeta, defaultSave, importSave, type Save } from './logic/save';
import { buildArena } from './render/arena';
import { cameraFor, render, renderBackdrop, type View } from './render/renderer';
import { botInput, botStep } from './sim/bot';
import { abilityAimRadius, chooseAbilityUpgrade } from './systems/abilities';
import { chooseLevelUp, levelUpOptions } from './systems/leveling';
import { resolveRelicOffer } from './systems/relics';
import { buildHud, setMuteIcon, showHud, updateHud, updateInspect } from './ui/hud';
import { clearOverlay, showAbilityUpgrade, showChronicle, showClassSelect, showDaily, showKeep, showLevelUp, showMerchant, showPause, showRelicOffer, showResults, showSaveDialog, showSettings, showTitle, type TitleInfo } from './ui/screens';

type State = 'menu' | 'playing' | 'choice' | 'paused' | 'results';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const view: View = { w: 0, h: 0, zoom: 1, dpr: 1 };
const DT = 1 / GAME.tickRate;
const MAX_STEPS = 5; // after a long stall, drop time instead of spiralling
const DEFAULT_CAST_RANGE = 320; // auto-aim reach for abilities without a castRange of their own

let state: State = 'menu';
let game: Game | null = null;
let save: Save = loadSave();
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
  onTitle = false;
  showHud(false);
  setTouchControls(false);
}

function toTitle(): void {
  menu();
  onTitle = true;
  showTitle(
    { gold: save.gold, label: `V${platform.version.replace(/\.\d+$/, (p) => (p === '.0' ? '' : p))} · ${platform.name}`, mobile: platform.touch, buildDate: `${platform.buildDate} · v${platform.version}`, notice, daily: { date: todayString(), best: save.daily[todayString()] ?? 0 } },
    { start: toSelect, daily: toDaily, keep: toKeep, chronicle: () => (menu(), showChronicle(save, toTitle)), settings: toSettings },
  );
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
      if (lockedArenas(save).includes(arena) || tier > save.tierUnlocked) return;
      commit({ ...save, settings: { ...save.settings, arena, tier } });
      toSelect();
    },
  });
}

function toKeep(): void {
  menu();
  showKeep(save, {
    back: toTitle,
    buy(id: MetaId) {
      commit(buyMeta(save, id));
      toKeep();
    },
  });
}

function toSettings(): void {
  menu();
  const d = platform.desktop;
  showSettings(
    { quality: save.settings.quality, effective: quality.level, muted: isMuted(), desktop: d ? { version: platform.version, status: updateStatus, prerelease: save.settings.prerelease } : null },
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
  });
}

// ---------- run ----------
function startRun(id: ClassId, opts: { seed?: number; daily?: DailySetup } = {}): void {
  initAudio();
  clearOverlay();
  const d = opts.daily;
  game = createGame(id, opts.seed ?? Date.now() >>> 0, {
    arena: d ? d.arena : save.settings.arena,
    tier: d ? 0 : save.settings.tier,
    meta: save.meta,
    classXp: save.classes[id].xp,
    lockedRelics: lockedRelics(save),
    curses: d ? d.curses : save.settings.curses.filter((c) => unlockedCurses(save).includes(c)),
    daily: d?.date,
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
    showLevelUp(p.level - g.pendingLevelUps + 1, levelUpOptions(g), p.cls, p.stats, { free, cost: rerollCost(paid), gold: g.gold }, {
      pick(o) {
        chooseLevelUp(g, o);
        resume();
      },
      reroll() {
        if (free > 0) free--;
        else if (g.gold >= rerollCost(paid)) g.gold -= rerollCost(paid++);
        else return;
        offer();
      },
    });
  };
  offer();
}

/** Relics first (they are lying on the ground), then ability tiers, then boons. */
function openChoice(g: Game): void {
  state = 'choice';
  setTouchControls(false);
  if (g.relicOffers.length > 0) {
    showRelicOffer(g.relicOffers[0], g.relics, g.relicSlots, {
      take: (id, replace) => void (resolveRelicOffer(g, id, replace), resume()),
      skip: () => void (resolveRelicOffer(g, null), resume()),
    });
  } else if (g.pendingAbilityTiers.length > 0) {
    const tier = g.pendingAbilityTiers[0];
    showAbilityUpgrade(tier, upgradeOptions(g.player.cls.id, tier), g.player.cls, (id) => {
      if (!chooseAbilityUpgrade(g, id)) g.pendingAbilityTiers.shift(); // never leave the player stuck on a choice that cannot be made
      resume();
    });
  } else if (g.pendingLevelUps > 0) openLevelUp(g);
  else openMerchant(g);
}

/** Between Acts: spend run gold (which would otherwise be banked), then on to the next arena. */
function openMerchant(g: Game): void {
  const act = g.act;
  const again = (ok: boolean) => ok && openMerchant(g);
  showMerchant(
    { act, gold: g.gold, hp: g.player.hp, maxHp: g.player.stats.hp, relics: g.relics, slots: g.relicSlots },
    {
      heal: () => again(merchantHeal(g)),
      buy: (r) => again(merchantBuy(g, r)),
      reroll: (i) => again(merchantReroll(g, i)),
      remove: (i) => again(merchantRemove(g, i)),
      leave() {
        nextAct(g);
        resume();
      },
    },
  );
}

const hasChoice = (g: Game) => g.relicOffers.length > 0 || g.pendingAbilityTiers.length > 0 || g.pendingLevelUps > 0 || g.pendingMerchant;

function togglePause(): void {
  if (state === 'playing' && game) {
    const g = game;
    state = 'paused';
    setTouchControls(false);
    showPause({ relics: g.relics, upgrades: g.player.upgrades }, togglePause, () => endRun(g));
  } else if (state === 'paused') resume();
}

/** Death or "end run": either way the run is banked. */
function endRun(g: Game): void {
  state = 'results';
  setTouchControls(false);
  const id = g.player.cls.id;
  const prevBest = save.classes[id].bestWave;
  const result = applyRun(save, summarizeRun(g));
  const earned = commit(result.save);
  showResults(
    {
      cls: g.player.cls, wave: g.wave, kills: g.kills, time: g.time, level: g.player.level,
      best: save.classes[id].bestWave, newBest: g.wave > prevBest,
      gold: Math.max(0, g.gold - g.goldStart), classXp: result.classXp, masteryRank: masteryRank(save.classes[id].xp),
      tier: g.tier.name, tierUnlocked: result.tierUnlocked ? TIERS[save.tierUnlocked].name : null, earned, slain: g.over,
      seed: formatSeed(g.seed), curseMult: curseMultiplier(g.curses), daily: g.daily,
    },
    () => (g.daily ? toDaily() : startRun(id)),
    toSelect,
  );
}

function mute(): void {
  setMuteIcon(toggleMute());
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
  g.input = { moveX: intent.moveX, moveY: intent.moveY, aimX: aim.x, aimY: aim.y, ability: intent.ability, showAim: intent.showAim };
}

function afterStep(g: Game): void {
  if (g.over) endRun(g);
  else if (hasChoice(g)) openChoice(g);
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
    updateHud(game);
    inspect(game);
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

function frame(now: number): void {
  const elapsed = now - last;
  acc += elapsed / 1000;
  last = now;
  pumpGamepad();
  let steps = 0;
  while (acc >= DT) {
    if (steps++ < MAX_STEPS) step();
    acc -= DT;
  }
  if (state === 'playing' && game) {
    const before = quality.level;
    sampleFrame(elapsed, game.wave);
    if (quality.level !== before) resize(); // auto quality dropped: also lowers the pixel ratio
  }
  // ponytail: no render interpolation; at 60 Hz sim it is not visible. Add alpha lerp if tickRate drops.
  draw(now);
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
  const root = document.documentElement;
  root.style.setProperty('--hud-scale', String(clamp(Math.min(w / 1280, h / 720), 0.55, 1)));
  root.classList.toggle('compact', h < 560);
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
onFirstGesture(initAudio); // iOS: the AudioContext may only start from a touch
onAction((a) => {
  if (a === 'pause') togglePause();
  if (a === 'mute') mute();
});
buildHud(togglePause, mute);
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

toTitle();
requestAnimationFrame(frame);

// Dev-only handle for automated smoke tests: drive the sim without real time or real input.
if (import.meta.env.DEV) {
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
      start: startRun,
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
          if (state === 'choice') (document.querySelector('[data-pick], [data-leave]') as HTMLElement).click();
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
        for (let i = 0; i < n && game && state === 'playing'; i++) {
          botStep(game, variant);
          if (game.over) endRun(game);
        }
      },
    },
  });
}
