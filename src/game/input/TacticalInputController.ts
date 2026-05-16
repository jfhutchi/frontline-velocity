import type { Scene } from '@babylonjs/core';
import { SELECTION_BOX_DRAG_THRESHOLD } from '../constants';
import type { TacticalCameraController } from '../rendering/TacticalCameraController';
import { computeEdgeScrollVector } from '../rendering/TacticalCameraController';
import type { SimulationState, Unit } from '../types';
import { CommandController } from './CommandController';
import { PointerWorldResolver } from './PointerWorldResolver';
import { SelectionController } from './SelectionController';

export interface SelectionBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TacticalInputCallbacks {
  /** Called whenever the drag-rectangle changes (or null when not box-selecting). */
  onSelectionBoxChange: (rect: SelectionBoxRect | null) => void;
  /** Called when the unit under the cursor changes (for hover highlight). */
  onHoverUnitChange: (unitId: string | null) => void;
  /** Called when an order or selection event is worth event-logging. */
  onEvent: (kind: 'select' | 'box' | 'move' | 'attack' | 'noop', detail?: string) => void;
  /** Optional click feedback hook (used to play SFX). */
  onSfx: (kind: 'click' | 'order' | 'attack') => void;
}

/**
 * Owns canvas pointer/keyboard input while the tactical camera is active.
 *
 * - Left button:   click = select / Shift+click = toggle / drag = box select.
 * - Right button:  context order against ground or enemy unit.
 * - Middle button / one-finger touch drag: pan the camera.
 * - Wheel:         smooth zoom.
 * - Q / E, WASD, arrow keys: routed to the TacticalCameraController.
 *
 * UI hit-test guard: any pointerdown whose event.target sits inside an element
 * marked `data-ui-interactive="true"` (or the .game-ui-panel class) is ignored
 * for world-space interactions, so HUD button clicks never become accidental
 * world clicks.
 */
export class TacticalInputController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private state: SimulationState;
  private camera: TacticalCameraController;
  private resolver: PointerWorldResolver;
  private selection: SelectionController;
  private command: CommandController;
  private cb: TacticalInputCallbacks;

  private bound = false;
  /** Pointer-down state for left-button click vs. drag. */
  private leftDown: { startX: number; startY: number; additive: boolean; dragging: boolean } | null = null;
  /** Pointer-down state for right-button click vs. discarded drag. */
  private rightDown: { startX: number; startY: number } | null = null;
  /** Middle-mouse drag state for camera pan. */
  private middleDown: { lastX: number; lastY: number } | null = null;
  /** Alt + middle mouse: orbit camera instead of panning (RTS orbit-drag). */
  private altRotate: { lastX: number } | null = null;
  /** Last cursor position for edge-scroll (in CSS pixels of the document). */
  private cursor = { x: -1, y: -1, blocked: false, valid: false };
  /** Touch-pinch state. */
  private touchPointers = new Map<number, { x: number; y: number }>();
  private lastTouchCenter: { x: number; y: number } | null = null;
  private lastTouchDistance = 0;
  private singleTouchPan: {
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null = null;
  /** Suppress next click if a touch gesture took place. */
  private suppressNextTapUntil = 0;
  /** Long-press timer for touch attack orders. */
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    state: SimulationState,
    camera: TacticalCameraController,
    resolver: PointerWorldResolver,
    selection: SelectionController,
    command: CommandController,
    cb: TacticalInputCallbacks,
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.state = state;
    this.camera = camera;
    this.resolver = resolver;
    this.selection = selection;
    this.command = command;
    this.cb = cb;
  }

  setSimulationState(state: SimulationState) {
    this.state = state;
    this.resolver.setSimulationState(state);
    this.selection.setSimulationState(state);
  }

  attach() {
    if (this.bound) return;
    this.bound = true;
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointermove', this.onWindowPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);
  }

  detach() {
    if (!this.bound) return;
    this.bound = false;
    this.clearLongPress();
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.cb.onSelectionBoxChange(null);
    this.camera.clearKeys();
    this.leftDown = null;
    this.rightDown = null;
    this.middleDown = null;
    this.altRotate = null;
    this.touchPointers.clear();
    this.singleTouchPan = null;
    this.cursor.valid = false;
  }

  /** Called every frame (only while tactical camera is active) to drive edge-scroll. */
  tick() {
    if (!this.cursor.valid) {
      this.camera.setEdgeScroll(0, 0);
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = this.cursor.x - rect.left;
    const y = this.cursor.y - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      this.camera.setEdgeScroll(0, 0);
      return;
    }
    const vec = computeEdgeScrollVector(x, y, rect.width, rect.height, this.cursor.blocked);
    this.camera.setEdgeScroll(vec.right, vec.forward);
  }

  // ----- helpers -----

  private clearLongPress() {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private isOverInteractiveUi(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    if (target === this.canvas) return false;
    const el = target.closest(
      '[data-ui-interactive="true"], .game-ui-panel, button, input, select, textarea, .pause-overlay, .end-overlay, .controls-help, .objective-panel, .unit-panel, .unit-roster, .tactical-controls, .event-log, .mobile-camera-pad, .selection-box-overlay',
    );
    return Boolean(el);
  }

  private updateHoverFromEvent(ev: PointerEvent) {
    if (this.middleDown || this.altRotate || this.leftDown?.dragging) {
      this.cb.onHoverUnitChange(null);
      return;
    }
    const unit = this.resolver.unitAt(ev.clientX, ev.clientY);
    this.cb.onHoverUnitChange(unit && unit.faction === 'friendly' && !unit.isDestroyed ? unit.id : null);
  }

  // ----- canvas event handlers -----

  private onContextMenu = (ev: Event) => ev.preventDefault();

  private onPointerDown = (ev: PointerEvent) => {
    // Touch path: tap-select/order, one-finger pan, and two-finger pan/pinch.
    if (ev.pointerType === 'touch') {
      requestFullscreenOnFirstTouch();
      this.touchPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.touchPointers.size === 1) {
        this.singleTouchPan = {
          id: ev.pointerId,
          startX: ev.clientX,
          startY: ev.clientY,
          lastX: ev.clientX,
          lastY: ev.clientY,
          moved: false,
        };
        // Long-press on an enemy unit = attack order (500 ms threshold).
        const lpX = ev.clientX;
        const lpY = ev.clientY;
        this.longPressTimer = setTimeout(() => {
          this.longPressTimer = null;
          if (this.singleTouchPan?.moved) return;
          const selected = this.selection.getSelectedUnits();
          if (!selected.length) return;
          const target = this.resolver.unitAt(lpX, lpY);
          if (target && target.faction === 'enemy' && !target.isDestroyed) {
            if (this.command.issueAttackTarget(selected, target.id)) {
              this.cb.onSfx('attack');
              this.cb.onEvent('attack', `Attack order: ${target.name}`);
              this.suppressNextTapUntil = performance.now() + 600;
            }
          }
        }, 500);
      }
      if (this.touchPointers.size >= 2) {
        const [a, b] = [...this.touchPointers.values()];
        this.lastTouchCenter = midpoint(a, b);
        this.lastTouchDistance = distance2d(a, b);
        this.singleTouchPan = null;
        this.suppressNextTapUntil = performance.now() + 500;
        this.clearLongPress();
      }
      try {
        this.canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      ev.preventDefault();
      return;
    }

    if (this.isOverInteractiveUi(ev.target)) return;

    if (ev.button === 1) {
      // Middle drag: pan, or Alt+middle drag orbit (camera rotate).
      if (ev.altKey) {
        this.altRotate = { lastX: ev.clientX };
      } else {
        this.middleDown = { lastX: ev.clientX, lastY: ev.clientY };
      }
      try {
        this.canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      ev.preventDefault();
      return;
    }
    if (ev.button === 0) {
      this.leftDown = {
        startX: ev.clientX,
        startY: ev.clientY,
        additive: ev.shiftKey,
        dragging: false,
      };
      try {
        this.canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    if (ev.button === 2) {
      this.rightDown = { startX: ev.clientX, startY: ev.clientY };
      ev.preventDefault();
      return;
    }
  };

  private onPointerMove = (ev: PointerEvent) => {
    // Touch pan / pinch.
    if (ev.pointerType === 'touch') {
      if (!this.touchPointers.has(ev.pointerId)) return;
      this.touchPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.touchPointers.size === 1 && this.singleTouchPan?.id === ev.pointerId) {
        const dxFromStart = ev.clientX - this.singleTouchPan.startX;
        const dyFromStart = ev.clientY - this.singleTouchPan.startY;
        if (this.singleTouchPan.moved || Math.hypot(dxFromStart, dyFromStart) > SELECTION_BOX_DRAG_THRESHOLD) {
          this.clearLongPress();
          this.singleTouchPan.moved = true;
          this.camera.panFromScreenDelta(ev.clientX - this.singleTouchPan.lastX, ev.clientY - this.singleTouchPan.lastY);
          this.singleTouchPan.lastX = ev.clientX;
          this.singleTouchPan.lastY = ev.clientY;
          this.suppressNextTapUntil = performance.now() + 180;
          ev.preventDefault();
        }
        return;
      }
      if (this.touchPointers.size >= 2 && this.lastTouchCenter) {
        const [a, b] = [...this.touchPointers.values()];
        const center = midpoint(a, b);
        const dist = distance2d(a, b);
        this.camera.panFromScreenDelta(center.x - this.lastTouchCenter.x, center.y - this.lastTouchCenter.y);
        if (this.lastTouchDistance > 0) {
          this.camera.zoom((this.lastTouchDistance - dist) * 0.18);
        }
        this.lastTouchCenter = center;
        this.lastTouchDistance = dist;
        ev.preventDefault();
      }
      return;
    }

    if (this.altRotate) {
      const dx = ev.clientX - this.altRotate.lastX;
      this.altRotate.lastX = ev.clientX;
      this.camera.applyMouseOrbitDeltaX(dx);
      ev.preventDefault();
      return;
    }

    if (this.middleDown) {
      this.camera.panFromScreenDelta(ev.clientX - this.middleDown.lastX, ev.clientY - this.middleDown.lastY);
      this.middleDown.lastX = ev.clientX;
      this.middleDown.lastY = ev.clientY;
      ev.preventDefault();
      return;
    }

    if (this.leftDown) {
      const dx = ev.clientX - this.leftDown.startX;
      const dy = ev.clientY - this.leftDown.startY;
      if (!this.leftDown.dragging && Math.hypot(dx, dy) > SELECTION_BOX_DRAG_THRESHOLD) {
        this.leftDown.dragging = true;
      }
      if (this.leftDown.dragging) {
        this.cb.onSelectionBoxChange({
          x: Math.min(this.leftDown.startX, ev.clientX),
          y: Math.min(this.leftDown.startY, ev.clientY),
          width: Math.abs(dx),
          height: Math.abs(dy),
        });
      }
    }

    this.updateHoverFromEvent(ev);
  };

  /** Window-level move tracker for cursor-on-screen position (drives edge-scroll). */
  private onWindowPointerMove = (ev: PointerEvent) => {
    if (ev.pointerType !== 'mouse') return;
    this.cursor.x = ev.clientX;
    this.cursor.y = ev.clientY;
    this.cursor.valid = true;
    this.cursor.blocked = this.isOverInteractiveUi(ev.target);
    // Clear stale hover when the cursor leaves the canvas onto HUD elements.
    if (this.cursor.blocked) this.cb.onHoverUnitChange(null);
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      this.clearLongPress();
      const wasSinglePan = this.singleTouchPan?.id === ev.pointerId && this.singleTouchPan.moved;
      this.touchPointers.delete(ev.pointerId);
      if (this.singleTouchPan?.id === ev.pointerId) {
        this.singleTouchPan = null;
      }
      if (this.touchPointers.size < 2) {
        this.lastTouchCenter = null;
        this.lastTouchDistance = 0;
      }
      try {
        this.canvas.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      if (wasSinglePan || performance.now() < this.suppressNextTapUntil || this.touchPointers.size > 0) return;
      // Single-finger tap on touch devices: select / order similar to v0.0.2.
      this.handleTouchTap(ev);
      return;
    }

    if (ev.button === 1 && (this.middleDown || this.altRotate)) {
      this.middleDown = null;
      this.altRotate = null;
      try {
        this.canvas.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    if (ev.button === 0 && this.leftDown) {
      const left = this.leftDown;
      this.leftDown = null;
      try {
        this.canvas.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      this.cb.onSelectionBoxChange(null);
      if (this.isOverInteractiveUi(ev.target) && !left.dragging) {
        // Pointer was released over a UI element after a click — treat as no-op.
        return;
      }
      if (left.dragging) {
        const { x: cx, y: cy } = this.resolver.toCanvasXY(ev.clientX, ev.clientY);
        const { x: sx, y: sy } = this.resolver.toCanvasXY(left.startX, left.startY);
        const inside = this.resolver.friendlyUnitsInCanvasRect(sx, sy, cx, cy);
        const count = this.selection.setBoxSelection(inside, left.additive);
        if (count > 0) {
          this.cb.onSfx('click');
          this.cb.onEvent('box', `${count} unit${count === 1 ? '' : 's'} selected`);
        } else if (!left.additive) {
          this.cb.onEvent('noop');
        }
        return;
      }
      // Click (no drag).
      this.handleLeftClick(ev, left.additive);
      return;
    }

    if (ev.button === 2 && this.rightDown) {
      const right = this.rightDown;
      this.rightDown = null;
      const dx = ev.clientX - right.startX;
      const dy = ev.clientY - right.startY;
      if (Math.hypot(dx, dy) > SELECTION_BOX_DRAG_THRESHOLD) return; // ignore drag
      if (this.isOverInteractiveUi(ev.target)) return;
      this.handleRightClick(ev);
      return;
    }
  };

  private onPointerCancel = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      this.clearLongPress();
      this.touchPointers.delete(ev.pointerId);
      this.lastTouchCenter = null;
      this.lastTouchDistance = 0;
      if (this.singleTouchPan?.id === ev.pointerId) this.singleTouchPan = null;
      return;
    }
    this.middleDown = null;
    this.altRotate = null;
    this.leftDown = null;
    this.rightDown = null;
    this.cb.onSelectionBoxChange(null);
  };

  private handleLeftClick(ev: PointerEvent, additive: boolean) {
    const unit = this.resolver.unitAt(ev.clientX, ev.clientY);
    if (unit && unit.faction === 'friendly' && !unit.isDestroyed) {
      const result = this.selection.selectFriendly(unit, additive);
      if (result !== 'none') {
        this.cb.onSfx('click');
        this.cb.onEvent('select', `${unit.name} selected`);
      }
      return;
    }
    if (!additive) this.selection.clear();
  }

  private handleRightClick(ev: PointerEvent) {
    const selected = this.selection.getSelectedUnits();
    if (!selected.length) {
      this.cb.onEvent('noop', 'No units selected');
      return;
    }
    const unit = this.resolver.unitAt(ev.clientX, ev.clientY);
    if (unit && unit.faction === 'enemy' && !unit.isDestroyed) {
      if (this.command.issueAttackTarget(selected, unit.id)) {
        this.cb.onSfx('attack');
        this.cb.onEvent('attack', `Attack order: ${unit.name}`);
      }
      return;
    }
    const ground = this.resolver.groundPointAt(ev.clientX, ev.clientY);
    if (!ground) return;
    if (this.command.issueGroundOrder(selected, ground)) {
      this.cb.onSfx('order');
      const obj = this.resolver.isClickInObjectiveZone(ev.clientX, ev.clientY);
      this.cb.onEvent('move', obj ? 'Move order to objective' : `Move order issued (${selected.length})`);
    }
  }

  private handleTouchTap(ev: PointerEvent) {
    const unit = this.resolver.unitAt(ev.clientX, ev.clientY);
    if (unit && unit.faction === 'friendly' && !unit.isDestroyed) {
      this.selection.selectFriendly(unit, false);
      this.cb.onSfx('click');
      return;
    }
    const selected = this.selection.getSelectedUnits();
    if (selected.length) {
      const ground = this.resolver.groundPointAt(ev.clientX, ev.clientY);
      if (ground) {
        this.command.issueGroundOrder(selected, ground);
        this.cb.onSfx('order');
      }
    } else {
      this.selection.clear();
    }
  }

  private onWheel = (ev: WheelEvent) => {
    if (this.isOverInteractiveUi(ev.target)) return;
    const ground = this.resolver.groundPointAt(ev.clientX, ev.clientY);
    this.camera.zoomByWheelTicksToward(ev.deltaY, ground);
    ev.preventDefault();
  };

  private onMouseLeave = () => {
    this.cursor.valid = false;
    this.camera.setEdgeScroll(0, 0);
    this.cb.onHoverUnitChange(null);
  };

  // ----- keyboard -----

  private onKeyDown = (ev: KeyboardEvent) => {
    // Don't steal keys from text inputs (defensive — none today, but cheap).
    const target = ev.target as Element | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const key = ev.key.toLowerCase();
    if (key === 'home' || key === 'r') {
      this.camera.reset();
      ev.preventDefault();
      return;
    }
    if (key === 'shift') {
      this.camera.onKeyDown(key);
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'].includes(key)) {
      this.camera.onKeyDown(key);
      ev.preventDefault();
    }
  };

  private onKeyUp = (ev: KeyboardEvent) => {
    this.camera.onKeyUp(ev.key.toLowerCase());
  };

  private onBlur = () => {
    this.clearLongPress();
    this.camera.clearKeys();
    this.middleDown = null;
    this.altRotate = null;
    this.leftDown = null;
    this.rightDown = null;
    this.touchPointers.clear();
    this.singleTouchPan = null;
    this.cursor.valid = false;
    this.cb.onSelectionBoxChange(null);
  };

  private onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.camera.clearKeys();
      this.middleDown = null;
      this.altRotate = null;
      this.leftDown = null;
      this.rightDown = null;
      this.touchPointers.clear();
      this.singleTouchPan = null;
      this.cursor.valid = false;
      this.camera.setEdgeScroll(0, 0);
      this.cb.onSelectionBoxChange(null);
    }
  };
}

let _fullscreenRequested = false;
function requestFullscreenOnFirstTouch() {
  if (_fullscreenRequested) return;
  _fullscreenRequested = true;
  document.documentElement.requestFullscreen?.().catch(() => {});
  (screen.orientation as any)?.lock?.('landscape').catch?.(() => {});
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Determines whether the given target Unit can be picked. Useful for tests. */
export function isTacticallySelectable(unit: Unit | null): unit is Unit {
  return Boolean(unit && unit.faction === 'friendly' && !unit.isDestroyed);
}

/** Marker export so this module retains its single-purpose role. */
export type { SimulationState };
