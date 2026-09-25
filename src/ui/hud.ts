import { EVOLUTIONS } from '../config/evolutions';
import { buildState, evolutionIn } from '../systems/evolutions';
import { SKILL } from '../config/game';
import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import { ARMOR, DAMAGE_TYPES, RESISTS, STATUSES, type DamageType } from '../config/damage';
import { AFFIXES } from '../config/elites';
import { DUOS, FAMILIES, FAMILY_IDS, RELIC_MAX_TIER, RELIC_STACKING, relicDef, type DuoId, type FamilyId, type RelicId } from '../config/relics';
import { MODIFIERS } from '../config/waves';
import { STAT_KEYS, type Enemy, type Game, type Mods, type Quest, type StatKey } from '../core/types';
import { critChance, xpToNext } from '../logic/formulas';
import { actName } from '../logic/acts';
import { shieldBurst } from '../logic/abilities';
import { duoTier, familySets, looseRelics, softCap, type RelicModTotal } from '../logic/relics';
import { activeStatuses } from '../logic/status';
import { statLabel } from '../logic/upgrades';
import { describeAbility } from '../systems/abilities';
import { describeUtility, utilityDef, utilityUnlocked } from '../systems/utility';
import { UTILITY } from '../config/utility';
import { QUESTS, REWARDS } from '../config/quests';
import { questProgress } from '../logic/quests';
import { duoTip, esc, relicClass, relicTip, setRecipeBuild, tierBadge } from './relicText';
import { isTestRun } from '../systems/testMode';

/** Tooltip for the enemy under the pointer (hover, or a tap on touch): what it is, what hurts it, what is on it. */
export function updateInspect(e: Enemy | null, x: number, y: number): void {
  const el = $('h-inspect');
  el.classList.toggle('hidden', !e);
  if (!e) return;
  const resists = Object.entries(RESISTS[e.def.id] ?? {}) as [DamageType, number][];
  const list = (pick: (m: number) => boolean) => resists.filter(([, m]) => pick(m)).map(([t, m]) => `<i style="color:${DAMAGE_TYPES[t].color}">${DAMAGE_TYPES[t].name} ×${m}</i>`).join(' ');
  const weak = list((m) => m > 1);
  const strong = list((m) => m < 1);
  const armor = ARMOR[e.def.id];
  const statuses = activeStatuses(e.statuses).map((id) => `${STATUSES[id].name}${e.statuses[id]!.stacks > 1 ? ` ×${e.statuses[id]!.stacks}` : ''}`);
  html('h-inspect', `
    <b>${e.elite ? 'Elite ' : ''}${e.def.name}</b>${e.def.aura ? ' <em>commander</em>' : ''}
    <div>${Math.ceil(e.hp)} / ${e.maxHp} HP${e.ai !== 'idle' && !e.def.boss ? ` · ${e.ai}` : ''}</div>
    ${e.affixes.length ? `<div>${e.affixes.map((a) => AFFIXES[a].name).join(' · ')}</div>` : ''}
    ${weak ? `<div>Weak to ${weak}</div>` : ''}${strong ? `<div>Resists ${strong}</div>` : ''}
    ${armor ? `<div>${e.armorHp > 0 ? (armor.backBreak ? 'Shield up: strike it from behind' : `Armored: soaks ${Math.round(armor.reduction * 100)}% until broken`) : 'Armor broken'}</div>` : ''}
    ${e.def.aura ? `<div>Aura: ${e.def.aura.kind === 'heal' ? 'heals and rallies' : `+${Math.round((e.def.aura.value - 1) * 100)}% ${e.def.aura.kind}`} nearby allies</div>` : ''}
    ${statuses.length ? `<div>${statuses.join(' · ')}</div>` : ''}`);
  // right of the pointer, and above it in the lower half so it never runs off the bottom
  el.style.left = `${Math.min(window.innerWidth - 260, x + 18)}px`;
  const below = y < window.innerHeight / 2;
  el.style.top = below ? `${Math.max(8, y - 20)}px` : '';
  el.style.bottom = below ? '' : `${window.innerHeight - y - 20}px`;
}

const root = () => document.getElementById('hud')!;
const $ = (id: string) => document.getElementById(id)!;

/**
 * Four corner stacks and two centre columns: elements in one stack flow and never overlap. The minimap is a canvas drawing;
 * #h-map is its frame in the flow (renderer.ts drawMinimap draws inside it). Shared looks (style.css): .hud-panel (parchment,
 * anchored), .hud-plate (dark, floating text and tooltips), .hud-badge (keys, tiers, chips).
 */
export function buildHud(onPause: () => void, onMute: () => void): void {
  root().innerHTML = `
    <div class="hud-left">
      <div class="hud-tl hud-panel">
        <div class="hud-name"><span id="h-class"></span><span>Lv <span id="h-level"></span></span></div>
        <div class="bar hp"><div id="h-hp-fill"></div><span id="h-hp-text"></span></div>
        <div class="bar xp"><div id="h-xp-fill"></div><span id="h-xp-text"></span></div>
        <div class="hud-purse"><span id="h-gold"></span><span id="h-tier"></span></div>
        <div id="h-status"></div>
      </div>
      <div id="h-quests" class="hud-quests"></div>
      <div id="h-map"></div>
      <div class="hud-stats hud-panel" id="h-stats" tabindex="0"><div id="h-stats-grid"></div><div id="h-stats-all" class="hud-pop hud-plate"></div></div>
    </div>
    <div class="hud-right">
      <div class="hud-tr"><button id="btn-mute" title="Mute (M)"></button><button id="btn-pause" title="Pause (Esc / P)">❚❚</button></div>
      <div id="h-p2" class="hud-tl hud-panel hidden">
        <div class="hud-name"><span id="h-p2-class"></span><span>Lv <span id="h-p2-level"></span></span></div>
        <div class="bar hp"><div id="h-p2-hp-fill"></div><span id="h-p2-hp-text"></span></div>
        <div class="hud-purse"><span id="h-p2-ab"></span><span id="h-p2-ut"></span></div>
      </div>
      <div class="hud-families" id="h-families"></div>
      <div class="hud-relics" id="h-relics"></div>
      <div id="h-toasts"></div>
    </div>
    <div class="hud-top">
      <div id="h-test" class="hud-plate hud-test hidden">TEST</div>
      <div class="hud-wave hud-plate">
        <div id="h-wave"></div>
        <div id="h-left"></div>
        <div id="h-mod" class="hidden"></div>
        <div id="h-boss" class="hidden"><div id="h-boss-name"></div><div class="bar boss"><div id="h-boss-fill"></div></div></div>
      </div>
      <div id="h-banner" class="hud-plate"></div>
    </div>
    <div class="hud-bottom">
      <div id="h-talent" class="hud-plate hidden"></div>
      <div class="hud-ability hud-panel">
        <div class="hud-slot"><div id="h-ab-icon"><div id="h-ab-cd"></div><span id="h-ab-time"></span></div><b class="hud-badge hud-key">Space</b></div>
        <div id="h-ab-text"><div id="h-ab-name"></div><div id="h-ab-desc"></div><div id="h-ab-ups"></div></div>
        <div class="hud-slot" id="h-ut-slot" tabindex="0"><div id="h-ut-icon"><div id="h-ut-cd"></div><span id="h-ut-time"></span></div><span><b class="hud-badge hud-key">E</b> <span id="h-ut-name"></span></span></div>
      </div>
    </div>
    <div id="h-inspect" class="hud-plate hidden"></div>`;
  $('btn-pause').onclick = onPause;
  $('btn-mute').onclick = onMute;
  addEventListener('resize', () => (lastRelicKey = '')); // the relic bar's fit depends on the width
}

const TOAST_TIME = 4000;
const TOAST_MAX = 3;

/** v0.4: an achievement tier earned mid-run (v0.5: or a quest done or failed), in the top-right stack. At most three at a time (two on phones), gone after a few seconds. */
export function toast(title: string, body: string, icon = '🏆'): void {
  const box = $('h-toasts');
  const el = document.createElement('div');
  el.className = 'toast hud-plate';
  el.innerHTML = `<b>${icon} ${title}</b><span>${body}</span>`;
  box.appendChild(el);
  while (box.children.length > TOAST_MAX) box.firstElementChild!.remove();
  setTimeout(() => el.remove(), TOAST_TIME);
}

export function setMuteIcon(muted: boolean): void {
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
}

export function showHud(show: boolean): void {
  root().classList.toggle('hidden', !show);
}

// DOM writes only when the value actually changed
function text(id: string, value: string): void {
  const el = $(id);
  if (el.textContent !== value) el.textContent = value;
}
function html(id: string, value: string): void {
  const el = $(id);
  if (el.dataset.html !== value) el.innerHTML = el.dataset.html = value;
}
function tip(id: string, value: string): void {
  const el = $(id);
  if (el.dataset.tip !== value) el.dataset.tip = value;
}
function width(id: string, frac: number): void {
  const w = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  const el = $(id);
  if (el.style.width !== w) el.style.width = w;
}

const toastedQuests = new WeakSet<Quest>(); // v0.5: each finished quest is toasted once

const fmt = (key: StatKey, v: number) => (key === 'atkSpd' ? v.toFixed(2) : String(Math.round(v * 10) / 10));
const lastLevels: Partial<Record<FamilyId, number>> = {}; // v0.7: family set levels last shown (a new threshold flashes)
let lastAttKey = '';
let lastRelicKey = '';
const MOD_NAMES: Partial<Record<keyof Mods, string>> = { damage: 'damage', atkSpd: 'attack speed', moveSpd: 'speed', cooldown: 'cooldown cut', pickup: 'pickup', xp: 'XP', gold: 'gold', armor: 'armor', crit: 'crit', pierce: 'pierce', minionAtkSpd: 'minion speed', minionDamage: 'minion damage' };

export function updateHud(g: Game): void {
  const p = g.player;
  text('h-class', p.cls.name);
  text('h-level', String(p.level));
  width('h-hp-fill', p.hp / p.stats.hp);
  text('h-hp-text', `${Math.ceil(p.hp)} / ${Math.round(p.stats.hp)}`);
  width('h-xp-fill', p.xp / xpToNext(p.level));
  text('h-xp-text', `${Math.floor(p.xp)} / ${xpToNext(p.level)} XP`);
  text('h-gold', `🪙 ${g.gold}`);
  text('h-tier', `${g.tier.name} · ${g.arena.name}`);
  // v0.8 (#28): the second player's own panel, on their half of the screen (ponytail: players 3-4 get one with local co-op, #1)
  const p2 = g.players[1];
  $('h-p2').classList.toggle('hidden', !p2);
  if (p2) {
    text('h-p2-class', `P2 · ${p2.cls.name}`);
    text('h-p2-level', String(p2.level));
    width('h-p2-hp-fill', p2.hp / p2.stats.hp);
    text('h-p2-hp-text', `${Math.ceil(p2.hp)} / ${Math.round(p2.stats.hp)}`);
    text('h-p2-ab', `${p2.cls.ability.name} ${p2.abilityCd <= 0 ? '✦' : p2.abilityCd.toFixed(1)}`);
    text('h-p2-ut', utilityUnlocked(p2) ? `${utilityDef(p2).name} ${p2.utilityCd <= 0 ? '✦' : p2.utilityCd.toFixed(1)}` : '');
  }

  $('h-test').classList.toggle('hidden', !isTestRun(g)); // v0.7.1 test mode
  text('h-wave', g.wave > 0 ? `${g.victory === 'endless' ? 'Endless · ' : ''}${actName(g.act)} · Wave ${g.wave}` : 'Prepare…');
  let left = g.spawnQueue.length;
  for (const e of g.enemies) if (!e.side) left++; // v0.5: lairs, quest targets and events are not the wave
  const clock = `${Math.floor(g.time / 60)}:${String(Math.floor(g.time % 60)).padStart(2, '0')}`; // v0.6: the run's time
  text('h-left', `${g.breather > 0 && g.wave > 0 ? 'Next wave incoming' : `${left} ${left === 1 ? 'enemy' : 'enemies'} remaining`} · ⏱ ${clock}`);
  $('h-mod').classList.toggle('hidden', !g.modifier);
  if (g.modifier) html('h-mod', `<b>${MODIFIERS[g.modifier].name}</b><span> — ${MODIFIERS[g.modifier].desc}</span>`); // phones show the name only

  const boss = g.enemies.find((e) => e.def.boss);
  $('h-boss').classList.toggle('hidden', !boss);
  if (boss) {
    text('h-boss-name', boss.warded ? `${boss.def.name} — warded: put out the Royal Flames` : boss.phase >= 2 ? `${boss.def.name} — enraged` : boss.def.name);
    width('h-boss-fill', boss.hp / boss.maxHp);
  }

  const stats = STAT_KEYS.map((k) => `<div><span>${statLabel(k, p.cls)}</span><b>${fmt(k, p.stats[k])}</b></div>`).join('');
  const crit = Math.round(Math.min(0.6, critChance(p.stats.dex) + p.mods.crit) * 100);
  const armor = Math.round(Math.min(0.8, p.cls.armor + p.mods.armor) * 100);
  const relicStats = (Object.entries(g.player.relics.totals) as [keyof Mods, RelicModTotal][]).filter(([, t]) => t.count > 1);
  const relicRows = relicStats.map(([key, t]) => `<div class="dim" data-tip="${esc(`${t.count} relics add up to +${Math.round(t.raw * 100)}% ${MOD_NAMES[key] ?? key}.`)}"><span>Relics: ${MOD_NAMES[key] ?? key}</span><b>+${Math.round(t.eff * 100)}%</b></div>`).join('');
  const procs = ''; // v0.7: no proc sharing
  const heal = g.vars.relicHeal ?? 0;
  const healRow = heal > 0 ? `<div class="dim" data-tip="${esc(`Relics healed ${Math.round(heal * 100)}% of your max HP this wave. Past the soft cap (${Math.round(RELIC_STACKING.healCap * 100)}%) each further heal counts for less.`)}"><span>Relic healing (wave)</span><b>${Math.round(softCap(heal, RELIC_STACKING.healCap) * 100)}%${heal > RELIC_STACKING.healCap ? ` <s>${Math.round(heal * 100)}</s>` : ''}</b></div>` : '';
  const damage = `×${(p.mods.damage * p.buff.damage).toFixed(2)}`;
  // in a fight: the six numbers that matter, in two columns; hover (tap) the panel for everything
  const cell = (label: string, value: string) => `<div><span>${label}</span><b>${value}</b></div>`;
  html('h-stats-grid', cell('Damage', damage) + cell('Attack', `${p.stats.atkSpd.toFixed(2)}/s`) + cell('Crit', `${crit}%`) + cell('Armor', `${armor}%`) + cell('Speed', String(Math.round(p.stats.moveSpd))) + cell(statLabel('secondary', p.cls), fmt('secondary', p.stats.secondary)));
  html('h-stats-all', `${stats}<div class="dim"><span>Crit · Armor</span><b>${crit}% · ${armor}%</b></div><div class="dim"><span>Damage</span><b>${damage}</b></div>${relicRows}${procs}${healRow}`);

  // relic bar: one row of the newest relics that fit, older ones behind a "+N" chip (hover or tap); tap or hover a relic for its tooltip.
  // Rebuilt only when the set changes (or the window is resized).
  const relicKey = `${g.player.relics.held.map((id) => `${id}${g.player.relics.tiers[id]}`).join(',')}|${g.player.relics.duos.join(',')}|${g.player.talents.length}|${g.evolutions.length}|${g.player.upgrades.length}|${g.player.utilityUpgrades.length}`; // v0.6: recipes change the tooltips too
  if (relicKey !== lastRelicKey) {
    lastRelicKey = relicKey;
    lastAttKey = ''; // new tiles: draw their attunement bars again
    setRecipeBuild(buildState(g));
    const tile = (id: RelicId) => {
      const r = relicDef(id);
      const tier = g.player.relics.tiers[id] ?? 1;
      return `<div class="relic ${relicClass(id)}" data-id="${id}" tabindex="0" data-tip="${esc(relicTip(id, tier, g.player.relics.held))}">${r.icon}${tierBadge(tier)}${tier < RELIC_MAX_TIER ? '<i class="att"></i>' : ''}</div>`;
    };
    // 50px a tile; desktop keeps clear of the ability panel, touch (bar at the top) of the wave plate
    const fit = Math.max(3, Math.min(8, Math.floor((innerWidth / 2 - (document.documentElement.classList.contains('compact') ? 140 : 300)) / 50)));
    const loose = looseRelics(g.player.relics.held, g.player.relics.duos); // v0.7.5 (#96): a duo's two relics show as the duo
    const older = loose.length > fit ? loose.slice(0, loose.length - fit) : [];
    const more = older.length ? `<div class="relic more" tabindex="0">+${older.length}<div class="hud-pop hud-plate">${older.map(tile).join('')}</div></div>` : '';
    const duos = g.player.relics.duos.map((d) => {
      const tier = duoTier(g.player.relics.tiers, d);
      return `<div class="relic duo" data-duo="${d}" tabindex="0" data-tip="${esc(duoTip(d, tier))}">${DUOS[d].icon}${tierBadge(tier)}${tier < RELIC_MAX_TIER ? '<i class="att"></i>' : ''}</div>`;
    }).join(''); // v0.7 A5
    html('h-relics', more + loose.slice(older.length).map(tile).join('') + duos);
    // v0.7: the family row: icon and count per family held; a reached threshold (2, 4, 6) lights up, and flashes when it is new
    const sets = familySets(g.player.relics.held);
    html('h-families', FAMILY_IDS.filter((f) => sets[f]).map((f) => {
      const st = sets[f]!;
      const fam = FAMILIES[f];
      const fresh = st.level > (lastLevels[f] ?? 0);
      lastLevels[f] = st.level;
      const next = ([2, 4, 6] as const).find((l) => l > st.count);
      const tip = `${fam.name} · ${st.count} held${st.level ? ` · ${([2, 4, 6] as const).filter((l) => st.level >= l).map((l) => fam.sets[l][0]).join(', ')}` : ''}${next ? `\nNext at ${next}: ${fam.sets[next][0]}, ${fam.sets[next][1]}` : ''}`;
      return `<div class="fam-chip ${st.level ? 'on' : ''} ${fresh ? 'flash' : ''}" style="--fam:${fam.color}" tabindex="0" data-tip="${esc(tip)}">${fam.icon}<b>${st.count}</b></div>`;
    }).join(''));
  }
  // v0.7 A4: attunement bars under the relic tiles
  const attKey = g.player.relics.held.map((id) => Math.floor((g.player.relics.attune[id] ?? 0) * 40)).join(',');
  if (attKey !== lastAttKey) {
    lastAttKey = attKey;
    for (const el of document.querySelectorAll<HTMLElement>('#h-relics .relic[data-id]')) el.style.setProperty('--att', String(g.player.relics.attune[el.dataset.id as RelicId] ?? 0));
    for (const el of document.querySelectorAll<HTMLElement>('#h-relics .relic[data-duo]')) el.style.setProperty('--att', String(Math.max(...DUOS[el.dataset.duo as DuoId].from.map((id) => g.player.relics.attune[id] ?? 0))));
  }

  const sig = evolutionIn(g, 'signature'); // v0.6: an evolved ability wears its new name
  text('h-ab-name', sig ? `${EVOLUTIONS[sig].icon} ${EVOLUTIONS[sig].name}` : p.cls.ability.name);
  const desc = describeAbility(p);
  text('h-ab-desc', desc);
  html('h-ab-ups', p.upgrades.map((id) => `<b class="hud-badge">${ABILITY_UPGRADES[id].name}</b>`).join(''));
  tip('h-ab-text', `${p.cls.ability.name} (Space / Right mouse)\n${desc}${p.upgrades.length ? `\nUpgrades: ${p.upgrades.map((id) => ABILITY_UPGRADES[id].name).join(', ')}` : ''}`);
  const ready = p.abilityCd <= 0;
  $('h-ab-icon').classList.toggle('ready', ready);
  $('h-ab-icon').classList.toggle('active', p.abilityTime > 0);
  $('h-ab-cd').style.height = `${(p.abilityCd / p.abilityCdMax) * 100}%`;
  // v0.7.4 (#63): while Divine Shield holds, the slot shows the burst a second press would set off
  const ab = p.cls.ability;
  const detonate = p.abilityTime > 0 && ab.id === 'divineShield' ? `${Math.round(shieldBurst(ab.earlyBurst, g.vars['shield.up'] ?? 0, p.abilityTime) * 100)}%` : '';
  text('h-ab-time', detonate || (ready ? '✦' : p.abilityCd.toFixed(1)));
  // the touch ability button mirrors the cooldown, because a thumb covers the HUD panel
  const touchBtn = document.getElementById('btn-ability');
  if (touchBtn) {
    touchBtn.classList.toggle('ready', ready);
    text('btn-ability-text', detonate || (ready ? '✦' : p.abilityCd.toFixed(0)));
    $('btn-ability-cd').style.height = `${(p.abilityCd / p.abilityCdMax) * 100}%`;
  }
  // v0.4: the utility ability slot (and its touch button), locked until UTILITY.unlockLevel
  const util = utilityDef(p);
  const unlocked = utilityUnlocked(p);
  const utilReady = unlocked && p.utilityCd <= 0;
  $('h-ut-icon').classList.toggle('ready', utilReady);
  $('h-ut-slot').classList.toggle('locked', !unlocked);
  const utilEvo = evolutionIn(g, 'utility');
  tip('h-ut-slot', `${utilEvo ? `${EVOLUTIONS[utilEvo].name}: ${EVOLUTIONS[utilEvo].desc}\n` : ''}${util.name} (E / Shift · X / RB)${unlocked ? '' : ` · unlocks at level ${UTILITY.unlockLevel}`}\n${describeUtility(p)}`);
  text('h-ut-name', utilEvo ? `${EVOLUTIONS[utilEvo].icon} ${EVOLUTIONS[utilEvo].name}` : util.name);
  $('h-ut-cd').style.height = unlocked ? `${(p.utilityCd / p.utilityCdMax) * 100}%` : '100%';
  text('h-ut-time', !unlocked ? `Lv ${UTILITY.unlockLevel}` : utilReady ? util.icon : p.utilityCd.toFixed(1));
  const utilBtn = document.getElementById('btn-utility');
  if (utilBtn) {
    utilBtn.classList.toggle('ready', utilReady);
    utilBtn.classList.toggle('hidden', !unlocked);
    text('btn-utility-text', utilReady ? util.icon : p.utilityCd.toFixed(0));
    $('btn-utility-cd').style.height = `${(p.utilityCd / p.utilityCdMax) * 100}%`;
  }
  // v0.5 quest tracker: one line per quest taken; a finished one flashes for a moment (systems/quests.ts lingers it) and is toasted once
  let lines = '';
  for (const q of g.quests) {
    if (q.state === 'offered') continue;
    lines += `<div class="hud-plate ${q.state}">${QUESTS[q.kind].icon} ${q.name} <b>${q.state === 'active' ? questProgress(q) : q.state}</b></div>`;
    if (q.state !== 'active' && !toastedQuests.has(q)) {
      toastedQuests.add(q);
      toast(q.state === 'done' ? `Quest done: ${q.name}` : `Quest failed: ${q.name}`, q.state === 'done' ? `${REWARDS[q.reward].icon} ${REWARDS[q.reward].name}` : 'No harm done. The board has more.', '📜');
    }
  }
  html('h-quests', lines);

  $('h-talent').classList.toggle('hidden', g.talentPoints === 0);
  if (g.talentPoints > 0) text('h-talent', `${g.talentPoints} talent point${g.talentPoints > 1 ? 's' : ''} to spend — pause menu`);

  // v0.6: the perfect-dodge buff and the Last Stand, as chips beside the statuses (whole seconds, so the DOM changes once a second)
  const perfect = Math.ceil((g.vars.perfectUntil ?? 0) - g.time);
  const stand = Math.ceil((g.vars.lastStandUntil ?? 0) - g.time);
  const skill = `${perfect > 0 ? `<span style="background:${SKILL.colors.perfect}">Perfect ${perfect}s</span>` : ''}${stand > 0 ? `<span style="background:#f4a595">Last Stand ${stand}s</span>` : ''}`;
  html('h-status', skill + activeStatuses(p.statuses).map((id) => `<span style="background:${STATUSES[id].color}">${STATUSES[id].name}${(p.statuses[id]?.stacks ?? 1) > 1 ? ` ×${p.statuses[id]!.stacks}` : ''}</span>`).join(''));
  root().classList.toggle('last-stand', stand > 0);

  const banner = $('h-banner');
  text('h-banner', g.banner.text);
  banner.style.opacity = String(Math.max(0, Math.min(1, g.banner.t)));

  // the minimap's frame: hidden under the Blind curse, shaped like this arena (renderer.ts draws the map inside it)
  const map = $('h-map');
  map.classList.toggle('hidden', g.curses.includes('blind'));
  if (map.dataset.arena !== g.arena.id) {
    map.dataset.arena = g.arena.id;
    map.style.aspectRatio = `${g.arena.w} / ${g.arena.h}`;
  }
}
