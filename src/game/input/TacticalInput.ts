import { ArcRotateCamera, PickingInfo, Scene } from '@babylonjs/core';
import type { SimulationState, Unit, Vec3 } from '../types';

export interface TacticalInputCallbacks {
  onSelectUnit: (id: string | null) => void;
  onIssueMoveOrder: (unitId: string, destination: Vec3) => void;
  getSelectedUnitId: () => string | null;
}

/**
 * Picks units / ground positions in the tactical scene. The camera owns its
 * own pan/zoom controls (Arc rotate camera default) — this class only handles
 * gameplay clicks.
 */
export class TacticalInput {
  private scene: Scene;
  private camera: ArcRotateCamera;
  private canvas: HTMLCanvasElement;
  private cb: TacticalInputCallbacks;
  private state: SimulationState;
  private downAt: { x: number; y: number; t: number } | null = null;
  private bound = false;
  private activeTouchPointers = new Set<number>();
  private suppressTapUntil = 0;

  constructor(scene: Scene, camera: ArcRotateCamera, canvas: HTMLCanvasElement, state: SimulationState, cb: TacticalInputCallbacks) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.state = state;
    this.cb = cb;
  }

  setSimulationState(state: SimulationState) {
    this.state = state;
  }

  attach() {
    if (this.bound) return;
    this.bound = true;
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
  }

  detach() {
    if (!this.bound) return;
    this.bound = false;
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
  }

  private onContextMenu = (ev: Event) => {
    ev.preventDefault();
  };

  private onPointerDown = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      this.activeTouchPointers.add(ev.pointerId);
      if (this.activeTouchPointers.size > 1) {
        this.suppressTapUntil = performance.now() + 450;
        this.downAt = null;
        return;
      }
    }
    if (ev.button === 1) {
      this.downAt = null;
      return;
    }
    this.downAt = { x: ev.clientX, y: ev.clientY, t: performance.now() };
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      this.activeTouchPointers.delete(ev.pointerId);
      if (this.activeTouchPointers.size > 0 || performance.now() < this.suppressTapUntil) {
        this.downAt = null;
        return;
      }
    }
    if (!this.downAt) return;
    const dx = ev.clientX - this.downAt.x;
    const dy = ev.clientY - this.downAt.y;
    const dt = performance.now() - this.downAt.t;
    this.downAt = null;
    // Treat as click if minor movement and quick release.
    if (Math.hypot(dx, dy) > 6 || dt > 400) return;

    // Convert screen coords to scene picks.
    const picked = this.pickUnit(ev);
    if (ev.button === 2) {
      // Right-click: move order.
      const ground = this.pickGround(ev);
      const selectedId = this.cb.getSelectedUnitId();
      if (selectedId && ground) {
        this.cb.onIssueMoveOrder(selectedId, ground);
      }
      return;
    }
    if (ev.button === 0) {
      // On touch devices PointerEvent.button is 0; if a friendly unit is hit, select.
      // Otherwise, if we already have a selection and the user tapped open ground,
      // treat as a move order — convenient for mobile.
      if (picked && picked.faction === 'friendly' && !picked.isDestroyed) {
        this.cb.onSelectUnit(picked.id);
      } else {
        const selectedId = this.cb.getSelectedUnitId();
        const ground = this.pickGround(ev);
        if (selectedId && ground && ev.pointerType !== 'mouse') {
          this.cb.onIssueMoveOrder(selectedId, ground);
        } else if (!picked) {
          this.cb.onSelectUnit(null);
        }
      }
    }
  };

  private pickUnit(ev: PointerEvent): Unit | null {
    const result = this.pick(ev, (m) => m.name.startsWith('hull_') || m.name.startsWith('marker_'));
    if (!result || !result.pickedMesh) return null;
    const id = result.pickedMesh.name.replace(/^[^_]+_/, '');
    return this.state.units.get(id) ?? null;
  }

  private pickGround(ev: PointerEvent): Vec3 | null {
    const result = this.pick(ev, (m) => m.name === 'ground');
    if (!result || !result.pickedPoint) return null;
    return { x: result.pickedPoint.x, y: 0, z: result.pickedPoint.z };
  }

  private pick(ev: PointerEvent, predicate: (m: { name: string }) => boolean): PickingInfo | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    return this.scene.pick(x, y, (m) => predicate(m as any));
  }
}
