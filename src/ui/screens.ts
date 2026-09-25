import { ABILITY_UPGRADES, type AbilityUpgradeId } from '../config/abilityUpgrades';
import { ACHIEVEMENTS, CATEGORIES, tierReward, type AchievementCategory, type AchievementDef } from '../config/achievements';
import { ARENA_IDS, ARENAS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, CLASSES, type ClassDef, type ClassId } from '../config/classes';
import { CURSE_IDS, CURSES, type CurseId } from '../config/curses';
import { FAMILIES, FAMILY_IDS, preferredFamilies, type Rarity, RELIC_IDS, RELIC_MAX_TIER, RELIC_WEIGHTS, relicDesc, TIER_NUMERALS } from '../config/relics';
import { actName, merchantPrice, type DailySetup, type MerchantItem } from '../logic/acts';
import { curseMultiplier } from '../logic/curses';
import { ACCOUNT_MILESTONES, BUILDING_IDS, BUILDINGS, MASTERY, META, RUNES, TIER_UNLOCK_WAVE, TIERS, VICTORY, type BuildingId, type MetaId } from '../config/economy';
import { CURSED, CURSED_IDS, DUO_IDS, DUOS, keyColor, keyIcon, keyName, relicDef, type DuoId, type RelicId, type RelicKey } from '../config/relics';
import { BLESSINGS, type BlessingId } from '../config/regions';
import { QUESTS, REWARDS, type QuestKind, type RewardKind } from '../config/quests';
import { TALENT_BRANCHES, TALENT_BY_ID, TALENTS, talentsFor, type BranchDef } from '../config/talents';
import { TRAIT_IDS, TRAITS, type TraitId } from '../config/traits';
import { ENEMIES } from '../config/enemies';
import { TREASURE_RULES, TREASURES, treasureDesc, type TreasureId } from '../config/treasures';
import { chainStep, followUpText, inText, nextFragmentBoss, rankFor } from '../logic/treasures';
import { UTILITIES, UTILITY_UPGRADES, type UtilityUpgradeId } from '../config/utility';
import { branchPoints, takenKeystone, talentBlocker } from '../logic/talents';
import { duoFamilies, familySets, halfAttunement, type RelicTiers } from '../logic/relics';
import { salvageValue, sellPrice } from '../systems/acts';
import { duoTip, esc, keyTip, recipeLines, relicClass, relicLine, relicTip, tierBadge } from './relicText';
import type { RelicOffer, RelicSource } from '../core/types';
import { dropStaleTooltip } from './tooltip';
import type { QualitySetting } from '../config/game';
import { MUSIC_LEVELS, type MusicLevel } from '../core/music';
import { STAT_KEYS, type StatKey, type Stats } from '../core/types';
import { onAction } from '../input';
import type { Action } from '../input/mapping';
import { earnedTier, earnedTitles, gateOf, lockedArenas, lockedCurses, rewardText as tierRewardText, tierOf, type EarnedTier } from '../logic/achievements';
import { accountLevel, buildingLevel, buildingOf, masteryBonus, masteryRank, metaCost, rankCap, rewardText } from '../logic/economy';
import { exportSave, saveFormatLabel, type EndlessEntry, type Save } from '../logic/save';
import type { SaveBackup } from '../core/storage';
import { exportRunLogs, type MarkKind, type RunLog } from '../logic/runlog';
import { ACT_THEMES, ACTS, FINAL } from '../config/acts';
import { ROUTE_FOCUS } from '../config/routes';
import type { Route } from '../logic/routes';
import { EVOLUTION_IDS, EVOLUTIONS, type EvolutionId } from '../config/evolutions';
import { requirementText } from '../logic/evolutions';
import { optionText, statLabel, type LevelUpOption } from '../logic/upgrades';
import { getSprite, SPRITE_PALETTES } from '../render/sprites';
import { OATHS } from '../config/oaths';
import { oathCap, oathReward } from '../logic/oaths';
import type { Goal } from '../logic/goals';
import type { Contract } from '../logic/contracts';
import type { WhatsNew } from '../logic/whatsNew';
import { GLOSSARY } from '../config/glossary';
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
/** A relic card: the tier it would be at after taking it (1 = new), its text at that tier, synergies with what is held. */
const relicCard = (id: RelicId, tier: number, held: RelicId[], attrs: string, extra = '') => {
  const r = relicDef(id);
  const fam = r.family ? `${FAMILIES[r.family].icon} ${FAMILIES[r.family].name}` : '☠ Cursed'; // v0.7.1 B6: a cursed card is purple and says so
  const upgrade = tier > 1;
  return `<button class="card panel boon relic-card ${relicClass(id)}" style="--fam:${keyColor(id)}" ${attrs} data-tip="${esc(relicTip(id, tier, held))}"><div class="relic-icon">${r.icon}${tierBadge(tier)}</div><h2>${r.name}</h2><div class="tag"><span class="fam">${fam}</span> · ${upgrade ? `tier ${TIER_NUMERALS[tier - 1]} → ${TIER_NUMERALS[tier]}` : r.cursed ? 'no family' : r.rarity}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''}</div><p>${relicDesc(id, tier)}</p>${extra}</button>`;
};

/** v0.7 A5: a duo as a gold card: it takes the moment's pick and counts toward both its families. */
const duoCard = (id: DuoId, attrs: string, extra = '') => {
  const d = DUOS[id];
  return `<button class="card panel boon evolution duo-card" ${attrs} data-tip="${esc(duoTip(id))}"><div class="relic-icon">${d.icon}</div><h2>${d.name}</h2><div class="tag">Duo · ${d.families.map((f) => `${FAMILIES[f].icon} ${FAMILIES[f].name}`).join(' + ')}</div><p>${d.desc}</p><div class="preview">From ${d.from.map((r) => relicDef(r).name).join(' + ')} · counts toward both families</div>${extra}</button>`;
};

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
  const el = show(`
    <div class="title">
      <h1>Last Bastion</h1>
      <div class="version">${info.label}${info.mobile ? ' <span class="badge">Mobile</span>' : ''}</div>
      ${info.whatsNew ? '<button class="btn small whatsnew-link" data-go="whatsNew">What’s new</button>' : ''}
      ${info.title ? `<div class="epithet">${info.title}</div>` : ''}
      <p class="sub">The walls have fallen silent. The courtyard has not.</p>
      ${info.notice ? `<div class="notice panel"><span>${info.notice.text}</span><button class="btn small" data-notice>${info.notice.button}</button></div>` : ''}
      <button class="btn big" data-go="start">Take up arms</button>
      <div class="row">
        ${info.daily.date ? `<button class="btn" data-go="daily">Daily Trial${info.daily.best ? ` · best ${info.daily.best}` : ''}</button>` : ''}
        <button class="btn" data-go="keep">The Keep · 🪙 ${info.gold}${info.runes ? ` · ◆ ${info.runes}` : ''}</button>
        <button class="btn" data-go="chronicle">Chronicle</button>
        <button class="btn" data-go="settings">Settings</button>
      </div>
      <div class="contracts panel"><b>This week's contracts</b> <span class="dim">· new ones every Monday · Runes when a run completes one</span>
        ${info.contracts.map((c) => `<div class="contract ${c.progress >= c.target ? 'done' : ''}"><span>${c.progress >= c.target ? '✔ ' : ''}${c.text}</span><span>${c.progress.toLocaleString('en')}/${c.target.toLocaleString('en')} · ◆ ${c.runes}</span></div>`).join('')}</div>
      <p class="hint">${info.mobile ? 'Left thumb moves · right thumb casts your signature ability (hold and drag to aim) · attacks are automatic' : 'WASD / arrows or gamepad to move · attacks are automatic · Space or right mouse for your signature ability · Esc / P to pause · M to mute'}</p>
      <p class="hint build">build ${info.buildDate}</p>
    </div>`);
  click(el, '[data-go]', (b) => on[b.dataset.go as keyof typeof on]());
  click(el, '[data-notice]', () => info.notice?.action());
  onActions((a) => a === 'confirm' && on.start());
}

export interface SettingsInfo {
  quality: QualitySetting;
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

export function showSettings(info: SettingsInfo, on: { quality: (q: QualitySetting) => void; mute: () => void; music: (level: MusicLevel) => void; effects: (level: MusicLevel) => void; runMusic: () => void; aim: (manual: boolean) => void; dev: () => void; testMode: () => void; perf: () => void; saveData: () => void; checkUpdates: () => void; prerelease: (v: boolean) => void; back: () => void }): void {
  const chip = (q: QualitySetting) => `<button class="chip ${info.quality === q ? 'on' : ''}" data-quality="${q}">${q[0].toUpperCase()}${q.slice(1)}</button>`;
  const el = show(`
    <div class="panel dialog wide settings">
      <h1 class="small">Settings</h1>
      <div class="setting"><div><b>Graphics quality</b><span>Low cuts particles, screen shake and shadows. Auto measures the first waves and drops to low if needed. Now: ${info.effective}.</span></div><div>${(['auto', 'low', 'high'] as const).map(chip).join('')}</div></div>
      <div class="setting"><div><b>Sound</b><span>Synthesised effects and music (M).</span></div><button class="chip on" data-act="mute">${info.muted ? 'Off' : 'On'}</button></div>
      <div class="setting"><div><b>Music</b><span>Composed live. In a run it plays quieter, under the effects.${info.muted ? ' Silent while Sound is off.' : ''}</span></div><div>${MUSIC_LEVELS.map((l) => `<button class="chip ${info.music === l ? 'on' : ''}" data-music="${l}">${l[0].toUpperCase()}${l.slice(1)}</button>`).join('')}</div></div>
      <div class="setting"><div><b>Music during runs</b><span>A quiet theme for every arena that builds a little in a fight.</span></div><button class="chip ${info.runMusic ? 'on' : ''}" data-act="runMusic">${info.runMusic ? 'On' : 'Off'}</button></div>
      <div class="setting"><div><b>Effects</b><span>How loud the sound effects are.</span></div><div>${MUSIC_LEVELS.map((l) => `<button class="chip ${info.effects === l ? 'on' : ''}" data-effects="${l}">${l[0].toUpperCase()}${l.slice(1)}</button>`).join('')}</div></div>
      <div class="setting"><div><b>Aim</b><span>Auto: basic attacks pick their own target. Manual: they go where the mouse or right stick points. Touch always aims itself.</span></div><div><button class="chip ${info.manualAim ? '' : 'on'}" data-aim="auto">Auto</button><button class="chip ${info.manualAim ? 'on' : ''}" data-aim="manual">Manual</button></div></div>
      <div class="setting"><div><b>Performance overlay</b><span>Frame, update and render times, entity counts, draw calls (F3 in a run).</span></div><button class="chip ${info.perf ? 'on' : ''}" data-act="perf">${info.perf ? 'On' : 'Off'}</button></div>
      ${info.desktop ? `
      <div class="setting"><div><b>Updates</b><span>Version ${info.desktop.version}. ${info.desktop.status}</span></div><button class="chip" data-act="check">Check for updates</button></div>
      <div class="setting"><div><b>Beta versions</b><span>Also install pre-releases.</span></div><button class="chip ${info.desktop.prerelease ? 'on' : ''}" data-act="pre">${info.desktop.prerelease ? 'On' : 'Off'}</button></div>` : ''}
      <div class="setting"><div><b>Save data</b><span>Export, import or reset your progress.</span></div><button class="chip" data-act="save">Open</button></div>
      ${info.dev ? '<div class="setting"><div><b>Test mode</b><span>Start a run anywhere and hear every arena’s music. Test runs pay nothing and leave no trace.</span></div><button class="chip" data-act="test">Open</button></div>' : ''}
      <button class="btn" data-act="back">Back</button>
      <p class="hint" data-version>Version ${info.version}</p>
    </div>`);
  let taps = 0;
  click(el, '[data-version]', () => ++taps === 5 && !info.dev && on.dev());
  click(el, '[data-quality]', (b) => on.quality(b.dataset.quality as QualitySetting));
  click(el, '[data-music]', (b) => on.music(b.dataset.music as MusicLevel));
  click(el, '[data-effects]', (b) => on.effects(b.dataset.effects as MusicLevel));
  click(el, '[data-aim]', (b) => on.aim(b.dataset.aim === 'manual'));
  click(el, '[data-act]', (b) => {
    const act = b.dataset.act;
    if (act === 'mute') on.mute();
    else if (act === 'perf') on.perf();
    else if (act === 'runMusic') on.runMusic();
    else if (act === 'test') on.testMode();
    else if (act === 'check') on.checkUpdates();
    else if (act === 'pre') on.prerelease(!info.desktop?.prerelease);
    else if (act === 'save') on.saveData();
    else on.back();
  });
  onActions((a) => (a === 'cancel' || a === 'pause') && on.back());
}

export function showClassSelect(save: Save, on: { pick: (id: ClassId, seed: string) => void; back: () => void; settings: (arena: ArenaId, tier: number) => void; curse: (id: CurseId) => void; trait: (id: TraitId) => void; palette: (id: ClassId, n: number) => void; treasure: (id: ClassId) => void; oath: (level: number) => void }): void {
  const locked = lockedArenas(save);
  // v0.6 Oath ladder: open once any class has won; each class swears at most one above the highest it has kept
  const oathMax = Math.max(...CLASS_ORDER.map((id) => oathCap(save.wins[id], save.oaths[id])));
  const oathOf = (id: ClassId) => Math.min(save.settings.oath, oathCap(save.wins[id], save.oaths[id]));
  const sworn = save.settings.oath > 0 && oathMax > 0;
  const card = (c: ClassDef) => {
    const rec = save.classes[c.id];
    const rank = masteryRank(rec.xp);
    const next = MASTERY[rank];
    const palettes = [...new Set([...masteryBonus(rec.xp).palettes, ...save.palettes])].sort(); // mastery's own plus the account-wide ones from deeds
    const chosen = save.settings.palettes[c.id] ?? 0;
    const swatches = palettes.length ? `<div class="swatches">${[0, ...palettes].map((n) => `<span class="swatch ${chosen === n ? 'on' : ''}" data-palette="${c.id}:${n}" data-tip="${['As drawn', 'Ashen colours', 'Gilded colours', 'Midnight colours'][n]}"><i style="filter:${SPRITE_PALETTES[n] || 'none'}"></i></span>`).join('')}</div>` : '';
    // v0.5: the sacred treasure, once earned: on (taken into the run) or off
    const t = TREASURES[c.id];
    const tr = save.treasures[c.id];
    const treasure = tr.tier ? `<span class="chip treasure-chip ${tr.equipped ? 'on' : ''}" data-treasure="${c.id}" data-tip="${esc(`${tr.equipped ? 'Equipped' : 'Left in the Keep'} — tap to switch.\n${treasureDesc(c.id, tr.tier)}`)}">${t.icon} ${t.name} ${TIER_NUMERALS[tr.tier]}</span>` : '';
    return `
    <button class="card panel" data-class="${c.id}">
      <div class="portrait" data-sprite="${c.sprite}" data-palette-n="${palettes.includes(chosen) ? chosen : 0}"></div>${swatches}
      <h2${c.name.length > 9 ? ' class="long"' : ''}>${c.name}</h2>
      <div class="role">${c.role}</div>
      <div class="stats">
        ${STAT_KEYS.map((k) => `<div><span>${statLabel(k, c)}</span><b>${fmtStat(k, c.base[k])}</b></div>`).join('')}
      </div>
      <div class="ability"><b class="gold">${c.ability.name}</b><p>${c.ability.desc}</p></div>
      <div class="ability"><b class="gold">${c.secondary.name}</b><p>${c.secondary.desc}</p></div>
      ${treasure}
      <div class="fam-line" data-tip="${esc(`Can max these relic families: ${preferredFamilies(c.id).map((f) => FAMILIES[f].name).join(', ')}. Every family is open to every class; these reach their 6-set with straight pieces.`)}">Families: ${preferredFamilies(c.id).map((f) => `<span style="color:${FAMILIES[f].color}">${FAMILIES[f].icon} ${FAMILIES[f].name}</span>`).join(' ')}</div>
      ${save.wins[c.id] ? `<div class="oath-line">⚜ ${save.oaths[c.id] ? `Oath ${save.oaths[c.id]} kept` : 'No Oath kept yet'}${sworn ? ` · this run: <b>${oathOf(c.id) ? `Oath ${oathOf(c.id)}` : 'custom'}</b>` : ''}</div>` : ''}
      <div class="best">${save.wins[c.id] ? `👑 ${save.wins[c.id]} win${save.wins[c.id] > 1 ? 's' : ''} · ` : ''}${rec.bestWave ? `Best: wave ${rec.bestWave}` : 'Not yet attempted'} · Mastery ${rank}/${MASTERY.length}${next ? ` <span class="dim">(${Math.round(rec.xp)}/${next.xp})</span>` : ''}</div>
    </button>`;
  };
  const arenaBtn = (id: ArenaId) => {
    const a = ARENAS[id];
    const gate = locked.includes(id) ? gateOf({ arena: id }) : undefined;
    return `<button class="chip ${save.settings.arena === id ? 'on' : ''}" data-arena="${id}" ${gate ? 'disabled' : ''} data-tip="${gate ? `Locked — ${gate.desc}` : `${a.desc} ${a.feature}`}">${gate ? '🔒 ' : ''}${a.name}</button>`;
  };
  const tierBtn = (i: number) => {
    const t = TIERS[i];
    const lockedTier = i > save.tierUnlocked || i > buildingLevel(save.buildings, 'watchtower');
    const tip = i > save.tierUnlocked ? `Locked — clear wave ${TIER_UNLOCK_WAVE} on ${TIERS[i - 1].name}` : lockedTier ? `Locked — raise the Watchtower to level ${i}` : `Enemy HP ×${t.enemyHp}, damage ×${t.enemyDmg}, elites ×${t.eliteMult} · gold ×${t.gold}, class XP ×${t.classXp}`;
    return `<button class="chip ${save.settings.tier === i ? 'on' : ''}" data-tier="${i}" ${lockedTier ? 'disabled' : ''} data-tip="${tip}">${lockedTier ? '🔒 ' : ''}${t.name}</button>`;
  };
  const lockedC = lockedCurses(save);
  const curseBtn = (id: CurseId) => {
    const c = CURSES[id];
    const gate = lockedC.includes(id) ? gateOf({ curse: id }) : undefined;
    const tip = gate ? `Locked — ${gate.desc}` : `${c.desc} +${Math.round(c.bonus * 100)}% gold and class XP.`;
    return `<button class="chip curse ${save.settings.curses.includes(id) && !sworn ? 'on' : ''}" data-curse="${id}" ${gate || sworn ? 'disabled' : ''} data-tip="${sworn ? 'An Oath brings its own curses. Free curses are for custom runs.' : tip}">${gate ? '🔒 ' : ''}${c.name}</button>`;
  };
  const traitBtn = (id: TraitId) => {
    const t = TRAITS[id];
    const need = t.unlock.achievement ? ACHIEVEMENTS.find((a) => a.id === t.unlock.achievement) : undefined;
    const lockedT = need !== undefined && !save.achievements.includes(need.id);
    const tip = lockedT ? `Locked — ${need!.name}: ${need!.desc}` : t.desc;
    return `<button class="chip trait ${save.settings.trait === id || (id !== 'none' && save.settings.trait2 === id) ? 'on' : ''}" data-trait="${id}" ${lockedT ? 'disabled' : ''} data-tip="${esc(tip)}">${lockedT ? '🔒 ' : `${t.icon} `}${t.name}</button>`;
  };
  const el = show(`
    <div class="select">
      <h1 class="small">Choose your champion</h1>
      <div class="pickers">
        <div><span class="label">Arena</span>${ARENA_IDS.map(arenaBtn).join('')}</div>
        <div><span class="label">Difficulty</span>${TIERS.map((_, i) => tierBtn(i)).join('')}</div>
      </div>
      <div class="pickers curses">
        <div><span class="label">Curses</span>${CURSE_IDS.map(curseBtn).join('')}
          <span class="mult" data-tip="Every curse adds to the gold and class XP this run earns.">gold &amp; XP ×${curseMultiplier(save.settings.curses).toFixed(2)}</span></div>
        <div><span class="label">Seed</span><input id="seed" maxlength="24" placeholder="random" autocomplete="off" spellcheck="false" data-tip="Type a seed from a results screen to replay that run." /></div>
      </div>
      <div class="pickers traits"><div><span class="label">Trait</span>${TRAIT_IDS.map(traitBtn).join('')}</div></div>
      ${oathMax ? `<div class="pickers oath"><div><span class="label">Oath</span>
        <button class="chip" data-oath="${save.settings.oath - 1}" ${save.settings.oath <= 0 ? 'disabled' : ''}>−</button>
        <b class="gold" data-tip="${esc(save.settings.oath ? OATHS.slice(0, save.settings.oath).map((o, i) => `${i + 1}. ${o.name}: ${o.desc}`).join('\n') : 'A custom run: choose your own curses.')}">${save.settings.oath ? `Oath ${save.settings.oath}: ${OATHS[save.settings.oath - 1].name}` : 'No Oath (custom run)'}</b>
        <button class="chip" data-oath="${save.settings.oath + 1}" ${save.settings.oath >= oathMax ? 'disabled' : ''}>+</button>
        <span class="hint">${save.settings.oath ? `${OATHS[save.settings.oath - 1].desc} Every Oath below it holds too. A class that has not kept Oath ${save.settings.oath - 1} swears its highest.` : 'Win with a class to swear its first Oath. Every level adds one hardship; keeping one pays.'}</span></div></div>` : ''}
      <div class="cards">${CLASS_ORDER.map((id) => card(CLASSES[id])).join('')}</div>
      <button class="btn" data-back>Back</button>
    </div>`);
  el.querySelectorAll<HTMLElement>('[data-sprite]').forEach((slot) => slot.appendChild(getSprite(slot.dataset.sprite as ClassDef['sprite'], 6, Number(slot.dataset.paletteN ?? 0)).img));
  el.querySelectorAll<HTMLElement>('[data-palette]').forEach((sw) => (sw.onclick = (e) => {
    e.stopPropagation(); // the card underneath would start the run
    const [cls, n] = sw.dataset.palette!.split(':');
    on.palette(cls as ClassId, Number(n));
  }));
  el.querySelectorAll<HTMLElement>('[data-treasure]').forEach((chip) => (chip.onclick = (e) => {
    e.stopPropagation(); // the card underneath would start the run
    on.treasure(chip.dataset.treasure as ClassId);
  }));
  click(el, '[data-class]', (b) => on.pick(b.dataset.class as ClassId, el.querySelector<HTMLInputElement>('#seed')!.value));
  click(el, '[data-curse]', (b) => on.curse(b.dataset.curse as CurseId));
  click(el, '[data-trait]', (b) => on.trait(b.dataset.trait as TraitId));
  click(el, '[data-oath]', (b) => on.oath(Number(b.dataset.oath)));
  click(el, '[data-arena]', (b) => on.settings(b.dataset.arena as ArenaId, save.settings.tier));
  click(el, '[data-tier]', (b) => on.settings(save.settings.arena, Number(b.dataset.tier)));
  click(el, '[data-back]', on.back);
}

export function showKeep(save: Save, on: { buy: (id: MetaId) => void; raise: (id: BuildingId) => void; mastery: (id: ClassId) => void; compendium: () => void; chronicle: () => void; treasures: () => void; history: () => void; glossary: () => void; back: () => void }): void {
  const row = (id: MetaId) => {
    const m = META[id];
    const rank = save.meta[id] ?? 0;
    const cap = rankCap(id, save.buildings);
    const cost = metaCost(id, rank, save.buildings);
    const pips = Array.from({ length: m.max }, (_, i) => `<i class="${i < rank ? 'on' : i < cap ? '' : 'capped'}"></i>`).join('');
    const btn = rank >= m.max ? '<span class="maxed">Maxed</span>' : cost === null ? `<span class="maxed" data-tip="Raise the ${BUILDINGS[buildingOf(id)].name} to buy further ranks">Level cap</span>`
      : `<button class="btn small" data-buy="${id}" ${save.gold < cost.gold || save.runes < cost.runes ? 'disabled' : ''}>🪙 ${cost.gold}${cost.runes ? ` · ◆ ${cost.runes}` : ''}</button>`;
    return `<div class="meta-row"><div><b>${m.name}</b><span>${m.desc}</span></div><div class="pips">${pips}</div>${btn}</div>`;
  };
  const building = (id: BuildingId) => {
    const b = BUILDINGS[id];
    const level = buildingLevel(save.buildings, id);
    const next = b.levels[level];
    const gate = next?.achievement ? tierOf(next.achievement) : undefined; // a deed may name a tier ("wave20:2")
    const deed = gate && { name: gate.tier > 1 ? `${gate.def.name} ${TIER_NUMERALS[gate.tier]}` : gate.def.name, desc: gate.def.desc };
    const deedDone = !next?.achievement || save.achievements.includes(next.achievement);
    const can = next && deedDone && save.gold >= next.gold && save.runes >= next.runes;
    const raise = !next ? '<span class="maxed">Fully raised</span>'
      : `<button class="btn small" data-raise="${id}" ${can ? '' : 'disabled'} data-tip="${esc(`Level ${level + 1}: 🪙 ${next.gold} · ◆ ${next.runes}${deed ? `\nDeed: ${deed.name} — ${deed.desc}${deedDone ? ' ✔' : ''}` : ''}`)}">Raise · 🪙 ${next.gold} · ◆ ${next.runes}${deed && !deedDone ? ' · 🔒' : ''}</button>`;
    const pips = b.levels.map((_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
    return `<div class="building panel"><div class="bhead"><b>${b.icon} ${b.name}</b><span class="pips">${pips}</span>${raise}</div><p class="hint">${b.desc}${deed && !deedDone ? ` · next deed: <em>${deed.name}</em>` : ''}</p>
      <div class="meta">${b.upgrades.map(row).join('')}</div></div>`;
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
    <div class="panel dialog wide keep">
      <h1 class="small">The Keep</h1>
      <p class="sub">Treasury: <b>🪙 ${save.gold}</b> · <b>◆ ${save.runes}</b> Runes${save.runeShards ? ` <span class="dim">(${save.runeShards}/${RUNES.shardsPerRune} shards)</span>` : ''} — gold buys ranks, Runes (from Act bosses, quests and deeds) raise buildings and the top ranks</p>
      ${save.refund ? `<p class="hint">${(save.refund.version ?? 'v0.6').split(',').map((v) => REFUND_NOTES[v] ?? '').join(' ')} What those ranks cost came back: <b>🪙 ${save.refund.gold}${save.refund.runes ? ` and ◆ ${save.refund.runes}` : ''}</b>.</p>` : ''}
      <div class="buildings">${BUILDING_IDS.map(building).join('')}</div>
      <h2>Class mastery · account level ${level}</h2>
      <p class="hint">Earned by playing a class: waves cleared, bosses slain, levels gained, times the difficulty tier. Every rank unlocks something; tap a class for its track.
        ${nextMilestone ? `Account level ${nextMilestone.level}: <em>${nextMilestone.name}</em> — ${nextMilestone.desc}.` : 'Every account milestone reached.'}</p>
      <div class="masteries">${mastery}</div>
      <div class="milestones">${ACCOUNT_MILESTONES.map((m) => `<span class="${level >= m.level ? 'on' : ''}" data-tip="${esc(m.desc)}">${level >= m.level ? '✔ ' : ''}${m.level} ${m.name}</span>`).join('')}</div>
      <div class="row"><button class="btn" data-compendium>Relic compendium</button><button class="btn" data-treasures>Sacred treasures</button><button class="btn" data-chronicle>Chronicle</button><button class="btn" data-history>Run history</button><button class="btn" data-glossary>Glossary</button></div>
      <button class="btn" data-back>Back</button>
    </div>`);
  click(el, '[data-chronicle]', on.chronicle);
  click(el, '[data-history]', on.history);
  click(el, '[data-glossary]', on.glossary);
  click(el, '[data-buy]', (b) => on.buy(b.dataset.buy as MetaId));
  click(el, '[data-raise]', (b) => on.raise(b.dataset.raise as BuildingId));
  click(el, '[data-mastery]', (b) => on.mastery(b.dataset.mastery as ClassId));
  click(el, '[data-compendium]', on.compendium);
  click(el, '[data-treasures]', on.treasures);
  click(el, '[data-back]', on.back);
  onActions((a) => (a === 'cancel' || a === 'pause') && on.back());
}

const MARK_ICONS: Record<MarkKind, string> = { level: '', relic: '💠', talent: '🌿', upgrade: '⬆️', board: '📜', quest: '✔️', event: '❗', shrine: '⛩️', boss: '💀', phase: '⚜️', evolution: '🌟', merchant: '🪙', route: '🧭', act: '🚩', stand: '❤️‍🔥', bored: '😴', attune: '✴️' };
const MARK_NAMES: Record<MarkKind, string> = { level: 'Level', relic: 'Relic', talent: 'Talent', upgrade: 'Upgrade', board: 'Quest board', quest: 'Quest done', event: 'Event', shrine: 'Shrine', boss: 'Boss slain', phase: 'Boss', evolution: 'Evolution', merchant: 'Merchant', route: 'Route', stand: 'Last Stand', act: 'New Act', bored: 'Bored here', attune: 'Relic attuned' };

/** v0.6: one run's timeline: a band per wave (width = how long it took), level-ups as ticks, everything else as icons above it. */
function timeline(r: RunLog): string {
  const at = (t: number) => `${((t / Math.max(1, r.time)) * 100).toFixed(2)}%`;
  const waves = r.waves.map(([start, end, dmg, quiet], i) => {
    const w = i + 1;
    const took = (end || r.time) - start;
    return `<i class="tw act${Math.floor(i / ACTS.length) % 2} ${w % 5 === 0 ? 'boss' : ''}" style="left:${at(start)};width:${at(took)}" data-tip="${esc(`Wave ${w} · ${fmtTime(took)}${end ? '' : ' (not cleared)'} · ${dmg} damage taken · ${Math.round(quiet)} s with under 5 enemies`)}"></i>`;
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
    return `<div class="run panel">
      <div class="rhead"><b>${CLASSES[r.classId].name}</b><span>${TIERS[r.tier]?.name ?? ''} · ${ARENAS[r.arena].name}${r.daily ? ` · Daily Trial ${r.daily}` : ''}</span><span class="dim">${when}</span></div>
      <div class="rstats">${actName(Math.max(1, Math.ceil(r.wave / ACTS.length)))} · wave ${r.wave} · ${fmtTime(r.time)} · level ${r.level} · ${r.kills} kills · ${r.end === 'slain' ? `slain by ${esc(r.cause || 'something unseen')}` : 'ended from the pause menu'}</div>
      ${timeline(r)}
      <div class="rbuild">${trait ? `<span>${trait}</span>` : ''}<span class="rrelics">${relics || '<em class="dim">no relics</em>'}</span></div>
      ${talents || ups ? `<p class="hint">${[talents && `🌿 ${talents}`, ups && `⬆️ ${ups}`].filter(Boolean).join('<br>')}</p>` : ''}
    </div>`;
  };
  const el = show(`
    <div class="panel dialog wide history">
      <h1 class="small">Run history</h1>
      <p class="sub">${runs.length ? `The last ${runs.length} run${runs.length > 1 ? 's' : ''} · on average ${fmtTime(avg((r) => r.time))} and wave ${avg((r) => r.wave).toFixed(1)}${bored ? ` · ${bored} bored mark${bored > 1 ? 's' : ''}` : ''}` : 'No runs logged yet. Every run from v0.6 on is kept here (the last 50).'}</p>
      <p class="hint">Each band is a wave, as wide as it lasted (darker: a boss wave); the small ticks are level-ups. Hover or tap anything for details. F8 in a run (or the pause menu) marks a moment you were bored.</p>
      ${[...runs].reverse().map(row).join('')}
      <div class="row">${runs.length ? '<button class="btn" data-export>Export as JSON</button>' : ''}<button class="btn" data-back>Back</button></div>
    </div>`);
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
  const el = show(`
    <div class="panel dialog wide treasures">
      <h1 class="small">Sacred treasures</h1>
      <p class="sub">One for every champion, earned over many runs, kept forever. Take it into a run from the champion select screen.</p>
      ${order.map(block).join('')}
      <button class="btn" data-back>Back</button>
    </div>`);
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack());
}

/** A class's full 25-rank mastery track: every rank's name and unlock, reached or not. */
export function showMastery(save: Save, classId: ClassId, onBack: () => void): void {
  const xp = save.classes[classId].xp;
  const rank = masteryRank(xp);
  const rows = MASTERY.map((r, i) => `<div class="rank ${i < rank ? 'on' : ''}"><b>${i + 1}</b><span>${r.name}</span><em>${rewardText(r.reward)}</em><i>${i < rank ? '✔' : `${r.xp} XP`}</i></div>`).join('');
  const el = show(`
    <div class="panel dialog wide">
      <h1 class="small">${CLASSES[classId].name} mastery</h1>
      <p class="sub">Rank ${rank} / ${MASTERY.length} · ${Math.round(xp)} class XP${rank < MASTERY.length ? ` · next at ${MASTERY[rank].xp}` : ''}</p>
      <div class="ranks">${rows}</div>
      <button class="btn" data-back>Back</button>
    </div>`);
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
  const chip = (key: 'cat' | 'state', value: string, label: string) => `<button class="chip ${chronicleView[key] === value ? 'on' : ''}" data-filter="${key}:${value}">${label}</button>`;
  const titles = earnedTitles(save);
  const titleChips = onEquip
    ? `<div class="titles">${[`<button class="chip ${save.title === null ? 'on' : ''}" data-equip="">Bare name</button>`, ...titles.map((t) => `<button class="chip ${save.title === t ? 'on' : ''}" data-equip="${esc(t)}">${t}</button>`)].join('')}</div>`
    : '';
  const records = CLASS_ORDER.map((id) => save.classes[id]);
  const favorite = (Object.entries(save.relicPicks) as [RelicId, number][]).sort((a, b) => b[1] - a[1])[0];
  const rows = CLASS_ORDER.map((id) => {
    const c = save.classes[id];
    return `<tr><td>${CLASSES[id].name}</td><td>${c.bestWave}</td><td>${c.kills}</td><td>${c.runs}</td><td>${fmtTime(c.time)}</td><td>${masteryRank(c.xp)}</td></tr>`;
  }).join('');
  const el = show(`
    <div class="panel dialog wide">
      <h1 class="small">Chronicle</h1>
      <h2>Deeds — ${save.achievements.length} / ${TOTAL_TIERS} tiers</h2>
      <div class="filters">
        <div>${chip('cat', 'all', 'All')}${(Object.keys(CATEGORIES) as AchievementCategory[]).map((c) => chip('cat', c, CATEGORIES[c])).join('')}</div>
        <div>${chip('state', 'all', 'Everything')}${chip('state', 'earned', 'Earned')}${chip('state', 'progress', 'In progress')}${chip('state', 'hidden', 'Secrets')}</div>
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
      </div>
      <button class="btn" data-back>Back</button>
    </div>`);
  click(el, '[data-filter]', (b) => {
    const [key, value] = b.dataset.filter!.split(':');
    Object.assign(chronicleView, { [key]: value });
    again();
  });
  click(el, '[data-equip]', (b) => onEquip?.(b.dataset.equip || null));
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack());
}

export function showSaveDialog(save: Save, on: { import: (text: string) => boolean; reset: () => void; back: () => void; backups: SaveBackup[]; restore: (b: SaveBackup) => void }): void {
  const el = show(`
    <div class="panel dialog wide">
      <h1 class="small">Save data</h1>
      <p class="hint">Copy this text somewhere safe to back up your progress. To restore, paste a save here and press Import.</p>
      <textarea id="save-text" spellcheck="false"></textarea>
      <div id="save-msg" class="hint">&nbsp;</div>
      <div class="row">
        <button class="btn" data-act="copy">Copy</button>
        <button class="btn" data-act="import">Import</button>
        <button class="btn danger" data-act="reset">Reset all progress</button>
        <button class="btn" data-act="back">Back</button>
      </div>
      ${on.backups.length ? `<h2>Restore previous version</h2>
      <p class="hint">Before a new version changes your save, the old one is kept here (the last ${on.backups.length === 1 ? 'one' : on.backups.length}). Restoring replaces your current progress; the current save is kept as a backup in turn.</p>
      <div class="row">${on.backups.map((b, i) => `<button class="btn small" data-restore="${i}">${new Date(b.at).toLocaleString()} · ${saveFormatLabel(b.version)}</button>`).join('')}</div>` : ''}
    </div>`);
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
    } else if (act === 'import') msg.textContent = on.import(area.value) ? 'Save imported.' : 'That is not a valid Last Bastion save.';
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
      <h1 class="small">Level ${level}</h1>
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
      <button class="btn" data-reroll ${canReroll ? '' : 'disabled'}>Reroll (R) — ${reroll.free > 0 ? `${reroll.free} free` : `🪙 ${reroll.cost}`}</button>
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
const MOMENT_TITLES: Record<RelicSource, string> = { boss: 'Spoils of the fallen', lair: "The lair's hoard", strongbox: 'A strongbox', quest: 'A reward for your quest', merchant: "The merchant's pick", start: "The Armorer's choice", other: 'A relic' };

/**
 * v0.7: a relic moment: pick one of three, reroll the three (a moment's rerolls are few), or skip it for gold and a Rune shard. Each card says
 * what the relic would do for this build right now (`preview`) and which evolution recipes it belongs to.
 */
export function showRelicOffer(
  offer: RelicOffer, held: RelicId[], tiers: RelicTiers, info: { skip: { gold: number; shards: number }; preview: (id: RelicId) => string[] },
  on: { take: (id: RelicId | DuoId) => void; skip: () => void; reroll: () => void },
): void {
  const { options } = offer;
  const el = show(`
    <div class="levelup">
      <h1 class="small">${MOMENT_TITLES[offer.from]}</h1>
      <p class="sub">Choose a relic · ${held.length} carried</p>
      <div class="cards">${options.map((id, i) => relicCard(id, (tiers[id] ?? 0) + 1, held, `data-pick="${i}"`, `<div class="num">${i + 1}</div>${[...info.preview(id), ...recipeLines({ relic: id })].map((l) => `<div class="preview">${esc(l)}</div>`).join('')}`)).join('')}${offer.duo ? duoCard(offer.duo, `data-pick="${options.length}"`, `<div class="num">${options.length + 1}</div>`) : ''}</div>
      <div class="row">
        <button class="btn" data-reroll ${offer.rerolls > 0 ? '' : 'disabled'}>Reroll (R) · ${offer.rerolls} left</button>
        <button class="btn" data-skip data-tip="Take nothing from this moment: gold for this run and a Rune shard for the Keep">Skip · 🪙 ${info.skip.gold} · ◆ ${info.skip.shards} shard</button>
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
      <h1 class="small">⛩️ An old shrine</h1>
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
      <h1 class="small">📜 ${actName(act)} · The quest board</h1>
      <p class="sub">Take up to ${take}. None of it is required: a failed quest costs nothing, and every one done opens a gate.</p>
      <div class="cards">${quests.map((q, i) => `<button class="card panel boon quest ${trial(i) ? 'special' : ''}" data-quest="${i}"><div class="num">${i + 1}</div><h2>${QUESTS[q.kind].icon} ${trial(i) ? q.name : QUESTS[q.kind].name}</h2>${trial(i) ? '<div class="tag">Sacred treasure · free, on top of the others</div>' : ''}<p>${q.desc ?? QUESTS[q.kind].desc}</p><div class="best" data-tip="${esc(REWARDS[q.reward].desc)}">${REWARDS[q.reward].icon} ${reward(q.reward)}</div></button>`).join('')}</div>
      <button class="btn big" data-leave></button>
    </div>`);
  const go = el.querySelector<HTMLElement>('[data-leave]')!;
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

/** v0.5: the wandering merchant (a wave event): a couple of relics rolled by the drop rules, at the Merchant's prices. */
export function showPeddler(info: { stock: number; price: number; gold: number; hurt: boolean }, on: { buy: () => void; leave: () => void }): void {
  const el = show(`
    <div class="levelup">
      <h1 class="small">🧺 A wandering merchant</h1>
      <p class="sub">"Good things, fair prices, no questions." Purse: <b class="goldtext">🪙 ${info.gold}</b> — what you spend here never reaches the Keep.</p>
      <div class="cards">${info.stock > 0 ? `<button class="card panel boon shop" data-buy="0" ${info.gold >= info.price && info.hurt ? '' : 'disabled'}><div class="num">1</div><h2>🧪 Healing draught</h2><p>${info.hurt ? 'Drink, and mend a good part of your wounds.' : 'You are not hurt.'}</p><div class="best">🪙 ${info.price}</div></button>` : '<p class="sub">Sold out.</p>'}</div>
      <button class="btn big" data-leave>Leave</button>
    </div>`);
  click(el, '[data-buy]', () => on.buy());
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
      <h1 class="small">${title}</h1>
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
  const el = show(`
    <div class="panel dialog wide talents">
      <h1 class="small">Talents</h1>
      <p class="sub">${info.points > 0 ? `<b>${info.points} point${info.points > 1 ? 's' : ''} to spend</b>` : 'No points to spend'} · a point every ${TALENTS.levelsPerPoint} levels · a keystone needs ${TALENTS.keystonePoints} points in its branch, and only one keystone${keystone ? ` (yours: ${keystone.name})` : ''}${info.rowCap < TALENTS.rows - 1 ? ' · <b>keystones open when the Library is raised in the Keep</b>' : ''}</p>
      <div class="tree">${branches.map(column).join('')}</div>
      <button class="btn big" data-back>Back</button>
    </div>`);
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
  const relics = info.relics.map((id) => {
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
  const duos = (info.duos ?? []).map((id) => `<div class="evolved"><span tabindex="0" data-tip="${esc(duoTip(id))}">${DUOS[id].icon} ${DUOS[id].name}</span><em>${DUOS[id].desc}</em></div>`).join('');
  const syns = Object.entries(familySets(info.relics, duoFamilies(info.duos ?? []))).map(([f, st]) => {
    const fam = FAMILIES[f as keyof typeof FAMILIES];
    const next = ([2, 4, 6] as const).find((l) => l > st.count);
    const reached = ([2, 4, 6] as const).filter((l) => st.level >= l).map((l) => `${fam.sets[l][0]}: ${fam.sets[l][1]}`).join(' ');
    return `<div class="syn ${st.level ? 'on' : ''}"><span>${fam.icon} ${fam.name} ${st.count}</span><em>${reached || 'no set bonus yet'}${next ? ` · next at ${next}: ${fam.sets[next][0]}` : ''}</em></div>`;
  }).join('');
  return relics || ups || trait || util || talents || sacred || evos ? `<div class="build">${evos}${sacred}${trait}${talents}${ups}${util}${relics}${duos}${syns}</div>` : '';
}

export function showPause(info: BuildInfo, on: { resume: () => void; quit: () => void; talents: () => void; treasures: () => void; glossary: () => void; bored: () => void }): void {
  const el = show(`
    <div class="panel dialog">
      <h1 class="small">Paused</h1>
      ${buildHtml(info)}
      <button class="btn big" data-resume>Resume</button>
      <button class="btn" data-talents>Talents${info.talentPoints > 0 ? ` (${info.talentPoints} to spend)` : ''}</button>
      <button class="btn" data-treasures>Sacred treasures</button>
      <button class="btn" data-glossary>Glossary</button>
      <div class="row">
        <button class="btn small" data-bored data-tip="Playtest aid: stamps this moment into the run log (Keep › Run history). F8 does the same without pausing.">😴 Bored here</button>
        <button class="btn" data-quit>End run (keeps your gold)</button>
      </div>
    </div>`);
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
  const title = deciding ? 'The Usurper has fallen' : r.endless ? (r.slain ? 'The Endless takes you' : 'The Endless ends') : r.won ? 'Victory' : r.slain ? 'Thou art slain' : 'The run ends';
  const winLine = r.won
    ? `<div class="earned"><span>${r.firstWin ? `First win with the ${r.cls.name}` : `Win ${r.wins} with the ${r.cls.name}`}</span><b>◆ +${VICTORY.win.runes + (r.firstWin ? VICTORY.firstWin.runes : 0)}${r.firstWin ? ` · 🪙 +${VICTORY.firstWin.gold}` : ''} · +${VICTORY.win.classXp + (r.firstWin ? VICTORY.firstWin.classXp : 0)} XP <em>(counted in the totals)</em></b></div>`
    : '';
  const oathLine = r.oathKept ? `<div class="earned"><span>Oath ${r.oathKept} kept for the first time</span><b>◆ +${oathReward(r.oathKept).runes} · 🪙 +${oathReward(r.oathKept).gold} <em>(counted in the totals)</em></b></div>` : '';
  const board = r.endless
    ? `<h2>Endless · ${r.cls.name}</h2><table class="stats-table endless"><tr><th>#</th><th>Score</th><th>Wave</th><th>Kills</th><th>Time</th></tr>${r.endless.board.map((e, i) => `<tr class="${i + 1 === r.endless!.rank ? 'on' : ''}"><td>${i + 1}</td><td>${e.score}</td><td>${e.wave}</td><td>${e.kills}</td><td>${fmtTime(e.time)}</td></tr>`).join('')}</table>`
    : '';
  const unlocks = [
    ...(r.tierUnlocked ? [`<div class="unlock">⚔ Difficulty unlocked: <b>${r.tierUnlocked}</b></div>`] : []),
    ...r.contracts.map((c) => `<div class="unlock">📜 Weekly contract done: <b>${c.text}</b> <em>◆ +${c.runes}</em></div>`),
    ...r.earned.map((e) => `<div class="unlock">🏆 <b>${e.def.name} · ${TIER_NAMES[e.tier - 1]}</b> — ${e.def.desc} <em>${tierRewardText(e.reward)}</em>${e.tier === 1 && e.def.unlocks?.arena ? ` <em>New arena: ${ARENAS[e.def.unlocks.arena].name}</em>` : ''}${e.tier === 1 && e.def.unlocks?.relic ? ` <em>New relic: ${relicDef(e.def.unlocks.relic).name}</em>` : ''}</div>`),
  ].join('');
  const el = show(`
    <div class="panel dialog ${r.won ? 'victory' : ''}">
      <h1 class="small ${r.won && !r.endless ? 'gold' : 'blood'}">${title}</h1>
      <p class="sub">${r.cls.name}${r.title ? `, <em>${r.title}</em>` : ''} · ${r.tier}${r.oath ? ` · Oath ${r.oath}` : ''}${r.newBest ? ' — <span class="gold">new record!</span>' : ''}${deciding ? '<br>Bank the win now, or march on into Endless: waves without end, for a score. Either way the win counts when the run is banked.' : ''}</p>
      ${deciding ? `<div class="row"><button class="btn big" data-endless>March on into Endless</button><button class="btn big" data-bank>Bank the win</button><button class="btn" data-restart data-tip="Bank the win and start again at once: ${esc(r.restart)}">Bank and restart</button></div>` : ''}
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
        <div class="earned"><span>Gold banked</span><b>🪙 +${r.gold}${r.goldRaw > r.gold ? ` <s>${r.goldRaw}</s>` : ''}</b></div>
        ${r.runes > 0 ? `<div class="earned"><span>Runes</span><b>◆ +${r.runes}</b></div>` : ''}
        <div class="earned"><span>${r.cls.name} mastery</span><b>+${r.classXp} XP · rank ${r.masteryRank}${r.masteryName ? ` — <em>${r.masteryName}</em>` : ''}</b></div>
        ${r.masteryNext ? `<div><span>Next mastery rank</span><b>${r.masteryNext.name} · ${r.masteryNext.need} XP to go</b></div>` : ''}
      </div>
      ${r.goals.length ? `<h2>Next</h2><div class="goals">${r.goals.map((g) => `<div class="goal"><span>${esc(g.text)}</span><div class="bar xp"><div style="width:${Math.round(g.frac * 100)}%"></div></div></div>`).join('')}</div>` : ''}
      ${r.relicShares.length ? `<h2>Relics</h2><table class="stats-table relics-table"><tr><th>Relic</th><th>Found</th><th>Damage</th><th>Healing</th><th>Mitigation</th></tr>${r.relicShares.map((s) => `<tr><td><span data-tip="${esc(keyTip(s.id, s.tier, r.relicShares.map((x) => x.id)))}">${keyIcon(s.id)} ${keyName(s.id)}${s.tier > 1 ? ` ${TIER_NUMERALS[s.tier]}` : ''}</span></td><td>${RELIC_SOURCE_NAMES[s.from]}</td><td>${s.damage ? `${s.damage}%` : '-'}</td><td>${s.healing ? `${s.healing}%` : '-'}</td><td>${s.mitigation ? `${s.mitigation}%` : '-'}</td></tr>`).join('')}</table><p class="hint">Each relic's share of all the damage you dealt, the healing you received and the damage turned away this run.</p>` : ''}
      ${unlocks ? `<div class="unlocks">${unlocks}</div>` : ''}
      ${board}
      ${buildHtml(r.build)}
      ${deciding ? '' : `<button class="btn big" data-retry data-tip="Enter">Quick restart · ${esc(r.restart)}</button><button class="btn" data-menu>Choose another champion</button>`}
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
    return `<button class="card panel boon route ${r.focus}" data-pick="${i}"><div class="num">${i + 1}</div><h2>${f.icon} ${f.name}</h2><div class="tag">${ARENAS[r.arena].name}</div>
      <p><b>${theme.name}</b> — ${theme.desc}</p><p>${f.desc}</p></button>`;
  };
  const el = show(`
    <div class="levelup routes">
      <h1 class="small">The road forks</h1>
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
}

/** Between Acts. Everything here costs run gold, and run gold is what you would otherwise bank for the Keep. */
export function showMerchant(info: MerchantInfo, on: { heal: () => void; buy: (r: Rarity) => void; reroll: (id: RelicId) => void; reforge: (id: RelicId) => void; sell: (id: RelicId) => void; salvage: (id: RelicId) => void; leave: () => void }): void {
  const price = (item: MerchantItem) => merchantPrice(item, info.act);
  const offer = (item: MerchantItem, attrs: string, title: string, text: string, enabled: boolean) =>
    `<button class="card panel boon shop" ${attrs} ${enabled && info.gold >= price(item) ? '' : 'disabled'}><h2>${title}</h2><p>${text}</p><div class="best">🪙 ${price(item)}</div></button>`;
  const held = info.relics.map((id) => {
    const tier = info.tiers[id] ?? 1;
    const fam = relicDef(id).family;
    const kept = halfAttunement(tier, info.attune[id] ?? 0);
    const forge = !fam ? 'A cursed relic has no family to reforge within' : !info.reforgeable.includes(id) ? `You carry every ${FAMILIES[fam].name} relic you can find` : `Swap it for a random other ${FAMILIES[fam].name} relic you do not carry, keeping half its attunement: tier ${TIER_NUMERALS[kept.tier]}${kept.attune > 0 ? `, ${Math.round(kept.attune * 100)}% toward ${TIER_NUMERALS[kept.tier + 1]}` : ''}`;
    return `<div class="held ${relicClass(id)}">${relicLine(id, tier, info.relics)}
      <button class="chip" data-reroll="${id}" ${info.gold >= price('reroll') ? '' : 'disabled'} data-tip="Swap it for a random ${relicDef(id).rarity} relic you do not carry, at the same tier">Reroll 🪙 ${price('reroll')}</button>
      <button class="chip" data-reforge="${id}" ${info.gold >= price('reforge') && info.reforgeable.includes(id) ? '' : 'disabled'} data-tip="${esc(forge)}">Reforge 🪙 ${price('reforge')}</button>
      <button class="chip" data-sell="${id}" data-tip="Sell it for gold${tier > 1 ? ' (every tier counts)' : ''}">Sell +🪙 ${sellPrice(id, tier, info.act)}</button>
      <button class="chip" data-salvage="${id}" data-tip="Break it into Rune shards: progress toward Runes, the Keep's second currency">Salvage +${salvageValue(id, tier)} ◆</button></div>`;
  }).join('');
  const el = show(`
    <div class="levelup merchant">
      <h1 class="small">${info.mid ? 'The Merchant’s caravan' : `${actName(info.act)} is won`}</h1>
      <p class="sub">${info.mid ? 'The Merchant path: his caravan has caught up with you.' : 'The Merchant waits by the gate.'} Purse: <b class="goldtext">🪙 ${info.gold}</b>${info.salvage > 0 ? ` · shards: <b>${info.salvage} ◆</b>` : ''} — what you spend here never reaches the Keep.</p>
      <div class="cards">
        ${offer('heal', 'data-heal', 'Field Surgeon', `Heal half your HP (${Math.ceil(info.hp)} / ${Math.round(info.maxHp)}).`, info.hp < info.maxHp)}
        ${(Object.keys(RELIC_WEIGHTS) as Rarity[]).map((r) => offer(`buy:${r}`, `data-buy="${r}"`, `${r[0].toUpperCase()}${r.slice(1)} relic`, info.relicsLeft > 0 ? `Choose one of three ${r} relics you do not carry. One relic a visit.` : 'He sells one relic a visit.', info.relicsLeft > 0)).join('')}
      </div>
      ${held ? `<div class="panel heldlist">${held}</div>` : ''}
      <button class="btn big" data-leave>March on</button>
    </div>`);
  click(el, '[data-heal]', on.heal);
  click(el, '[data-buy]', (b) => on.buy(b.dataset.buy as Rarity));
  click(el, '[data-reroll]', (b) => on.reroll(b.dataset.reroll as RelicId));
  click(el, '[data-reforge]', (b) => on.reforge(b.dataset.reforge as RelicId));
  click(el, '[data-sell]', (b) => on.sell(b.dataset.sell as RelicId));
  click(el, '[data-salvage]', (b) => on.salvage(b.dataset.salvage as RelicId));
  click(el, '[data-leave]', on.leave);
  onActions((a) => a === 'confirm' && on.leave());
}

/** The relic compendium in the Keep (v0.7): every relic by family, discovered or not, with its tiers and awakening, and each family's sets. */
export function showCompendium(save: Save, onBack: () => void): void {
  const found = (id: RelicId) => save.relicPicks[id] ?? 0;
  const card = (id: RelicId) => {
    const r = relicDef(id);
    const n = found(id);
    const who = r.classId ? ` · ${CLASSES[r.classId].name}` : '';
    if (n === 0) return `<div class="card panel boon relic-card undiscovered" style="--fam:${keyColor(id)}" data-tip="${esc(`Not found yet. A ${r.family ? `${r.rarity} ${FAMILIES[r.family].name}` : 'cursed'} relic${r.classId ? ` for the ${CLASSES[r.classId].name}` : ''}.`)}"><div class="relic-icon">?</div><h2>Unknown</h2><div class="tag">${r.rarity}${who}${save.newRelics.includes(id) ? ' · <b class="new">new in v0.7</b>' : ''}</div></div>`;
    const tiers = [1, 2].map((t) => `<div class="tierline"><b>${TIER_NUMERALS[t]}</b> ${relicDesc(id, t)}</div>`).join('');
    return `<div class="card panel boon relic-card ${relicClass(id)}" style="--fam:${keyColor(id)}"><div class="relic-icon">${r.icon}</div><h2>${r.name}</h2><div class="tag">${r.cursed ? 'cursed' : r.rarity}${who} · found ${n}×</div>${tiers}<div class="tierline"><b>III</b> <em>${r.awaken.name}</em>: ${r.awaken.desc}</div></div>`;
  };
  const family = (f: (typeof FAMILY_IDS)[number]) => {
    const fam = FAMILIES[f];
    const prefer = (fam.preferredBy as readonly string[]).map((c) => CLASSES[c as keyof typeof CLASSES].name).join(', ');
    return `<h2 style="color:${fam.color}">${fam.icon} ${fam.name}</h2><p class="hint">${fam.mechanic}. ${([2, 4, 6] as const).map((l) => `<b>${l} ${fam.sets[l][0]}</b>: ${fam.sets[l][1]}`).join(' ')} Can be maxed by: ${prefer}.</p>
      <div class="cards wrap">${RELIC_IDS.filter((id) => relicDef(id).family === f).map(card).join('')}</div>`;
  };
  const discovered = RELIC_IDS.filter((id) => found(id) > 0).length;
  const el = show(`
    <div class="panel dialog wide compendium">
      <h1 class="small">Relic compendium</h1>
      <p class="sub">${discovered} / ${RELIC_IDS.length} discovered · seven families; 2, 4 and 6 of a family unlock its set bonuses · a relic attunes as it works: tier II, then it awakens</p>
      ${FAMILY_IDS.map(family).join('')}
      <h2 style="color:${CURSED.color}">☠ Cursed</h2><p class="hint">No family and no set bonus, far stronger than any other relic, and each carries a curse; awakening it lifts the curse. At most one is offered an Act, as the purple third card of a wave boss or a lair.</p>
      <div class="cards wrap">${CURSED_IDS.map(card).join('')}</div>
      <h2>Duos · ${save.duos.length} / ${DUO_IDS.length} discovered</h2>
      <p class="hint">Hold both relics of a recipe and a relic moment offers the duo as a gold fourth card; it counts toward both families, and each relic feeds one duo. A discovered duo shows in full.</p>
      <div class="recipes">${DUO_IDS.map((id) => {
        const d = DUOS[id];
        const known = save.duos.includes(id);
        return `<div class="recipe ${known ? 'known' : ''}"><span>${known ? `${d.icon} ${d.name}` : '? Unknown duo'} <em>${d.families.map((f) => `${FAMILIES[f].icon} ${FAMILIES[f].name}`).join(' + ')}</em></span>${known ? `<p>${d.desc}</p>` : ''}<i>${d.from.map((r) => relicDef(r).name).join(' + ')}</i></div>`;
      }).join('')}</div>
      <h2>Evolutions · ${save.evolutions.length} / ${EVOLUTION_IDS.length} discovered</h2>
      <p class="hint">Three for each champion's signature ability, two for the second one. Meet both halves of a recipe in a run and the next level-up offers it as a gold card; one of each kind a run. A discovered recipe shows in full.</p>
      <div class="recipes">${CLASS_ORDER.map((c) => `<div class="recipe-class"><b>${CLASSES[c].name}</b>${EVOLUTION_IDS.filter((id) => EVOLUTIONS[id].classId === c).map((id) => {
        const e = EVOLUTIONS[id];
        const known = save.evolutions.includes(id);
        return `<div class="recipe ${known ? 'known' : ''}"><span>${known ? `${e.icon} ${e.name}` : '? Unknown evolution'} <em>${e.slot === 'signature' ? CLASSES[c].ability.name : UTILITIES[c].name}</em></span>${known ? `<p>${e.desc}</p>` : ''}<i>${e.requires.map((r) => requirementText(r, !known)).join(' + ')}</i></div>`;
      }).join('')}</div>`).join('')}</div>
      <button class="btn" data-back>Back</button>
    </div>`);
  click(el, '[data-back]', onBack);
}

export function showDaily(setup: DailySetup, best: number, onStart: () => void, onBack: () => void): void {
  const el = show(`
    <div class="panel dialog">
      <h1 class="small">Daily Trial</h1>
      <p class="sub">${setup.date} — the same trial for everyone today</p>
      <div class="stats wide">
        <div><span>Champion</span><b>${CLASSES[setup.classId].name}</b></div>
        <div><span>Arena</span><b>${ARENAS[setup.arena].name}</b></div>
        <div><span>Curses</span><b>${setup.curses.map((c) => CURSES[c].name).join(' · ')}</b></div>
        <div><span>Gold &amp; class XP</span><b>×${curseMultiplier(setup.curses).toFixed(2)}</b></div>
        <div><span>Your best today</span><b>${best ? `wave ${best}` : '—'}</b></div>
      </div>
      <button class="btn big" data-start>Begin the trial</button>
      <button class="btn" data-back>Back</button>
    </div>`);
  click(el, '[data-start]', onStart);
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'confirm' ? onStart() : a === 'cancel' && onBack()));
}

/** v0.7.1: what changed in this version, from the top CHANGELOG entry (logic/whatsNew.ts, at build time). Once after an update, and from the title screen. */
export function showWhatsNew(w: WhatsNew, onBack: () => void): void {
  const el = show(`
    <div class="panel dialog wide whatsnew">
      <h1 class="small">What’s new in v${w.version}</h1>
      ${w.title ? `<p class="sub"><b>${esc(w.title)}</b></p>` : ''}
      ${w.intro ? `<p>${esc(w.intro)}</p>` : ''}
      <ul>${w.points.map((p) => `<li><b>${esc(p.name)}</b>${p.text ? ` — ${esc(p.text)}` : ''}</li>`).join('')}</ul>
      ${w.more ? `<p class="hint">…and ${w.more} more change${w.more > 1 ? 's' : ''}.</p>` : ''}
      <button class="btn big" data-back>Continue</button>
    </div>`);
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'confirm' || a === 'cancel' || a === 'pause') && onBack());
}

/** v0.7.1: every game term and what it means (config/glossary.ts), from the pause menu and the Keep. Tooltips underline the same words. */
export function showGlossary(onBack: () => void): void {
  const el = show(`
    <div class="panel dialog wide glossary">
      <h1 class="small">Glossary</h1>
      <p class="sub">The words the game uses, and what they mean. Tooltips underline them and explain them too.</p>
      <dl>${[...GLOSSARY].sort((a, b) => a.name.localeCompare(b.name)).map((t) => `<dt>${t.name}</dt><dd>${t.def}</dd>`).join('')}</dl>
      <button class="btn" data-back>Back</button>
    </div>`);
  click(el, '[data-back]', onBack);
  onActions((a) => (a === 'cancel' || a === 'pause') && onBack());
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
  const el = show(`
    <div class="panel dialog wide testmode">
      <h1 class="small">Test mode</h1>
      <p class="sub">Test runs pay nothing and leave no trace: no gold, Runes, class XP, deeds, contracts or run history. The HUD says TEST.</p>
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
      <p class="sub">Held from the start, at the attunement tier chosen (III is awakened).</p>
      <div class="tm-talents" id="tm-relics">${relics(setup.classId)}</div>
      <button class="btn big" data-start>Start test run</button>
      <h2>Music jukebox</h2>
      <div class="tm-grid">
        <label>Theme <select id="jb-arena">${arenas(setup.arena)}</select></label>
        <label>Layer <input id="jb-layer" type="range" min="0" max="3" step="1" value="1"></label><span id="jb-name"></span>
      </div>
      <div class="row"><button class="btn" data-play>Play</button><button class="btn" data-cue="fork">Fork cue</button><button class="btn" data-cue="victory">Victory cue</button><button class="btn" data-stop>Stop</button></div>
      <div class="row">${JUKEBOX_STINGERS.map(([k, label]) => `<button class="btn small" data-sting="${k}">${label}</button>`).join('')}</div>
      <button class="btn" data-back>Back</button>
    </div>`);
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
}
