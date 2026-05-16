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
  private chasePosition: Vector3 | null = null;
  private chaseTarget: Vector3 | null = null;

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
    this.chaseCam = new FollowCamera('directFirstPersonCam', new Vector3(0, 2, -2), scene);
    this.chaseCam.radius = 2;
    this.chaseCam.heightOffset = 2;
    this.chaseCam.rotationOffset = 180;
    this.chaseCam.cameraAcceleration = 0.18;
    this.chaseCam.maxCameraSpeed = 180;
    this.chaseCam.minZ = 0.08;
    this.chaseCam.maxZ = 600;
    this.chaseCam.fov = 1.02;
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
    const switchingMode = this.mode !== mode;
    this.mode = mode;
    if (mode === 'tactical') {
      this.scene.activeCamera = this.tacticalCam;
      this.chasePosition = null;
      this.chaseTarget = null;
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
      if (switchingMode) {
        this.chasePosition = null;
        this.chaseTarget = null;
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

  /** Place the active camera at the selected unit's gunner/driver eye-line. */
  trackChase(unit: Unit, dt = 1 / 60) {
    if (this.mode !== 'directControl') return;
    const yaw = unit.rotation + unit.turretRotation * 0.32;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const eyeHeight =
      unit.type === 'reconJeep' ? 1.8 :
      unit.type === 'infantry' ? 1.7 :
      2.75;
    const forwardOffset =
      unit.type === 'reconJeep' ? 0.95 :
      unit.type === 'infantry' ? 0.25 :
      unit.radius * 0.62;
    const shake = this.consumeShake();
    const desiredPosition = new Vector3(
      unit.position.x + sin * forwardOffset + shake.x,
      eyeHeight + shake.y,
      unit.position.z + cos * forwardOffset + shake.z,
    );
    const desiredTarget = new Vector3(
      unit.position.x + sin * 90,
      eyeHeight - 0.12,
      unit.position.z + cos * 90,
    );
    const t = 1 - Math.exp(-Math.max(dt, 1 / 120) * 20);
    this.chasePosition = this.chasePosition ? Vector3.Lerp(this.chasePosition, desiredPosition, t) : desiredPosition;
    this.chaseTarget = this.chaseTarget ? Vector3.Lerp(this.chaseTarget, desiredTarget, t) : desiredTarget;
    this.chaseCam.position.copyFrom(this.chasePosition);
    this.chaseCam.setTarget(this.chaseTarget);
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

  setTacticalVirtualControls(right: number, forward: number, rotate: number, zoom: number) {
    this.tactical.setVirtualControls(right, forward, rotate, zoom);
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
