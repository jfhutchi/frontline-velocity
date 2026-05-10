import { ArcRotateCamera, Vector3 } from '@babylonjs/core';
import {
  MAP_HALF,
  TACTICAL_CAMERA_DEFAULT,
  TACTICAL_CAMERA_FAST_MULTIPLIER,
  TACTICAL_CAMERA_MAX_RADIUS,
  TACTICAL_CAMERA_MIN_RADIUS,
  TACTICAL_CAMERA_PAN_SMOOTHING,
  TACTICAL_CAMERA_PAN_SPEED,
  TACTICAL_CAMERA_ROTATE_SMOOTHING,
  TACTICAL_CAMERA_ROTATE_SPEED,
  TACTICAL_CAMERA_ZOOM_SMOOTHING,
  TACTICAL_EDGE_SCROLL_PIXELS,
  TACTICAL_EDGE_SCROLL_SPEED,
  TACTICAL_ZOOM_WHEEL_STEP,
} from '../constants';

/**
 * RTS-style tactical camera controller. Owns all camera math; the input layer
 * only feeds it abstract pan/zoom/rotate intents. Smoothed yaw/distance/target
 * keep movement framerate-independent and responsive without feeling jittery.
 *
 * Drag direction convention: middle-mouse drag pans the camera in the same
 * direction the cursor moves — i.e. "drag the world" feel: dragging the cursor
 * left moves the camera target left, revealing terrain on the left. This was
 * picked over the "grab the map" inversion because it matches how WASD pans.
 */
export class TacticalCameraController {
  private camera: ArcRotateCamera;
  private desiredTarget: Vector3;
  private desiredAlpha: number;
  private desiredRadius: number;
  private keys = new Set<string>();
  /** Pending edge-scroll input applied each tick. -1..1 in each axis. */
  private edgePan = { right: 0, forward: 0 };

  constructor(camera: ArcRotateCamera) {
    this.camera = camera;
    this.desiredTarget = new Vector3(
      TACTICAL_CAMERA_DEFAULT.target.x,
      0,
      TACTICAL_CAMERA_DEFAULT.target.z,
    );
    this.desiredAlpha = TACTICAL_CAMERA_DEFAULT.alpha;
    this.desiredRadius = TACTICAL_CAMERA_DEFAULT.radius;
    this.snapToDesired();
  }

  /** Push a key state in. Caller is responsible for filtering tactical-mode-only events. */
  onKeyDown(key: string) {
    this.keys.add(key.toLowerCase());
  }

  onKeyUp(key: string) {
    this.keys.delete(key.toLowerCase());
  }

  clearKeys() {
    this.keys.clear();
    this.edgePan.right = 0;
    this.edgePan.forward = 0;
  }

  /** R / Home — frame-snap back to the default tactical overview. */
  reset(immediate = false) {
    this.desiredTarget = new Vector3(
      TACTICAL_CAMERA_DEFAULT.target.x,
      0,
      TACTICAL_CAMERA_DEFAULT.target.z,
    );
    this.desiredAlpha = TACTICAL_CAMERA_DEFAULT.alpha;
    this.desiredRadius = TACTICAL_CAMERA_DEFAULT.radius;
    this.camera.beta = TACTICAL_CAMERA_DEFAULT.beta;
    this.clampDesired();
    if (immediate) this.snapToDesired();
  }

  /** F — center camera on a world position (e.g. selected unit). */
  centerOn(x: number, z: number) {
    this.desiredTarget = new Vector3(x, 0, z);
    this.clampDesired();
  }

  /** Q/E button-style rotation. */
  nudgeRotation(direction: number) {
    this.desiredAlpha += direction * 0.28;
  }

  /** Mouse-wheel zoom. delta in world units (sign matches "wheel down -> zoom out"). */
  zoom(delta: number) {
    this.desiredRadius = clamp(
      this.desiredRadius + delta,
      TACTICAL_CAMERA_MIN_RADIUS,
      TACTICAL_CAMERA_MAX_RADIUS,
    );
  }

  zoomByWheelTicks(deltaY: number) {
    // Normalize roughly to -1/+1 ticks irrespective of OS wheel granularity.
    const ticks = clamp(deltaY / 100, -3, 3);
    this.zoom(ticks * TACTICAL_ZOOM_WHEEL_STEP);
  }

  /**
   * Middle-mouse drag pan. Screen delta in CSS pixels.
   * See class-level comment for the chosen drag direction.
   */
  panFromScreenDelta(dx: number, dy: number) {
    const scale = this.desiredRadius * 0.0024;
    this.panByWorldAxes(dx * scale, -dy * scale);
  }

  /** Set edge-scroll vector for this frame, in -1..1 right/forward space. */
  setEdgeScroll(right: number, forward: number) {
    this.edgePan.right = clamp(right, -1, 1);
    this.edgePan.forward = clamp(forward, -1, 1);
  }

  /** Frame update — must be called every frame the tactical camera is active. */
  update(dt: number) {
    if (dt <= 0) return;
    this.applyKeyboardPan(dt);
    this.applyEdgeScroll(dt);
    this.clampDesired();

    const panT = 1 - Math.exp(-TACTICAL_CAMERA_PAN_SMOOTHING * dt);
    const rotT = 1 - Math.exp(-TACTICAL_CAMERA_ROTATE_SMOOTHING * dt);
    const zoomT = 1 - Math.exp(-TACTICAL_CAMERA_ZOOM_SMOOTHING * dt);

    this.camera.target = Vector3.Lerp(this.camera.target, this.desiredTarget, panT);
    this.camera.alpha = lerpAngle(this.camera.alpha, this.desiredAlpha, rotT);
    this.camera.radius = lerp(this.camera.radius, this.desiredRadius, zoomT);
  }

  /** Convenience getter for input controllers and HUD. */
  getDesiredTarget(): { x: number; z: number } {
    return { x: this.desiredTarget.x, z: this.desiredTarget.z };
  }

  private applyKeyboardPan(dt: number) {
    let right = 0;
    let forward = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) right -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) right += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) forward += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) forward -= 1;
    if (this.keys.has('q')) this.desiredAlpha -= TACTICAL_CAMERA_ROTATE_SPEED * dt;
    if (this.keys.has('e')) this.desiredAlpha += TACTICAL_CAMERA_ROTATE_SPEED * dt;
    if (right === 0 && forward === 0) return;
    const speed = this.panSpeedScale();
    this.panByWorldAxes(right * speed * dt, forward * speed * dt);
  }

  private applyEdgeScroll(dt: number) {
    if (this.edgePan.right === 0 && this.edgePan.forward === 0) return;
    const speed = TACTICAL_EDGE_SCROLL_SPEED * (this.desiredRadius / TACTICAL_CAMERA_DEFAULT.radius);
    this.panByWorldAxes(this.edgePan.right * speed * dt, this.edgePan.forward * speed * dt);
  }

  private panSpeedScale(): number {
    const fast = this.keys.has('shift') ? TACTICAL_CAMERA_FAST_MULTIPLIER : 1;
    const zoomScale = this.desiredRadius / TACTICAL_CAMERA_DEFAULT.radius;
    return TACTICAL_CAMERA_PAN_SPEED * fast * zoomScale;
  }

  private panByWorldAxes(rightAmount: number, forwardAmount: number) {
    const right = { x: Math.cos(this.desiredAlpha), z: -Math.sin(this.desiredAlpha) };
    const forward = { x: Math.sin(this.desiredAlpha), z: Math.cos(this.desiredAlpha) };
    this.desiredTarget.x += right.x * rightAmount + forward.x * forwardAmount;
    this.desiredTarget.z += right.z * rightAmount + forward.z * forwardAmount;
  }

  private clampDesired() {
    const margin = 18;
    this.desiredTarget.x = clamp(this.desiredTarget.x, -MAP_HALF - margin, MAP_HALF + margin);
    this.desiredTarget.z = clamp(this.desiredTarget.z, -MAP_HALF - margin, MAP_HALF + margin);
    this.desiredRadius = clamp(this.desiredRadius, TACTICAL_CAMERA_MIN_RADIUS, TACTICAL_CAMERA_MAX_RADIUS);
  }

  private snapToDesired() {
    this.camera.target = this.desiredTarget.clone();
    this.camera.alpha = this.desiredAlpha;
    this.camera.radius = this.desiredRadius;
  }
}

/**
 * Returns the (right, forward) edge-scroll vector for the current cursor
 * position. Each axis is in -1..1, smoothly ramped from the edge inward.
 * Cursor positions outside the viewport (e.g. moved to another monitor) and
 * positions blocked by an interactive HUD element produce 0,0.
 */
export function computeEdgeScrollVector(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
  blocked: boolean,
): { right: number; forward: number } {
  if (blocked) return { right: 0, forward: 0 };
  if (clientX < 0 || clientY < 0 || clientX > viewportWidth || clientY > viewportHeight) {
    return { right: 0, forward: 0 };
  }
  const edge = TACTICAL_EDGE_SCROLL_PIXELS;
  let right = 0;
  let forward = 0;
  if (clientX <= edge) right = -smoothEdge((edge - clientX) / edge);
  else if (clientX >= viewportWidth - edge) right = smoothEdge((clientX - (viewportWidth - edge)) / edge);
  if (clientY <= edge) forward = smoothEdge((edge - clientY) / edge);
  else if (clientY >= viewportHeight - edge) forward = -smoothEdge((clientY - (viewportHeight - edge)) / edge);
  return { right, forward };
}

function smoothEdge(t: number): number {
  // Smoothstep so the ramp eases in instead of snapping at the threshold.
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
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
