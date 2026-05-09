import { ArcRotateCamera, FollowCamera, Scene, Vector3 } from '@babylonjs/core';
import {
  MAP_HALF,
  TACTICAL_CAMERA_DEFAULT,
  TACTICAL_CAMERA_FAST_MULTIPLIER,
  TACTICAL_CAMERA_MAX_RADIUS,
  TACTICAL_CAMERA_MIN_RADIUS,
  TACTICAL_CAMERA_PAN_SPEED,
} from '../constants';
import type { Unit } from '../types';

export type CameraMode = 'tactical' | 'directControl';

type PointerSample = { x: number; y: number };

export class CameraController {
  private scene: Scene;
  private tacticalCam: ArcRotateCamera;
  private chaseCam: FollowCamera;
  private mode: CameraMode = 'tactical';
  private canvas: HTMLCanvasElement;
  private keys = new Set<string>();
  private desiredTarget = new Vector3(
    TACTICAL_CAMERA_DEFAULT.target.x,
    0,
    TACTICAL_CAMERA_DEFAULT.target.z,
  );
  private desiredRadius: number = TACTICAL_CAMERA_DEFAULT.radius;
  private desiredAlpha: number = TACTICAL_CAMERA_DEFAULT.alpha;
  private middleDragging = false;
  private lastPointer: PointerSample | null = null;
  private touchPointers = new Map<number, PointerSample>();
  private lastTouchCenter: PointerSample | null = null;
  private lastTouchDistance = 0;
  private shakeSeconds = 0;
  private shakeStrength = 0;

  constructor(scene: Scene, tacticalCam: ArcRotateCamera, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.tacticalCam = tacticalCam;
    this.canvas = canvas;
    this.chaseCam = new FollowCamera('chaseCam', new Vector3(0, 6, -10), scene);
    this.chaseCam.radius = 12;
    this.chaseCam.heightOffset = 6;
    this.chaseCam.rotationOffset = 180;
    this.chaseCam.cameraAcceleration = 0.08;
    this.chaseCam.maxCameraSpeed = 180;
    this.chaseCam.minZ = 0.5;
    this.chaseCam.maxZ = 600;
    this.resetTacticalCamera(true);
    this.bindInputs();
    this.activate('tactical');
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
  }

  getMode(): CameraMode {
    return this.mode;
  }

  activate(mode: CameraMode) {
    this.mode = mode;
    if (mode === 'tactical') {
      this.scene.activeCamera = this.tacticalCam;
      try {
        this.chaseCam.detachControl();
      } catch {
        /* no-op */
      }
    } else {
      this.scene.activeCamera = this.chaseCam;
      try {
        this.tacticalCam.detachControl();
      } catch {
        /* no-op */
      }
      this.middleDragging = false;
      this.touchPointers.clear();
    }
  }

  update(dt: number) {
    if (this.mode !== 'tactical') return;
    this.applyKeyboardPan(dt);
    this.clampDesired();
    this.tacticalCam.alpha = lerpAngle(this.tacticalCam.alpha, this.desiredAlpha, 1 - Math.pow(0.001, dt));
    this.tacticalCam.radius = lerp(this.tacticalCam.radius, this.desiredRadius, 1 - Math.pow(0.0008, dt));
    this.tacticalCam.target = Vector3.Lerp(this.tacticalCam.target, this.desiredTarget, 1 - Math.pow(0.0008, dt));
  }

  followUnit(unit: Unit | null) {
    if (!unit) {
      this.chaseCam.lockedTarget = null;
      return;
    }
  }

  /** Place chase camera behind the unit, looking forward over its turret. */
  trackChase(unit: Unit) {
    if (this.mode !== 'directControl') return;
    const sin = Math.sin(unit.rotation);
    const cos = Math.cos(unit.rotation);
    const back = 9.5;
    const up = 5.2;
    const shake = this.consumeShake();
    const camX = unit.position.x - sin * back + shake.x;
    const camZ = unit.position.z - cos * back + shake.z;
    this.chaseCam.position.set(camX, up + shake.y, camZ);
    this.chaseCam.setTarget(new Vector3(unit.position.x + sin * 5, unit.position.y + 1.5, unit.position.z + cos * 5));
  }

  centerOn(x: number, z: number) {
    this.desiredTarget = new Vector3(x, 0, z);
    this.clampDesired();
  }

  resetTacticalCamera(immediate = false) {
    this.desiredTarget = new Vector3(
      TACTICAL_CAMERA_DEFAULT.target.x,
      TACTICAL_CAMERA_DEFAULT.target.y,
      TACTICAL_CAMERA_DEFAULT.target.z,
    );
    this.desiredRadius = TACTICAL_CAMERA_DEFAULT.radius;
    this.desiredAlpha = TACTICAL_CAMERA_DEFAULT.alpha;
    this.tacticalCam.beta = TACTICAL_CAMERA_DEFAULT.beta;
    this.clampDesired();
    if (immediate) {
      this.tacticalCam.alpha = this.desiredAlpha;
      this.tacticalCam.radius = this.desiredRadius;
      this.tacticalCam.target = this.desiredTarget.clone();
    }
  }

  rotateTactical(direction: number) {
    this.desiredAlpha += direction * 0.28;
  }

  zoomTactical(delta: number) {
    this.desiredRadius = clamp(this.desiredRadius + delta, TACTICAL_CAMERA_MIN_RADIUS, TACTICAL_CAMERA_MAX_RADIUS);
  }

  addRecoilShake(strength = 0.22) {
    this.shakeSeconds = 0.16;
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

  private bindInputs() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  private applyKeyboardPan(dt: number) {
    let right = 0;
    let forward = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) right -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) right += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) forward += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) forward -= 1;
    if (this.keys.has('q')) this.desiredAlpha -= 1.5 * dt;
    if (this.keys.has('e')) this.desiredAlpha += 1.5 * dt;
    if (right === 0 && forward === 0) return;
    const speed =
      TACTICAL_CAMERA_PAN_SPEED *
      (this.keys.has('shift') ? TACTICAL_CAMERA_FAST_MULTIPLIER : 1) *
      (this.desiredRadius / TACTICAL_CAMERA_DEFAULT.radius);
    this.panByWorldAxes(right * speed * dt, forward * speed * dt);
  }

  private panByWorldAxes(rightAmount: number, forwardAmount: number) {
    const right = { x: Math.cos(this.desiredAlpha), z: -Math.sin(this.desiredAlpha) };
    const forward = { x: Math.sin(this.desiredAlpha), z: Math.cos(this.desiredAlpha) };
    this.desiredTarget.x += right.x * rightAmount + forward.x * forwardAmount;
    this.desiredTarget.z += right.z * rightAmount + forward.z * forwardAmount;
  }

  private panFromScreenDelta(dx: number, dy: number) {
    const scale = this.desiredRadius * 0.0024;
    this.panByWorldAxes(-dx * scale, dy * scale);
  }

  private clampDesired() {
    const margin = 18;
    this.desiredTarget.x = clamp(this.desiredTarget.x, -MAP_HALF - margin, MAP_HALF + margin);
    this.desiredTarget.z = clamp(this.desiredTarget.z, -MAP_HALF - margin, MAP_HALF + margin);
    this.desiredRadius = clamp(this.desiredRadius, TACTICAL_CAMERA_MIN_RADIUS, TACTICAL_CAMERA_MAX_RADIUS);
  }

  private onKeyDown = (ev: KeyboardEvent) => {
    if (this.mode !== 'tactical') return;
    const key = ev.key.toLowerCase();
    if (key === 'home' || key === 'r') {
      this.resetTacticalCamera();
      ev.preventDefault();
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', 'shift'].includes(key)) {
      this.keys.add(key);
      ev.preventDefault();
    }
  };

  private onKeyUp = (ev: KeyboardEvent) => {
    this.keys.delete(ev.key.toLowerCase());
  };

  private onBlur = () => {
    this.keys.clear();
    this.middleDragging = false;
    this.touchPointers.clear();
  };

  private onWheel = (ev: WheelEvent) => {
    if (this.mode !== 'tactical') return;
    this.zoomTactical(ev.deltaY * 0.08);
    ev.preventDefault();
  };

  private onPointerDown = (ev: PointerEvent) => {
    if (this.mode !== 'tactical') return;
    if (ev.pointerType === 'touch') {
      this.touchPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.touchPointers.size === 2) {
        const [a, b] = [...this.touchPointers.values()];
        this.lastTouchCenter = midpoint(a, b);
        this.lastTouchDistance = distance2d(a, b);
      }
      return;
    }
    if (ev.button !== 1) return;
    this.middleDragging = true;
    this.lastPointer = { x: ev.clientX, y: ev.clientY };
    this.canvas.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (this.mode !== 'tactical') return;
    if (ev.pointerType === 'touch') {
      if (!this.touchPointers.has(ev.pointerId)) return;
      this.touchPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.touchPointers.size >= 2) {
        const [a, b] = [...this.touchPointers.values()];
        const center = midpoint(a, b);
        const dist = distance2d(a, b);
        if (this.lastTouchCenter) {
          this.panFromScreenDelta(center.x - this.lastTouchCenter.x, center.y - this.lastTouchCenter.y);
        }
        if (this.lastTouchDistance > 0) {
          this.zoomTactical((this.lastTouchDistance - dist) * 0.18);
        }
        this.lastTouchCenter = center;
        this.lastTouchDistance = dist;
        ev.preventDefault();
      }
      return;
    }
    if (!this.middleDragging || !this.lastPointer) return;
    this.panFromScreenDelta(ev.clientX - this.lastPointer.x, ev.clientY - this.lastPointer.y);
    this.lastPointer = { x: ev.clientX, y: ev.clientY };
    ev.preventDefault();
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      this.touchPointers.delete(ev.pointerId);
      this.lastTouchCenter = null;
      this.lastTouchDistance = 0;
      return;
    }
    if (ev.button === 1) {
      this.middleDragging = false;
      this.lastPointer = null;
    }
  };

  private consumeShake() {
    if (this.shakeSeconds <= 0) return { x: 0, y: 0, z: 0 };
    this.shakeSeconds = Math.max(0, this.shakeSeconds - 1 / 60);
    const t = this.shakeSeconds / 0.16;
    const strength = this.shakeStrength * t;
    if (this.shakeSeconds <= 0) this.shakeStrength = 0;
    return {
      x: (Math.random() - 0.5) * strength,
      y: (Math.random() - 0.5) * strength * 0.5,
      z: (Math.random() - 0.5) * strength,
    };
  }
}

function midpoint(a: PointerSample, b: PointerSample): PointerSample {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function distance2d(a: PointerSample, b: PointerSample): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * clamp(t, 0, 1);
}

function lerpAngle(from: number, to: number, t: number) {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * clamp(t, 0, 1);
}
