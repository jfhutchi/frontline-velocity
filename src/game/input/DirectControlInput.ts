// Tracks keyboard / mouse input for direct vehicle control mode.
// The actual physics application happens inside the GameEngine.

export interface DirectInputState {
  forward: number;
  turn: number; // -1 turn left, +1 turn right
  fire: boolean;
  /** Mouse turret aim, in radians (world-space yaw). null means no fresh aim. */
  aimYaw: number | null;
}

export class DirectControlInput {
  private keys = new Set<string>();
  private fireDown = false;
  private bound = false;
  private touchForward = 0;
  private touchTurn = 0;
  private touchFire = false;
  private mouseAimYaw: number | null = null;

  attach() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
    this.keys.clear();
    this.fireDown = false;
  }

  setTouch(forward: number, turn: number, fire: boolean) {
    this.touchForward = Math.max(-1, Math.min(1, forward));
    this.touchTurn = Math.max(-1, Math.min(1, turn));
    this.touchFire = fire;
  }

  setMouseAimYaw(yaw: number | null) {
    this.mouseAimYaw = yaw;
  }

  read(): DirectInputState {
    let forward = 0;
    let turn = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) forward += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) forward -= 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) turn -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) turn += 1;
    forward += this.touchForward;
    turn += this.touchTurn;
    forward = Math.max(-1, Math.min(1, forward));
    turn = Math.max(-1, Math.min(1, turn));
    const fire = this.fireDown || this.keys.has(' ') || this.touchFire;
    return { forward, turn, fire, aimYaw: this.mouseAimYaw };
  }

  private onKeyDown = (ev: KeyboardEvent) => {
    const k = ev.key.toLowerCase();
    this.keys.add(k);
    if (k === ' ') ev.preventDefault();
  };
  private onKeyUp = (ev: KeyboardEvent) => {
    this.keys.delete(ev.key.toLowerCase());
  };
  private onMouseDown = (ev: MouseEvent) => {
    if (ev.button === 0) this.fireDown = true;
  };
  private onMouseUp = (ev: MouseEvent) => {
    if (ev.button === 0) this.fireDown = false;
  };
  private onBlur = () => {
    this.keys.clear();
    this.fireDown = false;
  };
}
