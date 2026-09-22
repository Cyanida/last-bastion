import { ABILITY_UPGRADES, type AbilityUpgradeId } from '../config/abilityUpgrades';
import { ACHIEVEMENTS, type AchievementDef } from '../config/achievements';
import { ARENA_IDS, ARENAS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, CLASSES, type ClassDef, type ClassId } from '../config/classes';
import { CURSE_IDS, CURSES, type CurseId } from '../config/curses';
import { RELIC_CATEGORIES, RELIC_IDS, RELIC_WEIGHTS, relicDesc, SYNERGIES, TIER_NUMERALS, type Rarity } from '../config/relics';
import { actName, merchantPrice, type DailySetup, type MerchantItem } from '../logic/acts';
import { curseMultiplier } from '../logic/curses';
import { ACCOUNT_MILESTONES, BUILDING_IDS, BUILDINGS, MASTERY, META, RUNES, TIER_UNLOCK_WAVE, TIERS, type BuildingId, type MetaId } from '../config/economy';
import { relicDef, type RelicId } from '../config/relics';
import { TALENT_BRANCHES, TALENT_BY_ID, TALENTS, talentsFor, type BranchDef } from '../config/talents';
import { TRAIT_IDS, TRAITS, type TraitId } from '../config/traits';
import { UTILITIES, UTILITY_UPGRADES, type UtilityUpgradeId } from '../config/utility';
import { branchPoints, takenKeystone, talentBlocker } from '../logic/talents';
import { activeSynergies, synergiesOf, type RelicTiers } from '../logic/relics';
import { salvageValue, sellPrice } from '../systems/acts';
import { esc, relicLine, relicTip, tierBadge } from './relicText';
import type { QualitySetting } from '../config/game';
import { STAT_KEYS, type StatKey, type Stats } from '../core/types';
import { onAction } from '../input';
import type { Action } from '../input/mapping';
import { gateOf, lockedArenas, lockedCurses } from '../logic/achievements';
import { accountLevel, buildingLevel, buildingOf, masteryBonus, masteryRank, metaCost, rankCap, rewardText } from '../logic/economy';
import { exportSave, type Save } from '../logic/save';
import { optionText, statLabel, type LevelUpOption } from '../logic/upgrades';
import { getSprite, SPRITE_PALETTES } from '../render/sprites';

const overlay = () => document.getElementById('overlay')!;
let stopActions: (() => void) | null = null;

function show(html: string): HTMLElement {
  clearOverlay();
  const el = overlay();
  el.innerHTML = html;
  el.classList.remove('hidden');
  return el;
}

export function clearOverlay(): void {
  stopActions?.();
  stopActions = null;
  overlay().classList.add('hidden');
  overlay().innerHTML = '';
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
  const upgrade = tier > 1;
  const syn = synergiesOf(id).map((sid) => {
    const sd = SYNERGIES[sid];
    const others = sd.relics.filter((o) => o !== id).map((o) => relicDef(o).name).join(' + ');
    const on = sd.relics.every((o) => o === id || held.includes(o));
    return `<div class="syn ${sd.anti ? 'anti' : on ? 'on' : ''}">${sd.anti ? '⚠' : on ? '✦' : '✧'} ${sd.name} <em>with ${others}</em></div>`;
  }).join('');
  return `<button class="card panel boon relic-card ${r.rarity}" ${attrs} data-tip="${esc(relicTip(id, tier, held))}"><div class="relic-icon">${r.icon}${tierBadge(tier)}</div><h2>${r.name}</h2><div class="tag">${upgrade ? `tier ${TIER_NUMERALS[tier - 1]} → ${TIER_NUMERALS[tier]}` : r.rarity}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''} · ${RELIC_CATEGORIES[r.category].name}</div><p>${relicDesc(id, tier)}</p>${syn}${extra}</button>`;
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
}

export function showTitle(info: TitleInfo, on: { start: () => void; daily: () => void; keep: () => void; chronicle: () => void; settings: () => void }): void {
  const el = show(`
    <div class="title">
      <h1>Last Bastion</h1>
      <div class="version">${info.label}${info.mobile ? ' <span class="badge">Mobile</span>' : ''}</div>
      <p class="sub">The walls have fallen silent. The courtyard has not.</p>
      ${info.notice ? `<div class="notice panel"><span>${info.notice.text}</span><button class="btn small" data-notice>${info.notice.button}</button></div>` : ''}
      <button class="btn big" data-go="start">Take up arms</button>
      <div class="row">
        ${info.daily.date ? `<button class="btn" data-go="daily">Daily Trial${info.daily.best ? ` · best ${info.daily.best}` : ''}</button>` : ''}
        <button class="btn" data-go="keep">The Keep · 🪙 ${info.gold}${info.runes ? ` · ◆ ${info.runes}` : ''}</button>
        <button class="btn" data-go="chronicle">Chronicle</button>
        <button class="btn" data-go="settings">Settings</button>
      </div>
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
  perf: boolean;
  desktop: { version: string; status: string; prerelease: boolean } | null;
}

export function showSettings(info: SettingsInfo, on: { quality: (q: QualitySetting) => void; mute: () => void; perf: () => void; saveData: () => void; checkUpdates: () => void; prerelease: (v: boolean) => void; back: () => void }): void {
  const chip = (q: QualitySetting) => `<button class="chip ${info.quality === q ? 'on' : ''}" data-quality="${q}">${q[0].toUpperCase()}${q.slice(1)}</button>`;
  const el = show(`
    <div class="panel dialog wide settings">
      <h1 class="small">Settings</h1>
      <div class="setting"><div><b>Graphics quality</b><span>Low cuts particles, screen shake and shadows. Auto measures the first waves and drops to low if needed. Now: ${info.effective}.</span></div><div>${(['auto', 'low', 'high'] as const).map(chip).join('')}</div></div>
      <div class="setting"><div><b>Sound</b><span>Synthesised effects.</span></div><button class="chip on" data-act="mute">${info.muted ? 'Off' : 'On'}</button></div>
      <div class="setting"><div><b>Performance overlay</b><span>Frame, update and render times, entity counts, draw calls (F3 in a run).</span></div><button class="chip ${info.perf ? 'on' : ''}" data-act="perf">${info.perf ? 'On' : 'Off'}</button></div>
      ${info.desktop ? `
      <div class="setting"><div><b>Updates</b><span>Version ${info.desktop.version}. ${info.desktop.status}</span></div><button class="chip" data-act="check">Check for updates</button></div>
      <div class="setting"><div><b>Beta versions</b><span>Also install pre-releases.</span></div><button class="chip ${info.desktop.prerelease ? 'on' : ''}" data-act="pre">${info.desktop.prerelease ? 'On' : 'Off'}</button></div>` : ''}
      <div class="setting"><div><b>Save data</b><span>Export, import or reset your progress.</span></div><button class="chip" data-act="save">Open</button></div>
      <button class="btn" data-act="back">Back</button>
    </div>`);
  click(el, '[data-quality]', (b) => on.quality(b.dataset.quality as QualitySetting));
  click(el, '[data-act]', (b) => {
    const act = b.dataset.act;
    if (act === 'mute') on.mute();
    else if (act === 'perf') on.perf();
    else if (act === 'check') on.checkUpdates();
    else if (act === 'pre') on.prerelease(!info.desktop?.prerelease);
    else if (act === 'save') on.saveData();
    else on.back();
  });
  onActions((a) => (a === 'cancel' || a === 'pause') && on.back());
}

export function showClassSelect(save: Save, on: { pick: (id: ClassId, seed: string) => void; back: () => void; settings: (arena: ArenaId, tier: number) => void; curse: (id: CurseId) => void; trait: (id: TraitId) => void; palette: (id: ClassId, n: number) => void }): void {
  const locked = lockedArenas(save);
  const card = (c: ClassDef) => {
    const rec = save.classes[c.id];
    const rank = masteryRank(rec.xp);
    const next = MASTERY[rank];
    const palettes = masteryBonus(rec.xp).palettes;
    const chosen = save.settings.palettes[c.id] ?? 0;
    const swatches = palettes.length ? `<div class="swatches">${[0, ...palettes].map((n) => `<span class="swatch ${chosen === n ? 'on' : ''}" data-palette="${c.id}:${n}" data-tip="${['As drawn', 'Ashen colours', 'Gilded colours', 'Midnight colours'][n]}"><i style="filter:${SPRITE_PALETTES[n] || 'none'}"></i></span>`).join('')}</div>` : '';
    return `
    <button class="card panel" data-class="${c.id}">
      <div class="portrait" data-sprite="${c.sprite}" data-palette-n="${palettes.includes(chosen) ? chosen : 0}"></div>${swatches}
      <h2>${c.name}</h2>
      <div class="role">${c.role}</div>
      <div class="stats">
        ${STAT_KEYS.map((k) => `<div><span>${statLabel(k, c)}</span><b>${fmtStat(k, c.base[k])}</b></div>`).join('')}
      </div>
      <div class="ability"><b class="gold">${c.ability.name}</b><p>${c.ability.desc}</p></div>
      <div class="ability"><b class="gold">${c.secondary.name}</b><p>${c.secondary.desc}</p></div>
      <div class="best">${rec.bestWave ? `Best: wave ${rec.bestWave}` : 'Not yet attempted'} · Mastery ${rank}/${MASTERY.length}${next ? ` <span class="dim">(${Math.round(rec.xp)}/${next.xp})</span>` : ''}</div>
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
    return `<button class="chip curse ${save.settings.curses.includes(id) ? 'on' : ''}" data-curse="${id}" ${gate ? 'disabled' : ''} data-tip="${tip}">${gate ? '🔒 ' : ''}${c.name}</button>`;
  };
  const traitBtn = (id: TraitId) => {
    const t = TRAITS[id];
    const need = t.unlock.achievement ? ACHIEVEMENTS.find((a) => a.id === t.unlock.achievement) : undefined;
    const lockedT = need !== undefined && !save.achievements.includes(need.id);
    const tip = lockedT ? `Locked — ${need!.name}: ${need!.desc}` : t.desc;
    return `<button class="chip trait ${save.settings.trait === id ? 'on' : ''}" data-trait="${id}" ${lockedT ? 'disabled' : ''} data-tip="${esc(tip)}">${lockedT ? '🔒 ' : `${t.icon} `}${t.name}</button>`;
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
      <div class="cards">${CLASS_ORDER.map((id) => card(CLASSES[id])).join('')}</div>
      <button class="btn" data-back>Back</button>
    </div>`);
  el.querySelectorAll<HTMLElement>('[data-sprite]').forEach((slot) => slot.appendChild(getSprite(slot.dataset.sprite as ClassDef['sprite'], 6, Number(slot.dataset.paletteN ?? 0)).img));
  el.querySelectorAll<HTMLElement>('[data-palette]').forEach((sw) => (sw.onclick = (e) => {
    e.stopPropagation(); // the card underneath would start the run
    const [cls, n] = sw.dataset.palette!.split(':');
    on.palette(cls as ClassId, Number(n));
  }));
  click(el, '[data-class]', (b) => on.pick(b.dataset.class as ClassId, el.querySelector<HTMLInputElement>('#seed')!.value));
  click(el, '[data-curse]', (b) => on.curse(b.dataset.curse as CurseId));
  click(el, '[data-trait]', (b) => on.trait(b.dataset.trait as TraitId));
  click(el, '[data-arena]', (b) => on.settings(b.dataset.arena as ArenaId, save.settings.tier));
  click(el, '[data-tier]', (b) => on.settings(save.settings.arena, Number(b.dataset.tier)));
  click(el, '[data-back]', on.back);
}

export function showKeep(save: Save, on: { buy: (id: MetaId) => void; raise: (id: BuildingId) => void; mastery: (id: ClassId) => void; compendium: () => void; back: () => void }): void {
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
    const deed = next?.achievement ? ACHIEVEMENTS.find((a) => a.id === next.achievement) : undefined;
    const deedDone = !deed || save.achievements.includes(deed.id);
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
      <div class="buildings">${BUILDING_IDS.map(building).join('')}</div>
      <h2>Class mastery · account level ${level}</h2>
      <p class="hint">Earned by playing a class: waves cleared, bosses slain, levels gained, times the difficulty tier. Every rank unlocks something; tap a class for its track.
        ${nextMilestone ? `Account level ${nextMilestone.level}: <em>${nextMilestone.name}</em> — ${nextMilestone.desc}.` : 'Every account milestone reached.'}</p>
      <div class="masteries">${mastery}</div>
      <div class="milestones">${ACCOUNT_MILESTONES.map((m) => `<span class="${level >= m.level ? 'on' : ''}" data-tip="${esc(m.desc)}">${level >= m.level ? '✔ ' : ''}${m.level} ${m.name}</span>`).join('')}</div>
      <button class="btn" data-compendium>Relic compendium</button>
      <button class="btn" data-back>Back</button>
    </div>`);
  click(el, '[data-buy]', (b) => on.buy(b.dataset.buy as MetaId));
  click(el, '[data-raise]', (b) => on.raise(b.dataset.raise as BuildingId));
  click(el, '[data-mastery]', (b) => on.mastery(b.dataset.mastery as ClassId));
  click(el, '[data-compendium]', on.compendium);
  click(el, '[data-back]', on.back);
  onActions((a) => (a === 'cancel' || a === 'pause') && on.back());
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

export function showChronicle(save: Save, onBack: () => void): void {
  const ach = (a: AchievementDef) => {
    const done = save.achievements.includes(a.id);
    const cur = Math.min(a.target, a.progress(save));
    const unlock = a.unlocks?.arena ? `Unlocks arena: ${ARENAS[a.unlocks.arena].name}` : a.unlocks?.relic ? `Unlocks relic: ${relicDef(a.unlocks.relic).name}` : '';
    return `<div class="ach ${done ? 'done' : ''}"><div><b>${done ? '✔ ' : ''}${a.name}</b><span>${a.desc}${unlock ? ` <em>${unlock}</em>` : ''}</span></div>
      <div class="bar xp"><div style="width:${(cur / a.target) * 100}%"></div><span>${Math.floor(cur)} / ${a.target}</span></div></div>`;
  };
  const records = CLASS_ORDER.map((id) => save.classes[id]);
  const favorite = (Object.entries(save.relicPicks) as [RelicId, number][]).sort((a, b) => b[1] - a[1])[0];
  const rows = CLASS_ORDER.map((id) => {
    const c = save.classes[id];
    return `<tr><td>${CLASSES[id].name}</td><td>${c.bestWave}</td><td>${c.kills}</td><td>${c.runs}</td><td>${fmtTime(c.time)}</td><td>${masteryRank(c.xp)}</td></tr>`;
  }).join('');
  const el = show(`
    <div class="panel dialog wide">
      <h1 class="small">Chronicle</h1>
      <h2>Deeds — ${save.achievements.length} / ${ACHIEVEMENTS.length}</h2>
      <div class="achs">${ACHIEVEMENTS.map(ach).join('')}</div>
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
  click(el, '[data-back]', onBack);
}

export function showSaveDialog(save: Save, on: { import: (text: string) => boolean; reset: () => void; back: () => void }): void {
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
    </div>`);
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
  on: { pick: (o: LevelUpOption) => void; reroll: () => void },
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
          const kind = o.kind === 'tradeoff' ? 'tradeoff' : o.kind === 'talent' ? 'talent' : o.kind === 'relic' ? `relic-card ${relicDef(o.id).rarity}` : o.rarity;
          const special = (o.kind === 'stat' && o.key === 'secondary') || o.kind === 'talent' ? 'special' : '';
          const now = o.kind === 'stat' ? `<div class="best">now ${fmtStat(o.key, stats[o.key])}</div>` : '';
          return `<button class="card panel boon ${kind} ${special}" data-pick="${i}"><div class="num">${i + 1}</div><h2>${t.title}</h2><div class="tag">${t.tag}</div><p>${t.desc}</p>${now}</button>`;
        }).join('')}
      </div>
      <button class="btn" data-reroll ${canReroll ? '' : 'disabled'}>Reroll (R) — ${reroll.free > 0 ? `${reroll.free} free` : `🪙 ${reroll.cost}`}</button>
    </div>`);
  click(el, '[data-pick]', (b) => on.pick(options[Number(b.dataset.pick)]));
  click(el, '[data-reroll]', on.reroll);
  numberKeys(el, (a) => a === 'reroll' && canReroll && on.reroll());
}

export function showRelicOffer(options: RelicId[], held: RelicId[], tiers: RelicTiers, on: { take: (id: RelicId) => void; skip: () => void }): void {
  const el = show(`
    <div class="levelup">
      <h1 class="small">${options.length > 1 ? 'Spoils of the fallen' : 'A relic!'}</h1>
      <p class="sub">${options.some((id) => held.includes(id)) ? 'A relic you already carry grows a tier stronger' : 'Choose a relic'} · ${held.length} carried</p>
      <div class="cards">${options.map((id, i) => relicCard(id, (tiers[id] ?? 0) + 1, held, `data-pick="${i}"`, `<div class="num">${i + 1}</div>`)).join('')}</div>
      <button class="btn" data-skip>Leave it</button>
    </div>`);
  click(el, '[data-pick]', (b) => on.take(options[Number(b.dataset.pick)]));
  click(el, '[data-skip]', on.skip);
  numberKeys(el);
}

export function showAbilityUpgrade(tier: number, options: readonly AbilityUpgradeId[], cls: ClassDef, onPick: (id: AbilityUpgradeId) => void): void {
  showTwoWay(`${cls.ability.name} — tier ${tier + 1}`, options.map((id) => ({ id, name: ABILITY_UPGRADES[id].name, desc: ABILITY_UPGRADES[id].desc })), (id) => onPick(id as AbilityUpgradeId));
}

/** v0.4: the utility ability's two-way choices at levels 8 and 14. */
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
export function showTalents(info: { classId: ClassId; taken: string[]; points: number }, on: { spend: (id: string) => boolean; back: () => void }): void {
  const branches = TALENT_BRANCHES[info.classId];
  const nodes = talentsFor(info.classId);
  const keystone = takenKeystone(info.taken);
  const column = (b: BranchDef) => {
    const mine = nodes.filter((n) => n.branch === b.id);
    const rows = Array.from({ length: TALENTS.rows }, (_, r) => mine.filter((n) => n.row === r));
    return `<div class="branch"><h2>${b.name}</h2><p class="hint">${b.desc} · ${branchPoints(info.taken, b.id)} points</p>
      ${rows.map((row) => `<div class="trow">${row.map((n) => {
        const taken = info.taken.includes(n.id);
        const why = taken ? null : talentBlocker(info.taken, n.id, info.points);
        const state = taken ? 'taken' : why === null ? 'open' : 'locked';
        const tip = `${n.name}${n.keystone ? ' · keystone' : ''}\n${n.desc}${why && !taken ? `\n(${why})` : ''}`;
        return `<button class="talent ${state} ${n.keystone ? 'keystone' : ''}" data-talent="${n.id}" ${state === 'open' ? '' : 'disabled'} data-tip="${esc(tip)}"><b>${taken ? '✔ ' : ''}${n.name}</b><span>${n.desc}</span></button>`;
      }).join('')}</div>`).join('')}
    </div>`;
  };
  const el = show(`
    <div class="panel dialog wide talents">
      <h1 class="small">Talents</h1>
      <p class="sub">${info.points > 0 ? `<b>${info.points} point${info.points > 1 ? 's' : ''} to spend</b>` : 'No points to spend'} · a point every ${TALENTS.levelsPerPoint} levels · a keystone needs ${TALENTS.keystonePoints} points in its branch, and only one keystone${keystone ? ` (yours: ${keystone.name})` : ''}</p>
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
  upgrades: AbilityUpgradeId[];
  classId: ClassId;
  talents: string[];
  talentPoints: number;
  utilityUpgrades: UtilityUpgradeId[];
  trait: TraitId;
}

/** The current build: ability upgrades, relics with tiers (tooltips), active synergies and clashes. Pause and results screens. */
export function buildHtml(info: BuildInfo): string {
  const relics = info.relics.map((id) => {
    const tier = info.tiers[id] ?? 1;
    return `<div><span tabindex="0" data-tip="${esc(relicTip(id, tier, info.relics))}">${relicDef(id).icon} ${relicDef(id).name}${tier > 1 ? ` ${TIER_NUMERALS[tier]}` : ''}</span><em>${relicDesc(id, tier)}</em></div>`;
  }).join('');
  const trait = info.trait !== 'none' ? `<div><span>${TRAITS[info.trait].icon} ${TRAITS[info.trait].name}</span><em>${TRAITS[info.trait].desc}</em></div>` : '';
  const ups = info.upgrades.map((id) => `<div><span>✦ ${ABILITY_UPGRADES[id].name}</span><em>${ABILITY_UPGRADES[id].desc}</em></div>`).join('');
  const util = info.utilityUpgrades.map((id) => `<div><span>${UTILITIES[info.classId].icon} ${UTILITY_UPGRADES[id].name}</span><em>${UTILITY_UPGRADES[id].desc}</em></div>`).join('');
  const talents = info.talents.length || info.talentPoints ? `<div><span>🌿 Talents${info.talentPoints ? ` · ${info.talentPoints} unspent` : ''}</span><em>${info.talents.map((id) => TALENT_BY_ID[id]?.name).join(' · ') || 'none yet'}</em></div>` : '';
  const syns = activeSynergies(info.relics).map((sid) => `<div class="syn ${SYNERGIES[sid].anti ? 'anti' : 'on'}"><span>${SYNERGIES[sid].anti ? '⚠' : '✦'} ${SYNERGIES[sid].name}</span><em>${SYNERGIES[sid].desc}</em></div>`).join('');
  return relics || ups || trait || util || talents ? `<div class="build">${trait}${talents}${ups}${util}${relics}${syns}</div>` : '';
}

export function showPause(info: BuildInfo, onResume: () => void, onQuit: () => void, onTalents?: () => void): void {
  const el = show(`
    <div class="panel dialog">
      <h1 class="small">Paused</h1>
      ${buildHtml(info)}
      <button class="btn big" data-resume>Resume</button>
      ${onTalents ? `<button class="btn" data-talents>Talents${info.talentPoints > 0 ? ` (${info.talentPoints} to spend)` : ''}</button>` : ''}
      <button class="btn" data-quit>End run (keeps your gold)</button>
    </div>`);
  click(el, '[data-resume]', onResume);
  click(el, '[data-talents]', () => onTalents?.());
  click(el, '[data-quit]', onQuit);
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
  earned: AchievementDef[];
  slain: boolean; // false = the player ended the run from the pause menu
  seed: string; // type it on the class select screen to replay the run
  curseMult: number;
  daily: string | null;
  build: BuildInfo;
}

export function showResults(r: RunResult, onRetry: () => void, onMenu: () => void): void {
  const unlocks = [
    ...(r.tierUnlocked ? [`<div class="unlock">⚔ Difficulty unlocked: <b>${r.tierUnlocked}</b></div>`] : []),
    ...r.earned.map((a) => `<div class="unlock">🏆 <b>${a.name}</b> — ${a.desc}${a.unlocks?.arena ? ` <em>New arena: ${ARENAS[a.unlocks.arena].name}</em>` : ''}${a.unlocks?.relic ? ` <em>New relic: ${relicDef(a.unlocks.relic).name}</em>` : ''}</div>`),
  ].join('');
  const el = show(`
    <div class="panel dialog">
      <h1 class="small blood">${r.slain ? 'Thou art slain' : 'The run ends'}</h1>
      <p class="sub">${r.cls.name} · ${r.tier}${r.newBest ? ' — <span class="gold">new record!</span>' : ''}</p>
      <div class="stats wide">
        <div><span>Reached</span><b>${actName(Math.max(1, Math.ceil(r.wave / 10)))} · wave ${r.wave}</b></div>
        <div><span>Enemies slain</span><b>${r.kills}</b></div>
        <div><span>Time survived</span><b>${fmtTime(r.time)}</b></div>
        <div><span>Level</span><b>${r.level}</b></div>
        <div><span>${r.daily ? `Daily Trial ${r.daily}` : 'Run seed'}</span><b class="seed">${r.seed}</b></div>
        ${r.curseMult > 1 ? `<div><span>Curses</span><b>×${r.curseMult.toFixed(2)} gold &amp; XP</b></div>` : ''}
        <div><span>Best wave (${r.cls.name})</span><b>${r.best}</b></div>
        <div class="earned"><span>Gold banked</span><b>🪙 +${r.gold}${r.goldRaw > r.gold ? ` <s>${r.goldRaw}</s>` : ''}</b></div>
        ${r.runes > 0 ? `<div class="earned"><span>Runes</span><b>◆ +${r.runes}</b></div>` : ''}
        <div class="earned"><span>${r.cls.name} mastery</span><b>+${r.classXp} XP · rank ${r.masteryRank}${r.masteryName ? ` — <em>${r.masteryName}</em>` : ''}</b></div>
      </div>
      ${unlocks ? `<div class="unlocks">${unlocks}</div>` : ''}
      ${buildHtml(r.build)}
      <button class="btn big" data-retry>Fight again</button>
      <button class="btn" data-menu>Choose another champion</button>
    </div>`);
  click(el, '[data-retry]', onRetry);
  click(el, '[data-menu]', onMenu);
  onActions((a) => a === 'confirm' && onRetry());
}

export interface MerchantInfo {
  act: number; // the Act that was just cleared
  gold: number;
  hp: number;
  maxHp: number;
  relics: RelicId[];
  tiers: RelicTiers;
  salvage: number; // Rune shards so far
}

/** Between Acts. Everything here costs run gold, and run gold is what you would otherwise bank for the Keep. */
export function showMerchant(info: MerchantInfo, on: { heal: () => void; buy: (r: Rarity) => void; reroll: (id: RelicId) => void; sell: (id: RelicId) => void; salvage: (id: RelicId) => void; leave: () => void }): void {
  const price = (item: MerchantItem) => merchantPrice(item, info.act);
  const offer = (item: MerchantItem, attrs: string, title: string, text: string, enabled: boolean) =>
    `<button class="card panel boon shop" ${attrs} ${enabled && info.gold >= price(item) ? '' : 'disabled'}><h2>${title}</h2><p>${text}</p><div class="best">🪙 ${price(item)}</div></button>`;
  const held = info.relics.map((id) => {
    const tier = info.tiers[id] ?? 1;
    return `<div class="held ${relicDef(id).rarity}">${relicLine(id, tier, info.relics)}
      <button class="chip" data-reroll="${id}" ${info.gold >= price('reroll') ? '' : 'disabled'} data-tip="Swap it for a random ${relicDef(id).rarity} relic you do not carry, at the same tier">Reroll 🪙 ${price('reroll')}</button>
      <button class="chip" data-sell="${id}" data-tip="Sell it for gold${tier > 1 ? ' (every tier counts)' : ''}">Sell +🪙 ${sellPrice(id, tier, info.act)}</button>
      <button class="chip" data-salvage="${id}" data-tip="Break it into Rune shards: progress toward Runes, the Keep's second currency">Salvage +${salvageValue(id, tier)} ◆</button></div>`;
  }).join('');
  const el = show(`
    <div class="levelup merchant">
      <h1 class="small">${actName(info.act)} is won</h1>
      <p class="sub">The Merchant waits by the gate. Purse: <b class="goldtext">🪙 ${info.gold}</b>${info.salvage > 0 ? ` · shards: <b>${info.salvage} ◆</b>` : ''} — what you spend here never reaches the Keep.</p>
      <div class="cards">
        ${offer('heal', 'data-heal', 'Field Surgeon', `Heal half your HP (${Math.ceil(info.hp)} / ${Math.round(info.maxHp)}).`, info.hp < info.maxHp)}
        ${(Object.keys(RELIC_WEIGHTS) as Rarity[]).map((r) => offer(`buy:${r}`, `data-buy="${r}"`, `${r[0].toUpperCase()}${r.slice(1)} relic`, `A random ${r} relic: new, or a tier up for one you carry.`, true)).join('')}
      </div>
      ${held ? `<div class="panel heldlist">${held}</div>` : ''}
      <button class="btn big" data-leave>March on</button>
    </div>`);
  click(el, '[data-heal]', on.heal);
  click(el, '[data-buy]', (b) => on.buy(b.dataset.buy as Rarity));
  click(el, '[data-reroll]', (b) => on.reroll(b.dataset.reroll as RelicId));
  click(el, '[data-sell]', (b) => on.sell(b.dataset.sell as RelicId));
  click(el, '[data-salvage]', (b) => on.salvage(b.dataset.salvage as RelicId));
  click(el, '[data-leave]', on.leave);
  onActions((a) => a === 'confirm' && on.leave());
}

/** The relic compendium in the Keep: every relic, discovered or not, with tiers, synergies and how often it was found. */
export function showCompendium(save: Save, onBack: () => void): void {
  const found = (id: RelicId) => save.relicPicks[id] ?? 0;
  const card = (id: RelicId) => {
    const r = relicDef(id);
    const n = found(id);
    if (n === 0) return `<div class="card panel boon relic-card undiscovered" data-tip="${esc(`Not found yet. A ${r.rarity} ${RELIC_CATEGORIES[r.category].name.toLowerCase()} relic${r.classId ? ` for the ${CLASSES[r.classId].name}` : ''}.`)}"><div class="relic-icon">?</div><h2>Unknown</h2><div class="tag">${r.rarity}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''}</div><p>${RELIC_CATEGORIES[r.category].name}</p></div>`;
    const tiers = [1, 2, 3].map((t) => `<div class="tierline"><b>${TIER_NUMERALS[t]}</b> ${relicDesc(id, t)}</div>`).join('');
    const syn = synergiesOf(id).map((sid) => `<div class="syn ${SYNERGIES[sid].anti ? 'anti' : ''}">${SYNERGIES[sid].anti ? '⚠' : '✧'} ${SYNERGIES[sid].name} <em>with ${SYNERGIES[sid].relics.filter((o) => o !== id).map((o) => (found(o) ? relicDef(o).name : '?')).join(' + ')}</em>: ${SYNERGIES[sid].desc}</div>`).join('');
    return `<div class="card panel boon relic-card ${r.rarity}"><div class="relic-icon">${r.icon}</div><h2>${r.name}</h2><div class="tag">${r.rarity}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''} · ${RELIC_CATEGORIES[r.category].name} · found ${n}×</div>${tiers}${syn}</div>`;
  };
  const discovered = RELIC_IDS.filter((id) => found(id) > 0).length;
  const el = show(`
    <div class="panel dialog wide compendium">
      <h1 class="small">Relic compendium</h1>
      <p class="sub">${discovered} / ${RELIC_IDS.length} discovered · a duplicate raises a relic's tier (three tiers) · ${Object.values(RELIC_CATEGORIES).map((c) => c.name).join(', ')}: relics of a kind add up and pass a soft cap</p>
      <div class="cards wrap">${(['common', 'rare', 'legendary'] as Rarity[]).map((rar) => RELIC_IDS.filter((id) => relicDef(id).rarity === rar).map(card).join('')).join('')}</div>
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
