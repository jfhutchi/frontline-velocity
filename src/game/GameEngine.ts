import { AudioManager } from './audio/AudioManager';
import {
  DC_FORWARD_ACCEL,
  DC_MAX_FORWARD_SPEED,
  DC_MAX_REVERSE_SPEED,
  DC_REVERSE_ACCEL,
  DC_TURN_RATE,
  MAP_HALF,
  SPEED_LEVELS,
  VEHICLE_FRICTION,
} from './constants';
import { CommandController } from './input/CommandController';
import { DirectControlInput } from './input/DirectControlInput';
import { PointerWorldResolver } from './input/PointerWorldResolver';
import { SelectionController } from './input/SelectionController';
import { TacticalInputController, type SelectionBoxRect } from './input/TacticalInputController';
import { CameraController } from './rendering/CameraController';
import { createBabylonContext, disposeBabylonContext, type BabylonContext } from './rendering/BabylonScene';
import { EffectsRenderer } from './rendering/EffectsRenderer';
import { TerrainRenderer } from './rendering/TerrainRenderer';
import { UnitRenderer } from './rendering/UnitRenderer';
import { Simulation } from './simulation/Simulation';
import { installScenarioTestHook } from './simulation/ai/__tests__/squadScenarios';
import { useGameStore, type MinimapBlip, type MinimapSnapshot, type UnitSummary } from './state/gameStore';
import type { BattlefieldEvent, GameMode, Unit } from './types';
import { resolveUnitAgainstObstacles } from './simulation/systems/PathfindingSystem';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

export interface GameEngineCallbacks {
  /** Called when the drag-rectangle changes so React can render the overlay. */
  onSelectionBoxChange?: (rect: SelectionBoxRect | null) => void;
}

export class GameEngine {
  private ctx: BabylonContext;
  private terrainRenderer: TerrainRenderer;
  private unitRenderer: UnitRenderer;
  private effectsRenderer: EffectsRenderer;
  private cameraController: CameraController;
  private simulation: Simulation;
  private resolver: PointerWorldResolver;
  private selection: SelectionController;
  private commandController: CommandController;
  private tacticalInput: TacticalInputController;
  private directInput: DirectControlInput;
  private canvas: HTMLCanvasElement;
  private callbacks: GameEngineCallbacks;

  private lastFrameTime = 0;
  private resultEmitted = false;
  private summaryAccumulator = 0;
  private prevControlledUnitId: string | null = null;
  private vehicleVelocity = 0;
  private projectileSoundCooldown = 0;
  private lastEffectCount = 0;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrame = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.ctx = createBabylonContext(canvas);
    this.simulation = new Simulation({
      onPlayerHit: () => useGameStore.getState().flashDamage(),
    });
    this.terrainRenderer = new TerrainRenderer(this.ctx.scene, this.ctx.shadowGenerator);
    this.unitRenderer = new UnitRenderer(this.ctx.scene, this.ctx.shadowGenerator);
    this.effectsRenderer = new EffectsRenderer(this.ctx.scene);
    this.cameraController = new CameraController(this.ctx.scene, this.ctx.camera, canvas);
    this.resolver = new PointerWorldResolver(this.ctx.scene, this.ctx.camera, canvas, this.simulation.state);
    this.selection = new SelectionController(this.simulation.state);
    this.commandController = new CommandController(this.simulation);
    this.tacticalInput = new TacticalInputController(
      this.ctx.scene,
      canvas,
      this.simulation.state,
      this.cameraController.getTactical(),
      this.resolver,
      this.selection,
      this.commandController,
      {
        onSelectionBoxChange: (rect) => this.callbacks.onSelectionBoxChange?.(rect),
        onHoverUnitChange: (id) => useGameStore.getState().setHoveredUnitId(id),
        onEvent: (kind, detail) => this.appendInputEventLog(kind, detail),
        onSfx: (kind) => {
          if (kind === 'click') AudioManager.play('click');
          else if (kind === 'order') AudioManager.play('click');
          else if (kind === 'attack') AudioManager.play('hit');
        },
      },
    );
    this.directInput = new DirectControlInput();

    this.terrainRenderer.build(this.simulation.state.mission);
    this.tacticalInput.attach();

    this.ctx.engine.runRenderLoop(this.frame);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.onDocVisibility);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.ctx.engine.resize());
      this.resizeObserver.observe(canvas);
    }
    // Frame the camera over the friendly starting area.
    this.cameraController.resetTacticalCamera(true);
    this.exposeTestHooks();
    installScenarioTestHook();

    this.publishSummaries(true);
  }

  dispose() {
    this.tacticalInput.detach();
    this.directInput.detach();
    this.cameraController.dispose();
    if (window.render_game_to_text === this.renderGameToText) window.render_game_to_text = undefined;
    if (window.advanceTime === this.advanceTime) window.advanceTime = undefined;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.onDocVisibility);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('focus', this.onWindowFocus);
    if (this.resizeFrame) window.cancelAnimationFrame(this.resizeFrame);
    this.resizeObserver?.disconnect();
    this.unitRenderer.dispose();
    this.effectsRenderer.dispose();
    this.terrainRenderer.dispose();
    disposeBabylonContext(this.ctx);
  }

  resetMission() {
    this.simulation.reset();
    this.tacticalInput.setSimulationState(this.simulation.state);
    this.commandController.setSimulation(this.simulation);
    this.terrainRenderer.build(this.simulation.state.mission);
    this.unitRenderer.dispose();
    this.effectsRenderer.dispose();
    this.unitRenderer = new UnitRenderer(this.ctx.scene, this.ctx.shadowGenerator);
    this.effectsRenderer = new EffectsRenderer(this.ctx.scene);
    this.resultEmitted = false;
    this.cameraController.activate('tactical');
    this.cameraController.resetTacticalCamera(true);
    this.publishSummaries(true);
  }

  private onDocVisibility = () => {
    if (document.visibilityState === 'hidden') {
      AudioManager.suspend();
    } else {
      AudioManager.resume();
    }
  };

  private onWindowBlur = () => {
    AudioManager.suspend();
  };

  private onWindowFocus = () => {
    AudioManager.resume();
  };

  private handleResize = () => {
    if (this.resizeFrame) window.cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = window.requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.ctx.engine.resize();
    });
    window.setTimeout(() => this.ctx.engine.resize(), 160);
  };

  private frame = () => {
    const now = performance.now() / 1000;
    const rawDt = this.lastFrameTime === 0 ? 1 / 60 : Math.max(0, now - this.lastFrameTime);
    this.lastFrameTime = now;

    const store = useGameStore.getState();
    const speed = store.paused ? 0 : SPEED_LEVELS[store.speedLevel];
    const controlledId = store.controlledUnitId;

    // Handle camera mode switch.
    if (store.screen === 'directControl' && controlledId) {
      if (this.cameraController.getMode() !== 'directControl') {
        this.cameraController.activate('directControl');
        this.directInput.attach();
        this.tacticalInput.detach();
      }
      this.applyDirectControl(rawDt, controlledId, speed > 0);
    } else {
      if (this.cameraController.getMode() !== 'tactical') {
        this.cameraController.activate('tactical');
        this.directInput.detach();
        this.tacticalInput.attach();
        // Restore the prior controlled unit's order so it doesn't freeze.
        if (this.prevControlledUnitId) {
          this.simulation.setControlledUnitOrderToHold(this.prevControlledUnitId);
        }
      }
    }
    this.prevControlledUnitId = controlledId;

    // Step simulation.
    if (rawDt > 0) {
      this.simulation.update(rawDt, speed, controlledId);
    }
    this.tacticalInput.setSimulationState(this.simulation.state);
    if (this.cameraController.getMode() === 'tactical') {
      this.tacticalInput.tick();
    }
    this.cameraController.update(rawDt);

    // Render syncing.
    this.syncRenderers();

    // Camera tracking when in direct control.
    if (controlledId) {
      const unit = this.simulation.state.units.get(controlledId);
      if (unit) {
        if (unit.isDestroyed && store.screen === 'directControl') {
          // Vehicle destroyed: kick the player back to tactical so they can
          // keep playing with surviving units.
          useGameStore.getState().exitDirectControl();
        } else {
          this.cameraController.trackChase(unit, rawDt);
        }
      }
    }

    // Push summaries to UI ~10x/sec.
    this.summaryAccumulator += rawDt;
    if (this.summaryAccumulator >= 0.1) {
      this.summaryAccumulator = 0;
      this.publishSummaries(false);
      // Publish enemy AI debug snapshot at the same cadence so the overlay
      // updates smoothly without dragging the simulation tick rate down.
      if (useGameStore.getState().showEnemyDebug) {
        useGameStore.getState().setEnemyDebug(this.simulation.getEnemyDebugSnapshots());
      }
      this.publishCameraStatus();
    }

    // Detect end conditions.
    if (this.simulation.state.result && !this.resultEmitted) {
      this.resultEmitted = true;
      const r = this.simulation.state.result;
      AudioManager.play(r === 'victory' ? 'victory' : 'defeat');
      useGameStore.getState().setResult(r);
    }

    // Play SFX for newly spawned effects (rough heuristic — count growth).
    const effects = this.simulation.state.effects;
    if (effects.length > this.lastEffectCount) {
      const added = effects.slice(this.lastEffectCount);
      for (const e of added) {
        if (e.kind === 'explosion' && e.scale && e.scale > 1.6) {
          AudioManager.play('explosion');
        } else if (e.kind === 'muzzleFlash') {
          // throttle muzzle flash sounds to avoid spam
          if (this.projectileSoundCooldown <= 0) {
            AudioManager.play('fire');
            this.projectileSoundCooldown = 0.05;
          }
        } else if (e.kind === 'hit') {
          AudioManager.play('hit');
        }
      }
    }
    this.lastEffectCount = effects.length;
    this.projectileSoundCooldown = Math.max(0, this.projectileSoundCooldown - rawDt);

    this.ctx.scene.render();
  };

  private applyDirectControl(rawDt: number, controlledId: string, simulating: boolean) {
    const unit = this.simulation.state.units.get(controlledId);
    if (!unit || unit.isDestroyed) return;
    const input = this.directInput.read();
    if (!simulating) return;

    const dt = Math.min(rawDt, 1 / 30);

    // Hull rotation.
    unit.rotation += input.turn * DC_TURN_RATE * dt;

    // Vehicle velocity along forward axis with simple acceleration.
    // Speed is capped to the unit's own speed stat so infantry can't sprint at
    // tank pace, and zero-speed weapons (mortar, AT gun) stay stationary.
    const dcFwdMax = Math.min(DC_MAX_FORWARD_SPEED, unit.speed);
    const dcRevMax = Math.min(DC_MAX_REVERSE_SPEED, unit.speed);
    if (input.forward > 0) {
      this.vehicleVelocity = Math.min(
        dcFwdMax,
        this.vehicleVelocity + DC_FORWARD_ACCEL * input.forward * dt,
      );
    } else if (input.forward < 0) {
      this.vehicleVelocity = Math.max(
        -dcRevMax,
        this.vehicleVelocity + DC_REVERSE_ACCEL * input.forward * dt,
      );
    } else {
      // Friction when no input.
      const sign = Math.sign(this.vehicleVelocity);
      const dec = VEHICLE_FRICTION * dt;
      this.vehicleVelocity = Math.abs(this.vehicleVelocity) <= dec ? 0 : this.vehicleVelocity - sign * dec;
    }

    const sin = Math.sin(unit.rotation);
    const cos = Math.cos(unit.rotation);
    const newX = unit.position.x + sin * this.vehicleVelocity * dt;
    const newZ = unit.position.z + cos * this.vehicleVelocity * dt;
    unit.position.x = Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, newX));
    unit.position.z = Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, newZ));
    resolveUnitAgainstObstacles(unit, this.simulation.state);
    unit.currentSpeed = Math.abs(this.vehicleVelocity);

    // Turret aim: face camera direction. We use the chase camera's yaw.
    // Simpler: just keep turret aligned with hull (turret = 0 in hull-local)
    // but allow slight mouse-driven offset later. For v0.0.1, keep aligned.
    unit.turretRotation = unit.turretRotation * 0.95; // slowly recenter

    if (input.fire) {
      const fired = this.simulation.fireFromControlled(controlledId);
      if (fired) {
        this.cameraController.addRecoilShake();
        AudioManager.play('fire');
      }
    }
  }

  private syncRenderers() {
    const state = this.simulation.state;
    const store = useGameStore.getState();
    const selectedSet = new Set(store.selectedUnitIds);
    const hoveredId = store.hoveredUnitId;

    const activeIds = new Set<string>();
    for (const u of state.units.values()) {
      activeIds.add(u.id);
      const isSelected = selectedSet.has(u.id);
      const isControlled = store.controlledUnitId === u.id;
      const isHovered = hoveredId === u.id && !isSelected;
      const target = u.targetId ? state.units.get(u.targetId) ?? null : null;
      this.unitRenderer.update(u, isSelected, isControlled, target, state.time, isHovered);
    }
    this.unitRenderer.removeMissing(activeIds);

    this.effectsRenderer.update(state);
    this.terrainRenderer.updateObjective(state.objective);
    this.terrainRenderer.syncBuildings(state);
  }

  private publishCameraStatus() {
    const tactical = this.cameraController.getTactical();
    const yaw = tactical.getYaw();
    const dist = tactical.getDistance();
    const { min, max } = tactical.getDistanceLimits();
    const frac = max > min ? (dist - min) / (max - min) : 0.5;
    useGameStore.getState().setCameraStatus(yaw, Math.max(0, Math.min(1, frac)));
  }

  private appendInputEventLog(
    kind: 'select' | 'box' | 'move' | 'attack' | 'noop',
    detail?: string,
  ) {
    if (kind === 'noop') return;
    const message = detail ?? defaultInputEventLabel(kind);
    if (!message) return;
    const state = this.simulation.state;
    state.eventLog.push({ id: `input_${kind}_${state.time.toFixed(2)}`, time: state.time, message });
    if (state.eventLog.length > 6) {
      state.eventLog.splice(0, state.eventLog.length - 6);
    }
  }

  private publishSummaries(force: boolean) {
    const state = this.simulation.state;
    const summaries: UnitSummary[] = [];
    for (const u of state.units.values()) {
      summaries.push(toSummary(u, state.time, state.units));
    }
    const store = useGameStore.getState();
    if (!force) {
      // Skip allocation churn: only push if unit count changed or key fields changed.
      const prev = store.unitSummaries;
      if (prev.length === summaries.length) {
        let same = true;
        for (let i = 0; i < prev.length; i += 1) {
          const a = prev[i];
          const b = summaries[i];
          if (
            a.id !== b.id ||
            a.health !== b.health ||
            a.isDestroyed !== b.isDestroyed ||
            Math.abs(a.currentSpeed - b.currentSpeed) > 0.1 ||
            Math.abs(a.reloadProgress - b.reloadProgress) > 0.05 ||
            a.orderKind !== b.orderKind ||
            a.targetName !== b.targetName ||
            a.aiState !== b.aiState
          ) {
            same = false;
            break;
          }
        }
        if (same) {
          // Still update objective, but don't replace summaries.
          store.setObjective({ ...state.objective });
          store.setEventLog([...state.eventLog]);
          return;
        }
      }
    }
    store.setUnitSummaries(summaries);
    store.setObjective({ ...state.objective });
    store.setEventLog([...state.eventLog]);
    store.setMinimap(this.buildMinimapSnapshot());
  }

  private buildMinimapSnapshot(): MinimapSnapshot {
    const state = this.simulation.state;
    const selected = new Set(useGameStore.getState().selectedUnitIds);
    const blips: MinimapBlip[] = [];
    for (const u of state.units.values()) {
      if (u.isDestroyed) continue;
      blips.push({
        id: u.id,
        kind: u.faction === 'friendly' ? 'friendly' : 'enemy',
        x: u.position.x,
        z: u.position.z,
        selected: selected.has(u.id),
      });
    }
    for (const b of state.buildings.values()) {
      blips.push({
        id: b.id,
        kind: b.isDestroyed ? 'rubble' : 'building',
        x: b.position.x,
        z: b.position.z,
        destroyed: b.isDestroyed,
      });
    }
    const obj = state.objective;
    const heldFrac = obj.requiredHoldSeconds > 0
      ? Math.max(0, Math.min(1, obj.heldSeconds / obj.requiredHoldSeconds))
      : (obj.captured ? 1 : 0);
    return {
      mapSize: state.mission.mapSize,
      blips,
      objective: {
        x: obj.position.x,
        z: obj.position.z,
        radius: obj.radius,
        controlPercent: heldFrac,
      },
      cameraFocus: { x: this.ctx.camera.target.x, z: this.ctx.camera.target.z },
    };
  }

  jumpIntoSelected() {
    const store = useGameStore.getState();
    const id = store.selectedUnitId;
    if (!id) return;
    const u = this.simulation.state.units.get(id);
    if (!u || u.isDestroyed || !u.isPlayerControllable) return;
    AudioManager.play('click');
    store.enterDirectControl();
  }

  exitDirectControl() {
    AudioManager.play('click');
    useGameStore.getState().exitDirectControl();
  }

  setMobileVehicleInput(forward: number, turn: number, fire: boolean) {
    this.directInput.setTouch(forward, turn, fire);
  }

  setTacticalTouchCamera(right: number, forward: number, rotate: number, zoom: number) {
    this.cameraController.setTacticalVirtualControls(right, forward, rotate, zoom);
  }

  /** Used by HUD buttons — centers on the primary selected unit. */
  centerCameraOnSelected() {
    const ids = useGameStore.getState().selectedUnitIds;
    if (!ids.length) return;
    let cx = 0;
    let cz = 0;
    let count = 0;
    for (const id of ids) {
      const u = this.simulation.state.units.get(id);
      if (!u) continue;
      cx += u.position.x;
      cz += u.position.z;
      count += 1;
    }
    if (!count) return;
    this.cameraController.centerOn(cx / count, cz / count);
  }

  /** Center camera on a control group's average position; used for double-tap. */
  centerCameraOnUnits(ids: string[]) {
    let cx = 0;
    let cz = 0;
    let count = 0;
    for (const id of ids) {
      const u = this.simulation.state.units.get(id);
      if (!u || u.isDestroyed) continue;
      cx += u.position.x;
      cz += u.position.z;
      count += 1;
    }
    if (!count) return;
    this.cameraController.centerOn(cx / count, cz / count);
  }

  resetTacticalCamera() {
    this.cameraController.resetTacticalCamera();
    this.appendInputEventLog('move', 'Camera reset to overview');
  }

  /** Pan the tactical camera to a world position (used by the minimap). */
  panTacticalCameraTo(worldX: number, worldZ: number) {
    this.cameraController.getTactical().centerOn(worldX, worldZ);
  }

  /**
   * Issue Stop/Hold-position to all currently selected friendly units. Used by
   * the HUD button and the `H` keyboard shortcut.
   */
  stopSelectedUnits(): number {
    const ids = useGameStore.getState().selectedUnitIds;
    if (!ids.length) return 0;
    const units: Unit[] = [];
    for (const id of ids) {
      const u = this.simulation.state.units.get(id);
      if (u) units.push(u);
    }
    const count = this.commandController.issueHold(units);
    if (count > 0) {
      AudioManager.play('click');
      this.appendInputEventLog('move', `Hold position (${count})`);
    }
    return count;
  }

  rotateTacticalCamera(direction: number) {
    this.cameraController.rotateTactical(direction);
  }

  zoomTacticalCamera(delta: number) {
    this.cameraController.zoomTactical(delta);
  }

  /** Returns simulation reference for higher-level use cases. */
  getSimulation() {
    return this.simulation;
  }

  private exposeTestHooks() {
    window.render_game_to_text = this.renderGameToText;
    window.advanceTime = this.advanceTime;
  }

  private renderGameToText = () => {
    const state = this.simulation.state;
    const store = useGameStore.getState();
    const units = [...state.units.values()].map((u) => ({
      id: u.id,
      name: u.name,
      faction: u.faction,
      type: u.type,
      x: Number(u.position.x.toFixed(1)),
      z: Number(u.position.z.toFixed(1)),
      health: Math.round(u.health),
      order: u.currentOrder.kind,
      ai: u.aiState,
      targetId: u.targetId,
      destroyed: u.isDestroyed,
    }));
    const payload = {
      note: 'World coordinates use x east/west and z north/south on the ground plane.',
      screen: store.screen,
      selectedUnitId: store.selectedUnitId,
      selectedUnitIds: store.selectedUnitIds,
      controlledUnitId: store.controlledUnitId,
      objective: {
        heldSeconds: Number(state.objective.heldSeconds.toFixed(1)),
        contested: state.objective.contested,
        captured: state.objective.captured,
      },
      camera: {
        x: Number(this.ctx.camera.target.x.toFixed(1)),
        z: Number(this.ctx.camera.target.z.toFixed(1)),
        yaw: Number(this.cameraController.getTactical().getYaw().toFixed(3)),
        zoomFrac: Number(store.cameraZoomFrac.toFixed(2)),
      },
      units,
      events: state.eventLog.map((event: BattlefieldEvent) => event.message),
    };
    return JSON.stringify(payload);
  };

  private advanceTime = (ms: number) => {
    const store = useGameStore.getState();
    const speed = store.paused ? 0 : SPEED_LEVELS[store.speedLevel];
    this.simulation.update(Math.max(0, ms) / 1000, speed, store.controlledUnitId);
    this.syncRenderers();
    this.publishSummaries(true);
    this.ctx.scene.render();
  };
}

function defaultInputEventLabel(kind: 'select' | 'box' | 'move' | 'attack'): string {
  switch (kind) {
    case 'select':
      return 'Unit selected';
    case 'box':
      return 'Units selected';
    case 'move':
      return 'Move order issued';
    case 'attack':
      return 'Attack order issued';
  }
}

function toSummary(u: Unit, time: number, units: Map<string, Unit>): UnitSummary {
  const sinceFire = time - u.weapon.lastFiredAt;
  const reloadProgress = Math.max(0, Math.min(1, sinceFire / u.weapon.reloadSeconds));
  const target = u.targetId ? units.get(u.targetId) : undefined;
  const orderLabel = formatOrder(u);
  return {
    id: u.id,
    name: u.name,
    type: u.type,
    faction: u.faction,
    health: Math.max(0, Math.round(u.health)),
    maxHealth: u.maxHealth,
    armor: u.armor,
    speed: u.speed,
    currentSpeed: Math.abs(u.currentSpeed),
    weaponName: u.weapon.name,
    weaponRange: u.weapon.range,
    reloadSeconds: u.weapon.reloadSeconds,
    reloadProgress,
    orderKind: u.currentOrder.kind,
    orderLabel,
    aiState: u.aiState,
    targetId: u.targetId,
    targetName: target?.name ?? null,
    isUnderAttack: u.lastDamagedAt !== undefined && time - u.lastDamagedAt < 1.2,
    isDestroyed: u.isDestroyed,
    isPlayerControllable: u.isPlayerControllable,
  };
}

function formatOrder(u: Unit): string {
  if (u.isDestroyed) return 'Destroyed';
  if (u.targetId && u.currentOrder.kind === 'move') return 'Attack-moving';
  if (u.targetId) return 'Engaging';
  if (u.currentOrder.kind === 'move') return 'Moving';
  if (u.currentOrder.kind === 'patrol') return 'Patrol';
  if (u.currentOrder.kind === 'hold') return 'Idle';
  return 'Idle';
}

export type GameModeAlias = GameMode;
