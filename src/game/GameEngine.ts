import { AudioManager } from './audio/AudioManager';
import { DC_FORWARD_ACCEL, DC_MAX_FORWARD_SPEED, DC_MAX_REVERSE_SPEED, DC_REVERSE_ACCEL, DC_TURN_RATE, MAP_HALF, SPEED_LEVELS, VEHICLE_FRICTION } from './constants';
import { DirectControlInput } from './input/DirectControlInput';
import { TacticalInput } from './input/TacticalInput';
import { CameraController } from './rendering/CameraController';
import { createBabylonContext, disposeBabylonContext, type BabylonContext } from './rendering/BabylonScene';
import { EffectsRenderer } from './rendering/EffectsRenderer';
import { TerrainRenderer } from './rendering/TerrainRenderer';
import { UnitRenderer } from './rendering/UnitRenderer';
import { Simulation } from './simulation/Simulation';
import { useGameStore, type UnitSummary } from './state/gameStore';
import type { GameMode, Unit } from './types';

export class GameEngine {
  private ctx: BabylonContext;
  private terrainRenderer: TerrainRenderer;
  private unitRenderer: UnitRenderer;
  private effectsRenderer: EffectsRenderer;
  private cameraController: CameraController;
  private simulation: Simulation;
  private tacticalInput: TacticalInput;
  private directInput: DirectControlInput;
  private canvas: HTMLCanvasElement;

  private lastFrameTime = 0;
  private resultEmitted = false;
  private summaryAccumulator = 0;
  private prevControlledUnitId: string | null = null;
  private vehicleVelocity = 0;
  private projectileSoundCooldown = 0;
  private lastEffectCount = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = createBabylonContext(canvas);
    this.simulation = new Simulation({
      onPlayerHit: () => useGameStore.getState().flashDamage(),
    });
    this.terrainRenderer = new TerrainRenderer(this.ctx.scene);
    this.unitRenderer = new UnitRenderer(this.ctx.scene);
    this.effectsRenderer = new EffectsRenderer(this.ctx.scene);
    this.cameraController = new CameraController(this.ctx.scene, this.ctx.camera, canvas);
    this.tacticalInput = new TacticalInput(this.ctx.scene, this.ctx.camera, canvas, this.simulation.state, {
      onSelectUnit: (id) => {
        useGameStore.getState().setSelectedUnitId(id);
        if (id) AudioManager.play('click');
      },
      onIssueMoveOrder: (id, dest) => {
        this.simulation.issueMoveOrder(id, dest);
        AudioManager.play('click');
      },
      getSelectedUnitId: () => useGameStore.getState().selectedUnitId,
    });
    this.directInput = new DirectControlInput();

    this.terrainRenderer.build(this.simulation.state.mission);
    this.tacticalInput.attach();

    this.ctx.engine.runRenderLoop(this.frame);
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.ctx.engine.resize());
      this.resizeObserver.observe(canvas);
    }
    // Frame the camera over the friendly starting area.
    this.cameraController.centerOn(-45, 70);

    this.publishSummaries(true);
  }

  dispose() {
    this.tacticalInput.detach();
    this.directInput.detach();
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.unitRenderer.dispose();
    this.effectsRenderer.dispose();
    this.terrainRenderer.dispose();
    disposeBabylonContext(this.ctx);
  }

  resetMission() {
    this.simulation.reset();
    this.tacticalInput.setSimulationState(this.simulation.state);
    this.terrainRenderer.build(this.simulation.state.mission);
    this.unitRenderer.dispose();
    this.effectsRenderer.dispose();
    this.unitRenderer = new UnitRenderer(this.ctx.scene);
    this.effectsRenderer = new EffectsRenderer(this.ctx.scene);
    this.resultEmitted = false;
    this.cameraController.activate('tactical');
    this.cameraController.centerOn(-45, 70);
    this.publishSummaries(true);
  }

  private handleResize = () => {
    this.ctx.engine.resize();
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
          this.cameraController.trackChase(unit);
        }
      }
    }

    // Push summaries to UI ~10x/sec.
    this.summaryAccumulator += rawDt;
    if (this.summaryAccumulator >= 0.1) {
      this.summaryAccumulator = 0;
      this.publishSummaries(false);
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
    if (input.forward > 0) {
      this.vehicleVelocity = Math.min(
        DC_MAX_FORWARD_SPEED,
        this.vehicleVelocity + DC_FORWARD_ACCEL * input.forward * dt,
      );
    } else if (input.forward < 0) {
      this.vehicleVelocity = Math.max(
        -DC_MAX_REVERSE_SPEED,
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

    // Turret aim: face camera direction. We use the chase camera's yaw.
    // Simpler: just keep turret aligned with hull (turret = 0 in hull-local)
    // but allow slight mouse-driven offset later. For v0.0.1, keep aligned.
    unit.turretRotation = unit.turretRotation * 0.95; // slowly recenter

    if (input.fire) {
      const fired = this.simulation.fireFromControlled(controlledId);
      if (fired) AudioManager.play('fire');
    }
  }

  private syncRenderers() {
    const state = this.simulation.state;
    const store = useGameStore.getState();

    const activeIds = new Set<string>();
    for (const u of state.units.values()) {
      activeIds.add(u.id);
      const isSelected = store.selectedUnitId === u.id;
      const isControlled = store.controlledUnitId === u.id;
      this.unitRenderer.update(u, isSelected, isControlled);
    }
    this.unitRenderer.removeMissing(activeIds);

    this.effectsRenderer.update(state);
    this.terrainRenderer.updateObjective(state.objective);
  }

  private publishSummaries(force: boolean) {
    const state = this.simulation.state;
    const summaries: UnitSummary[] = [];
    for (const u of state.units.values()) {
      summaries.push(toSummary(u, state.time));
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
          if (a.id !== b.id || a.health !== b.health || a.isDestroyed !== b.isDestroyed || Math.abs(a.reloadProgress - b.reloadProgress) > 0.05 || a.orderKind !== b.orderKind) {
            same = false;
            break;
          }
        }
        if (same) {
          // Still update objective, but don't replace summaries.
          store.setObjective({ ...state.objective });
          return;
        }
      }
    }
    store.setUnitSummaries(summaries);
    store.setObjective({ ...state.objective });
  }

  jumpIntoSelected() {
    const store = useGameStore.getState();
    const id = store.selectedUnitId;
    if (!id) return;
    const u = this.simulation.state.units.get(id);
    if (!u || u.isDestroyed || !u.isPlayerControllable) return;
    if (u.type !== 'mediumTank' && u.type !== 'reconJeep') return;
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

  /** Used by HUD buttons. */
  centerCameraOnSelected() {
    const id = useGameStore.getState().selectedUnitId;
    if (!id) return;
    const u = this.simulation.state.units.get(id);
    if (!u) return;
    this.cameraController.centerOn(u.position.x, u.position.z);
  }

  /** Returns simulation reference for higher-level use cases. */
  getSimulation() {
    return this.simulation;
  }
}

function toSummary(u: Unit, time: number): UnitSummary {
  const sinceFire = time - u.weapon.lastFiredAt;
  const reloadProgress = Math.max(0, Math.min(1, sinceFire / u.weapon.reloadSeconds));
  return {
    id: u.id,
    name: u.name,
    type: u.type,
    faction: u.faction,
    health: Math.max(0, Math.round(u.health)),
    maxHealth: u.maxHealth,
    armor: u.armor,
    speed: u.speed,
    weaponName: u.weapon.name,
    weaponRange: u.weapon.range,
    reloadSeconds: u.weapon.reloadSeconds,
    reloadProgress,
    orderKind: u.currentOrder.kind,
    isDestroyed: u.isDestroyed,
    isPlayerControllable: u.isPlayerControllable && (u.type === 'mediumTank' || u.type === 'reconJeep'),
  };
}

export type GameModeAlias = GameMode;
