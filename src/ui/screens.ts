import { ABILITY_UPGRADES, type AbilityUpgradeId } from '../config/abilityUpgrades';
import { ACHIEVEMENTS, CATEGORIES, tierReward, type AchievementCategory, type AchievementDef } from '../config/achievements';
import { ARENA_IDS, ARENAS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, CLASSES, type ClassDef, type ClassId } from '../config/classes';
import { CURSE_IDS, CURSES, type CurseId } from '../config/curses';
import { ARENA_FAMILIES, FAMILIES, FAMILY_IDS, preferredFamilies, type FamilyId, type Rarity, RELIC_IDS, RELIC_MAX_TIER, RELIC_WEIGHTS, relicDesc, TIER_NUMERALS } from '../config/relics';
import { actName, merchantPrice, type DailySetup, type MerchantItem } from '../logic/acts';
import { curseMultiplier } from '../logic/curses';
import { ACCOUNT_MILESTONES, BUILDING_IDS, BUILDINGS, MASTERY, META, RUNES, TIERS, VICTORY, type BuildingId, type MetaId } from '../config/economy';
import { CURSED, CURSED_IDS, DUO_IDS, DUOS, keyColor, keyIcon, keyName, relicDef, type DuoId, type RelicId, type RelicKey } from '../config/relics';
import { BLESSINGS, type BlessingId } from '../config/regions';
import { QUESTS, REWARDS, type QuestKind, type RewardKind } from '../config/quests';
import { TALENT_BRANCHES, TALENT_BY_ID, TALENTS, talentsFor, type BranchDef } from '../config/talents';
import { TRAIT_IDS, TRAITS, type TraitId } from '../config/traits';
import { ENEMIES, type EnemyDef, type EnemyId } from '../config/enemies';
import { WAVES } from '../config/waves';
import { TREASURE_RULES, TREASURES, treasureDesc, type TreasureId } from '../config/treasures';
import { chainStep, followUpText, inText, nextFragmentBoss, rankFor } from '../logic/treasures';
import { UTILITIES, UTILITY_UPGRADES, type UtilityUpgradeId } from '../config/utility';
import { classFacts, statShare } from '../logic/roster';
import { branchPoints, takenKeystone, talentBlocker } from '../logic/talents';
import * as kit from './kit';
import { duoTier, familySets, looseRelics, halfAttunement, type RelicTiers } from '../logic/relics';
import { salvageValue, sellPrice } from '../systems/acts';
import { duoTip, esc, keyTip, recipeLines, relicClass, relicLine, relicRarity, relicTip, tierBadge } from './relicText';
import type { RelicOffer, RelicSource } from '../core/types';
import { dropStaleTooltip } from './tooltip';
import { SKILL, TEXT_SIZES, type QualitySetting, type TextSize } from '../config/game';
import { MUSIC_LEVELS, type MusicLevel } from '../core/music';
import { STAT_KEYS, type StatKey, type Stats } from '../core/types';
import { latchGamepad, onAction } from '../input';
import type { Action } from '../input/mapping';
import { earnedTier, earnedTitles, gateOf, lockedArenas, lockedCurses, rewardText as tierRewardText, tierOf, type EarnedTier } from '../logic/achievements';
import { nextTierRequirement } from '../logic/difficulty';
import { accountLevel, buildingLevel, buildingOf, masteryBonus, masteryRank, metaCost, rankCap, rewardText } from '../logic/economy';
import { keepStage } from '../logic/keep';
import { exportSave, importSave, saveFormatLabel, type EndlessEntry, type Save } from '../logic/save';
import type { SaveBackup } from '../core/storage';
import { exportRunLogs, type MarkKind, type RunLog } from '../logic/runlog';
import { ACT_THEMES, ACTS, FINAL, MERCHANT, type BookId } from '../config/acts';
import { ROUTE_FOCUS } from '../config/routes';
import type { Route } from '../logic/routes';
import { EVOLUTION_IDS, EVOLUTIONS, type EvolutionId } from '../config/evolutions';
import { requirementText } from '../logic/evolutions';
import { optionText, statLabel, type LevelUpOption } from '../logic/upgrades';
import { drawSheetFrame, outlineSprite, portraitSprite, SHEETS, SPRITE_PALETTES } from '../render/sprites';
import { frameAt, type AnimName } from '../logic/animation';
import { OATHS } from '../config/oaths';
import { oathCap, oathReward } from '../logic/oaths';
import type { Goal } from '../logic/goals';
import type { Contract } from '../logic/contracts';
import type { WhatsNew } from '../logic/whatsNew';
import { GLOSSARY } from '../config/glossary';
import { cardInfo, MECHANIC_CARDS, type CardId, type MechanicCard } from '../config/cards';
import { AFFIXES, ELITES, type AffixId } from '../config/elites';
import type { Cue, Layer, Mood, Stinger } from '../logic/runMusic';
import type { TestSetup } from '../systems/testMode';

const overlay = () => document.getElementById('overlay')!;
let stopActions: (() => void) | null = null;

function show(html: string): HTMLElement {
  clearOverlay();
  const el = overlay();
  el.innerHTML = html;
  el.classList.remove('hidden');
  dropStaleTooltip();
  return el;
}

export function clearOverlay(): void {
  stopActions?.();
  stopActions = null;
  latchGamepad();
  overlay().classList.add('hidden');
  overlay().innerHTML = '';
  dropStaleTooltip(); // after the old screen is gone, so its tooltip goes with it
}

/** Screens never read keys: they react to input-layer actions (keyboard, gamepad...). */
function onActions(handler: (a: Action) => void): void {
  stopActions = onAction(handler);
}

function click(el: HTMLElement, selector: string, fn: (target: HTMLElement) => void): void {
  el.querySelectorAll<HTMLElement>(selector).forEach((b) => (b.onclick = () => fn(b)));
}

/** Number keys 1..n pick the n-th [data-pick] card. */
function numberKeys(el: HTMLElement, other?: (a: Action) => void): void {
  onActions((a) => {
    const m = /^pick(\d)$/.exec(a);
    if (m) el.querySelectorAll<HTMLElement>('[data-pick]')[Number(m[1]) - 1]?.click();
    else other?.(a);
  });
}

const fmtStat = (k: StatKey, v: number) => (k === 'atkSpd' ? v.toFixed(2) : String(Math.round(v * 10) / 10));
const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
/**
 * A relic card: the tier it would be at after taking it (1 = new), its text at that tier, synergies with what is held. `more` goes to the end of
 * its tooltip (#98: an offer card shows only its effect and one compact line; the details are on hover or tap).
 */
const relicCard = (id: RelicId, tier: number, held: RelicId[], attrs: string, extra = '', more: string[] = []) => {
  const r = relicDef(id);
  const fam = r.family ? `${FAMILIES[r.family].icon} ${FAMILIES[r.family].name}` : '☠ Cursed'; // v0.7.1 B6: a cursed card is purple and says so
  const upgrade = tier > 1;
  return `<button class="card panel boon relic-card ${relicClass(id)}" style="--fam:${keyColor(id)}" ${attrs} data-tip="${esc([relicTip(id, tier, held), ...more].join('\n'))}"><div class="relic-icon">${r.icon}${tierBadge(tier)}</div><h2>${r.name}</h2><div class="tag"><span class="fam">${fam}</span> · ${upgrade ? `tier ${TIER_NUMERALS[tier - 1]} → ${TIER_NUMERALS[tier]}` : r.cursed ? 'no family' : r.rarity}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''}</div><p>${relicDesc(id, tier)}</p>${extra}</button>`;
};

/** v0.7 A5: a duo as a gold card: it takes the moment's pick. v0.7.5 (#96): it combines its two relics into one; the families keep their counts. */
const duoCard = (id: DuoId, attrs: string, extra = '') => {
  const d = DUOS[id];
  return `<button class="card panel boon evolution duo-card" ${attrs} data-tip="${esc(duoTip(id))}"><div class="relic-icon">${d.icon}</div><h2>${d.name}</h2><div class="tag">Duo · ${d.families.map((f) => `${FAMILIES[f].icon} ${FAMILIES[f].name}`).join(' + ')}</div><p>${d.desc}</p><div class="preview">Combines ${d.from.map((r) => relicDef(r).name).join(' + ')} into one · families keep their counts</div>${extra}</button>`;
};

/**
 * #189: a framed screen in the kit, as Settings and the results (#186): the heading on a ribbon with the round back disc in its corner
 * (`back` is the disc's data attribute; none for a screen whose own button goes on), what you read on parchment that scrolls, and the
 * buttons in a footer that stays in view.
 */
const kitScreen = (cls: string, title: string, o: { sub?: string; body?: string; foot?: string; back?: string }) => `
    <div class="kit-frame kit-screen ${cls}">
      <header class="kit-head">${kit.ribbon(title, { attrs: 'role="heading" aria-level="1"' })}${o.back ? kit.closeButton('back', { attrs: o.back }) : ''}</header>
      ${o.sub ? `<p class="sub">${o.sub}</p>` : ''}
      ${o.body ? kit.parch(o.body, { cls: 'kit-scroll' }) : ''}
      ${o.foot ? `<footer class="row">${o.foot}</footer>` : ''}
    </div>`;
/** #189: a choice screen's heading (level-up, relics, the board, the Merchant...): the ribbon over the cards. */
const choiceHead = (title: string) => `<h1 class="kit-head">${kit.ribbon(title)}</h1>`;

// ---------------------------------------------------------------- title & menus

export interface TitleInfo {
  gold: number;
  runes: number;
  label: string; // "V0.3 · Web"
  mobile: boolean;
  buildDate: string;
  notice: { text: string; button: string; action: () => void } | null; // "new version available"
  daily: { date: string; best: number };
  title: string | null; // v0.4: the equipped title (Chronicle)
  contracts: { text: string; progress: number; target: number; runes: number }[]; // v0.6: this week's
  whatsNew: boolean; // v0.7.1: this build has a What's new screen
}

export function showTitle(info: TitleInfo, on: { start: () => void; daily: () => void; keep: () => void; chronicle: () => void; settings: () => void; whatsNew: () => void }): void {
  // #184: the title screen is the new look's prototype: the UI kit (kit.css, built by kit.ts) and the rig's icon atlas
  const el = show(`
    <div class="title kit-title">
      <div class="kit-purse">${kit.pill('gold', info.gold, { title: 'Gold' })}${info.runes ? kit.pill('runes', info.runes, { title: 'Runes' }) : ''}</div>
      <h1>Last Bastion</h1>
      ${kit.ribbon(`${info.label}${info.mobile ? ' <span class="badge">Mobile</span>' : ''}`)}
      ${info.whatsNew ? kit.button('What’s new', { size: 'small', cls: 'whatsnew-link', attrs: 'data-go="whatsNew"' }) : ''}
      ${info.title ? `<div class="epithet">${esc(info.title)}</div>` : ''}
      <p class="sub">The walls have fallen silent. The courtyard has not.</p>
      ${info.notice ? kit.parch(`<span>${info.notice.text}</span>${kit.button(info.notice.button, { size: 'small', attrs: 'data-notice' })}`, { cls: 'notice' }) : ''}
      ${kit.button('Take up arms', { kind: 'gold', size: 'big', attrs: 'data-go="start"' })}
      <div class="row">
        ${info.daily.date ? kit.button(`Daily Trial${info.daily.best ? ` · best ${info.daily.best}` : ''}`, { kind: 'go', attrs: 'data-go="daily"' }) : ''}
        ${kit.button('The Keep', { icon: 'keep', attrs: 'data-go="keep"' })}
        ${kit.button('Chronicle', { icon: 'crown', attrs: 'data-go="chronicle"' })}
        ${kit.button('Settings', { icon: 'settings', attrs: 'data-go="settings"' })}
      </div>
      ${kit.frame(kit.parch(`<b>This week's contracts</b> <span class="dim">· new ones every Monday · Runes when a run completes one</span>
        ${info.contracts.map((c) => `<div class="contract ${c.progress >= c.target ? 'done' : ''}"><span>${c.progress >= c.target ? '✔ ' : ''}${c.text}</span><span>${c.progress.toLocaleString('en')}/${c.target.toLocaleString('en')} · ${kit.icon('runes')}${c.runes}</span></div>`).join('')}`, { cls: 'contracts' }))}
      <p class="hint">${info.mobile ? 'Left thumb moves · right thumb casts your signature ability (hold and drag to aim) · attacks are automatic' : 'WASD / arrows or gamepad to move · attacks are automatic · Space or right mouse for your signature ability · Esc / P to pause · M to mute'}</p>
      <p class="hint build">build ${info.buildDate}</p>
    </div>`);
  click(el, '[data-go]', (b) => on[b.dataset.go as keyof typeof on]());
  click(el, '[data-notice]', () => info.notice?.action());
  onActions((a) => a === 'confirm' && on.start());
}

export interface SettingsInfo {
  quality: QualitySetting;
  textSize: TextSize;
  effective: string;
  muted: boolean;
  music: MusicLevel;
  effects: MusicLevel; // v0.7.1
  runMusic: boolean; // v0.7.1
  manualAim: boolean; // v0.7.5 (#81)
  version: string; // v0.7.1: tap it five times for test mode
  dev: boolean; // v0.7.1: test mode is open
  perf: boolean;
  desktop: { version: string; status: string; prerelease: boolean } | null;
}

export function showSettings(info: SettingsInfo, on: { quality: (q: QualitySetting) => void; mute: () => void; music: (level: MusicLevel) => void; effects: (level: MusicLevel) => void; runMusic: () => void; aim: (manual: boolean) => void; textSize: (size: TextSize) => void; dev: () => void; testMode: () => void; perf: () => void; saveData: () => void; checkUpdates: () => void; prerelease: (v: boolean) => void; back: () => void }): void {
  // #186: Settings in the kit: a framed screen, choices as a row of small wood buttons (the one picked sits pressed), on/off as
  // switches, the two volumes as sliders over MUSIC_LEVELS, and the back disc in the corner
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const choice = (attr: string, list: readonly string[], on: string) =>
    `<div class="kit-choice">${list.map((v) => kit.button(cap(v), { size: 'small', cls: v === on ? 'on pressed' : '', attrs: `data-${attr}="${v}" aria-pressed="${v === on}"` })).join('')}</div>`;
  const onOff = (name: string, on: boolean) => kit.toggle(on ? 'On' : 'Off', name, on);
  const level = (name: string, v: MusicLevel) => kit.slider(`<em data-level>${cap(v)}</em>`, name, MUSIC_LEVELS.indexOf(v), 0, MUSIC_LEVELS.length - 1);
  const setting = (title: string, text: string, control: string) => `<div class="setting"><div><b>${title}</b><span>${text}</span></div>${control}</div>`;
  const open = (act: string, label = 'Open') => kit.button(label, { size: 'small', attrs: `data-act="${act}"` });
  const el = show(`
    <div class="kit-frame kit-screen settings">
      <header class="kit-head">${kit.ribbon(`${kit.icon('settings')} Settings`, { attrs: 'role="heading" aria-level="1"' })}${kit.closeButton('back', { attrs: 'data-act="back"' })}</header>
      ${kit.parch(`
      ${setting('Graphics quality', `Low cuts particles, screen shake and shadows. Auto measures the first waves and drops to low if needed. Now: ${info.effective}.`, choice('quality', ['auto', 'low', 'high'], info.quality))}
      ${setting('Text size', 'The HUD and every screen. A small screen keeps what still fits.', choice('text-size', Object.keys(TEXT_SIZES), info.textSize))}
      ${setting(`${kit.icon('sound')} Sound`, 'Synthesised effects and music (M).', onOff('mute', !info.muted))}
      ${setting(`${kit.icon('music')} Music`, `Composed live. In a run it plays quieter, under the effects.${info.muted ? ' Silent while Sound is off.' : ''}`, level('music', info.music))}
      ${setting('Music during runs', 'A quiet theme for every arena that builds a little in a fight.', onOff('runMusic', info.runMusic))}
      ${setting('Effects', 'How loud the sound effects are.', level('effects', info.effects))}
      ${setting('Aim', 'Auto: basic attacks pick their own target. Manual: they go where the mouse or right stick points. Touch always aims itself.', choice('aim', ['auto', 'manual'], info.manualAim ? 'manual' : 'auto'))}
      ${setting('Performance overlay', 'Frame, update and render times, entity counts, draw calls (F3 in a run).', onOff('perf', info.perf))}
      ${info.desktop ? `
      ${setting('Updates', `Version ${info.desktop.version}. <span data-update-status>${esc(info.desktop.status)}</span>`, open('check', 'Check for updates'))}
      ${setting('Beta versions', 'Also install pre-releases.', onOff('pre', info.desktop.prerelease))}` : ''}
      ${setting('Save data', 'Export, import or reset your progress.', open('save'))}
      ${info.dev ? setting('Test mode', 'Start a run anywhere and hear every arena’s music. Test runs pay nothing and leave no trace.', open('test')) : ''}
      <p class="hint" data-version>Version ${info.version}</p>`, { cls: 'kit-scroll' })}
    </div>`);
  let taps = 0;
  click(el, '[data-version]', () => ++taps === 5 && !info.dev && on.dev());
  click(el, '[data-quality]', (b) => on.quality(b.dataset.quality as QualitySetting));
  click(el, '[data-text-size]', (b) => on.textSize(b.dataset.textSize as TextSize));
  click(el, '[data-aim]', (b) => on.aim(b.dataset.aim === 'manual'));
  const switches: Record<string, () => void> = { mute: on.mute, runMusic: on.runMusic, perf: on.perf, pre: () => on.prerelease(!info.desktop?.prerelease) };
  for (const input of el.querySelectorAll<HTMLInputElement>('[data-set]')) {
    const name = input.dataset.set!;
    if (input.type === 'checkbox') input.onchange = () => switches[name]();
    else {
      const pick = () => MUSIC_LEVELS[Number(input.value)];
      input.oninput = () => (input.closest('label')!.querySelector('[data-level]')!.textContent = cap(pick())); // the level's name follows the knob
      input.onchange = () => (name === 'music' ? on.music : on.effects)(pick());
    }
  }
  click(el, '[data-act]', (b) => {
    const act = b.dataset.act;
    if (act === 'test') on.testMode();
    else if (act === 'check') on.checkUpdates();
    else if (act === 'save') on.saveData();
    else on.back();
  });
  onActions((a) => (a === 'cancel' || a === 'pause') && on.back());
}

/** #146: the champion picked on the class select; kept while its options re-render the screen. Starts as the last one played. */
let selectedClass: ClassId | undefined;
/** #182: the seed typed on the class select, kept while its options re-render the screen; Back or Start clears it. */
let seedText = '';

/** #156: the rigged champions' portrait scale on the class cards: the Paladin's figure (120 px at scale 6) shows at 84 px. */
const PORTRAIT_K = 0.7;

export function showClassSelect(save: Save, on: { pick: (id: ClassId, seed: string) => void; back: () => void; settings: (arena: ArenaId, tier: number) => void; curse: (id: CurseId) => void; trait: (id: TraitId) => void; palette: (id: ClassId, n: number) => void; treasure: (id: ClassId) => void; oath: (level: number) => void }): void {
  const locked = lockedArenas(save);
  // v0.6 Oath ladder: open once any class has won; each class swears at most one above the highest it has kept
  const oathMax = Math.max(...CLASS_ORDER.map((id) => oathCap(save.wins[id], save.oaths[id])));
  const oathOf = (id: ClassId) => Math.min(save.settings.oath, oathCap(save.wins[id], save.oaths[id]));
  const sworn = save.settings.oath > 0 && oathMax > 0;
  selectedClass ??= save.runs.at(-1)?.classId ?? CLASS_ORDER[0];
  const roster = CLASS_ORDER.map((id) => CLASSES[id]);
  const paletteOf = (c: ClassDef) => {
    const palettes = [...new Set([...masteryBonus(save.classes[c.id].xp).palettes, ...save.palettes])].sort(); // mastery's own plus the account-wide ones from deeds
    const chosen = save.settings.palettes[c.id] ?? 0;
    return { palettes, chosen, n: palettes.includes(chosen) ? chosen : 0 };
  };
  // #65: the roster: a small tile per champion, in a strip that scrolls sideways, so more champions fit without a taller screen
  const tile = (c: ClassDef) => {
    const { palettes, chosen, n } = paletteOf(c);
    const swatches = palettes.length ? `<div class="swatches">${[0, ...palettes].map((p) => `<span class="swatch ${chosen === p ? 'on' : ''}" data-palette="${c.id}:${p}" data-tip="${['As drawn', 'Ashen colours', 'Gilded colours', 'Midnight colours'][p]}"><i style="filter:${SPRITE_PALETTES[p] || 'none'}"></i></span>`).join('')}</div>` : '';
    return `
    <button class="card champ ${selectedClass === c.id ? 'on' : ''}" data-class="${c.id}">
      <div class="portrait" data-sprite="${c.sprite}" data-palette-n="${n}"></div>${swatches}
      <b class="champ-name">${c.name}</b>
      <span class="champ-rec">${save.wins[c.id] ? `${kit.icon('crown')}${save.wins[c.id]} · ` : ''}Mastery ${masteryRank(save.classes[c.id].xp)}</span>
    </button>`;
  };
  // #65: the chosen champion in full, on a pedestal: stat bars against the roster's best, the facts the bars leave out, both abilities,
  // families, treasure, Oath and record. One per champion, the others hidden, so picking one needs no re-render (#146)
  const hero = (c: ClassDef) => {
    const rec = save.classes[c.id];
    const rank = masteryRank(rec.xp);
    const next = MASTERY[rank];
    // v0.5: the sacred treasure, once earned: on (taken into the run) or off
    const t = TREASURES[c.id];
    const tr = save.treasures[c.id];
    const treasure = tr.tier ? `<span class="chip treasure-chip ${tr.equipped ? 'on' : ''}" data-treasure="${c.id}" data-tip="${esc(`${tr.equipped ? 'Equipped' : 'Left in the Keep'} — tap to switch.\n${treasureDesc(c.id, tr.tier)}`)}">${t.icon} ${t.name} ${TIER_NUMERALS[tr.tier]}</span>` : '';
    return `
    <div class="hero" data-hero="${c.id}"${selectedClass === c.id ? '' : ' hidden'}>
      <div class="pedestal"><div class="hero-figure" data-figure="${c.id}"></div>${kit.ribbon(c.name)}<i class="role">${c.role}</i></div>
      <div class="hero-stats">
        ${STAT_KEYS.map((k) => `<div class="stat-bar"><span>${statLabel(k, c)}</span><i><b style="width:${Math.round(statShare(roster, k, c.base[k]) * 100)}%"></b></i><em>${fmtStat(k, c.base[k])}</em></div>`).join('')}
        <div class="facts">${classFacts(c).map((f) => `<span><small>${f.label}</small> ${f.value}</span>`).join('')}</div>
      </div>
      <div class="hero-text">
        <div class="ability"><b>${c.ability.name}</b><p>${c.ability.desc}</p></div>
        <div class="ability"><b>${c.secondary.name}</b><p>${c.secondary.desc}</p></div>
        <div class="fam-line" data-tip="${esc(`Can max these relic families: ${preferredFamilies(c.id).map((f) => FAMILIES[f].name).join(', ')}. Every family is open to every class; these reach their 6-set with straight pieces.`)}">Families:${preferredFamilies(c.id).map((f) => `<span class="fam-chip" style="--fam:${FAMILIES[f].color}">${FAMILIES[f].icon} ${FAMILIES[f].name}</span>`).join('')}</div>
        ${treasure}
        ${save.wins[c.id] ? `<div class="oath-line">⚜ ${save.oaths[c.id] ? `Oath ${save.oaths[c.id]} kept` : 'No Oath kept yet'}${sworn ? ` · this run: <b>${oathOf(c.id) ? `Oath ${oathOf(c.id)}` : 'custom'}</b>` : ''}</div>` : ''}
        <div class="best">${save.wins[c.id] ? `👑 ${save.wins[c.id]} win${save.wins[c.id] > 1 ? 's' : ''} · ` : ''}${rec.bestWave ? `Best: wave ${rec.bestWave}` : 'Not yet attempted'} · Mastery ${rank}/${MASTERY.length}${next ? ` <span class="dim">(${Math.round(rec.xp)}/${next.xp})</span>` : ''}</div>
      </div>
    </div>`;
  };
  // #65: the run's options as small kit buttons; the picked one has the brass ring, a locked one its lock
  const opt = (label: string, attrs: string, o: { on?: boolean; locked?: boolean; disabled?: boolean; cls?: string } = {}) =>
    kit.button(label, { size: 'small', cls: `opt${o.on ? ' on' : ''}${o.cls ? ` ${o.cls}` : ''}`, attrs, icon: o.locked ? 'lock' : undefined, disabled: o.locked || o.disabled });
  const arenaBtn = (id: ArenaId) => {
    const a = ARENAS[id];
    const gate = locked.includes(id) ? gateOf({ arena: id }) : undefined;
    return opt(a.name, `data-arena="${id}" data-tip="${esc(gate ? `Locked — ${gate.desc}` : `${a.desc} ${a.feature} Boss relics: ${familyList(ARENA_FAMILIES[id])}.`)}"`, { on: save.settings.arena === id, locked: !!gate });
  };
  const tierBtn = (i: number) => {
    const t = TIERS[i];
    const lockedTier = i > save.tierUnlocked;
    const tip = lockedTier ? `Locked — ${nextTierRequirement(i, save) || `unlock ${TIERS[i - 1].name} first`}` : `Enemy HP ×${t.enemyHp}, damage ×${t.enemyDmg}, elites ×${t.eliteMult} · gold ×${t.gold}, class XP ×${t.classXp} · ${i ? `new foes: ${WAVES.tierRoster[i].map((id) => ENEMIES[id].name).join(', ')}` : 'the basic foes'}`;
    return opt(t.name, `data-tier="${i}" data-tip="${esc(tip)}"`, { on: save.settings.tier === i, locked: lockedTier });
  };
  const lockedC = lockedCurses(save);
  const curseBtn = (id: CurseId) => {
    const c = CURSES[id];
    const gate = lockedC.includes(id) ? gateOf({ curse: id }) : undefined;
    const tip = gate ? `Locked — ${gate.desc}` : `${c.desc} +${Math.round(c.bonus * 100)}% gold and class XP.`;
    return opt(c.name, `data-curse="${id}" data-tip="${esc(sworn ? 'An Oath brings its own curses. Free curses are for custom runs.' : tip)}"`, { on: save.settings.curses.includes(id) && !sworn, locked: !!gate, disabled: sworn, cls: 'curse' });
  };
  const traitBtn = (id: TraitId) => {
    const t = TRAITS[id];
    const need = t.unlock.achievement ? ACHIEVEMENTS.find((a) => a.id === t.unlock.achievement) : undefined;
    const lockedT = need !== undefined && !save.achievements.includes(need.id);
    const tip = lockedT ? `Locked — ${need!.name}: ${need!.desc}` : t.desc;
    return opt(lockedT ? t.name : `${t.icon} ${t.name}`, `data-trait="${id}" data-tip="${esc(tip)}"`, { on: save.settings.trait === id || (id !== 'none' && save.settings.trait2 === id), locked: lockedT, cls: 'trait' });
  };
  // #65: the champion select in the kit: the roster strip and the chosen champion on the left, the run's options on the right, one gold Start
  const el = show(`
    <div class="select kit-select">
      <div class="kit-select-top">${kit.closeButton('back', { attrs: 'data-back' })}${kit.ribbon('Choose your champion')}</div>
      <div class="kit-purse">${kit.pill('gold', save.gold, { title: 'Gold' })}${save.runes ? kit.pill('runes', save.runes, { title: 'Runes' }) : ''}</div>
      <div class="kit-select-main">
        <div class="kit-select-champ">
          ${kit.frame(`<div class="roster">${roster.map(tile).join('')}</div>`, { cls: 'roster-frame' })}
          ${kit.frame(kit.parch(roster.map(hero).join('')), { cls: 'hero-frame' })}
        </div>
        ${kit.frame(`
          <div class="pick"><span class="label">Arena</span><div>${ARENA_IDS.map(arenaBtn).join('')}</div></div>
          <div class="pick"><span class="label">Difficulty</span><div>${TIERS.map((_, i) => tierBtn(i)).join('')}</div></div>
          <div class="pick curses"><span class="label">Curses <span class="mult" data-tip="Every curse adds to the gold and class XP this run earns.">gold &amp; XP ×${curseMultiplier(save.settings.curses).toFixed(2)}</span></span><div>${CURSE_IDS.map(curseBtn).join('')}</div></div>
          <div class="pick traits"><span class="label">Trait</span><div>${TRAIT_IDS.map(traitBtn).join('')}</div></div>
          ${oathMax ? `<div class="pick oath"><span class="label">Oath</span><div>
            ${opt('−', `data-oath="${save.settings.oath - 1}"`, { disabled: save.settings.oath <= 0 })}
            <b data-tip="${esc(save.settings.oath ? OATHS.slice(0, save.settings.oath).map((o, i) => `${i + 1}. ${o.name}: ${o.desc}`).join('\n') : 'A custom run: choose your own curses.')}">${save.settings.oath ? `Oath ${save.settings.oath}: ${OATHS[save.settings.oath - 1].name}` : 'No Oath (custom run)'}</b>
            ${opt('+', `data-oath="${save.settings.oath + 1}"`, { disabled: save.settings.oath >= oathMax })}</div>
            <span class="hint">${save.settings.oath ? `${OATHS[save.settings.oath - 1].desc} Every Oath below it holds too. A class that has not kept Oath ${save.settings.oath - 1} swears its highest.` : 'Win with a class to swear its first Oath. Every level adds one hardship; keeping one pays.'}</span></div>` : ''}
          <div class="pick seed"><span class="label">Seed</span><input id="seed" maxlength="24" placeholder="random" value="${esc(seedText)}" autocomplete="off" spellcheck="false" data-tip="Type a seed from a results screen to replay that run." /></div>`, { cls: 'run-frame' })}
        ${kit.button(`Start as ${CLASSES[selectedClass].name}`, { kind: 'gold', size: 'big', attrs: 'data-start' })}
      </div>
    </div>`);
  el.querySelectorAll<HTMLElement>('[data-sprite]').forEach((slot) => {
    const id = slot.dataset.sprite as ClassDef['sprite'];
    const spr = portraitSprite(id, 6, Number(slot.dataset.paletteN ?? 0));
    // #138: a finer-grid canvas is larger than it shows; #155: a rigged figure (taller) shows the Paladin at his old 84 px, to fit the card;
    // #156: every champion at the Paladin's scale, so a helm's horns or a halo don't shrink the one who wears them
    spr.img.style.setProperty('--sprite-h', `${SHEETS[id] ? Math.round(spr.h * PORTRAIT_K) : spr.h}px`);
    slot.appendChild(spr.img);
    // #65: the same figure, larger, on the chosen champion's pedestal (a copy: the cached canvas can sit in one place only)
    const big = document.createElement('canvas');
    big.width = spr.img.width;
    big.height = spr.img.height;
    big.getContext('2d')!.drawImage(spr.img, 0, 0);
    big.style.setProperty('--sprite-h', `${SHEETS[id] ? spr.h : Math.round(spr.h / PORTRAIT_K)}px`);
    el.querySelector(`[data-figure="${slot.closest<HTMLElement>('[data-class]')!.dataset.class}"]`)?.appendChild(big);
  });
  el.querySelectorAll<HTMLElement>('[data-palette]').forEach((sw) => (sw.onclick = (e) => {
    e.stopPropagation(); // the card underneath would take the click
    const [cls, n] = sw.dataset.palette!.split(':');
    on.palette(cls as ClassId, Number(n));
  }));
  click(el, '[data-treasure]', (chip) => on.treasure(chip.dataset.treasure as ClassId));
  const seedIn = el.querySelector<HTMLInputElement>('#seed')!;
  seedIn.oninput = () => (seedText = seedIn.value);
  const start = () => {
    seedText = '';
    on.pick(selectedClass!, seedIn.value);
  };
  // #146: a card selects its champion (no re-render, so the keyboard focus stays on it); a second click on it, or Start, begins the run
  click(el, '[data-class]', (b) => {
    if (b.dataset.class === selectedClass) return start();
    selectedClass = b.dataset.class as ClassId;
    el.querySelectorAll('[data-class]').forEach((c) => c.classList.toggle('on', c === b));
    el.querySelectorAll<HTMLElement>('[data-hero]').forEach((h) => (h.hidden = h.dataset.hero !== selectedClass)); // #65: its details
    el.querySelector('[data-start]')!.textContent = `Start as ${CLASSES[selectedClass].name}`;
  });
  click(el, '[data-start]', start);
  // Enter or the pad's confirm starts the run, unless a focused button takes the key itself
  onActions((a) => a === 'confirm' && !(document.activeElement instanceof HTMLButtonElement) && start());
  click(el, '[data-curse]', (b) => on.curse(b.dataset.curse as CurseId));
  click(el, '[data-trait]', (b) => on.trait(b.dataset.trait as TraitId));
  click(el, '[data-oath]', (b) => on.oath(Number(b.dataset.oath)));
  click(el, '[data-arena]', (b) => on.settings(b.dataset.arena as ArenaId, save.settings.tier));
  click(el, '[data-tier]', (b) => on.settings(save.settings.arena, Number(b.dataset.tier)));
  click(el, '[data-back]', () => {
    seedText = '';
    on.back();
  });
}

/** #67: the building whose panel is open, so it stays open while ranks are bought (the Keep redraws after each). */
let keepOpen: BuildingId | null = null;

/** The Keep (#67): a castle courtyard whose six buildings grow with their levels and ranks; tap one for its panel. */
export function showKeep(save: Save, on: { buy: (id: MetaId) => void; raise: (id: BuildingId) => void; mastery: (id: ClassId) => void; compendium: () => void; chronicle: () => void; treasures: () => void; history: () => void; glossary: () => void; back: () => void }): void {
  const row = (id: MetaId) => {
    const m = META[id];
    const rank = save.meta[id] ?? 0;
    const cap = rankCap(id, save.buildings);
    const cost = metaCost(id, rank, save.buildings);
    const pips = Array.from({ length: m.max }, (_, i) => `<i class="${i < rank ? 'on' : i < cap ? '' : 'capped'}"></i>`).join('');
    const btn = rank >= m.max ? '<span class="maxed">Maxed</span>' : cost === null ? `<span class="maxed" data-tip="Raise the ${BUILDINGS[buildingOf(id)].name} to buy further ranks">Level cap</span>`
      : kit.button(`${kit.icon('gold')}${cost.gold}${cost.runes ? ` · ${kit.icon('runes')}${cost.runes}` : ''}`, { kind: 'go', size: 'small', attrs: `data-buy="${id}"`, disabled: save.gold < cost.gold || save.runes < cost.runes });
    return kit.row(`<b>${m.name}</b><span>${m.desc}</span>`, { cls: 'meta-row', end: `<div class="pips">${pips}</div>${btn}` });
  };
  const panel = (id: BuildingId) => {
    const b = BUILDINGS[id];
    const level = buildingLevel(save.buildings, id);
    const next = b.levels[level];
    const gate = next?.achievement ? tierOf(next.achievement) : undefined; // a deed may name a tier ("wave20:2")
    const deed = gate && { name: gate.tier > 1 ? `${gate.def.name} ${TIER_NUMERALS[gate.tier]}` : gate.def.name, desc: gate.def.desc };
    const deedDone = !next?.achievement || save.achievements.includes(next.achievement);
    const can = next && deedDone && save.gold >= next.gold && save.runes >= next.runes;
    const raise = !next ? '<span class="maxed">Fully raised</span>'
      : kit.button(`Raise · ${kit.icon('gold')}${next.gold} · ${kit.icon('runes')}${next.runes}${deed && !deedDone ? ` ${kit.icon('lock')}` : ''}`, { kind: 'gold', size: 'small', disabled: !can, attrs: `data-raise="${id}" data-tip="${esc(`Level ${level + 1}: 🪙 ${next.gold} · ◆ ${next.runes}${deed ? `\nDeed: ${deed.name} — ${deed.desc}${deedDone ? ' ✔' : ''}` : ''}`)}"` });
    const pips = b.levels.map((_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
    return kit.frame(`${kit.closeButton('close', { cls: 'keep-close', attrs: 'data-close-building' })}
      ${kit.ribbon(`${b.name} <span class="pips">${pips}</span>`)}
      ${kit.parch(`<div class="bhead"><p>${b.desc}${deed && !deedDone ? ` · next deed: <em>${deed.name}</em> — ${deed.desc}` : ''}</p>${raise}</div>
        <div class="meta">${b.upgrades.map(row).join('')}</div>`)}`, { cls: `keep-panel${keepOpen === id ? '' : ' hidden'}`, attrs: `data-panel="${id}"` });
  };
  const plot = (id: BuildingId) => {
    const st = keepStage(save.buildings, save.meta, id);
    const pips = BUILDINGS[id].levels.map((_, i) => `<i class="${i < st.level ? 'on' : ''}"></i>`).join('');
    return `<button class="keep-bld b-${id} s-${st.frame}" data-building="${id}" aria-label="${BUILDINGS[id].name}, level ${st.level}"><span class="keep-plate">${BUILDINGS[id].name}<span class="pips">${pips}</span></span></button>`;
  };
  const level = accountLevel(CLASS_ORDER.map((id) => save.classes[id].xp));
  const nextMilestone = ACCOUNT_MILESTONES.find((m) => m.level > level);
  const mastery = CLASS_ORDER.map((id) => {
    const xp = save.classes[id].xp;
    const rank = masteryRank(xp);
    const next = MASTERY[rank];
    const prev = rank > 0 ? MASTERY[rank - 1].xp : 0;
    const frac = next ? (xp - prev) / (next.xp - prev) : 1;
    return `<button class="mastery" data-mastery="${id}"><b>${CLASSES[id].name}</b><span>Rank ${rank}/${MASTERY.length}</span><div class="bar xp"><div style="width:${frac * 100}%"></div></div><span class="dim">${next ? `Next: ${next.name}` : 'Grandmaster'}</span></button>`;
  }).join('');
  const el = show(`
    <div class="kit-frame keep keep-castle">
      ${kit.closeButton('back', { cls: 'keep-back', attrs: 'data-back' })}
      <div class="keep-head">${kit.ribbon('<h1>The Keep</h1>')}
        <div class="keep-purse">${kit.pill('gold', save.gold, { title: 'Gold: buys ranks' })}${kit.pill('runes', save.runes, { title: `Runes: raise buildings and the top ranks${save.runeShards ? ` (${save.runeShards}/${RUNES.shardsPerRune} shards)` : ''}` })}</div></div>
      ${save.refund ? kit.parch(`${(save.refund.version ?? 'v0.6').split(',').map((v) => REFUND_NOTES[v] ?? '').join(' ')} What those ranks cost came back: <b>🪙 ${save.refund.gold}${save.refund.runes ? ` and ◆ ${save.refund.runes}` : ''}</b>.`, { cls: 'hint' }) : ''}
      <div class="keep-yard">${BUILDING_IDS.map(plot).join('')}</div>
      <p class="keep-tip">Tap a building to raise it and buy its ranks. Gold buys ranks; Runes (from Act bosses, quests and deeds) raise buildings and the top ranks.</p>
      ${kit.parch(`<h2>Class mastery · account level ${level}</h2>
      <p class="hint">Earned by playing a class: waves cleared, bosses slain, levels gained, times the difficulty tier. Every rank unlocks something; tap a class for its track.
        ${nextMilestone ? `Account level ${nextMilestone.level}: <em>${nextMilestone.name}</em> — ${nextMilestone.desc}.` : 'Every account milestone reached.'}</p>
      <div class="masteries">${mastery}</div>
      <div class="milestones">${ACCOUNT_MILESTONES.map((m) => `<span class="${level >= m.level ? 'on' : ''}" data-tip="${esc(m.desc)}">${level >= m.level ? '✔ ' : ''}${m.level} ${m.name}</span>`).join('')}</div>`, { cls: 'keep-mastery' })}
      <div class="row">${kit.button('Relic compendium', { icon: 'relics', attrs: 'data-compendium' })}${kit.button('Sacred treasures', { icon: 'crown', attrs: 'data-treasures' })}${kit.button('Chronicle', { icon: 'deeds', attrs: 'data-chronicle' })}${kit.button('Run history', { attrs: 'data-history' })}${kit.button('Glossary', { attrs: 'data-glossary' })}</div>
      ${BUILDING_IDS.map(panel).join('')}
    </div>`);
  const openPanel = (id: BuildingId | null) => {
    keepOpen = id;
    el.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== id));
    if (id) el.querySelector<HTMLElement>(`[data-panel="${id}"] [data-close-building]`)?.focus();
  };
  const back = () => {
    keepOpen = null;
    on.back();
  };
  click(el, '[data-building]', (b) => openPanel(b.dataset.building as BuildingId));
  click(el, '[data-close-building]', () => openPanel(null));
  click(el, '[data-chronicle]', on.chronicle);
  click(el, '[data-history]', on.history);
  click(el, '[data-glossary]', on.glossary);
  click(el, '[data-buy]', (b) => on.buy(b.dataset.buy as MetaId));
  click(el, '[data-raise]', (b) => on.raise(b.dataset.raise as BuildingId));
  click(el, '[data-mastery]', (b) => on.mastery(b.dataset.mastery as ClassId));
  click(el, '[data-compendium]', on.compendium);
  click(el, '[data-treasures]', on.treasures);
  click(el, '[data-back]', back);
  onActions((a) => (a === 'cancel' || a === 'pause') && (keepOpen ? openPanel(null) : back())); // Esc closes the open building first
}

const MARK_ICONS: Record<MarkKind, string> = { level: '', relic: '💠', talent: '🌿', upgrade: '⬆️', board: '📜', quest: '✔️', event: '❗', shrine: '⛩️', boss: '💀', phase: '⚜️', evolution: '🌟', merchant: '🪙', route: '🧭', act: '🚩', stand: '❤️‍🔥', bored: '😴', attune: '✴️' };
const MARK_NAMES: Record<MarkKind, string> = { level: 'Level', relic: 'Relic', talent: 'Talent', upgrade: 'Upgrade', board: 'Quest board', quest: 'Quest done', event: 'Event', shrine: 'Shrine', boss: 'Boss slain', phase: 'Boss', evolution: 'Evolution', merchant: 'Merchant', route: 'Route', stand: 'Last Stand', act: 'New Act', bored: 'Bored here', attune: 'Relic attuned' };

/** v0.6: one run's timeline: a band per wave (width = how long it took), level-ups as ticks, everything else as icons above it. */
function timeline(r: RunLog): string {
  const at = (t: number) => `${((t / Math.max(1, r.time)) * 100).toFixed(2)}%`;
  const waves = r.waves.map(([start, end, dmg, quiet], i) => {
    const w = i + 1;
    const took = (end || r.time) - start;
    return `<i class="tw act${Math.floor(i / ACTS.length) % 2} ${w % WAVES.bossEvery === 0 ? 'boss' : ''}" style="left:${at(start)};width:${at(took)}" data-tip="${esc(`Wave ${w} · ${fmtTime(took)}${end ? '' : ' (not cleared)'} · ${dmg} damage taken · ${Math.round(quiet)} s with under 5 enemies`)}"></i>`;
  }).join('');
  const ticks = r.marks.filter((m) => m[1] === 'level').map(([t]) => `<i class="tl" style="left:${at(t)}"></i>`).join('');
  const marks = r.marks.filter((m) => m[1] !== 'level').map(([t, kind, detail]) => `<i class="tm m-${kind}" style="left:${at(t)}" data-tip="${esc(`${fmtTime(t)} · ${MARK_NAMES[kind]}${detail ? `: ${detail}` : ''}`)}">${MARK_ICONS[kind]}</i>`).join('');
  const end = r.end === 'slain' ? `<i class="tm m-death" style="left:100%" data-tip="${esc(`${fmtTime(r.time)} · slain by ${r.cause || 'something unseen'}`)}">✖</i>` : '';
  return `<div class="timeline"><div class="tmarks">${marks}${end}</div><div class="tbar">${waves}${ticks}</div></div>`;
}

/** v0.6: the Keep's Run History: the last runs, newest first, each with its timeline and build; the logs export as JSON. */
export function showRunHistory(runs: RunLog[], onBack: () => void): void {
  const avg = (f: (r: RunLog) => number) => runs.reduce((s, r) => s + f(r), 0) / Math.max(1, runs.length);
  const bored = runs.reduce((n, r) => n + r.marks.filter((m) => m[1] === 'bored').length, 0);
  const row = (r: RunLog) => {
    const relics = Object.entries(r.relics).filter(([id]) => RELIC_IDS.includes(id as RelicId)).map(([id, tier]) => `<span data-tip="${esc(`${relicDef(id as RelicId).name} ${TIER_NUMERALS[tier] ?? ''}`)}">${relicDef(id as RelicId).icon}${tierBadge(tier)}</span>`).join('');
    const talents = r.talents.map((id) => TALENT_BY_ID[id]?.name).filter(Boolean).join(' · ');
    const ups = r.upgrades.map((id) => ABILITY_UPGRADES[id as AbilityUpgradeId]?.name ?? UTILITY_UPGRADES[id as UtilityUpgradeId]?.name).filter(Boolean).join(' · ');
    const trait = r.trait !== 'none' && TRAIT_IDS.includes(r.trait as TraitId) ? `${TRAITS[r.trait as TraitId].icon} ${TRAITS[r.trait as TraitId].name}` : '';
    const when = r.at ? new Date(r.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
    return `<div class="run">
      <div class="rhead"><b>${CLASSES[r.classId].name}</b><span>${TIERS[r.tier]?.name ?? ''} · ${ARENAS[r.arena].name}${r.daily ? ` · Daily Trial ${esc(r.daily)}` : ''}</span><span class="dim">${when}</span></div>
      <div class="rstats">${actName(Math.max(1, Math.ceil(r.wave / ACTS.length)))} · wave ${r.wave} · ${fmtTime(r.time)} · level ${r.level} · ${r.kills} kills · ${r.end === 'slain' ? `slain by ${esc(r.cause || 'something unseen')}` : 'ended from the pause menu'}</div>
      ${timeline(r)}
      <div class="rbuild">${trait ? `<span>${trait}</span>` : ''}<span class="rrelics">${relics || '<em class="dim">no relics</em>'}</span></div>
      ${talents || ups ? `<p class="hint">${[talents && `🌿 ${talents}`, ups && `⬆️ ${ups}`].filter(Boolean).join('<br>')}</p>` : ''}
    </div>`;
  };
  const el = show(kitScreen('history', 'Run history', {
    back: 'data-back',
    sub: runs.length ? `The last ${runs.length} run${runs.length > 1 ? 's' : ''} · on average ${fmtTime(avg((r) => r.time))} and wave ${avg((r) => r.wave).toFixed(1)}${bored ? ` · ${bored} bored mark${bored > 1 ? 's' : ''}` : ''}` : 'No runs logged yet. Every run from v0.6 on is kept here (the last 50).',
    body: `<p class="hint">Each band is a wave, as wide as it lasted (darker: a boss wave); the small ticks are level-ups. Hover or tap anything for details. F8 in a run (or the pause menu) marks a moment you were bored.</p>
      ${[...runs].reverse().map(row).join('')}`,
    foot: runs.length ? kit.button('Export as JSON', { attrs: 'data-export' }) : '',
  }));
  click(el, '[data-export]', () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([exportRunLogs(runs)], { type: 'application/json' })), download: `last-bastion-runs-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack());
}

/** v0.5: the sacred treasures' quest log, from the Keep and the pause menu (the current class first): every class's chain, step by step. */
export function showTreasures(save: Save, first: ClassId | null, onBack: () => void): void {
  const order = first ? [first, ...CLASS_ORDER.filter((id) => id !== first)] : CLASS_ORDER;
  const step = (done: boolean, now: boolean, title: string, text: string) => `<div class="tstep ${done ? 'done' : now ? 'now' : ''}"><b>${done ? '✔' : now ? '➤' : '·'} ${title}</b><span>${text}</span></div>`;
  const block = (id: ClassId) => {
    const t = TREASURES[id];
    const rec = save.treasures[id];
    const unlocked = masteryBonus(save.classes[id].xp).treasureStep;
    const at = chainStep(rec, unlocked);
    const head = `<h2>${t.icon} ${t.name}${rec.tier ? ` ${TIER_NUMERALS[rec.tier]}` : ''} <span class="dim">· ${CLASSES[id].name}</span></h2>`;
    if (at === 'locked') return `<div class="treasure locked">${head}<p class="hint">Locked — reach ${CLASSES[id].name} mastery rank ${rankFor(1)} (${MASTERY[rankFor(1) - 1].name}) to hear the first rumours.</p></div>`;
    const next = nextFragmentBoss(id, { ...rec, unlocked });
    const n = TREASURE_RULES.fragments;
    const steps = [
      step(rec.fragments >= n, at === 'fragments', `Fragments ${rec.fragments}/${n}`, next ? `The next falls from ${inText(ENEMIES[next].name)}, an Act boss, in a run of the ${CLASSES[id].name}. A quest may pay one too.` : 'All found.'),
      step(rec.trial, at === 'trial', t.trial.name, `${t.trial.desc} It comes as a free extra card on the quest board.`),
      step(rec.tier >= 1, at === 'guardian', t.guardian.name, 'Sleeps in the hidden vault, which opens after the mid-Act boss. Slay it to claim the treasure.'),
      ...t.followUps.map((f, i) => step(rec.tier >= i + 2, rec.tier === i + 1, `${f.name} · tier ${TIER_NUMERALS[i + 2]}`, followUpText(id, i as 0 | 1))),
    ];
    return `<div class="treasure">${head}<p>${treasureDesc(id, Math.max(1, rec.tier))}</p><div class="tsteps">${steps.join('')}</div>
      <p class="hint">Hidden talent while it is equipped: <b>${t.talent.name}</b> — ${t.talent.desc}</p></div>`;
  };
  const el = show(kitScreen('treasures', 'Sacred treasures', {
    back: 'data-back',
    sub: 'One for every champion, earned over many runs, kept forever. Take it into a run from the champion select screen.',
    body: order.map(block).join(''),
  }));
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack());
}

/** A class's full 25-rank mastery track: every rank's name and unlock, reached or not. */
export function showMastery(save: Save, classId: ClassId, onBack: () => void): void {
  const xp = save.classes[classId].xp;
  const rank = masteryRank(xp);
  const rows = MASTERY.map((r, i) => `<div class="rank ${i < rank ? 'on' : ''}"><b>${i + 1}</b><span>${r.name}</span><em>${rewardText(r.reward)}</em><i>${i < rank ? '✔' : `${r.xp} XP`}</i></div>`).join('');
  const el = show(kitScreen('mastery-track', `${CLASSES[classId].name} mastery`, {
    back: 'data-back',
    sub: `Rank ${rank} / ${MASTERY.length} · ${Math.round(xp)} class XP${rank < MASTERY.length ? ` · next at ${MASTERY[rank].xp}` : ''}`,
    body: `<div class="ranks">${rows}</div>`,
  }));
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack());
}

/** Chronicle filters live here so equipping a title (which re-opens the screen) does not reset them. */
const chronicleView: { cat: AchievementCategory | 'all'; state: 'all' | 'earned' | 'progress' | 'hidden' } = { cat: 'all', state: 'all' };
const TIER_NAMES = ['Bronze', 'Silver', 'Gold'];
const TOTAL_TIERS = ACHIEVEMENTS.reduce((n, a) => n + a.tiers.length, 0);

export function showChronicle(save: Save, onBack: () => void, onEquip?: (title: string | null) => void): void {
  const again = () => showChronicle(save, onBack, onEquip);
  const ach = (a: AchievementDef) => {
    const tier = earnedTier(save, a.id);
    const secret = a.hidden === true && tier === 0;
    const next = a.tiers[tier];
    const last = a.tiers[a.tiers.length - 1].target;
    const cur = Math.min(last, a.progress(save));
    const marks = a.tiers.slice(0, -1).map((t) => `<i style="left:${(t.target / last) * 100}%"></i>`).join('');
    const unlock = a.unlocks?.arena ? `Unlocks arena: ${ARENAS[a.unlocks.arena].name}` : a.unlocks?.relic ? `Unlocks relic: ${relicDef(a.unlocks.relic).name}` : a.unlocks?.curse ? `Unlocks curse: ${CURSES[a.unlocks.curse].name}` : '';
    const pips = a.tiers.map((_, i) => `<i class="${i < tier ? 'on' : ''}" data-tip="${esc(`${TIER_NAMES[i]}: ${a.tiers[i].target} · ${tierRewardText(tierReward(a, i + 1))}`)}">${i < tier ? '✔' : '·'}</i>`).join('');
    return `<div class="ach ${tier > 0 ? 'done' : ''}">
      <div><b>${tier > 0 ? '✔ ' : ''}${secret ? '???' : a.name}${tier > 0 ? ` <em class="badge">${TIER_NAMES[tier - 1]}</em>` : ''}</b>
        <span>${secret ? a.hint ?? 'A secret deed.' : a.desc}${unlock ? ` <em>${unlock}</em>` : ''}</span>
        <span class="dim">${CATEGORIES[a.category]}${a.classId ? ` · ${CLASSES[a.classId].name}` : ''} · ${next ? `next: ${tierRewardText(tierReward(a, tier + 1))}` : 'all tiers earned'}</span></div>
      <div class="bar xp ticks"><div style="width:${(cur / last) * 100}%"></div>${marks}<span>${Math.floor(cur)} / ${next ? next.target : last}</span></div>
      <div class="tierpips">${pips}</div></div>`;
  };
  const shown = ACHIEVEMENTS.filter((a) => {
    const tier = earnedTier(save, a.id);
    if (chronicleView.cat !== 'all' && a.category !== chronicleView.cat) return false;
    if (chronicleView.state === 'earned') return tier > 0;
    if (chronicleView.state === 'progress') return tier < a.tiers.length && !(a.hidden && tier === 0);
    if (chronicleView.state === 'hidden') return a.hidden === true;
    return true;
  });
  // #189: filters and titles are small wood buttons, the one chosen sits pressed (as Settings' choices)
  const chip = (on: boolean, label: string, attrs: string) => kit.button(label, { size: 'small', cls: on ? 'on pressed' : '', attrs: `${attrs} aria-pressed="${on}"` });
  const filter = (key: 'cat' | 'state', value: string, label: string) => chip(chronicleView[key] === value, label, `data-filter="${key}:${value}"`);
  const titles = earnedTitles(save);
  const titleChips = onEquip
    ? `<div class="kit-choice titles">${[chip(save.title === null, 'Bare name', 'data-equip=""'), ...titles.map((t) => chip(save.title === t, esc(t), `data-equip="${esc(t)}"`))].join('')}</div>`
    : '';
  const records = CLASS_ORDER.map((id) => save.classes[id]);
  const favorite = (Object.entries(save.relicPicks) as [RelicId, number][]).sort((a, b) => b[1] - a[1])[0];
  const rows = CLASS_ORDER.map((id) => {
    const c = save.classes[id];
    return `<tr><td>${CLASSES[id].name}</td><td>${c.bestWave}</td><td>${c.kills}</td><td>${c.runs}</td><td>${fmtTime(c.time)}</td><td>${masteryRank(c.xp)}</td></tr>`;
  }).join('');
  const el = show(kitScreen('chronicle', 'Chronicle', {
    back: 'data-back',
    body: `
      <h2>Deeds — ${save.achievements.length} / ${TOTAL_TIERS} tiers</h2>
      <div class="filters">
        <div class="kit-choice">${filter('cat', 'all', 'All')}${(Object.keys(CATEGORIES) as AchievementCategory[]).map((c) => filter('cat', c, CATEGORIES[c])).join('')}</div>
        <div class="kit-choice">${filter('state', 'all', 'Everything')}${filter('state', 'earned', 'Earned')}${filter('state', 'progress', 'In progress')}${filter('state', 'hidden', 'Secrets')}</div>
      </div>
      <div class="achs">${shown.map(ach).join('') || '<p class="hint">Nothing here yet.</p>'}</div>
      <h2>Titles</h2>
      <p class="hint">${titles.length ? 'Earned from deeds and mastery ranks. The one you wear shows on the title screen and after every run.' : 'Deeds and mastery ranks grant titles; none yet.'}</p>
      ${titleChips}
      <h2>Statistics</h2>
      <table class="stats-table"><tr><th>Class</th><th>Best wave</th><th>Kills</th><th>Runs</th><th>Playtime</th><th>Mastery</th></tr>${rows}</table>
      <div class="stats wide">
        <div><span>Total playtime</span><b>${fmtTime(records.reduce((s, c) => s + c.time, 0))}</b></div>
        <div><span>Total kills · bosses · elites</span><b>${save.counters.kills} · ${save.counters.bosses} · ${save.counters.elites}</b></div>
        <div><span>Favorite relic</span><b>${favorite ? `${relicDef(favorite[0]).icon} ${relicDef(favorite[0]).name} (${favorite[1]}×)` : '—'}</b></div>
        <div><span>Gold banked in total</span><b>${save.counters.goldEarned}</b></div>
        <div><span>Highest difficulty</span><b>${TIERS[save.tierUnlocked].name}</b></div>
      </div>`,
  }));
  click(el, '[data-filter]', (b) => {
    const [key, value] = b.dataset.filter!.split(':');
    Object.assign(chronicleView, { [key]: value });
    again();
  });
  click(el, '[data-equip]', (b) => onEquip?.(b.dataset.equip || null));
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack());
}

export function showSaveDialog(save: Save, on: { import: (save: Save) => void; reset: () => void; back: () => void; backups: SaveBackup[]; restore: (b: SaveBackup) => void }): void {
  const el = show(kitScreen('save-data', 'Save data', {
    back: 'data-act="back"',
    body: `
      <p class="hint">Copy this text somewhere safe to back up your progress. To restore, paste a save here and press Import.</p>
      <textarea id="save-text" spellcheck="false"></textarea>
      <div id="save-msg" class="hint">&nbsp;</div>
      ${on.backups.length ? `<h2>Restore previous version</h2>
      <p class="hint">Before a new version or an import replaces your save, the old one is kept here (the last ${on.backups.length === 1 ? 'one' : on.backups.length}). Restoring replaces your current progress; the current save is kept as a backup in turn.</p>
      <div class="kit-choice restore">${on.backups.map((b, i) => kit.button(`${new Date(b.at).toLocaleString()} · ${saveFormatLabel(b.version)}`, { size: 'small', attrs: `data-restore="${i}"` })).join('')}</div>` : ''}`,
    foot: `${kit.button('Copy', { attrs: 'data-act="copy"' })}${kit.button('Import', { attrs: 'data-act="import"' })}${kit.button('Reset all progress', { cls: 'danger', attrs: 'data-act="reset"' })}`,
  }));
  click(el, '[data-restore]', (b) => {
    const backup = on.backups[Number(b.dataset.restore)];
    if (confirm(`Restore the save from ${new Date(backup.at).toLocaleString()} (${saveFormatLabel(backup.version)})? Your current progress is replaced; it is kept as a backup.`)) on.restore(backup);
  });
  const area = el.querySelector<HTMLTextAreaElement>('#save-text')!;
  const msg = el.querySelector<HTMLElement>('#save-msg')!;
  area.value = exportSave(save);
  click(el, '[data-act]', (b) => {
    const act = b.dataset.act;
    if (act === 'back') on.back();
    else if (act === 'copy') {
      area.select();
      void navigator.clipboard?.writeText(area.value);
      msg.textContent = 'Copied to the clipboard.';
    } else if (act === 'import') {
      const imported = importSave(area.value);
      if (!imported) msg.textContent = 'That is not a valid Last Bastion save.';
      // v0.8.3 (#175): ask first; the save it replaces is kept as a backup
      else if (confirm('Import this save? Your current progress is replaced; it is kept as a backup.')) {
        on.import(imported);
        document.getElementById('save-msg')!.textContent = 'Save imported.';
      }
    }
    else if (confirm('Erase ALL progress — gold, upgrades, mastery, achievements and records? This cannot be undone.')) on.reset();
  });
}

// ---------------------------------------------------------------- in-run choices

export function showLevelUp(
  level: number, options: LevelUpOption[], cls: ClassDef, stats: Stats,
  reroll: { free: number; cost: number; gold: number },
  on: { pick: (o: LevelUpOption) => void; reroll: () => void; banish?: (o: LevelUpOption) => void },
  tiers: RelicTiers = {},
): void {
  const canReroll = reroll.free > 0 || reroll.gold >= reroll.cost;
  const el = show(`
    <div class="levelup">
      ${choiceHead(`Level ${level}`)}
      <p class="sub">Choose a boon</p>
      <div class="cards">
        ${options.map((o, i) => {
          const t = optionText(o, cls, o.kind === 'relic' ? (tiers[o.id] ?? 0) : 0);
          const kind = o.kind === 'tradeoff' ? 'tradeoff' : o.kind === 'talent' ? 'talent' : o.kind === 'evolution' ? 'evolution' : o.kind === 'relic' ? `relic-card ${relicDef(o.id).rarity}` : o.rarity;
          const special = (o.kind === 'stat' && o.key === 'secondary') || o.kind === 'talent' || o.kind === 'evolution' ? 'special' : '';
          const now = o.kind === 'stat' ? `<div class="best">now ${fmtStat(o.key, stats[o.key])}</div>` : '';
          const strike = on.banish && o.kind !== 'evolution' ? `<span class="banish" data-banish="${i}" data-tip="Quartermaster's Ledger: strike this card from the run for good (and get a fresh hand)">✕</span>` : '';
          return `<button class="card panel boon ${kind} ${special}" data-pick="${i}">${strike}<div class="num">${i + 1}</div><h2>${t.title}</h2><div class="tag">${t.tag}</div><p>${t.desc}</p>${now}</button>`;
        }).join('')}
      </div>
      ${kit.button(`Reroll (R) — ${reroll.free > 0 ? `${reroll.free} free` : `🪙 ${reroll.cost}`}`, { attrs: 'data-reroll', disabled: !canReroll })}
    </div>`);
  click(el, '[data-pick]', (b) => on.pick(options[Number(b.dataset.pick)]));
  el.querySelectorAll<HTMLElement>('[data-banish]').forEach((b) => (b.onclick = (ev) => {
    ev.stopPropagation(); // not a pick
    on.banish?.(options[Number(b.dataset.banish)]);
  }));
  click(el, '[data-reroll]', on.reroll);
  numberKeys(el, (a) => a === 'reroll' && canReroll && on.reroll());
}

/** Why the Keep handed something back, per rework (save.refund.version). */
const REFUND_NOTES: Record<string, string> = {
  'v0.6': "<b>The Keep was rebuilt for v0.6:</b> the Armory's damage drills became new ways to start a run, and the top ranks of a few tracks were cut.",
  'v0.7': "<b>The Chapel changed with v0.7's relics:</b> Reliquary Guard now gives rerolls at relic moments (two ranks at most), the Reliquary Vault a fourth choice at wave bosses; a third Guard rank is handed back.",
};
const RELIC_SOURCE_NAMES: Record<RelicSource, string> = { boss: 'a boss', lair: 'a lair', strongbox: 'a strongbox', quest: 'a quest', merchant: 'the Merchant', start: 'the start', other: '-' };
/** #100: the families an arena's bosses drop, e.g. "🔥 Flame · ✨ Holy · 🛡️ Steel". */
const familyList = (ids: readonly FamilyId[]) => ids.map((f) => `${FAMILIES[f].icon} ${FAMILIES[f].name}`).join(' · ');
const MOMENT_TITLES: Record<RelicSource, string> = { boss: 'Spoils of the fallen', lair: "The lair's hoard", strongbox: 'A strongbox', quest: 'A reward for your quest', merchant: "The merchant's pick", start: "The Armorer's choice", other: 'A relic' };

/**
 * v0.7: a relic moment: pick one of three, reroll the three (a moment's rerolls are few), or skip it for gold and a Rune shard. Each card says
 * what the relic would do for this build right now (`preview`) and which evolution recipes it belongs to. #98: the card leads with the effect and
 * one compact line (`line`); the rest is its tooltip.
 */
export function showRelicOffer(
  offer: RelicOffer, held: RelicId[], tiers: RelicTiers,
  info: { skip: { gold: number; shards: number }; preview: (id: RelicId) => string[]; line: (id: RelicId) => string },
  on: { take: (id: RelicId | DuoId) => void; skip: () => void; reroll: () => void },
): void {
  const { options } = offer;
  const el = show(`
    <div class="levelup">
      ${choiceHead(MOMENT_TITLES[offer.from])}
      <p class="sub">Choose a relic · ${held.length} carried</p>
      ${offer.families ? `<p class="sub" data-families>This arena's bosses drop only ${familyList(offer.families)}</p>` : ''}
      <div class="cards">${options.map((id, i) => relicCard(id, (tiers[id] ?? 0) + 1, held, `data-pick="${i}"`, `<div class="num">${i + 1}</div><div class="preview">${esc(info.line(id))}</div>`, ['', 'For this build:', ...info.preview(id)])).join('')}${offer.duo ? duoCard(offer.duo, `data-pick="${options.length}"`, `<div class="num">${options.length + 1}</div>`) : ''}</div>
      <div class="row">
        ${kit.button(`Reroll (R) · ${offer.rerolls} left`, { attrs: 'data-reroll', disabled: offer.rerolls <= 0 })}
        ${kit.button(`Skip · 🪙 ${info.skip.gold} · ◆ ${info.skip.shards} shard`, { attrs: 'data-skip data-tip="Take nothing from this moment: gold for this run and a Rune shard for the Keep"' })}
      </div>
    </div>`);
  click(el, '[data-pick]', (b) => on.take(Number(b.dataset.pick) < options.length ? options[Number(b.dataset.pick)] : offer.duo!));
  click(el, '[data-skip]', on.skip);
  click(el, '[data-reroll]', () => offer.rerolls > 0 && on.reroll());
  numberKeys(el, (a) => a === 'reroll' && offer.rerolls > 0 && on.reroll());
}

export function showAbilityUpgrade(tier: number, options: readonly AbilityUpgradeId[], cls: ClassDef, onPick: (id: AbilityUpgradeId) => void): void {
  showTwoWay(`${cls.ability.name} — tier ${tier + 1}`, options.map((id) => ({ id, name: ABILITY_UPGRADES[id].name, desc: ABILITY_UPGRADES[id].desc })), (id) => onPick(id as AbilityUpgradeId));
}

/** v0.4: the utility ability's two-way choices at levels 8 and 14. */
/** v0.5: a shrine in an open wing offers a blessing for the rest of the run. */
export function showShrine(options: readonly BlessingId[], onPick: (id: BlessingId) => void): void {
  const el = show(`
    <div class="levelup">
      ${choiceHead('⛩️ An old shrine')}
      <p class="sub">Kneel, and choose a blessing. It lasts the whole run.</p>
      <div class="cards">${options.map((id, i) => `<button class="card panel boon special" data-pick="${id}"><div class="num">${i + 1}</div><h2>${BLESSINGS[id].name}</h2><p>${BLESSINGS[id].desc}</p></button>`).join('')}</div>
    </div>`);
  click(el, '[data-pick]', (b) => onPick(b.dataset.pick as BlessingId));
  numberKeys(el);
}

/** v0.5: the Act's quest board. Tap a quest (or its number) to take or drop it, up to `take` (a treasure trial is free on top); setting out with none is fine. */
export function showBoard(act: number, quests: { kind: QuestKind; reward: RewardKind; name: string; desc?: string }[], take: number, onSetOut: (picks: number[]) => void): void {
  const picks: number[] = [];
  const reward = (r: RewardKind) => (r === 'gold' ? `${REWARDS.gold.amount * act} gold` : REWARDS[r].name);
  const trial = (i: number) => quests[i]?.kind === 'trial';
  const el = show(`
    <div class="levelup board">
      ${choiceHead(`📜 ${actName(act)} · The quest board`)}
      <p class="sub">Take up to ${take}. None of it is required: a failed quest costs nothing, and every one done opens a gate.</p>
      <div class="cards">${quests.map((q, i) => `<button class="card panel boon quest ${trial(i) ? 'special' : ''}" data-quest="${i}"><div class="num">${i + 1}</div><h2>${QUESTS[q.kind].icon} ${trial(i) ? q.name : QUESTS[q.kind].name}</h2>${trial(i) ? '<div class="tag">Sacred treasure · free, on top of the others</div>' : ''}<p>${q.desc ?? QUESTS[q.kind].desc}</p><div class="best" data-tip="${esc(REWARDS[q.reward].desc)}">${REWARDS[q.reward].icon} ${reward(q.reward)}</div></button>`).join('')}</div>
      ${kit.button('', { kind: 'gold', size: 'big', attrs: 'data-leave' })}
    </div>`);
  const go =el.querySelector<HTMLElement>('[data-leave]')!;
  const label = () => (go.textContent = picks.length ? `Set out with ${picks.length} quest${picks.length > 1 ? 's' : ''}` : 'Set out without a quest');
  const toggle = (i: number) => {
    if (i >= quests.length) return;
    if (picks.includes(i)) picks.splice(picks.indexOf(i), 1);
    else if (trial(i) || picks.filter((p) => !trial(p)).length < take) picks.push(i);
    el.querySelectorAll<HTMLElement>('[data-quest]').forEach((b) => b.classList.toggle('on', picks.includes(Number(b.dataset.quest))));
    label();
  };
  label();
  click(el, '[data-quest]', (b) => toggle(Number(b.dataset.quest)));
  go.onclick = () => onSetOut([...picks]);
  onActions((a) => {
    const m = /^pick(\d)$/.exec(a);
    if (m) toggle(Number(m[1]) - 1);
    else if (a === 'confirm') onSetOut([...picks]);
  });
}

/** v0.5: the wandering merchant (a wave event): a healing draught or (#128) a reroll token, one sale a visit. */
export function showPeddler(info: { stock: number; price: number; tokenPrice: number; gold: number; hurt: boolean }, on: { buy: () => void; token: () => void; leave: () => void }): void {
  const el = show(`
    <div class="levelup">
      ${choiceHead('🧺 A wandering merchant')}
      <p class="sub">"Good things, fair prices, no questions." Purse: <b class="goldtext">🪙 ${info.gold}</b> — what you spend here never reaches the Keep.</p>
      <div class="cards">${info.stock > 0 ? `<button class="card panel boon shop" data-buy="0" ${info.gold >= info.price && info.hurt ? '' : 'disabled'}><div class="num">1</div><h2>🧪 Healing draught</h2><p>${info.hurt ? 'Drink, and mend a good part of your wounds.' : 'You are not hurt.'}</p><div class="best">🪙 ${info.price}</div></button><button class="card panel boon shop" data-buy="1" ${info.gold >= info.tokenPrice ? '' : 'disabled'}><div class="num">2</div><h2>🎲 Reroll token</h2><p>One more free reroll on your next level-up.</p><div class="best">🪙 ${info.tokenPrice}</div></button>` : '<p class="sub">Sold out.</p>'}</div>
      ${kit.button('Leave', { size: 'big', attrs: 'data-leave' })}
    </div>`);
  click(el, '[data-buy]', (b) => (b.dataset.buy === '1' ? on.token() : on.buy()));
  click(el, '[data-leave]', on.leave);
  onActions((a) => {
    const m = /^pick(\d)$/.exec(a);
    if (m) el.querySelectorAll<HTMLElement>('[data-buy]')[Number(m[1]) - 1]?.click();
    else if (a === 'confirm' || a === 'cancel') on.leave();
  });
}

export function showUtilityUpgrade(tier: number, options: readonly UtilityUpgradeId[], cls: ClassDef, onPick: (id: UtilityUpgradeId) => void): void {
  showTwoWay(`${UTILITIES[cls.id].name} — upgrade ${tier + 1}`, options.map((id) => ({ id, name: UTILITY_UPGRADES[id].name, desc: UTILITY_UPGRADES[id].desc })), (id) => onPick(id as UtilityUpgradeId));
}

function showTwoWay(title: string, options: { id: string; name: string; desc: string }[], onPick: (id: string) => void): void {
  const el = show(`
    <div class="levelup">
      ${choiceHead(title)}
      <p class="sub">Choose one path. The other is lost for this run.</p>
      <div class="cards">
        ${options.map((o, i) => `<button class="card panel boon special" data-pick="${o.id}"><div class="num">${i + 1}</div><h2>${o.name}</h2><p>${o.desc}</p></button>`).join('<div class="or heading">or</div>')}
      </div>
    </div>`);
  click(el, '[data-pick]', (b) => onPick(b.dataset.pick!));
  numberKeys(el);
}

/**
 * v0.4: the talent tree, from the pause menu. Three branch columns, four rows, big buttons: taken, available (glowing) or locked
 * (dim, the tooltip says what it needs). Spending is immediate; the screen re-renders itself.
 */
export function showTalents(info: { classId: ClassId; taken: string[]; points: number; rowCap: number; treasure?: TreasureId | null }, on: { spend: (id: string) => boolean; back: () => void }): void {
  const branches = TALENT_BRANCHES[info.classId];
  const nodes = talentsFor(info.classId, info.treasure);
  const keystone = takenKeystone(info.taken);
  const column = (b: BranchDef) => {
    const mine = nodes.filter((n) => n.branch === b.id);
    const rows = Array.from({ length: TALENTS.rows }, (_, r) => mine.filter((n) => n.row === r));
    return `<div class="branch"><h2>${b.name}</h2><p class="hint">${b.desc} · ${branchPoints(info.taken, b.id)} points</p>
      ${rows.map((row) => `<div class="trow">${row.map((n) => {
        const taken = info.taken.includes(n.id);
        const why = taken ? null : talentBlocker(info.taken, n.id, info.points, info.rowCap, info.treasure);
        const state = taken ? 'taken' : why === null ? 'open' : 'locked';
        const library = !taken && n.row > info.rowCap; // locked by the Keep, not by this run: say so on the node itself
        const recipe = taken ? [] : recipeLines({ talent: n.id }); // v0.6: the missing half of an evolution recipe
        const tip = `${n.name}${n.keystone ? ' · keystone' : ''}${n.treasure ? ' · sacred treasure' : ''}\n${n.desc}${why && !taken ? `\n(${why})` : ''}${recipe.length ? `\n${recipe.join('\n')}` : ''}`;
        return `<button class="talent ${state} ${n.keystone ? 'keystone' : ''} ${n.treasure ? 'sacred' : ''} ${recipe.length ? 'recipe' : ''}" data-talent="${n.id}" ${state === 'open' ? '' : 'disabled'} data-tip="${esc(tip)}"><b>${taken ? '✔ ' : library ? '🔒 ' : ''}${n.name}</b><span>${library ? 'Raise the Library in the Keep to open the keystones.' : n.desc}</span></button>`;
      }).join('')}</div>`).join('')}
    </div>`;
  };
  const el = show(kitScreen('talents', 'Talents', {
    back: 'data-back',
    sub: `${info.points > 0 ? `<b>${info.points} point${info.points > 1 ? 's' : ''} to spend</b>` : 'No points to spend'} · a point every ${TALENTS.levelsPerPoint} levels · a keystone needs ${TALENTS.keystonePoints} points in its branch, and only one keystone${keystone ? ` (yours: ${keystone.name})` : ''}${info.rowCap < TALENTS.rows - 1 ? ' · <b>keystones open when the Library is raised in the Keep</b>' : ''}`,
    body: `<div class="tree">${branches.map(column).join('')}</div>`,
  }));
  click(el, '[data-talent]', (b) => {
    if (on.spend(b.dataset.talent!)) showTalents({ ...info, taken: [...info.taken, b.dataset.talent!], points: info.points - 1 }, on);
  });
  click(el, '[data-back]', on.back);
  onActions((a) => (a === 'cancel' || a === 'pause') && on.back());
}

export interface BuildInfo {
  relics: RelicId[];
  tiers: RelicTiers;
  attune?: RelicTiers; // v0.7 A4: progress to the next tier, 0..1
  duos?: DuoId[]; // v0.7 A5: formed duos
  upgrades: AbilityUpgradeId[];
  classId: ClassId;
  talents: string[];
  talentPoints: number;
  utilityUpgrades: UtilityUpgradeId[];
  trait: TraitId;
  sacred?: { name: string; desc: string }[]; // v0.5: the treasure equipped, and this run's progress on its chain
  evolutions?: EvolutionId[]; // v0.6
}

/** The current build: ability upgrades, relics with tiers (tooltips), active synergies and clashes. Pause and results screens. */
export function buildHtml(info: BuildInfo): string {
  const relics = looseRelics(info.relics, info.duos ?? []).map((id) => { // v0.7.5 (#96): a duo's two relics show as the duo
    const tier = info.tiers[id] ?? 1;
    const att = info.attune && tier < RELIC_MAX_TIER ? ` · ${Math.floor((info.attune[id] ?? 0) * 100)}% to ${TIER_NUMERALS[tier + 1]}` : '';
    return `<div><span tabindex="0" data-tip="${esc(relicTip(id, tier, info.relics))}">${relicDef(id).icon} ${relicDef(id).name}${tier > 1 ? ` ${TIER_NUMERALS[tier]}` : ''}${att}</span><em>${relicDesc(id, tier)}</em></div>`;
  }).join('');
  const trait = info.trait !== 'none' ? `<div><span>${TRAITS[info.trait].icon} ${TRAITS[info.trait].name}</span><em>${TRAITS[info.trait].desc}</em></div>` : '';
  const ups = info.upgrades.map((id) => `<div><span>✦ ${ABILITY_UPGRADES[id].name}</span><em>${ABILITY_UPGRADES[id].desc}</em></div>`).join('');
  const evos = (info.evolutions ?? []).map((id) => `<div class="evolved"><span>${EVOLUTIONS[id].icon} ${EVOLUTIONS[id].name}</span><em>${EVOLUTIONS[id].desc}</em></div>`).join('');
  const util = info.utilityUpgrades.map((id) => `<div><span>${UTILITIES[info.classId].icon} ${UTILITY_UPGRADES[id].name}</span><em>${UTILITY_UPGRADES[id].desc}</em></div>`).join('');
  const talents = info.talents.length || info.talentPoints ? `<div><span>🌿 Talents${info.talentPoints ? ` · ${info.talentPoints} unspent` : ''}</span><em>${info.talents.map((id) => TALENT_BY_ID[id]?.name).join(' · ') || 'none yet'}</em></div>` : '';
  const sacred = (info.sacred ?? []).map((s) => `<div><span>${s.name}</span><em>${s.desc}</em></div>`).join('');
  // v0.7: the set bonuses reached, per family
  const duos = (info.duos ?? []).map((id) => {
    const tier = duoTier(info.tiers, id);
    const att = info.attune && tier < RELIC_MAX_TIER ? ` · ${Math.floor(Math.max(...DUOS[id].from.map((r) => info.attune![r] ?? 0)) * 100)}% to ${TIER_NUMERALS[tier + 1]}` : '';
    return `<div class="evolved"><span tabindex="0" data-tip="${esc(duoTip(id, tier))}">${DUOS[id].icon} ${DUOS[id].name}${tier > 1 ? ` ${TIER_NUMERALS[tier]}` : ''}${att}</span><em>${DUOS[id].desc}</em></div>`;
  }).join('');
  const syns = Object.entries(familySets(info.relics)).map(([f, st]) => {
    const fam = FAMILIES[f as keyof typeof FAMILIES];
    const next = ([2, 4, 6] as const).find((l) => l > st.count);
    const reached = ([2, 4, 6] as const).filter((l) => st.level >= l).map((l) => `${fam.sets[l][0]}: ${fam.sets[l][1]}`).join(' ');
    return `<div class="syn ${st.level ? 'on' : ''}"><span>${fam.icon} ${fam.name} ${st.count}</span><em>${reached || 'no set bonus yet'}${next ? ` · next at ${next}: ${fam.sets[next][0]}` : ''}</em></div>`;
  }).join('');
  return relics || ups || trait || util || talents || sacred || evos ? `<div class="build">${evos}${sacred}${trait}${talents}${ups}${util}${relics}${duos}${syns}</div>` : '';
}

export function showPause(info: BuildInfo, on: { resume: () => void; quit: () => void; talents: () => void; treasures: () => void; glossary: () => void; bored: () => void }): void {
  // #189: Resume is the one main button; the build (when there is one) on parchment above the menu
  const el = show(kitScreen('pause', 'Paused', {
    body: buildHtml(info),
    foot: `${kit.button('Resume', { kind: 'gold', size: 'big', attrs: 'data-resume' })}
      <div class="row">${kit.button(`Talents${info.talentPoints > 0 ? ` (${info.talentPoints} to spend)` : ''}`, { attrs: 'data-talents' })}${kit.button('Sacred treasures', { icon: 'crown', attrs: 'data-treasures' })}${kit.button('Glossary', { attrs: 'data-glossary' })}</div>
      <div class="row">${kit.button('😴 Bored here', { size: 'small', attrs: 'data-bored data-tip="Playtest aid: stamps this moment into the run log (Keep › Run history). F8 does the same without pausing."' })}${kit.button('End run (keeps your gold)', { attrs: 'data-quit' })}</div>`,
  }));
  click(el, '[data-resume]', on.resume);
  click(el, '[data-talents]', on.talents);
  click(el, '[data-treasures]', on.treasures);
  click(el, '[data-glossary]', on.glossary);
  click(el, '[data-quit]', on.quit);
  click(el, '[data-bored]', (b) => {
    on.bored();
    b.textContent = '😴 Noted';
    (b as HTMLButtonElement).disabled = true;
  });
}

export interface RunResult {
  cls: ClassDef;
  wave: number;
  kills: number;
  time: number;
  level: number;
  best: number;
  newBest: boolean;
  gold: number; // banked (after the run and daily caps)
  goldRaw: number; // picked up in the run
  runes: number;
  classXp: number;
  masteryRank: number;
  masteryName: string | null; // a rank reached this run
  tier: string;
  tierUnlocked: string | null;
  earned: EarnedTier[];
  title: string | null; // the equipped title
  slain: boolean; // false = the player ended the run from the pause menu
  seed: string; // type it on the class select screen to replay the run
  curseMult: number;
  daily: string | null;
  build: BuildInfo;
  // v0.6
  act: number;
  won: boolean; // the Usurper fell in this run
  firstWin: boolean; // ...and it is the class's first win (it pays VICTORY.firstWin)
  oath: number; // v0.6: the Oath sworn, 0 = a custom run
  oathKept: number; // the Oath level kept for the first time by this win (it pays oathReward), 0 = none
  goals: Goal[]; // v0.6: the three closest goals, after this run
  contracts: Contract[]; // weekly contracts this run completed
  restart: string; // what Quick Restart keeps: "Viking · Stalwart · Oath 3"
  relicShares: { id: RelicKey; tier: number; from: RelicSource; damage: number; healing: number; mitigation: number }[]; // v0.7: which relics carried the run
  wins: number; // the class's wins, this one included
  masteryNext: { name: string; need: number } | null; // the next mastery rank and the class XP still missing
  endless: { score: number; rank: number; board: EndlessEntry[] } | null; // the run went on into Endless
}

/**
 * The end of a run, and (v0.6) the moment the Usurper falls. With `bank` and `endless` it is the victory screen: the run as it would
 * bank right now, and the choice. With `retry` and `menu` the run is over and banked.
 */
export function showResults(r: RunResult, on: { retry: () => void; menu: () => void } | { bank: () => void; endless: () => void; restart: () => void }): void {
  const deciding = 'bank' in on;
  const G = kit.icon('gold'), R = kit.icon('runes'); // #186: the atlas's currency icons
  const title = deciding ? 'The Usurper has fallen' : r.endless ? (r.slain ? 'The Endless takes you' : 'The Endless ends') : r.won ? 'Victory' : r.slain ? 'Thou art slain' : 'The run ends';
  const winLine = r.won
    ? `<div class="earned"><span>${r.firstWin ? `First win with the ${r.cls.name}` : `Win ${r.wins} with the ${r.cls.name}`}</span><b>${R} +${VICTORY.win.runes + (r.firstWin ? VICTORY.firstWin.runes : 0)}${r.firstWin ? ` · ${G} +${VICTORY.firstWin.gold}` : ''} · +${VICTORY.win.classXp + (r.firstWin ? VICTORY.firstWin.classXp : 0)} XP <em>(counted in the totals)</em></b></div>`
    : '';
  const oathLine = r.oathKept ? `<div class="earned"><span>Oath ${r.oathKept} kept for the first time</span><b>${R} +${oathReward(r.oathKept).runes} · ${G} +${oathReward(r.oathKept).gold} <em>(counted in the totals)</em></b></div>` : '';
  const board = r.endless
    ? `<h2>Endless · ${r.cls.name}</h2><table class="stats-table endless"><tr><th>#</th><th>Score</th><th>Wave</th><th>Kills</th><th>Time</th></tr>${r.endless.board.map((e, i) => `<tr class="${i + 1 === r.endless!.rank ? 'on' : ''}"><td>${i + 1}</td><td>${e.score}</td><td>${e.wave}</td><td>${e.kills}</td><td>${fmtTime(e.time)}</td></tr>`).join('')}</table>`
    : '';
  const unlocks = [
    ...(r.tierUnlocked ? [`<div class="unlock">⚔ Difficulty unlocked: <b>${r.tierUnlocked}</b></div>`] : []),
    ...r.contracts.map((c) => `<div class="unlock">📜 Weekly contract done: <b>${c.text}</b> <em>${R} +${c.runes}</em></div>`),
    ...r.earned.map((e) => `<div class="unlock">🏆 <b>${e.def.name} · ${TIER_NAMES[e.tier - 1]}</b> — ${e.def.desc} <em>${tierRewardText(e.reward)}</em>${e.tier === 1 && e.def.unlocks?.arena ? ` <em>New arena: ${ARENAS[e.def.unlocks.arena].name}</em>` : ''}${e.tier === 1 && e.def.unlocks?.relic ? ` <em>New relic: ${relicDef(e.def.unlocks.relic).name}</em>` : ''}</div>`),
  ].join('');
  // #186: the results in the kit: a framed screen with its heading on the ribbon, the run on parchment (it scrolls), and the
  // buttons in a footer that stays in view. One main button: Quick restart, or Bank the win at the Usurper; Endless is a go.
  const el = show(`
    <div class="kit-frame kit-screen results ${r.won ? 'victory' : ''}">
      <header class="kit-head">${kit.ribbon(title, { attrs: 'role="heading" aria-level="1"' })}</header>
      <p class="sub">${r.cls.name}${r.title ? `, <em>${esc(r.title)}</em>` : ''} · ${r.tier}${r.oath ? ` · Oath ${r.oath}` : ''}${r.newBest ? ' — <span class="record">new record!</span>' : ''}${deciding ? '<br>Bank the win now, or march on into Endless: waves without end, for a score. Either way the win counts when the run is banked.' : ''}</p>
      ${kit.parch(`
      <div class="stats wide">
        <div><span>Reached</span><b>${r.endless ? 'Endless · ' : ''}${actName(r.act)} · wave ${r.wave}</b></div>
        ${r.endless ? `<div class="earned"><span>Endless score</span><b>${r.endless.score}${r.endless.rank ? ` · #${r.endless.rank} for the ${r.cls.name}` : ''}</b></div>` : ''}
        ${winLine}
        ${oathLine}
        <div><span>Enemies slain</span><b>${r.kills}</b></div>
        <div><span>Time survived</span><b>${fmtTime(r.time)}</b></div>
        <div><span>Level</span><b>${r.level}</b></div>
        <div><span>${r.daily ? `Daily Trial ${r.daily}` : 'Run seed'}</span><b class="seed">${r.seed}</b></div>
        ${r.curseMult > 1 ? `<div><span>Curses</span><b>×${r.curseMult.toFixed(2)} gold &amp; XP</b></div>` : ''}
        <div><span>Best wave (${r.cls.name})</span><b>${r.best}</b></div>
        <div class="earned"><span>Gold banked</span><b>${G} +${r.gold}${r.goldRaw > r.gold ? ` <s>${r.goldRaw}</s>` : ''}</b></div>
        ${r.runes > 0 ? `<div class="earned"><span>Runes</span><b>${R} +${r.runes}</b></div>` : ''}
        <div class="earned"><span>${r.cls.name} mastery</span><b>+${r.classXp} XP · rank ${r.masteryRank}${r.masteryName ? ` — <em>${r.masteryName}</em>` : ''}</b></div>
        ${r.masteryNext ? `<div><span>Next mastery rank</span><b>${r.masteryNext.name} · ${r.masteryNext.need} XP to go</b></div>` : ''}
      </div>
      ${r.goals.length ? `<h2>Next</h2><div class="goals">${r.goals.map((g) => `<div class="goal"><span>${esc(g.text)}</span><div class="bar xp"><div style="width:${Math.round(g.frac * 100)}%"></div></div></div>`).join('')}</div>` : ''}
      ${r.relicShares.length ? `<h2>Relics</h2><table class="stats-table relics-table"><tr><th>Relic</th><th>Found</th><th>Damage</th><th>Healing</th><th>Mitigation</th></tr>${r.relicShares.map((s) => `<tr><td><span data-tip="${esc(keyTip(s.id, s.tier, r.relicShares.map((x) => x.id)))}">${keyIcon(s.id)} ${keyName(s.id)}${s.tier > 1 ? ` ${TIER_NUMERALS[s.tier]}` : ''}</span></td><td>${RELIC_SOURCE_NAMES[s.from]}</td><td>${s.damage ? `${s.damage}%` : '-'}</td><td>${s.healing ? `${s.healing}%` : '-'}</td><td>${s.mitigation ? `${s.mitigation}%` : '-'}</td></tr>`).join('')}</table><p class="hint">Each relic's share of all the damage you dealt, the healing you received and the damage turned away this run.</p>` : ''}
      ${unlocks ? `<div class="unlocks">${unlocks}</div>` : ''}
      ${board}
      ${buildHtml(r.build)}`, { cls: 'kit-scroll' })}
      <footer class="row">${deciding
        ? `${kit.button('Bank the win', { kind: 'gold', size: 'big', attrs: 'data-bank' })}${kit.button('March on into Endless', { kind: 'go', attrs: 'data-endless' })}${kit.button('Bank and restart', { attrs: `data-restart data-tip="Bank the win and start again at once: ${esc(r.restart)}"` })}`
        : `${kit.button(`Quick restart · ${esc(r.restart)}`, { kind: 'gold', size: 'big', attrs: 'data-retry data-tip="Enter"' })}${kit.button('Choose another champion', { attrs: 'data-menu' })}`}</footer>
    </div>`);
  if ('bank' in on) {
    click(el, '[data-endless]', on.endless);
    click(el, '[data-bank]', on.bank);
    click(el, '[data-restart]', on.restart);
  } else {
    click(el, '[data-retry]', on.retry);
    click(el, '[data-menu]', on.menu);
    onActions((a) => a === 'confirm' && on.retry());
  }
}

/**
 * v0.6: the fork after an Act. Three routes into the next one: an arena, a theme (what the horde will be) and a focus (what the Act pays).
 * Seeded (logic/routes.ts), so a Daily Trial forks the same way for everyone.
 */
export function showRoutes(act: number, routes: Route[], onPick: (i: number) => void): void {
  const card = (r: Route, i: number) => {
    const f = ROUTE_FOCUS[r.focus];
    const theme = r.theme < 0 ? FINAL.theme : ACT_THEMES[r.theme];
    return `<button class="card panel boon route ${r.focus}" data-pick="${i}"><div class="num">${i + 1}</div><h2>${f.icon} ${f.name}</h2><div class="tag">${ARENAS[r.arena].name}</div><div class="tag" data-families>Boss relics: ${familyList(ARENA_FAMILIES[r.arena])}</div>
      <p><b>${theme.name}</b> — ${theme.desc}</p><p>${f.desc}</p></button>`;
  };
  const el = show(`
    <div class="levelup routes">
      ${choiceHead('The road forks')}
      <p class="sub">Choose your way into ${actName(act + 1)}</p>
      <svg class="fork" viewBox="0 0 300 60" aria-hidden="true"><circle cx="150" cy="8" r="6"/><path d="M150 14 L50 58 M150 14 L150 58 M150 14 L250 58"/></svg>
      <div class="cards">${routes.map(card).join('')}</div>
    </div>`);
  click(el, '[data-pick]', (b) => onPick(Number(b.dataset.pick)));
  numberKeys(el);
}

export interface MerchantInfo {
  act: number; // the Act that was just cleared
  gold: number;
  hp: number;
  maxHp: number;
  relics: RelicId[];
  tiers: RelicTiers;
  attune: Partial<Record<RelicId, number>>; // v0.7.1 B7: the Reforge keeps half of it
  reforgeable: RelicId[]; // v0.7.1 B7: held relics with another of their family left to become
  salvage: number; // Rune shards so far
  relicsLeft: number; // v0.7: relic moments he still sells this visit
  mid?: boolean; // v0.6: the Merchant path's visit halfway through an Act
  books: BookId[]; // v0.8.1 #144: the caravan's books in the relic slots (none when it sells a relic this visit, or at the end of an Act)
  booksLeft: BookId[]; // one of each a visit
}

/** Between Acts. Everything here costs run gold, and run gold is what you would otherwise bank for the Keep. */
export function showMerchant(info: MerchantInfo, on: { heal: () => void; buy: (r: Rarity) => void; book: (b: BookId) => void; reroll: (id: RelicId) => void; reforge: (id: RelicId) => void; sell: (id: RelicId) => void; salvage: (id: RelicId) => void; leave: () => void }): void {
  const price = (item: MerchantItem) => merchantPrice(item, info.act);
  const offer = (item: MerchantItem, attrs: string, title: string, text: string, enabled: boolean) =>
    `<button class="card panel boon shop" ${attrs} ${enabled && info.gold >= price(item) ? '' : 'disabled'}><h2>${title}</h2><p>${text}</p><div class="best">🪙 ${price(item)}</div></button>`;
  const held = info.relics.map((id) => {
    const tier = info.tiers[id] ?? 1;
    const fam = relicDef(id).family;
    const kept = halfAttunement(tier, info.attune[id] ?? 0);
    const forge = !fam ? 'A cursed relic has no family to reforge within' : !info.reforgeable.includes(id) ? `You carry every ${FAMILIES[fam].name} relic you can find` : `Swap it for a random other ${FAMILIES[fam].name} relic you do not carry, keeping half its attunement: tier ${TIER_NUMERALS[kept.tier]}${kept.attune > 0 ? `, ${Math.round(kept.attune * 100)}% toward ${TIER_NUMERALS[kept.tier + 1]}` : ''}`;
    return `<div class="held ${relicClass(id)}">${relicLine(id, tier, info.relics)}
      ${kit.button(`Reroll 🪙 ${price('reroll')}`, { size: 'small', disabled: info.gold < price('reroll'), attrs: `data-reroll="${id}" data-tip="Swap it for a random ${relicDef(id).rarity} relic you do not carry, at the same tier"` })}
      ${kit.button(`Reforge 🪙 ${price('reforge')}`, { size: 'small', disabled: !(info.gold >= price('reforge') && info.reforgeable.includes(id)), attrs: `data-reforge="${id}" data-tip="${esc(forge)}"` })}
      ${kit.button(`Sell +🪙 ${sellPrice(id, tier, info.act)}`, { size: 'small', attrs: `data-sell="${id}" data-tip="Sell it for gold${tier > 1 ? ' (every tier counts)' : ''}"` })}
      ${kit.button(`Salvage +${salvageValue(id, tier)} ◆`, { size: 'small', attrs: `data-salvage="${id}" data-tip="Break it into Rune shards: progress toward Runes, the Keep's second currency"` })}</div>`;
  }).join('');
  const el = show(`
    <div class="levelup merchant">
      ${choiceHead(info.mid ? 'The Merchant’s caravan' : `${actName(info.act)} is won`)}
      <p class="sub">${info.mid ? 'The Merchant path: his caravan has caught up with you.' : 'The Merchant waits by the gate.'} Purse: <b class="goldtext">🪙 ${info.gold}</b>${info.salvage > 0 ? ` · shards: <b>${info.salvage} ◆</b>` : ''} — what you spend here never reaches the Keep.</p>
      <div class="cards">
        ${offer('heal', 'data-heal', 'Field Surgeon', `Heal half your HP (${Math.ceil(info.hp)} / ${Math.round(info.maxHp)}).`, info.hp < info.maxHp)}
        ${info.books.length ? info.books.map((b) => offer(`book:${b}`, `data-book="${b}"`, `${MERCHANT.books[b].icon} ${MERCHANT.books[b].name}`, info.booksLeft.includes(b) ? MERCHANT.books[b].desc : 'Bought. One of each a visit.', info.booksLeft.includes(b))).join('')
        : info.mid && info.relicsLeft <= 0 ? '' : (Object.keys(RELIC_WEIGHTS) as Rarity[]).map((r) => offer(`buy:${r}`, `data-buy="${r}"`, `${r[0].toUpperCase()}${r.slice(1)} relic`, info.relicsLeft > 0 ? `Choose one of three ${r} relics you do not carry. One relic a visit.` : 'He sells one relic a visit.', info.relicsLeft > 0)).join('')}
      </div>
      ${held ? kit.frame(kit.parch(held), { cls: 'heldlist' }) : ''}
      ${kit.button('March on', { kind: 'gold', size: 'big', attrs: 'data-leave' })}
    </div>`);
  click(el, '[data-heal]', on.heal);
  click(el, '[data-buy]', (b) => on.buy(b.dataset.buy as Rarity));
  click(el, '[data-book]', (b) => on.book(b.dataset.book as BookId));
  click(el, '[data-reroll]', (b) => on.reroll(b.dataset.reroll as RelicId));
  click(el, '[data-reforge]', (b) => on.reforge(b.dataset.reforge as RelicId));
  click(el, '[data-sell]', (b) => on.sell(b.dataset.sell as RelicId));
  click(el, '[data-salvage]', (b) => on.salvage(b.dataset.salvage as RelicId));
  click(el, '[data-leave]', on.leave);
  onActions((a) => a === 'confirm' && on.leave());
}

/**
 * The relic compendium in the Keep (v0.7): every relic by family, discovered or not, with its tiers and awakening, and each family's sets.
 * #187: in the kit: a wood frame, a ribbon, the list on parchment, each relic a row with its icon in the frame of its rarity.
 */
export function showCompendium(save: Save, onBack: () => void): void {
  const found = (id: RelicId) => save.relicPicks[id] ?? 0;
  const card = (id: RelicId) => {
    const r = relicDef(id);
    const n = found(id);
    const who = r.classId ? ` · ${CLASSES[r.classId].name}` : '';
    if (n === 0) return kit.row(`<b>Unknown</b><div class="tag">${r.rarity}${who}${save.newRelics.includes(id) ? ' · <b class="new">new in v0.7</b>' : ''}</div>`, { cls: 'comp-card locked undiscovered', attrs: `data-relic="${id}" data-tip="${esc(`Not found yet. A ${r.family ? `${r.rarity} ${FAMILIES[r.family].name}` : 'cursed'} relic${r.classId ? ` for the ${CLASSES[r.classId].name}` : ''}.`)}"`, lead: kit.rarityGlyph(relicRarity(id), '?') });
    const tiers = [1, 2].map((t) => `<div class="tierline"><b>${TIER_NUMERALS[t]}</b> ${relicDesc(id, t)}</div>`).join('');
    return kit.row(`<b>${r.name}</b><div class="tag">${r.cursed ? 'cursed' : r.rarity}${who} · found ${n}×</div>${tiers}<div class="tierline"><b>III</b> <em>${r.awaken.name}</em>: ${r.awaken.desc}</div>`, { cls: `comp-card${r.cursed ? ' cursed' : ''}`, attrs: `data-relic="${id}"`, lead: kit.rarityGlyph(relicRarity(id), r.icon) });
  };
  const family = (f: (typeof FAMILY_IDS)[number]) => {
    const fam = FAMILIES[f];
    const prefer = (fam.preferredBy as readonly string[]).map((c) => CLASSES[c as keyof typeof CLASSES].name).join(', ');
    return `<h2 style="--fam:${fam.color}">${kit.icon(f)}${fam.name}</h2><p class="hint">${fam.mechanic}. ${([2, 4, 6] as const).map((l) => `<b>${l} ${fam.sets[l][0]}</b>: ${fam.sets[l][1]}`).join(' ')} Can be maxed by: ${prefer}.</p>
      <div class="comp-grid">${RELIC_IDS.filter((id) => relicDef(id).family === f).map(card).join('')}</div>`;
  };
  // a duo or an evolution: its icon in the gold (signature) frame once discovered, a greyed ? until then
  const recipe = (known: boolean, icon: string, head: string, body: string) =>
    kit.row(`${head}${body}`, { cls: `recipe${known ? ' known' : ' locked'}`, lead: kit.rarityGlyph('signature', known ? icon : '?') });
  const discovered = RELIC_IDS.filter((id) => found(id) > 0).length;
  const el = show(`
    <div class="kit-frame kit-book compendium">
      ${kit.closeButton('back', { cls: 'kit-corner', attrs: 'data-back' })}
      <h1 class="kit-head">${kit.ribbon('Relic compendium')}</h1>
      <p class="sub">${discovered} / ${RELIC_IDS.length} discovered · seven families; 2, 4 and 6 of a family unlock its set bonuses · a relic attunes as it works: tier II, then it awakens</p>
      ${kit.parch(`${FAMILY_IDS.map(family).join('')}
      <h2 style="--fam:${CURSED.color}">☠ Cursed</h2><p class="hint">No family and no set bonus, far stronger than any other relic, and each carries a curse; awakening it lifts the curse. At most one is offered an Act, as the purple third card of a wave boss or a lair.</p>
      <div class="comp-grid">${CURSED_IDS.map(card).join('')}</div>
      <h2>Duos · ${save.duos.length} / ${DUO_IDS.length} discovered</h2>
      <p class="hint">Hold both relics of a recipe and a relic moment offers the duo as a gold fourth card; it combines the two into one relic that attunes as one, the families keep their counts, and each relic feeds one duo. A discovered duo shows in full.</p>
      <div class="recipes">${DUO_IDS.map((id) => {
        const d = DUOS[id];
        const known = save.duos.includes(id);
        return recipe(known, d.icon, `<span><b>${known ? d.name : 'Unknown duo'}</b> <em>${d.families.map((f) => `${FAMILIES[f].icon} ${FAMILIES[f].name}`).join(' + ')}</em></span>`, `${known ? `<p>${d.desc}</p>` : ''}<i>${d.from.map((r) => relicDef(r).name).join(' + ')}</i>`);
      }).join('')}</div>
      <h2>Evolutions · ${save.evolutions.length} / ${EVOLUTION_IDS.length} discovered</h2>
      <p class="hint">Three for each champion's signature ability, two for the second one. Meet both halves of a recipe in a run and the next level-up offers it as a gold card; one of each kind a run. A discovered recipe shows in full.</p>
      <div class="recipes">${CLASS_ORDER.map((c) => `<div class="recipe-class"><h3>${CLASSES[c].name}</h3>${EVOLUTION_IDS.filter((id) => EVOLUTIONS[id].classId === c).map((id) => {
        const e = EVOLUTIONS[id];
        const known = save.evolutions.includes(id);
        return recipe(known, e.icon, `<span><b>${known ? e.name : 'Unknown evolution'}</b> <em>${e.slot === 'signature' ? CLASSES[c].ability.name : UTILITIES[c].name}</em></span>`, `${known ? `<p>${e.desc}</p>` : ''}<i>${e.requires.map((r) => requirementText(r, !known)).join(' + ')}</i>`);
      }).join('')}</div>`).join('')}</div>`, { cls: 'kit-scroll' })}
    </div>`);
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack()); // #182: Esc goes back to the Keep, like its sibling screens
}

export function showDaily(setup: DailySetup, best: number, onStart: () => void, onBack: () => void): void {
  const el = show(kitScreen('daily', 'Daily Trial', {
    back: 'data-back',
    sub: `${setup.date} — the same trial for everyone today`,
    body: `<div class="stats wide">
        <div><span>Champion</span><b>${CLASSES[setup.classId].name}</b></div>
        <div><span>Arena</span><b>${ARENAS[setup.arena].name}</b></div>
        <div><span>Curses</span><b>${setup.curses.map((c) => CURSES[c].name).join(' · ')}</b></div>
        <div><span>Gold &amp; class XP</span><b>×${curseMultiplier(setup.curses).toFixed(2)}</b></div>
        <div><span>Your best today</span><b>${best ? `wave ${best}` : '—'}</b></div>
      </div>`,
    foot: kit.button('Begin the trial', { kind: 'gold', size: 'big', attrs: 'data-start' }),
  }));
  click(el, '[data-start]', onStart);
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'confirm' ? onStart() : a === 'cancel' && onBack()));
}

/** v0.7.1: what changed in this version, from the top CHANGELOG entry (logic/whatsNew.ts, at build time). Once after an update, and from the title screen. */
export function showWhatsNew(w: WhatsNew, onBack: () => void): void {
  const el = show(kitScreen('whatsnew', `What’s new in v${w.version}`, {
    sub: w.title ? `<b>${esc(w.title)}</b>` : '',
    body: `${w.intro ? `<p>${esc(w.intro)}</p>` : ''}
      <ul>${w.points.map((p) => `<li><b>${esc(p.name)}</b>${p.text ? ` — ${esc(p.text)}` : ''}</li>`).join('')}</ul>
      ${w.more ? `<p class="hint">…and ${w.more} more change${w.more > 1 ? 's' : ''}.</p>` : ''}`,
    foot: kit.button('Continue', { kind: 'gold', size: 'big', attrs: 'data-back' }),
  }));
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'confirm' || a === 'cancel' || a === 'pause') && onBack());
}

/** v0.7.1: every game term and what it means (config/glossary.ts), from the pause menu and the Keep. Tooltips underline the same words. */
export function showGlossary(onBack: () => void, cards: CardId[] = []): void {
  const met = cards.map((id) => ({ id, ...cardInfo(id) })).sort((a, b) => a.name.localeCompare(b.name));
  const el = show(`
    <div class="kit-frame kit-book glossary">
      ${kit.closeButton('back', { cls: 'kit-corner', attrs: 'data-back' })}
      <h1 class="kit-head">${kit.ribbon('Glossary')}</h1>
      <p class="sub">The words the game uses, and what they mean. Tooltips underline them and explain them too.</p>
      ${kit.parch(`<dl>${[...GLOSSARY].sort((a, b) => a.name.localeCompare(b.name)).map((t) => `<dt>${t.name}</dt><dd>${t.def}</dd>`).join('')}</dl>
      ${met.length ? `<h2>Foes and marks met</h2><dl class="cards-met">${met.map((c) => `<dt>${cardPicture(c.id)}${c.name}</dt><dd>${c.text}</dd>`).join('')}</dl>` : ''}`, { cls: 'kit-scroll' })}
    </div>`);
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack());
}

/** #133: what a card's picture needs to know about the foe that brought it (a slice of Enemy). */
export interface CardPictureFoe {
  def: EnemyDef;
  elite: boolean;
  affixes: AffixId[];
}

/**
 * #133: a card's picture. A foe is its own arena sprite from the same cache (so a sprite redesign reaches the card by itself); an elite
 * wears its first affix's colour as an outline. A mechanic without a foe (the Glossary, a marked attack) shows its icon.
 */
function cardPicture(id: CardId, foe?: CardPictureFoe): string {
  const def = id in ENEMIES ? ENEMIES[id as EnemyId] : id === 'elite' ? foe?.def : undefined;
  if (!def) return `<span class="card-pic icon">${MECHANIC_CARDS[id as MechanicCard].icon}</span>`;
  const elite = !!foe?.elite && foe.def === def;
  const spr = portraitSprite(def.sprite, def.scale + (elite ? ELITES.scaleBonus : 0), def.palette);
  const c = document.createElement('canvas');
  c.width = spr.w + 4;
  c.height = spr.h + 4;
  const ctx = c.getContext('2d')!;
  if (elite) ctx.drawImage(outlineSprite(spr, AFFIXES[foe!.affixes[0]]?.color ?? SKILL.colors.elite)[0], 0, 0);
  ctx.drawImage(spr.img, 2, 2);
  return `<img class="card-pic" src="${c.toDataURL()}" alt="" data-sprite-of="${def.id}">`;
}

/** v0.8 (#124): a flash card, the first time a foe, a boss or a mechanic is met. The run waits under it. `pause` (Esc) also opens the pause menu. */
export function showFlashCard(id: CardId, foe: CardPictureFoe | undefined, onDone: (pause: boolean) => void): void {
  const c = cardInfo(id);
  const el = show(`
    <div class="kit-frame flash-card${c.boss ? ' boss' : ''}" data-card="${id}">
      ${kit.ribbon(c.boss ? 'Boss' : 'New', { cls: 'tag' })}
      ${cardPicture(id, foe)}
      ${kit.parch(`<h2>${c.name}</h2><p>${c.text}</p>`)}
      ${kit.button('Got it', { kind: 'gold', size: 'big', attrs: 'data-leave' })}
    </div>`);
  click(el, '[data-leave]', () => onDone(false));
  onActions((a) => (a === 'confirm' || a === 'cancel' || a === 'pause') && onDone(a === 'pause'));
}

const JUKEBOX_LAYERS = ['Sparse: a breather, the Merchant', 'Base: a wave', 'Second layer: a dense or dangerous fight', 'Boss: drums and a bass line'];
const JUKEBOX_STINGERS: [Stinger, string][] = [['tier', 'Relic tier-up'], ['set', 'Set bonus'], ['duo', 'Duo formed'], ['evolution', 'Evolution'], ['phase', 'Boss phase']];

/** v0.7.1 test mode (hidden): start a run at any Act, wave and arena with any champion, level, talents and relics (B5); and the music jukebox. */
export function showTestMode(setup: TestSetup, on: { start: (s: TestSetup) => void; play: (m: Mood) => void; stop: () => void; sting: (k: Stinger) => void; back: () => void }): void {
  const options = (items: [string, string][], chosen: string) => items.map(([v, label]) => `<option value="${v}" ${v === chosen ? 'selected' : ''}>${label}</option>`).join('');
  const arenas = (chosen: string) => options((Object.keys(ARENAS) as ArenaId[]).map((id) => [id, ARENAS[id].name]), chosen);
  const talents = (classId: ClassId) => TALENT_BRANCHES[classId].map((b) => `<div><b>${b.name}</b>${talentsFor(classId).filter((n) => n.branch === b.id).map((n) => `<label><input type="checkbox" value="${n.id}" ${setup.talents.includes(n.id) ? 'checked' : ''}> ${n.name}${n.keystone ? ' (keystone)' : ''}</label>`).join('')}</div>`).join('');
  const group = (label: string, ids: RelicId[]) => `<div><b>${label}</b>${ids.map((id) => `<label>${relicDef(id).icon} ${relicDef(id).name} <select data-relic="${id}">${options([['0', '–'], ['1', 'I'], ['2', 'II'], ['3', 'III']], String(setup.relics[id] ?? 0))}</select></label>`).join('')}</div>`;
  const relics = (classId: ClassId) => [...FAMILY_IDS.map((f) => group(`${FAMILIES[f].icon} ${FAMILIES[f].name}`, RELIC_IDS.filter((id) => relicDef(id).family === f && (relicDef(id).classId ?? classId) === classId))), group('☠ Cursed', CURSED_IDS)].join('');
  const el = show(kitScreen('testmode', 'Test mode', {
    back: 'data-back',
    sub: 'Test runs pay nothing and leave no trace: no gold, Runes, class XP, deeds, contracts or run history. The HUD says TEST.',
    body: `
      <h2>Start a run</h2>
      <div class="tm-grid">
        <label>Champion <select id="tm-class">${options(CLASS_ORDER.map((id) => [id, CLASSES[id].name]), setup.classId)}</select></label>
        <label>Arena <select id="tm-arena">${arenas(setup.arena)}</select></label>
        <label>Act <input id="tm-act" type="number" min="1" max="${FINAL.act}" value="${setup.act}"></label>
        <label>Wave <input id="tm-wave" type="number" min="1" max="${ACTS.length}" value="${setup.wave}"></label>
        <label>Level <input id="tm-level" type="number" min="1" max="60" value="${setup.level}"></label>
      </div>
      <div class="tm-talents" id="tm-talents">${talents(setup.classId)}</div>
      <h2>Relics</h2>
      <p class="hint">Held from the start, at the attunement tier chosen (III is awakened).</p>
      <div class="tm-talents" id="tm-relics">${relics(setup.classId)}</div>
      <h2>Sprite gallery</h2>
      <p class="hint">Every rigged sprite's animations, side by side at 2×, each on its own clock (#155).</p>
      ${Object.entries(SHEETS).map(([id, d]) => `<div class="tm-gallery"><b>${id}</b>${Object.keys(d.anims).map((a) => `<figure><canvas data-sheet="${id}" data-anim="${a}" width="${d.w * 2}" height="${d.h * 2}"></canvas><figcaption>${a}</figcaption></figure>`).join('')}</div>`).join('')}
      <h2>Music jukebox</h2>
      <div class="tm-grid">
        <label>Theme <select id="jb-arena">${arenas(setup.arena)}</select></label>
        <label>Layer <input id="jb-layer" type="range" min="0" max="3" step="1" value="1"></label><span id="jb-name"></span>
      </div>
      <div class="row">${kit.button('Play', { kind: 'go', attrs: 'data-play' })}${kit.button('Fork cue', { attrs: 'data-cue="fork"' })}${kit.button('Victory cue', { attrs: 'data-cue="victory"' })}${kit.button('Stop', { attrs: 'data-stop' })}</div>
      <div class="row">${JUKEBOX_STINGERS.map(([k, label]) => kit.button(label, { size: 'small', attrs: `data-sting="${k}"` })).join('')}</div>`,
    foot: kit.button('Start test run', { kind: 'gold', size: 'big', attrs: 'data-start' }), // #189: in the footer, always in reach
  }));
  const field = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)!;
  const num = (id: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(field(id).value)) || lo));
  field('tm-class').onchange = () => {
    field('tm-talents').innerHTML = talents(field('tm-class').value as ClassId);
    field('tm-relics').innerHTML = relics(field('tm-class').value as ClassId);
  };
  click(el, '[data-start]', () => on.start({
    classId: field('tm-class').value as ClassId, arena: field('tm-arena').value as ArenaId, act: num('tm-act', 1, FINAL.act), wave: num('tm-wave', 1, ACTS.length), level: num('tm-level', 1, 60),
    talents: [...el.querySelectorAll<HTMLInputElement>('#tm-talents input:checked')].map((i) => i.value),
    relics: Object.fromEntries([...el.querySelectorAll<HTMLSelectElement>('#tm-relics select')].filter((s) => s.value !== '0').map((s) => [s.dataset.relic, Number(s.value)])),
  }));
  // the jukebox: changes land on the next bar line, as in a run; a cue plays once, then the mood lets go of it
  let playing = false;
  const play = (cue: Cue | null = null) => {
    playing = true;
    on.play({ arena: field('jb-arena').value as ArenaId, layer: Number(field('jb-layer').value) as Layer, cue });
  };
  const label = () => (field('jb-name').textContent = JUKEBOX_LAYERS[Number(field('jb-layer').value)]);
  label();
  field('jb-layer').oninput = () => (label(), playing && play());
  field('jb-arena').onchange = () => playing && play();
  click(el, '[data-play]', () => play());
  click(el, '[data-cue]', (b) => {
    play(b.dataset.cue as Cue);
    const slider = field('jb-layer');
    setTimeout(() => slider.isConnected && playing && play(), 4000); // longer than any theme's bar
  });
  click(el, '[data-stop]', () => ((playing = false), on.stop()));
  click(el, '[data-sting]', (b) => {
    if (!playing) play();
    on.sting(b.dataset.sting as Stinger);
  });
  click(el, '[data-back]', on.back);
  onActions((a) => a === 'cancel' && on.back());
  // the gallery plays until the screen goes; a frame that hasn't loaded yet leaves its cell empty
  const cells = [...el.querySelectorAll<HTMLCanvasElement>('[data-sheet]')];
  const t0 = performance.now();
  const tick = (now: number) => {
    if (!el.isConnected) return;
    for (const c of cells) {
      const id = c.dataset.sheet!, anim = c.dataset.anim as AnimName;
      const f = frameAt(SHEETS[id].anims[anim]!, now - t0, true);
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      drawSheetFrame(ctx, id, anim, f, 2); // #168: uncached, so browsing every sheet doesn't fill the frame cache
      c.dataset.frame = String(f); // for the play test
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * v0.7.5 (#106): an error anywhere no longer freezes the game silently. Its own layer above every screen, so the screen under it stays
 * as it was; one at a time (an error every frame would stack them). The report is shown as text, for a bug report.
 */
export function showCrash(report: string): void {
  if (document.getElementById('crash')) return;
  const el = document.createElement('div');
  el.id = 'crash';
  el.innerHTML = kitScreen('crash', 'Something went wrong', {
    body: '<p>The game can go on. If this keeps happening, please send this with a bug report:</p><pre></pre>',
    foot: kit.button('Continue', { kind: 'gold', size: 'big', attrs: 'data-continue' }),
  });
  el.querySelector('pre')!.textContent = report;
  el.querySelector('[data-continue]')!.addEventListener('click', () => el.remove());
  document.body.append(el);
}
