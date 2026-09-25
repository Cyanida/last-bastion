import { ATTUNEMENT, FAMILIES, type RelicId, type SetLevel } from '../../config/relics';
import { cooldownFloor } from '../../logic/formulas';
import { addWork } from '../../logic/relics';
import { fireProjectile } from '../../entities/hazards';
import { TAU } from '../../core/math';
import { rollPlayerHit } from '../combat';
import { ring } from '../effects';
import { awakened, bonus, credit, gainWard, nOf, nova, relicDamage, relicHeal, relicSkeletons, sOf, type RelicHooks } from '../relicCore';

/**
 * ✨ Holy (RELICS.md): healing, ward and blessing. Relics heal, grant ward (combat.damagePlayer lets ward take a hit first) or save you from
 * death; the sets turn healing into ward (Blessed), overhealing into a holy pulse (Radiance) and share it all with minions and allies (Communion).
 */
const F = FAMILIES.holy;

export const HOLY_RELICS: Partial<Record<RelicId, RelicHooks>> = {
  rallyBanner: {
    onWaveStart(g, _ev, p) {
      const heal = p.stats.hp * nOf(p, 'rallyBanner').heal;
      relicHeal(g, p, heal, true);
      if (awakened(p, 'rallyBanner')) gainWard(g, p, heal); // Hymn
    },
  },

  blessedWater: {
    tick(g, _dt, p) {
      g.vars.relicHealMult = (g.vars.relicHealMult ?? 1) + nOf(p, 'blessedWater').bonus; // combat.healPlayer reads it
    },
    onHeal(g, ev, p) {
      const bonus = nOf(p, 'blessedWater').bonus;
      credit(g, p, 'blessedWater', 'healing', (ev.amount * bonus) / (g.vars.relicHealMult ?? 1 + bonus)); // its share of the heal
      if (!awakened(p, 'blessedWater') || ev.amount <= 0) return;
      for (const id of ['poison', 'bleed', 'curse', 'slow'] as const) if (p.statuses[id]) return void delete p.statuses[id]; // Baptism
    },
  },

  guardiansAegis: {
    tick(g, dt, p) {
      const n = nOf(p, 'guardiansAegis');
      if ((g.vars['aegis.t'] = (g.vars['aegis.t'] ?? 0) + dt) >= n.every) {
        g.vars['aegis.t'] = 0;
        gainWard(g, p, p.stats.hp * n.ward);
      }
      if (awakened(p, 'guardiansAegis') && p.ward > 0) bonus(p, 'damage', 0.15); // Faithful
    },
  },

  haloOfMercy: {
    onKill(g, ev, p) {
      const n = nOf(p, 'haloOfMercy');
      if (g.rng() >= n.chance) return;
      ring(g, ev.enemy.x, ev.enemy.y, 26, F.color, 0.4);
      relicHeal(g, p, p.stats.hp * n.heal, true);
      if (awakened(p, 'haloOfMercy')) gainWard(g, p, p.stats.hp * n.heal); // Grace
    },
  },

  phoenixFeather: {
    acquire(g, p) {
      if (!g.vars['phoenix.given']) (g.vars['phoenix.given'] = 1), (p.revives += 1); // once per run, whatever tier it arrives at
      g.vars['phoenix.hp'] = nOf(p, 'phoenixFeather').hp; // combat.revive reads it
    },
    onRevive(g, _ev, p) {
      if (!awakened(p, 'phoenixFeather')) return;
      const n = nOf(p, 'phoenixFeather');
      nova(g, p.x, p.y, n.radius, relicDamage(p, n.damage), 500, F.color, 'holy'); // Rebirth
    },
  },

  reliquary: {
    onDamageTaken(g, _ev, p) {
      if (p.abilityCd <= cooldownFloor(g)) return;
      p.abilityCd = Math.max(cooldownFloor(g), p.abilityCd - nOf(p, 'reliquary').perFaith * sOf(p)); // v0.7.3: not below the shield's downtime
      addWork(p.relics, 'reliquary', ATTUNEMENT.proc);
    },
    onAbilityEnd(g, _ev, p) {
      if (awakened(p, 'reliquary')) gainWard(g, p, p.stats.hp * 0.01 * sOf(p)); // Martyr's Relic
    },
  },

  seraphHalo: {
    onAbilityUsed(g, _ev, p) {
      const n = nOf(p, 'seraphHalo');
      const count = Math.floor(n.base + sOf(p) * n.perGrace);
      for (let i = 0; i < count; i++) {
        const hit = rollPlayerHit(g, p.cls.attack.damage * n.mult, 'int');
        fireProjectile(g, p.x, p.y, (i / count) * TAU, { damage: hit.amount, crit: hit.crit, hostile: false, pierce: 2, shape: 'orb', color: '#f2e6a0', r: 6, speed: 420, range: 420, source: 'relic' });
      }
      // Choir of Light: the bolts heal as they land (one per enemy in their reach, at most one per bolt)
      if (awakened(p, 'seraphHalo')) relicHeal(g, p, p.stats.hp * 0.01 * Math.min(count, g.hash.query(p.x, p.y, 420, []).length));
    },
  },

  hallowedBones: {
    tick(g, _dt, p) {
      const n = nOf(p, 'hallowedBones');
      const seen = p.relics.warded;
      for (const m of g.minions) {
        if (m.kind || m.relicBy || seen.includes(m)) continue;
        seen.push(m);
        m.maxHp *= 1 + n.ward; // the ward, as extra HP on a skeleton you raised
        m.hp *= 1 + n.ward;
      }
      for (const m of [...seen]) {
        if (g.minions.includes(m) && m.hp > 0 && m.life > 0) continue;
        seen.splice(seen.indexOf(m), 1);
        relicHeal(g, p, p.stats.hp * (n.heal + n.perSoul * sOf(p)));
      }
    },
    onHit(g, ev, p) {
      if (awakened(p, 'hallowedBones') && ev.source === 'minion') relicHeal(g, p, ev.amount * 0.005); // Sanctified Legion
    },
  },
};

export const HOLY_SETS: Partial<Record<SetLevel, RelicHooks>> = {
  2: {
    onHeal(g, ev, p) {
      if (ev.amount > 0) gainWard(g, p, ev.amount * F.n.wardShare); // Blessed (the ward's maximum: relicCore.wardMax)
    },
  },
  4: {
    onHeal(g, ev, p) {
      if (ev.over > 1) nova(g, p.x, p.y, F.n.pulseRadius, ev.over * F.n.pulseMult, 120, F.color, 'holy'); // Radiance
    },
  },
  6: {
    onHeal(g, ev, p) {
      if (ev.amount <= 0) return; // Communion: your heals reach your minions at full strength (and allies, once there are any)
      for (const m of g.minions) if (Math.hypot(m.x - p.x, m.y - p.y) < 250) m.hp = Math.min(m.maxHp, m.hp + ev.amount);
    },
  },
};
