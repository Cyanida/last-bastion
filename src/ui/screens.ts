import { ABILITY_UPGRADES, type AbilityUpgradeId } from '../config/abilityUpgrades';
import { ACHIEVEMENTS, type AchievementDef } from '../config/achievements';
import { ARENA_IDS, ARENAS, type ArenaId } from '../config/arenas';
import { CLASS_ORDER, CLASSES, type ClassDef, type ClassId } from '../config/classes';
import { MASTERY, META, META_IDS, TIER_UNLOCK_WAVE, TIERS, type MetaId } from '../config/economy';
import { relicDef, type RelicId } from '../config/relics';
import { STAT_KEYS, type StatKey, type Stats } from '../core/types';
import { gateOf, lockedArenas } from '../logic/achievements';
import { masteryRank, metaCost } from '../logic/economy';
import { exportSave, type Save } from '../logic/save';
import { optionText, statLabel, type LevelUpOption } from '../logic/upgrades';
import { getSprite } from '../render/sprites';

const overlay = () => document.getElementById('overlay')!;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

function show(html: string): HTMLElement {
  clearOverlay();
  const el = overlay();
  el.innerHTML = html;
  el.classList.remove('hidden');
  return el;
}

export function clearOverlay(): void {
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  keyHandler = null;
  overlay().classList.add('hidden');
  overlay().innerHTML = '';
}

function onKeys(handler: (e: KeyboardEvent) => void): void {
  keyHandler = handler;
  window.addEventListener('keydown', handler);
}

function click(el: HTMLElement, selector: string, fn: (target: HTMLElement) => void): void {
  el.querySelectorAll<HTMLElement>(selector).forEach((b) => (b.onclick = () => fn(b)));
}

/** Number keys 1..n pick the n-th [data-pick] card. */
function numberKeys(el: HTMLElement, other?: (e: KeyboardEvent) => void): void {
  onKeys((e) => {
    const m = /^Digit(\d)$/.exec(e.code);
    if (m) el.querySelectorAll<HTMLElement>('[data-pick]')[Number(m[1]) - 1]?.click();
    else other?.(e);
  });
}

const fmtStat = (k: StatKey, v: number) => (k === 'atkSpd' ? v.toFixed(2) : String(Math.round(v * 10) / 10));
const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const relicCard = (id: RelicId, attrs: string, extra = '') => {
  const r = relicDef(id);
  return `<button class="card panel boon relic-card ${r.rarity}" ${attrs}><div class="relic-icon">${r.icon}</div><h2>${r.name}</h2><div class="tag">${r.rarity}${r.classId ? ` · ${CLASSES[r.classId].name}` : ''}</div><p>${r.desc}</p>${extra}</button>`;
};

// ---------------------------------------------------------------- title & menus

export function showTitle(gold: number, on: { start: () => void; keep: () => void; chronicle: () => void; save: () => void }): void {
  const el = show(`
    <div class="title">
      <h1>Last Bastion</h1>
      <div class="version">V0.2</div>
      <p class="sub">The walls have fallen silent. The courtyard has not.</p>
      <button class="btn big" data-go="start">Take up arms</button>
      <div class="row">
        <button class="btn" data-go="keep">The Keep · 🪙 ${gold}</button>
        <button class="btn" data-go="chronicle">Chronicle</button>
        <button class="btn" data-go="save">Save data</button>
      </div>
      <p class="hint">WASD / arrows to move · attacks are automatic · Space or right mouse for your signature ability · Esc / P to pause · M to mute</p>
    </div>`);
  click(el, '[data-go]', (b) => on[b.dataset.go as keyof typeof on]());
  onKeys((e) => (e.code === 'Enter' || e.code === 'Space') && on.start());
}

export function showClassSelect(save: Save, on: { pick: (id: ClassId) => void; back: () => void; settings: (arena: ArenaId, tier: number) => void }): void {
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
  const el = show(`
    <div class="select">
      <h1 class="small">Choose your champion</h1>
      <div class="pickers">
        <div><span class="label">Arena</span>${ARENA_IDS.map(arenaBtn).join('')}</div>
        <div><span class="label">Difficulty</span>${TIERS.map((_, i) => tierBtn(i)).join('')}</div>
      </div>
      <div class="cards">${CLASS_ORDER.map((id) => card(CLASSES[id])).join('')}</div>
      <button class="btn" data-back>Back</button>
    </div>`);
  el.querySelectorAll<HTMLElement>('[data-sprite]').forEach((slot) => slot.appendChild(getSprite(slot.dataset.sprite as ClassDef['sprite'], 6).img));
  click(el, '[data-class]', (b) => on.pick(b.dataset.class as ClassId));
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
  numberKeys(el, (e) => e.code === 'KeyR' && canReroll && on.reroll());
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
        <div><span>Wave reached</span><b>${r.wave}</b></div>
        <div><span>Enemies slain</span><b>${r.kills}</b></div>
        <div><span>Time survived</span><b>${fmtTime(r.time)}</b></div>
        <div><span>Level</span><b>${r.level}</b></div>
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
  onKeys((e) => e.code === 'Enter' && onRetry());
}
