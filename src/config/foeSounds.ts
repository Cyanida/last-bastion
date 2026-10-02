import type { EnemyId } from './enemies';

/**
 * #285: each enemy family sounds its own: its attack, the champion's blow landing on it, and its death (logic/foeSounds.ts picks,
 * core/foeVoices.ts plays). A sound is a few short layers, each one oscillator or noise burst with a pitch slide, started `at` seconds
 * in; a noise layer may go through a band-pass at `filter` Hz (a hoof's thud is low, a blade's swish high). The realms play their
 * families' sounds through a tint: the Iron Hold's ring of iron, the Cinderlands' crackle, the Barrowvale's hollow (REALM_TINTS).
 * They go out as the foe's own cues (swing, shoot, hit, kill on the effects bus) and keep those cues' low voice priority
 * (config/voices.ts), so in a swarm they are the first dropped and never drown the champion's swing or a boss.
 * Bosses keep their own sounds (not listed here).
 */
export type FoeWave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
export interface FoeLayer {
  wave: FoeWave;
  f0: number;
  f1: number;
  dur: number;
  vol: number;
  at?: number;
  filter?: number;
}
export type FoeEvent = 'attack' | 'hit' | 'death';
export type FoeFamily = 'folk' | 'beast' | 'steel' | 'bow' | 'cavalry' | 'holy' | 'cult' | 'plague' | 'siege' | 'war' | 'shade' | 'bone';
export type FoeRealm = 'iron' | 'cinder' | 'barrow';

const noise = (dur: number, vol: number, filter?: number, at?: number): FoeLayer => ({ wave: 'noise', f0: 0, f1: 0, dur, vol, filter, at });

export const FOE_SOUNDS: Record<FoeFamily, Record<FoeEvent, FoeLayer[]>> = {
  // peasants and their realm kin: a club's thud, a grunt, a groan
  folk: {
    attack: [noise(0.06, 0.06, 900)],
    hit: [noise(0.04, 0.07, 1600), { wave: 'triangle', f0: 210, f1: 150, dur: 0.06, vol: 0.04 }],
    death: [{ wave: 'sawtooth', f0: 200, f1: 80, dur: 0.16, vol: 0.05 }],
  },
  // wolves and hounds: a snarl, a yelp, a whimper
  beast: {
    attack: [{ wave: 'sawtooth', f0: 150, f1: 300, dur: 0.12, vol: 0.05 }, noise(0.08, 0.03, 700)],
    hit: [{ wave: 'triangle', f0: 950, f1: 620, dur: 0.06, vol: 0.05 }],
    death: [{ wave: 'triangle', f0: 760, f1: 240, dur: 0.22, vol: 0.05 }],
  },
  // armoured men: a blade's swish, a clank on plate, armour falling
  steel: {
    attack: [noise(0.08, 0.05, 3200), { wave: 'square', f0: 1250, f1: 1150, dur: 0.03, vol: 0.02, at: 0.05 }],
    hit: [{ wave: 'square', f0: 1800, f1: 1400, dur: 0.04, vol: 0.035 }, noise(0.03, 0.04, 2400)],
    death: [{ wave: 'square', f0: 300, f1: 90, dur: 0.18, vol: 0.04 }, noise(0.1, 0.05, 1800, 0.06)],
  },
  // crossbows and ballistas: the string's twang, a thunk, a cry
  bow: {
    attack: [{ wave: 'square', f0: 2200, f1: 900, dur: 0.02, vol: 0.03 }, { wave: 'triangle', f0: 520, f1: 470, dur: 0.14, vol: 0.06 }],
    hit: [noise(0.04, 0.06, 2000)],
    death: [{ wave: 'triangle', f0: 420, f1: 120, dur: 0.14, vol: 0.05 }],
  },
  // horsemen: hooves drumming into the charge, a thud, a whinny
  cavalry: {
    attack: [noise(0.04, 0.09, 380), noise(0.04, 0.08, 420, 0.09), noise(0.04, 0.09, 380, 0.18)],
    hit: [noise(0.05, 0.07, 700)],
    death: [{ wave: 'sawtooth', f0: 900, f1: 480, dur: 0.24, vol: 0.04 }, noise(0.08, 0.07, 400, 0.12)],
  },
  // priests and chaplains: a chanted fifth as they mend, a bell-like ring, a falling note
  holy: {
    attack: [{ wave: 'sine', f0: 330, f1: 330, dur: 0.38, vol: 0.04 }, { wave: 'sine', f0: 495, f1: 495, dur: 0.38, vol: 0.03 }],
    hit: [{ wave: 'triangle', f0: 640, f1: 540, dur: 0.06, vol: 0.05 }],
    death: [{ wave: 'sine', f0: 440, f1: 220, dur: 0.4, vol: 0.05 }],
  },
  // cultists: a rising hiss, a gasp, a burst
  cult: {
    attack: [{ wave: 'sawtooth', f0: 110, f1: 230, dur: 0.2, vol: 0.04 }],
    hit: [noise(0.05, 0.06, 1300)],
    death: [{ wave: 'sawtooth', f0: 170, f1: 40, dur: 0.2, vol: 0.06 }, noise(0.12, 0.05, 900)],
  },
  // plague doctors and carts: a bubbling flask, a wet slap, a long sigh
  plague: {
    attack: [noise(0.14, 0.05, 500), { wave: 'sine', f0: 200, f1: 420, dur: 0.12, vol: 0.03, at: 0.03 }],
    hit: [noise(0.06, 0.06, 800)],
    death: [{ wave: 'sine', f0: 300, f1: 60, dur: 0.3, vol: 0.05 }],
  },
  // siege works: a creak and thunk, wood struck, a collapse
  siege: {
    attack: [{ wave: 'square', f0: 140, f1: 100, dur: 0.08, vol: 0.05 }, noise(0.06, 0.05, 500, 0.04)],
    hit: [noise(0.05, 0.07, 450), { wave: 'square', f0: 140, f1: 110, dur: 0.05, vol: 0.03 }],
    death: [noise(0.4, 0.09, 300), { wave: 'square', f0: 90, f1: 40, dur: 0.3, vol: 0.05 }],
  },
  // bannermen and drummers: two drum beats, a thump, a dropped drum
  war: {
    attack: [{ wave: 'sine', f0: 130, f1: 60, dur: 0.1, vol: 0.08 }, { wave: 'sine', f0: 130, f1: 60, dur: 0.1, vol: 0.07, at: 0.13 }],
    hit: [{ wave: 'sine', f0: 160, f1: 90, dur: 0.06, vol: 0.06 }],
    death: [{ wave: 'sine', f0: 110, f1: 45, dur: 0.25, vol: 0.07 }],
  },
  // assassins: a thin swish, a hiss, a high fall
  shade: {
    attack: [noise(0.05, 0.05, 5200)],
    hit: [noise(0.03, 0.05, 3600)],
    death: [{ wave: 'sine', f0: 1200, f1: 300, dur: 0.12, vol: 0.04 }],
  },
  // bone collectors: a rattle of bones
  bone: {
    attack: [0, 0.03, 0.06].map((at) => ({ wave: 'square' as const, f0: 2400, f1: 2000, dur: 0.02, vol: 0.025, at })),
    hit: [{ wave: 'square', f0: 2600, f1: 1900, dur: 0.03, vol: 0.03 }, noise(0.03, 0.04, 2800)],
    death: [0, 0.04, 0.09, 0.15].map((at, i) => ({ wave: 'square' as const, f0: 2300 - i * 200, f1: 1800 - i * 200, dur: 0.025, vol: 0.03, at })),
  },
};

/**
 * A realm's tint on its families' sounds: every pitch times `pitch`, and one layer more on every sound (the Iron Hold's ring of iron,
 * the Cinderlands' crackle of embers, the Barrowvale's hollow under-note).
 */
export const REALM_TINTS: Record<FoeRealm, { pitch: number; layer: FoeLayer }> = {
  iron: { pitch: 1.15, layer: { wave: 'square', f0: 2100, f1: 1700, dur: 0.05, vol: 0.02 } },
  cinder: { pitch: 0.9, layer: noise(0.08, 0.03, 4200) },
  barrow: { pitch: 0.8, layer: { wave: 'sine', f0: 95, f1: 60, dur: 0.2, vol: 0.04 } },
};

/** Who sounds like whom. A realm's own foes (config/world.ts `foes`) sound their family through the realm's tint. */
export const FOE_FAMILY: Partial<Record<EnemyId, { family: FoeFamily; realm?: FoeRealm }>> = {
  peasant: { family: 'folk' },
  torchbearer: { family: 'folk', realm: 'cinder' },
  barrowThrall: { family: 'folk', realm: 'barrow' },
  wolf: { family: 'beast' },
  cinderHound: { family: 'beast', realm: 'cinder' },
  blightHound: { family: 'beast', realm: 'barrow' },
  houndmaster: { family: 'beast' },
  knight: { family: 'steel' },
  shieldBearer: { family: 'steel' },
  shieldwall: { family: 'steel' },
  mirrorKnight: { family: 'steel' },
  ironKnight: { family: 'steel', realm: 'iron' },
  ironShieldwall: { family: 'steel', realm: 'iron' },
  thornBearer: { family: 'steel', realm: 'iron' },
  crossbow: { family: 'bow' },
  ballista: { family: 'bow' },
  engineer: { family: 'siege' },
  siegeTower: { family: 'siege' },
  siegeCamp: { family: 'siege' },
  royalFlame: { family: 'siege', realm: 'cinder' },
  cavalry: { family: 'cavalry' },
  priest: { family: 'holy' },
  chaplain: { family: 'holy' },
  cultist: { family: 'cult' },
  plagueDoctor: { family: 'plague' },
  plagueCart: { family: 'plague' },
  bannerman: { family: 'war' },
  drummer: { family: 'war' },
  assassin: { family: 'shade' },
  boneCollector: { family: 'bone' },
};
