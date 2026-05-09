import { ArcRotateCamera, FollowCamera, Scene, Vector3 } from '@babylonjs/core';
import type { Unit } from '../types';

export type CameraMode = 'tactical' | 'directControl';

export class CameraController {
  private scene: Scene;
  private tacticalCam: ArcRotateCamera;
  private chaseCam: FollowCamera;
  private mode: CameraMode = 'tactical';
  private canvas: HTMLCanvasElement;

  constructor(scene: Scene, tacticalCam: ArcRotateCamera, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.tacticalCam = tacticalCam;
    this.canvas = canvas;
    this.chaseCam = new FollowCamera('chaseCam', new Vector3(0, 6, -10), scene);
    this.chaseCam.radius = 12;
    this.chaseCam.heightOffset = 6;
    this.chaseCam.rotationOffset = 180;
    this.chaseCam.cameraAcceleration = 0.04;
    this.chaseCam.maxCameraSpeed = 200;
    this.chaseCam.minZ = 0.5;
    this.chaseCam.maxZ = 600;
    this.activate('tactical');
  }

  getMode(): CameraMode {
    return this.mode;
  }

  activate(mode: CameraMode) {
    this.mode = mode;
    if (mode === 'tactical') {
      this.scene.activeCamera = this.tacticalCam;
      this.tacticalCam.attachControl(this.canvas, true);
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
    }
  }

  followUnit(unit: Unit | null) {
    if (!unit) {
      this.chaseCam.lockedTarget = null;
      return;
    }
    // Use the unit's root mesh as a follow target. We'll rely on the unit's
    // hull mesh being positioned via the renderer; instead of digging through
    // the scene graph, we just place the chase camera ourselves each frame.
  }

  /** Place chase camera behind the unit, looking forward over its turret. */
  trackChase(unit: Unit) {
    if (this.mode !== 'directControl') return;
    const sin = Math.sin(unit.rotation);
    const cos = Math.cos(unit.rotation);
    const back = 9;
    const up = 5;
    const camX = unit.position.x - sin * back;
    const camZ = unit.position.z - cos * back;
    this.chaseCam.position.set(camX, up, camZ);
    this.chaseCam.setTarget(new Vector3(unit.position.x + sin * 4, unit.position.y + 1.6, unit.position.z + cos * 4));
  }

  centerOn(x: number, z: number) {
    this.tacticalCam.target = new Vector3(x, 0, z);
  }
}
