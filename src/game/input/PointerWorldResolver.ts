import { Matrix, Scene, Vector3, type ArcRotateCamera } from '@babylonjs/core';
import type { SimulationState, Unit, Vec3 } from '../types';

/**
 * Converts screen coordinates into world-space ground points and resolves which
 * unit (if any) sits beneath the cursor. Kept independent of input/event wiring
 * so the same helpers can serve clicks, hover detection, and box-selection
 * culling.
 */
export class PointerWorldResolver {
  private scene: Scene;
  private camera: ArcRotateCamera;
  private canvas: HTMLCanvasElement;
  private state: SimulationState;

  constructor(scene: Scene, camera: ArcRotateCamera, canvas: HTMLCanvasElement, state: SimulationState) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.state = state;
  }

  setSimulationState(state: SimulationState) {
    this.state = state;
  }

  /** Returns local canvas coordinates (origin top-left) for a window-space event. */
  toCanvasXY(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  /** Pick the ground point the cursor is over, or null if pointing off the world plane. */
  groundPointAt(clientX: number, clientY: number): Vec3 | null {
    const { x, y } = this.toCanvasXY(clientX, clientY);
    const pick = this.scene.pick(x, y, (m) => m.name === 'ground');
    if (!pick || !pick.pickedPoint) return null;
    return { x: pick.pickedPoint.x, y: 0, z: pick.pickedPoint.z };
  }

  /** Picks any unit (friend or foe) under the cursor, identified by the hull/marker mesh prefix. */
  unitAt(clientX: number, clientY: number): Unit | null {
    const { x, y } = this.toCanvasXY(clientX, clientY);
    const pick = this.scene.pick(x, y, (m) => m.name.startsWith('hull_') || m.name.startsWith('marker_'));
    if (!pick || !pick.pickedMesh) return null;
    const id = pick.pickedMesh.name.replace(/^[^_]+_/, '');
    return this.state.units.get(id) ?? null;
  }

  /**
   * Returns all friendly, non-destroyed units whose projected screen position
   * falls inside the given canvas-space rectangle. Used for drag-box selection.
   */
  friendlyUnitsInCanvasRect(x1: number, y1: number, x2: number, y2: number): Unit[] {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const engine = this.scene.getEngine();
    const renderWidth = engine.getRenderWidth();
    const renderHeight = engine.getRenderHeight();
    // Scene returns picks in render-buffer pixels. Convert from CSS pixels.
    const cssWidth = this.canvas.clientWidth || renderWidth;
    const cssHeight = this.canvas.clientHeight || renderHeight;
    const sx = renderWidth / cssWidth;
    const sy = renderHeight / cssHeight;
    const transform = this.scene.getTransformMatrix();
    const viewport = this.camera.viewport.toGlobal(renderWidth, renderHeight);
    const identity = Matrix.Identity();

    const results: Unit[] = [];
    for (const unit of this.state.units.values()) {
      if (unit.faction !== 'friendly') continue;
      if (unit.isDestroyed) continue;
      const world = new Vector3(unit.position.x, 0.6, unit.position.z);
      const projected = Vector3.Project(world, identity, transform, viewport);
      // Drop units behind the camera.
      if (projected.z < 0 || projected.z > 1) continue;
      const cssX = projected.x / sx;
      const cssY = projected.y / sy;
      if (cssX >= minX && cssX <= maxX && cssY >= minY && cssY <= maxY) {
        results.push(unit);
      }
    }
    return results;
  }
}
