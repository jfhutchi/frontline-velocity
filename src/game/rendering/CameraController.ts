import { ArcRotateCamera, FollowCamera, Scene, Vector3 } from '@babylonjs/core';
import { TacticalCameraController } from './TacticalCameraController';
import type { Unit } from '../types';

export type CameraMode = 'tactical' | 'directControl';

/**
 * High-level camera rig that switches between the tactical RTS camera and the
 * direct-control chase camera. Tactical math lives in
 * {@link TacticalCameraController}; this class coordinates which camera is the
 * active scene camera and forwards chase-cam updates while in direct control.
 */
export class CameraController {
  private scene: Scene;
  private tacticalCam: ArcRotateCamera;
  private chaseCam: FollowCamera;
  private tactical: TacticalCameraController;
  private mode: CameraMode = 'tactical';
  private shakeSeconds = 0;
  private shakeStrength = 0;

  constructor(scene: Scene, tacticalCam: ArcRotateCamera, _canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.tacticalCam = tacticalCam;
    // Detach Babylon's built-in pointer/keyboard handling — TacticalInputController
    // and TacticalCameraController together are the single source of truth.
    try {
      this.tacticalCam.detachControl();
    } catch {
      /* no-op */
    }
    this.tactical = new TacticalCameraController(tacticalCam);
    this.chaseCam = new FollowCamera('chaseCam', new Vector3(0, 6, -10), scene);
    this.chaseCam.radius = 12;
    this.chaseCam.heightOffset = 6;
    this.chaseCam.rotationOffset = 180;
    this.chaseCam.cameraAcceleration = 0.08;
    this.chaseCam.maxCameraSpeed = 180;
    this.chaseCam.minZ = 0.5;
    this.chaseCam.maxZ = 600;
    this.tactical.reset(true);
    this.activate('tactical');
  }

  dispose() {
    /* Tactical input owns its own listeners; nothing to remove here. */
  }

  /** Direct access to the tactical-camera math layer for the input controller. */
  getTactical(): TacticalCameraController {
    return this.tactical;
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
      this.tactical.clearKeys();
    }
  }

  update(dt: number) {
    if (this.mode !== 'tactical') return;
    this.tactical.update(dt);
  }

  followUnit(unit: Unit | null) {
    if (!unit) {
      this.chaseCam.lockedTarget = null;
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

  /** Tactical-camera convenience methods exposed for HUD buttons. */
  centerOn(x: number, z: number) {
    this.tactical.centerOn(x, z);
  }

  resetTacticalCamera(immediate = false) {
    this.tactical.reset(immediate);
  }

  rotateTactical(direction: number) {
    this.tactical.nudgeRotation(direction);
  }

  zoomTactical(delta: number) {
    this.tactical.zoom(delta);
  }

  addRecoilShake(strength = 0.22) {
    this.shakeSeconds = 0.16;
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

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
