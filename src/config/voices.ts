/**
 * #283: the effect voices (core/audio.ts sfx, logic/voices.ts). Each cue carries a source, a priority and maybe a place in the world.
 * max: how many effect voices sound at once; a cue past it takes the place of the weakest voice playing if it matters more,
 * else it is dropped (a hit in a crowd goes first, a boss cue or a warning stays). stealFade: how fast a voice that lost its place fades out.
 * repeat: the same sound from the same source starts at most once per this many seconds (200 hits in a frame are not 200 voices).
 * priority: each sound's weight (a sound not listed weighs `fallback`); source: what its source adds (a boss's cue outranks any foe's).
 * vary: a cue's pitch and volume move up to this fraction either way, so a sound played over and over doesn't grate.
 * pan: how far left or right a cue at the edge of the screen sits (1 = all the way). distance: past the edge of the screen a cue fades
 * over `fade` world px, down to `floor` of its volume.
 */
export type CueSource = 'player' | 'foe' | 'boss' | 'world';

export const VOICES = {
  max: 8,
  stealFade: 0.015,
  repeat: 0.015, // about a frame: the voice limit, not this, keeps a crowd in check (it was 0.05 s per sound before #283)
  fallback: 2,
  priority: {
    xp: 0,
    hit: 1,
    swing: 1,
    shoot: 1,
    kill: 1,
    clang: 2,
    block: 2,
    thorns: 2,
    boom: 3,
    slam: 3,
    hurt: 4,
    ability: 4,
    warn: 5,
    wave: 6,
    levelup: 6,
    tap: 6,
  } as Record<string, number>,
  source: { world: 0, foe: 0, player: 1, boss: 4 } satisfies Record<CueSource, number>,
  vary: { pitch: 0.05, volume: 0.15 },
  pan: 0.8,
  distance: { fade: 600, floor: 0.25 },
};
