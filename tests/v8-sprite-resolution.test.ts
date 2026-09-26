import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/config/enemies';
import { spriteSize } from '../src/logic/spriteRes';
import { PALETTE, SPRITE_RES, SPRITES, type SpriteId } from '../src/render/sprites';

describe('v0.8.1 sprite resolution (#138)', () => {
  it('a 2x sprite and a 1x sprite of the same design are the same size on screen', () => {
    for (const scale of [3, 4, 5, 6]) {
      const old = spriteSize(12, 14, scale, 1);
      const fine = spriteSize(24, 28, scale, 2);
      expect([fine.w, fine.h]).toEqual([old.w, old.h]);
      // the finer grid is never rasterized below its on-screen size
      expect(24 * fine.cell).toBeGreaterThanOrEqual(fine.w);
    }
    expect(spriteSize(12, 14, 3)).toEqual({ w: 36, h: 42, cell: 3 }); // no resolution = the old grid, unchanged
  });

  it('the regular foes and the commanders are on the finer grid and keep their old on-screen size', () => {
    const old: Partial<Record<SpriteId, [number, number]>> = { wolf: [14, 8], cavalry: [16, 13], assassin: [12, 13] };
    const foes: SpriteId[] = ['peasant', 'wolf', 'crossbow', 'knight', 'cultist', 'shieldBearer', 'priest', 'cavalry', 'engineer', 'plagueDoctor', 'houndmaster', 'mirrorKnight', 'assassin', 'shieldwall', 'boneCollector', 'bannerman', 'drummer', 'chaplain'];
    for (const id of foes) {
      const [cols, rows] = old[id] ?? [12, 14];
      expect(SPRITE_RES[id], id).toBe(2);
      const fine = spriteSize(SPRITES[id][0].length, SPRITES[id].length, 3, 2), was = spriteSize(cols, rows, 3);
      expect([fine.w, fine.h], id).toEqual([was.w, was.h]);
    }
  });

  it('the siege pieces and the bosses are on the finer grid and keep their old on-screen size, elite or not', () => {
    const old: Partial<Record<SpriteId, [number, number]>> = { ballista: [14, 10], siegeTower: [16, 18], dragon: [29, 18], usurper: [16, 18], royalFlame: [12, 14] };
    const bosses: SpriteId[] = ['ballista', 'siegeTower', 'blackKnight', 'warlord', 'lich', 'inquisitor', 'abbot', 'dragon', 'warden', 'usurper', 'royalFlame'];
    for (const id of bosses) {
      const [cols, rows] = old[id] ?? [16, 18];
      expect(SPRITE_RES[id], id).toBe(2);
      // the arena scales (a boss at 4, the Usurper at 5) and an elite's +1 on a flash card
      for (const scale of [3, 4, 5, 6]) {
        const fine = spriteSize(SPRITES[id][0].length, SPRITES[id].length, scale, 2), was = spriteSize(cols, rows, scale);
        expect([fine.w, fine.h], `${id}@${scale}`).toEqual([was.w, was.h]);
      }
    }
  });

  it('the Siege Camp and the Plague Cart have their own pictures; the skeleton minion stays on the old grid on purpose', () => {
    expect(ENEMIES.siegeCamp.sprite).toBe('siegeCamp');
    expect(ENEMIES.plagueCart.sprite).toBe('plagueCart');
    expect(SPRITE_RES.siegeCamp).toBe(2);
    expect(SPRITE_RES.plagueCart).toBe(2);
    expect(SPRITE_RES.skeleton).toBeUndefined();
    // every foe but the minion is on the finer grid
    for (const def of Object.values(ENEMIES)) expect(SPRITE_RES[def.sprite], def.id).toBe(2);
  });

  it('every sprite is a clean grid: rows of one width, known colours, a finer grid in whole old pixels', () => {
    for (const [id, rows] of Object.entries(SPRITES) as [SpriteId, string[]][]) {
      const res = SPRITE_RES[id] ?? 1;
      expect(rows.every((r) => r.length === rows[0].length), id).toBe(true);
      expect(rows.join('').replace(/\./g, '').split('').every((ch) => ch in PALETTE), id).toBe(true);
      expect(rows[0].length % res, id).toBe(0);
      expect(rows.length % res, id).toBe(0);
    }
  });
});
