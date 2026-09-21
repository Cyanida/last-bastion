import { ABILITY_UPGRADES } from '../config/abilityUpgrades';
import { ARMOR, DAMAGE_TYPES, RESISTS, STATUSES, type DamageType } from '../config/damage';
import { AFFIXES } from '../config/elites';
import { relicDef } from '../config/relics';
import { MODIFIERS } from '../config/waves';
import { STAT_KEYS, type Enemy, type Game, type StatKey } from '../core/types';
import { critChance, xpToNext } from '../logic/formulas';
import { activeStatuses } from '../logic/status';
import { statLabel } from '../logic/upgrades';
import { describeAbility } from '../systems/abilities';

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
  el.style.left = `${Math.min(window.innerWidth - 240, x + 18)}px`;
  el.style.top = `${Math.max(8, y - 20)}px`;
}

const root = () => document.getElementById('hud')!;
const $ = (id: string) => document.getElementById(id)!;

export function buildHud(onPause: () => void, onMute: () => void): void {
  root().innerHTML = `
    <div class="hud-tl panel">
      <div class="hud-name"><span id="h-class"></span> <span class="gold">Lv <span id="h-level"></span></span></div>
      <div class="bar hp"><div id="h-hp-fill"></div><span id="h-hp-text"></span></div>
      <div class="bar xp"><div id="h-xp-fill"></div><span id="h-xp-text"></span></div>
      <div class="hud-purse"><span id="h-gold"></span><span id="h-tier" class="dim"></span></div>
      <div id="h-status"></div>
    </div>
    <div id="h-inspect" class="panel hidden"></div>
    <div class="hud-top">
      <div id="h-wave" class="heading"></div>
      <div id="h-left"></div>
      <div id="h-mod" class="hidden"></div>
      <div id="h-boss" class="hidden"><div id="h-boss-name" class="heading"></div><div class="bar boss"><div id="h-boss-fill"></div></div></div>
    </div>
    <div class="hud-tr"><button id="btn-mute" title="Mute (M)"></button><button id="btn-pause" title="Pause (Esc / P)">❚❚</button></div>
    <div class="hud-stats panel" id="h-stats"></div>
    <div class="hud-relics" id="h-relics"></div>
    <div class="hud-ability panel">
      <div id="h-ab-icon"><div id="h-ab-cd"></div><span id="h-ab-time"></span></div>
      <div><div id="h-ab-name" class="heading"></div><div id="h-ab-desc"></div><div id="h-ab-ups" class="hint"></div></div>
    </div>
    <div id="h-banner" class="heading"></div>`;
  $('btn-pause').onclick = onPause;
  $('btn-mute').onclick = onMute;
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
function width(id: string, frac: number): void {
  const w = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  const el = $(id);
  if (el.style.width !== w) el.style.width = w;
}

const fmt = (key: StatKey, v: number) => (key === 'atkSpd' ? v.toFixed(2) : String(Math.round(v * 10) / 10));
const esc = (s: string) => s.replace(/"/g, '&quot;');

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

  text('h-wave', g.wave > 0 ? `Wave ${g.wave}` : 'Prepare…');
  const left = g.enemies.length + g.spawnQueue.length;
  text('h-left', g.breather > 0 && g.wave > 0 ? 'Next wave incoming' : `${left} enemies remaining`);
  $('h-mod').classList.toggle('hidden', !g.modifier);
  if (g.modifier) text('h-mod', `${MODIFIERS[g.modifier].name} — ${MODIFIERS[g.modifier].desc}`);

  const boss = g.enemies.find((e) => e.def.boss);
  $('h-boss').classList.toggle('hidden', !boss);
  if (boss) {
    text('h-boss-name', boss.phase === 2 ? `${boss.def.name} — enraged` : boss.def.name);
    width('h-boss-fill', boss.hp / boss.maxHp);
  }

  const stats = STAT_KEYS.map((k) => `<div><span>${statLabel(k, p.cls)}</span><b>${fmt(k, p.stats[k])}</b></div>`).join('');
  const crit = Math.round(Math.min(0.6, critChance(p.stats.dex) + p.mods.crit) * 100);
  const armor = Math.round(Math.min(0.8, p.cls.armor + p.mods.armor) * 100);
  html('h-stats', `${stats}<div class="dim"><span>Crit · Armor</span><b>${crit}% · ${armor}%</b></div><div class="dim"><span>Damage</span><b>×${(p.mods.damage * p.buff.damage).toFixed(2)}</b></div>`);

  const slots = Array.from({ length: g.relicSlots }, (_, i) => {
    const id = g.relics[i];
    if (!id) return '<div class="relic empty"></div>';
    const r = relicDef(id);
    return `<div class="relic ${r.rarity}" tabindex="0" data-tip="${esc(`${r.name} — ${r.desc}`)}">${r.icon}</div>`;
  }).join('');
  html('h-relics', slots);

  text('h-ab-name', p.cls.ability.name);
  text('h-ab-desc', describeAbility(p));
  text('h-ab-ups', p.upgrades.length ? p.upgrades.map((id) => ABILITY_UPGRADES[id].name).join(' · ') : 'Space / Right mouse');
  const ready = p.abilityCd <= 0;
  $('h-ab-icon').classList.toggle('ready', ready);
  $('h-ab-icon').classList.toggle('active', p.abilityTime > 0);
  $('h-ab-cd').style.height = `${(p.abilityCd / p.abilityCdMax) * 100}%`;
  text('h-ab-time', ready ? '✦' : p.abilityCd.toFixed(1));
  // the touch ability button mirrors the cooldown, because a thumb covers the HUD panel
  const touchBtn = document.getElementById('btn-ability');
  if (touchBtn) {
    touchBtn.classList.toggle('ready', ready);
    text('btn-ability-text', ready ? '✦' : p.abilityCd.toFixed(0));
    $('btn-ability-cd').style.height = `${(p.abilityCd / p.abilityCdMax) * 100}%`;
  }

  html('h-status', activeStatuses(p.statuses).map((id) => `<span style="background:${STATUSES[id].color}">${STATUSES[id].name}${(p.statuses[id]?.stacks ?? 1) > 1 ? ` ×${p.statuses[id]!.stacks}` : ''}</span>`).join(''));

  const banner = $('h-banner');
  text('h-banner', g.banner.text);
  banner.style.opacity = String(Math.max(0, Math.min(1, g.banner.t)));
}
