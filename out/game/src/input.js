// Keyboard and pointer input. Held keys give a movement vector; one-shot presses
// (confirm, pause, dash, mute, card picks) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// The mouse position is reported in the game's logical 1280x720 coordinates.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;
export const ACTION_CARD_1 = 32;
export const ACTION_CARD_2 = 64;
export const ACTION_CARD_3 = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const CARD_KEYS = { Digit1: ACTION_CARD_1, Digit2: ACTION_CARD_2, Digit3: ACTION_CARD_3 };

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let firing = false;
  let dashQueued = false;
  // Mouse in logical field coordinates; starts aimed up from the centre.
  let mouseX = FIELD.width / 2;
  let mouseY = FIELD.height / 2 - 200;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    mouseX = (event.clientX - rect.left - offsetX) / scale;
    mouseY = (event.clientY - rect.top - offsetY) / scale;
  }

  function onKeyDown(event) {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      firing = true;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (CARD_KEYS[event.code]) {
      if (!event.repeat) actions |= CARD_KEYS[event.code];
    } else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (CONFIRM.has(event.code)) firing = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = false;
    firing = false;
  });
  canvas.addEventListener('pointermove', toLogical);
  canvas.addEventListener('pointerdown', (event) => {
    toLogical(event);
    if (event.button === 2) actions |= ACTION_DASH;
    else {
      firing = true;
      actions |= ACTION_CONFIRM;
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.button !== 2) firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement vector from the held keys. */
    moveVector() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    get mouse() {
      return { x: mouseX, y: mouseY };
    },
    get firing() {
      return firing;
    },
    /** Queue a dash for the next simulation step (set by the main loop from the action flags). */
    requestDash() {
      dashQueued = true;
    },
    /** Take the queued dash, if any — one dash per request. */
    takeDash() {
      const taken = dashQueued;
      dashQueued = false;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Drive the aim and fire state from a script (used by the screenshot autopilot). */
    setMouse(x, y) {
      mouseX = x;
      mouseY = y;
    },
    setFiring(value) {
      firing = value;
    },
  };
}
