/**
 * Pure input mapping: raw device state -> game actions. No DOM in here, so it is unit-tested.
 * Devices (keyboard/mouse, touch, gamepad) live in input/index.ts and only feed these functions.
 */

/** Discrete, edge-triggered actions. pickN = choose the N-th card on a choice screen. */
export type Action = 'pause' | 'mute' | 'confirm' | 'cancel' | 'reroll' | 'perf' | 'bored' | `pick${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

/** Where the signature ability should land. The game resolves it to a world point. */
export type Aim =
  | { kind: 'screen'; x: number; y: number } // mouse: CSS pixels
  | { kind: 'auto' } // touch tap / gamepad: densest enemy cluster
  | { kind: 'offset'; dx: number; dy: number } // touch drag: CSS pixels away from the auto-aim point
  | { kind: 'stick'; x: number; y: number }; // gamepad right stick: direction from the player, length 0..1

/** Continuous state, sampled once per simulation step. */
export interface Intent {
  moveX: number; // vector of length 0..1
  moveY: number;
  ability: boolean;
  utility: boolean; // v0.4: the second ability (E / Shift, gamepad X or RB, the small touch button)
  aim: Aim;
  showAim: boolean; // draw the reticle (always with a mouse, only while holding on touch)
}

export interface Vec {
  x: number;
  y: number;
}

const KEY_ACTIONS: Record<string, Action> = {
  Escape: 'pause', KeyP: 'pause', KeyM: 'mute', Enter: 'confirm', NumpadEnter: 'confirm', Backspace: 'cancel', KeyR: 'reroll', F3: 'perf', F8: 'bored',
};

export function actionForKey(code: string): Action | null {
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return digit ? (`pick${digit[1]}` as Action) : (KEY_ACTIONS[code] ?? null);
}

/** v0.8 (#28): with two players on one keyboard, the first moves on WASD and the second on the arrow keys. */
export type KeySide = 'both' | 'wasd' | 'arrows';

export function keyboardMove(keys: ReadonlySet<string>, side: KeySide = 'both'): Vec {
  const down = (wasd: string, arrow: string) => (side !== 'arrows' && keys.has(wasd)) || (side !== 'wasd' && keys.has(arrow));
  const x = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  const y = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/** Radial dead zone, rescaled so the stick still reaches full speed. Output length 0..1. */
export function stickVector(x: number, y: number, deadzone = 0.2): Vec {
  const len = Math.hypot(x, y);
  if (len <= deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (len - deadzone) / (1 - deadzone));
  return { x: (x / len) * scaled, y: (y / len) * scaled };
}

/** Floating touch joystick: origin is where the thumb landed. Also returns where to draw the knob. */
export function joystickVector(ox: number, oy: number, px: number, py: number, radius: number): Vec & { knobX: number; knobY: number } {
  const dx = px - ox;
  const dy = py - oy;
  const len = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(len, radius);
  const v = stickVector(((dx / len) * clamped) / radius, ((dy / len) * clamped) / radius, 0.12);
  return { ...v, knobX: ox + (dx / len) * clamped, knobY: oy + (dy / len) * clamped };
}

/** Standard-mapping gamepad buttons -> actions, on the press edge only. */
const PAD_ACTIONS: [number, Action][] = [[0, 'confirm'], [1, 'cancel'], [2, 'pick1'], [3, 'pick2'], [5, 'pick3'], [4, 'reroll'], [9, 'pause']];
export const PAD_ABILITY_BUTTONS = [0, 7]; // A or right trigger
export const PAD_UTILITY_BUTTONS = [2, 5]; // X or right bumper
export const UTILITY_KEYS = ['KeyE', 'ShiftLeft', 'ShiftRight'];
export const SECOND_ABILITY_KEYS = ['ControlRight', 'Slash']; // v0.8: the second player on the arrow keys
export const SECOND_UTILITY_KEYS = ['ShiftRight', 'Period'];

export function gamepadActions(prev: readonly boolean[], now: readonly boolean[]): Action[] {
  return PAD_ACTIONS.filter(([i]) => now[i] && !prev[i]).map(([, a]) => a);
}

/** Buttons still held since a screen closed stay latched until released: the press that answered it does not also cast. */
export const unlatch = (latched: readonly boolean[], now: readonly boolean[]): boolean[] => latched.map((l, i) => l && !!now[i]);
export const livePad = (latched: readonly boolean[], now: readonly boolean[]): boolean[] => now.map((b, i) => b && !latched[i]);

/** Several devices at once: the strongest movement wins, any device can cast, aim follows the device that casts. */
export function mergeIntents(intents: Intent[]): Intent {
  const moving = intents.reduce((a, b) => (Math.hypot(b.moveX, b.moveY) > Math.hypot(a.moveX, a.moveY) ? b : a));
  const caster = intents.find((i) => i.ability) ?? intents.find((i) => i.showAim) ?? intents[0];
  return { moveX: moving.moveX, moveY: moving.moveY, ability: intents.some((i) => i.ability), utility: intents.some((i) => i.utility), aim: caster.aim, showAim: caster.showAim };
}
