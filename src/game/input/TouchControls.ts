/**
 * Helper for mobile virtual joystick + buttons. Returns a simple signal
 * the React side can use. Implemented as a hook in TouchControls UI.
 */
export interface TouchInputSignal {
  forward: number;
  turn: number;
  fire: boolean;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
