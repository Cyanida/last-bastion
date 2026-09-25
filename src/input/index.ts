import { actionForKey, gamepadActions, joystickVector, keyboardMove, livePad, mergeIntents, unlatch, PAD_ABILITY_BUTTONS, stickVector, type Action, type Intent, PAD_UTILITY_BUTTONS, SECOND_ABILITY_KEYS, SECOND_UTILITY_KEYS, UTILITY_KEYS } from './mapping';

/**
 * The only place that listens to raw keyboard, mouse, touch and gamepad events.
 * The game reads `pollInput()` (continuous) and subscribes to `onAction()` (discrete); screens do the same.
 * Touch uses Pointer Events (pointerType 'touch'), which iOS Safari supports and which can be synthesised in tests.
 */

const JOY_RADIUS = 56;
const AIM_DRAG_SCALE = 2.4; // aim point moves this many px per px of thumb travel
const INSPECT_TIME = 2500;

const keys = new Set<string>();
const mouse = { x: 0, y: 0, rmb: false, used: false };
const touch = { joyId: -1, ox: 0, oy: 0, px: 0, py: 0, abilityId: -1, sx: 0, sy: 0, dx: 0, dy: 0, fire: false, fireDx: 0, fireDy: 0, visible: false, targeted: false, utility: false };
const pad = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, ability: false, utility: false, prev: [] as boolean[], latched: [] as boolean[] };
const inspect = { x: 0, y: 0, until: 0 };
const listeners = new Set<(a: Action) => void>();
const gestureCallbacks: (() => void)[] = [];
let ui: { root: HTMLElement; joy: HTMLElement; knob: HTMLElement; button: HTMLElement } | null = null;

let touchSeen = false;
let wanted = { visible: false, targeted: false };
export const isTouchDevice = (): boolean => touchSeen || (typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0));

/** Pointer capture keeps a drag alive outside the element; synthetic (test) pointers cannot be captured. */
function capture(el: Element, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    /* not an active hardware pointer */
  }
}

export function onAction(fn: (a: Action) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(a: Action): void {
  for (const fn of [...listeners]) fn(a);
}

/** Runs once, on the first key press or touch: browsers only allow audio to start from a user gesture. */
export function onFirstGesture(fn: () => void): void {
  gestureCallbacks.push(fn);
}
function gesture(): void {
  for (const fn of gestureCallbacks.splice(0)) fn();
}

const typing = (e: Event) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

function buildTouchUi(): void {
  const root = document.createElement('div');
  root.id = 'touch';
  root.className = 'hidden';
  root.innerHTML = '<div id="joy"><i></i></div><button id="btn-ability" aria-label="Signature ability"><span id="btn-ability-cd"></span><b id="btn-ability-text">✦</b></button><button id="btn-utility" aria-label="Utility ability"><span id="btn-utility-cd"></span><b id="btn-utility-text">◆</b></button>';
  document.body.appendChild(root);
  ui = { root, joy: root.querySelector('#joy')!, knob: root.querySelector('#joy i')!, button: root.querySelector('#btn-ability')! };

  // the utility button: a tap fires once (consumed by the next simulation step)
  const u = root.querySelector<HTMLButtonElement>('#btn-utility')!;
  u.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touch.utility = true;
    u.classList.add('held');
  });
  u.addEventListener('pointerup', () => u.classList.remove('held'));
  u.addEventListener('pointercancel', () => u.classList.remove('held'));

  const b = ui.button;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capture(b, e.pointerId);
    Object.assign(touch, { abilityId: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 });
    b.classList.add('held');
  });
  b.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touch.abilityId) return;
    touch.dx = (e.clientX - touch.sx) * AIM_DRAG_SCALE;
    touch.dy = (e.clientY - touch.sy) * AIM_DRAG_SCALE;
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId !== touch.abilityId) return;
    Object.assign(touch, { abilityId: -1, fire: e.type === 'pointerup', fireDx: touch.dx, fireDy: touch.dy });
    b.classList.remove('held');
  };
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
}

function drawJoystick(): void {
  if (!ui) return;
  const active = touch.joyId !== -1;
  ui.joy.classList.toggle('on', active);
  if (!active) return;
  const v = joystickVector(touch.ox, touch.oy, touch.px, touch.py, JOY_RADIUS);
  ui.joy.style.transform = `translate(${touch.ox}px, ${touch.oy}px)`;
  ui.knob.style.transform = `translate(${v.knobX - touch.ox}px, ${v.knobY - touch.oy}px)`;
}

export function initInput(canvas: HTMLCanvasElement): void {
  buildTouchUi();

  window.addEventListener('keydown', (e) => {
    gesture();
    if (typing(e)) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    const action = e.repeat ? null : actionForKey(e.code);
    if (action) emit(action);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.rmb = false;
    touch.joyId = touch.abilityId = -1;
    drawJoystick();
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  // iOS: no pinch zoom, no double-tap zoom, no rubber-band scroll on the playfield
  for (const type of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  window.addEventListener('pointerdown', gesture, { capture: true });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    Object.assign(mouse, { x: e.clientX, y: e.clientY, used: true });
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' && e.button === 2) mouse.rmb = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') {
      if (e.button === 2) mouse.rmb = true;
      return;
    }
    mouse.used = false;
    if (!touchSeen) {
      touchSeen = true; // a touch screen the media query did not announce (hybrid laptops)
      document.documentElement.classList.add('touch');
      setTouchControls(wanted.visible, wanted.targeted);
    }
    if (touch.visible && touch.joyId === -1 && e.clientX < window.innerWidth * 0.55) {
      capture(canvas, e.pointerId);
      Object.assign(touch, { joyId: e.pointerId, ox: e.clientX, oy: e.clientY, px: e.clientX, py: e.clientY });
      drawJoystick();
    } else Object.assign(inspect, { x: e.clientX, y: e.clientY, until: performance.now() + INSPECT_TIME }); // tap an enemy to inspect it
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touch.joyId) return;
    touch.px = e.clientX;
    touch.py = e.clientY;
    drawJoystick();
  });
  const endJoy = (e: PointerEvent) => {
    if (e.pointerId !== touch.joyId) return;
    touch.joyId = -1;
    drawJoystick();
  };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);
}

/** Show or hide the on-screen controls. `targeted`: the ability fires on release at the dragged aim point, else while held. */
export function setTouchControls(visible: boolean, targeted = false): void {
  wanted = { visible, targeted };
  touch.visible = visible && isTouchDevice();
  touch.targeted = targeted;
  ui?.root.classList.toggle('hidden', !touch.visible);
  if (!touch.visible) {
    touch.joyId = touch.abilityId = -1;
    touch.fire = false;
    drawJoystick();
  }
}

/** Once per rendered frame: gamepads have no events, they must be polled. */
export function pumpGamepad(): void {
  const gp = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()].find((p) => p?.connected) : null;
  if (!gp) {
    Object.assign(pad, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, ability: false, utility: false });
    return;
  }
  const now = gp.buttons.map((b) => b.pressed);
  const prev = pad.prev;
  pad.prev = now; // before emitting: a screen the press closes latches what is held now (latchGamepad)
  for (const a of gamepadActions(prev, now)) emit(a);
  if (now.some(Boolean)) gesture();
  pad.latched = unlatch(pad.latched, now);
  const live = livePad(pad.latched, now);
  const move = stickVector(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
  const aim = stickVector(gp.axes[2] ?? 0, gp.axes[3] ?? 0, 0.3);
  Object.assign(pad, { moveX: move.x, moveY: move.y, aimX: aim.x, aimY: aim.y, ability: PAD_ABILITY_BUTTONS.some((i) => live[i]), utility: PAD_UTILITY_BUTTONS.some((i) => live[i]) });
}

/** A screen closed: the gamepad buttons held right now cast nothing until they are released (A answers a screen and is also cast). */
export function latchGamepad(): void {
  pad.latched = [...pad.prev];
}

/**
 * Once per simulation step. A touch "fire on release" is consumed by the step that reads it.
 * v0.8 (#28): `seat` of `seats` local players. Alone, every device is yours. With two, the first has WASD, the mouse and touch, the
 * second the arrow keys and the gamepad. ponytail: seats 3-4 get no device yet; binding devices to seats is local co-op's (#1).
 */
export function pollInput(seat = 0, seats = 1): Intent {
  if (seat > 1) return { moveX: 0, moveY: 0, ability: false, utility: false, aim: { kind: 'auto' }, showAim: false };
  const aiming = Math.hypot(pad.aimX, pad.aimY) > 0;
  const gamepad: Intent = { moveX: pad.moveX, moveY: pad.moveY, ability: pad.ability, utility: pad.utility, aim: aiming ? { kind: 'stick', x: pad.aimX, y: pad.aimY } : { kind: 'auto' }, showAim: aiming };
  if (seat === 1) {
    const kb = keyboardMove(keys, 'arrows');
    return mergeIntents([{ moveX: kb.x, moveY: kb.y, ability: SECOND_ABILITY_KEYS.some((k) => keys.has(k)), utility: SECOND_UTILITY_KEYS.some((k) => keys.has(k)), aim: { kind: 'auto' }, showAim: false }, gamepad]);
  }
  const split = seats > 1;
  const kb = keyboardMove(keys, split ? 'wasd' : 'both');
  const utilityKeys = split ? UTILITY_KEYS.filter((k) => !SECOND_UTILITY_KEYS.includes(k)) : UTILITY_KEYS;
  const keyboard: Intent = { moveX: kb.x, moveY: kb.y, ability: keys.has('Space') || mouse.rmb, utility: utilityKeys.some((k) => keys.has(k)), aim: mouse.used ? { kind: 'screen', x: mouse.x, y: mouse.y } : { kind: 'auto' }, showAim: mouse.used };

  const joy = touch.joyId === -1 ? { x: 0, y: 0 } : joystickVector(touch.ox, touch.oy, touch.px, touch.py, JOY_RADIUS);
  const holding = touch.abilityId !== -1;
  const fired = touch.fire;
  touch.fire = false;
  const utilityTap = touch.utility;
  touch.utility = false;
  const finger: Intent = {
    moveX: joy.x,
    moveY: joy.y,
    ability: touch.targeted ? fired : holding || fired,
    utility: utilityTap,
    aim: touch.targeted ? { kind: 'offset', dx: fired ? touch.fireDx : touch.dx, dy: fired ? touch.fireDy : touch.dy } : { kind: 'auto' },
    showAim: touch.targeted && holding,
  };

  return mergeIntents(split ? [keyboard, finger] : [keyboard, finger, gamepad]);
}

/** Screen point the player is pointing at (mouse hover, or a recent tap), for enemy tooltips. */
export function inspectPoint(): { x: number; y: number } | null {
  if (mouse.used) return mouse;
  return performance.now() < inspect.until ? inspect : null;
}
