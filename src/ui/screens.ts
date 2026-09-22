import { ABILITY_UPGRADES, type AbilityUpgradeId } from '../config/abilityUpgrades';
import { ACHIEVEMENTS, type AchievementDef } from '../config/achievements';
import { ARENA_IDS, ARENAS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, CLASSES, type ClassDef, type ClassId } from '../config/classes';
import { CURSE_IDS, CURSES, type CurseId } from '../config/curses';
import { RELIC_WEIGHTS, type Rarity } from '../config/relics';
import { actName, merchantPrice, type DailySetup, type MerchantItem } from '../logic/acts';
import { curseMultiplier } from '../logic/curses';
import { MASTERY, META, META_IDS, TIER_UNLOCK_WAVE, TIERS, type MetaId } from '../config/economy';
import { relicDef, type RelicId } from '../config/relics';
import type { QualitySetting } from '../config/game';
import { STAT_KEYS, type StatKey, type Stats } from '../core/types';
import { onAction } from '../input';
import type { Action } from '../input/mapping';
import { gateOf, lockedArenas, lockedCurses } from '../logic/achievements';
import { masteryRank, metaCost } from '../logic/economy';
import { exportSave, type Save } from '../logic/save';
import { optionText, statLabel, type LevelUpOption } from '../logic/upgrades';
import { getSprite } from '../render/sprites';

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
const relicCard = (id: RelicId, attrs: string, extra = '') => {
  const r = relicDef(id);
  return `<button class="card panel boon relic-card ${r.rarity}" ${attrs}><div class="relic-icon">${r.icon}</div><h2>${r.name}</h2><div class="tag">${r.rarity}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''}</div><p>${r.desc}</p>${extra}</button>`;
};

// ---------------------------------------------------------------- title & menus

export interface TitleInfo {
  gold: number;
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
        <button class="btn" data-go="keep">The Keep · 🪙 ${info.gold}</button>
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

export function showClassSelect(save: Save, on: { pick: (id: ClassId, seed: string) => void; back: () => void; settings: (arena: ArenaId, tier: number) => void; curse: (id: CurseId) => void }): void {
  const locked = lockedArenas(save);
  const card = (c: ClassDef) => {
    const rec = save.classes[c.id];
    const rank = masteryRank(rec.xp);
    const next = MASTERY[rank];
    return `
    <button class="card panel" data-class="${c.id}">
      <div class="portrait" data-sprite="${c.sprite}"></div>
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
    const lockedTier = i > save.tierUnlocked;
    const tip = lockedTier ? `Locked — clear wave ${TIER_UNLOCK_WAVE} on ${TIERS[i - 1].name}` : `Enemy HP ×${t.enemyHp}, damage ×${t.enemyDmg}, elites ×${t.eliteMult} · gold ×${t.gold}, class XP ×${t.classXp}`;
    return `<button class="chip ${save.settings.tier === i ? 'on' : ''}" data-tier="${i}" ${lockedTier ? 'disabled' : ''} data-tip="${tip}">${lockedTier ? '🔒 ' : ''}${t.name}</button>`;
  };
  const lockedC = lockedCurses(save);
  const curseBtn = (id: CurseId) => {
    const c = CURSES[id];
    const gate = lockedC.includes(id) ? gateOf({ curse: id }) : undefined;
    const tip = gate ? `Locked — ${gate.desc}` : `${c.desc} +${Math.round(c.bonus * 100)}% gold and class XP.`;
    return `<button class="chip curse ${save.settings.curses.includes(id) ? 'on' : ''}" data-curse="${id}" ${gate ? 'disabled' : ''} data-tip="${tip}">${gate ? '🔒 ' : ''}${c.name}</button>`;
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
      <div class="cards">${CLASS_ORDER.map((id) => card(CLASSES[id])).join('')}</div>
      <button class="btn" data-back>Back</button>
    </div>`);
  el.querySelectorAll<HTMLElement>('[data-sprite]').forEach((slot) => slot.appendChild(getSprite(slot.dataset.sprite as ClassDef['sprite'], 6).img));
  click(el, '[data-class]', (b) => on.pick(b.dataset.class as ClassId, el.querySelector<HTMLInputElement>('#seed')!.value));
  click(el, '[data-curse]', (b) => on.curse(b.dataset.curse as CurseId));
  click(el, '[data-arena]', (b) => on.settings(b.dataset.arena as ArenaId, save.settings.tier));
  click(el, '[data-tier]', (b) => on.settings(save.settings.arena, Number(b.dataset.tier)));
  click(el, '[data-back]', on.back);
}

export function showKeep(save: Save, on: { buy: (id: MetaId) => void; back: () => void }): void {
  const row = (id: MetaId) => {
    const m = META[id];
    const rank = save.meta[id] ?? 0;
    const cost = metaCost(id, rank);
    const pips = Array.from({ length: m.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('');
    const btn = cost === null ? '<span class="maxed">Maxed</span>' : `<button class="btn small" data-buy="${id}" ${save.gold < cost ? 'disabled' : ''}>🪙 ${cost}</button>`;
    return `<div class="meta-row"><div><b>${m.name}</b><span>${m.desc}</span></div><div class="pips">${pips}</div>${btn}</div>`;
  };
  const mastery = CLASS_ORDER.map((id) => {
    const xp = save.classes[id].xp;
    const rank = masteryRank(xp);
    const next = MASTERY[rank];
    const prev = rank > 0 ? MASTERY[rank - 1].xp : 0;
    const frac = next ? (xp - prev) / (next.xp - prev) : 1;
    return `<div class="mastery"><b>${CLASSES[id].name}</b><span>Rank ${rank}/${MASTERY.length}</span><div class="bar xp"><div style="width:${frac * 100}%"></div></div><span class="dim">${next ? `Next: ${next.reward}` : 'Mastered'}</span></div>`;
  }).join('');
  const el = show(`
    <div class="panel dialog wide">
      <h1 class="small">The Keep</h1>
      <p class="sub">Treasury: <b>🪙 ${save.gold}</b> — permanent upgrades for every champion</p>
      <div class="meta">${META_IDS.map(row).join('')}</div>
      <h2>Class mastery</h2>
      <p class="hint">Earned by playing a class: waves cleared, bosses slain, levels gained — multiplied by the difficulty tier.</p>
      <div class="masteries">${mastery}</div>
      <button class="btn" data-back>Back</button>
    </div>`);
  click(el, '[data-buy]', (b) => on.buy(b.dataset.buy as MetaId));
  click(el, '[data-back]', on.back);
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
): void {
  const canReroll = reroll.free > 0 || reroll.gold >= reroll.cost;
  const el = show(`
    <div class="levelup">
      <h1 class="small">Level ${level}</h1>
      <p class="sub">Choose a boon</p>
      <div class="cards">
        ${options.map((o, i) => {
          const t = optionText(o, cls);
          const kind = o.kind === 'tradeoff' ? 'tradeoff' : o.rarity;
          const special = o.kind === 'stat' && o.key === 'secondary' ? 'special' : '';
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

export function showRelicOffer(options: RelicId[], held: RelicId[], slots: number, on: { take: (id: RelicId, replace?: number) => void; skip: () => void }): void {
  const full = held.length >= slots;
  const el = show(`
    <div class="levelup">
      <h1 class="small">${options.length > 1 ? 'Spoils of the fallen' : 'A relic!'}</h1>
      <p class="sub">${full ? 'Your reliquary is full — choosing one means giving another up' : `Choose a relic (${held.length}/${slots} slots)`}</p>
      <div class="cards">${options.map((id, i) => relicCard(id, `data-pick="${i}"`, `<div class="num">${i + 1}</div>`)).join('')}</div>
      <button class="btn" data-skip>Leave it</button>
    </div>`);
  click(el, '[data-pick]', (b) => {
    const id = options[Number(b.dataset.pick)];
    if (!full) return on.take(id);
    const el2 = show(`
      <div class="levelup">
        <h1 class="small">Give up which relic?</h1>
        <p class="sub">for ${relicDef(id).icon} ${relicDef(id).name}</p>
        <div class="cards">${held.map((h, i) => relicCard(h, `data-pick="${i}"`)).join('')}</div>
        <button class="btn" data-skip>Keep them all</button>
      </div>`);
    click(el2, '[data-pick]', (c) => on.take(id, Number(c.dataset.pick)));
    click(el2, '[data-skip]', on.skip);
  });
  click(el, '[data-skip]', on.skip);
  numberKeys(el);
}

export function showAbilityUpgrade(tier: number, options: readonly AbilityUpgradeId[], cls: ClassDef, onPick: (id: AbilityUpgradeId) => void): void {
  const el = show(`
    <div class="levelup">
      <h1 class="small">${cls.ability.name} — tier ${tier + 1}</h1>
      <p class="sub">Choose one path. The other is lost for this run.</p>
      <div class="cards">
        ${options.map((id, i) => `<button class="card panel boon special" data-pick="${id}"><div class="num">${i + 1}</div><h2>${ABILITY_UPGRADES[id].name}</h2><p>${ABILITY_UPGRADES[id].desc}</p></button>`).join('<div class="or heading">or</div>')}
      </div>
    </div>`);
  click(el, '[data-pick]', (b) => onPick(b.dataset.pick as AbilityUpgradeId));
  numberKeys(el);
}

export function showPause(info: { relics: RelicId[]; upgrades: AbilityUpgradeId[] }, onResume: () => void, onQuit: () => void): void {
  const relics = info.relics.map((id) => `<div><span>${relicDef(id).icon} ${relicDef(id).name}</span><em>${relicDef(id).desc}</em></div>`).join('');
  const ups = info.upgrades.map((id) => `<div><span>✦ ${ABILITY_UPGRADES[id].name}</span><em>${ABILITY_UPGRADES[id].desc}</em></div>`).join('');
  const el = show(`
    <div class="panel dialog">
      <h1 class="small">Paused</h1>
      ${relics || ups ? `<div class="build">${ups}${relics}</div>` : ''}
      <button class="btn big" data-resume>Resume</button>
      <button class="btn" data-quit>End run (keeps your gold)</button>
    </div>`);
  click(el, '[data-resume]', onResume);
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
  gold: number;
  classXp: number;
  masteryRank: number;
  tier: string;
  tierUnlocked: string | null;
  earned: AchievementDef[];
  slain: boolean; // false = the player ended the run from the pause menu
  seed: string; // type it on the class select screen to replay the run
  curseMult: number;
  daily: string | null;
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
        <div class="earned"><span>Gold banked</span><b>🪙 +${r.gold}</b></div>
        <div class="earned"><span>${r.cls.name} mastery</span><b>+${r.classXp} XP · rank ${r.masteryRank}</b></div>
      </div>
      ${unlocks ? `<div class="unlocks">${unlocks}</div>` : ''}
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
  slots: number;
}

/** Between Acts. Everything here costs run gold, and run gold is what you would otherwise bank for the Keep. */
export function showMerchant(info: MerchantInfo, on: { heal: () => void; buy: (r: Rarity) => void; reroll: (i: number) => void; remove: (i: number) => void; leave: () => void }): void {
  const price = (item: MerchantItem) => merchantPrice(item, info.act);
  const offer = (item: MerchantItem, attrs: string, title: string, text: string, enabled: boolean) =>
    `<button class="card panel boon shop" ${attrs} ${enabled && info.gold >= price(item) ? '' : 'disabled'}><h2>${title}</h2><p>${text}</p><div class="best">🪙 ${price(item)}</div></button>`;
  const full = info.relics.length >= info.slots;
  const held = info.relics.map((id, i) => {
    const r = relicDef(id);
    return `<div class="held ${r.rarity}"><span>${r.icon} ${r.name}</span>
      <button class="chip" data-reroll="${i}" ${info.gold >= price('reroll') ? '' : 'disabled'} data-tip="Swap it for a random ${r.rarity} relic">Reroll 🪙 ${price('reroll')}</button>
      <button class="chip" data-remove="${i}" ${info.gold >= price('remove') ? '' : 'disabled'} data-tip="Drop it to free the slot">Remove 🪙 ${price('remove')}</button></div>`;
  }).join('');
  const el = show(`
    <div class="levelup merchant">
      <h1 class="small">${actName(info.act)} is won</h1>
      <p class="sub">The Merchant waits by the gate. Purse: <b class="goldtext">🪙 ${info.gold}</b> — what you spend here never reaches the Keep.</p>
      <div class="cards">
        ${offer('heal', 'data-heal', 'Field Surgeon', `Heal half your HP (${Math.ceil(info.hp)} / ${Math.round(info.maxHp)}).`, info.hp < info.maxHp)}
        ${(Object.keys(RELIC_WEIGHTS) as Rarity[]).map((r) => offer(`buy:${r}`, `data-buy="${r}"`, `${r[0].toUpperCase()}${r.slice(1)} relic`, full ? 'Your reliquary is full.' : `A random ${r} relic.`, !full)).join('')}
      </div>
      ${held ? `<div class="panel heldlist">${held}</div>` : ''}
      <button class="btn big" data-leave>March on</button>
    </div>`);
  click(el, '[data-heal]', on.heal);
  click(el, '[data-buy]', (b) => on.buy(b.dataset.buy as Rarity));
  click(el, '[data-reroll]', (b) => on.reroll(Number(b.dataset.reroll)));
  click(el, '[data-remove]', (b) => on.remove(Number(b.dataset.remove)));
  click(el, '[data-leave]', on.leave);
  onActions((a) => a === 'confirm' && on.leave());
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
