import './ui/style.css';
import { ARENAS, type ArenaId } from './config/arenas';
import type { ClassId } from './config/classes';
import { TIERS, type MetaId } from './config/economy';
import { GAME } from './config/game';
import { initAudio, isMuted, toggleMute } from './core/audio';
import { abilityHeld, initInput, input, moveAxis } from './core/input';
import { loadSave, storeSave, wipeSave } from './core/storage';
import type { Game } from './core/types';
import { createGame, summarizeRun, updateGame } from './game';
import { upgradeOptions } from './logic/abilityUpgrades';
import { lockedArenas, lockedRelics, withAchievements } from './logic/achievements';
import { masteryRank, rerollCost } from './logic/economy';
import { applyRun, buyMeta, defaultSave, importSave, type Save } from './logic/save';
import { buildArena } from './render/arena';
import { cameraFor, render, renderBackdrop, type View } from './render/renderer';
import { botInput, botStep } from './sim/bot';
import { abilityAimRadius, chooseAbilityUpgrade } from './systems/abilities';
import { chooseLevelUp, levelUpOptions } from './systems/leveling';
import { resolveRelicOffer } from './systems/relics';
import { buildHud, setMuteIcon, showHud, updateHud } from './ui/hud';
import { clearOverlay, showAbilityUpgrade, showChronicle, showClassSelect, showKeep, showLevelUp, showPause, showRelicOffer, showResults, showSaveDialog, showTitle } from './ui/screens';

type State = 'menu' | 'playing' | 'choice' | 'paused' | 'results';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const view: View = { w: 0, h: 0, zoom: 1 };
const DT = 1 / GAME.tickRate;
const MAX_STEPS = 5; // after a long stall, drop time instead of spiralling

let state: State = 'menu';
let game: Game | null = null;
let save: Save = loadSave();

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
  showHud(false);
}

function toTitle(): void {
  menu();
  showTitle(save.gold, { start: toSelect, keep: toKeep, chronicle: () => showChronicle(save, toTitle), save: toSaveDialog });
}

function toSelect(): void {
  initAudio();
  menu();
  showClassSelect(save, {
    pick: startRun,
    back: toTitle,
    settings(arena, tier) {
      if (lockedArenas(save).includes(arena) || tier > save.tierUnlocked) return;
      commit({ ...save, settings: { arena, tier } });
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

function toSaveDialog(): void {
  menu();
  showSaveDialog(save, {
    back: toTitle,
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
function startRun(id: ClassId): void {
  initAudio();
  clearOverlay();
  game = createGame(id, Date.now(), {
    arena: save.settings.arena,
    tier: save.settings.tier,
    meta: save.meta,
    classXp: save.classes[id].xp,
    lockedRelics: lockedRelics(save),
  });
  state = 'playing';
  showHud(true);
}

function resume(): void {
  clearOverlay();
  state = 'playing'; // the loop opens the next queued choice, if any
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
  } else openLevelUp(g);
}

const hasChoice = (g: Game) => g.relicOffers.length > 0 || g.pendingAbilityTiers.length > 0 || g.pendingLevelUps > 0;

function togglePause(): void {
  if (state === 'playing' && game) {
    const g = game;
    state = 'paused';
    showPause({ relics: g.relics, upgrades: g.player.upgrades }, togglePause, () => endRun(g));
  } else if (state === 'paused') resume();
}

/** Death or "end run": either way the run is banked. */
function endRun(g: Game): void {
  state = 'results';
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
    },
    () => startRun(id),
    toSelect,
  );
}

function mute(): void {
  setMuteIcon(toggleMute());
}

// ---------- simulation step ----------
function sampleInput(g: Game): void {
  const axis = moveAxis();
  const cam = cameraFor(g, view);
  g.input.moveX = axis.x;
  g.input.moveY = axis.y;
  g.input.aimX = cam.x + input.mouseX / view.zoom;
  g.input.aimY = cam.y + input.mouseY / view.zoom;
  g.input.ability = abilityHeld();
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
  } else renderBackdrop(ctx, view, arenaCanvas(save.settings.arena), now / 1000);
}
function frame(now: number): void {
  acc += (now - last) / 1000;
  last = now;
  let steps = 0;
  while (acc >= DT) {
    if (steps++ < MAX_STEPS) step();
    acc -= DT;
  }
  // ponytail: no render interpolation; at 60 Hz sim it is not visible. Add alpha lerp if tickRate drops.
  draw(now);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
function resize(): void {
  view.w = canvas.width = window.innerWidth;
  view.h = canvas.height = window.innerHeight;
  view.zoom = Math.max(1, Math.min(2, Math.min(view.w / 1280, view.h / 720)));
}
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') mute();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

resize();
initInput();
buildHud(togglePause, mute);
setMuteIcon(isMuted());
commit(save); // writes the migrated save once, and grants anything a v0.1 record already earned
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
      start: startRun,
      draw: () => draw(performance.now()),
      /** Advance n ticks with real UI flow; choice screens are answered by clicking their first option. */
      run(n: number, ability = false, steer = false) {
        for (let i = 0; i < n && game && state !== 'results'; i++) {
          if (state === 'choice') (document.querySelector('[data-pick]') as HTMLElement).click();
          if (state !== 'playing') continue;
          if (steer) botInput(game); // the bot moves and casts, but the real choice screens still open
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
