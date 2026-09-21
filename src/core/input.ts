export const input = {
  keys: new Set<string>(),
  mouseX: 0,
  mouseY: 0,
  rmb: false,
};

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    input.keys.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.rmb = false;
  });
  window.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 2) input.rmb = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) input.rmb = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

const down = (...codes: string[]) => codes.some((c) => input.keys.has(c));

export function moveAxis(): { x: number; y: number } {
  return {
    x: (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0),
    y: (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0),
  };
}

export const abilityHeld = () => input.rmb || input.keys.has('Space');
