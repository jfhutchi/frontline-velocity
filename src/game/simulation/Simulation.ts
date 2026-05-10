import { MAX_FRAME_DT, SIM_DT } from '../constants';
import { createOperationCrossroads } from '../missions/operationCrossroads';
import type { Order, Projectile, SimulationState, Unit, Vec3 } from '../types';
import { updateAI } from './systems/AISystem';
import { updateCombat } from './systems/CombatSystem';
import { applyDamage } from './systems/DamageSystem';
import { updateMovement } from './systems/MovementSystem';
import { updateObjective } from './systems/ObjectiveSystem';
import { updateProjectiles, type DamageEvent } from './systems/ProjectileSystem';
import { pushBattlefieldEvent, resetBattlefieldEventMemory } from './systems/EventLogSystem';
import { planPath } from './systems/PathfindingSystem';

export type SimulationCallbacks = {
  onPlayerHit: () => void;
};

/**
 * Runs the gameplay simulation independently from the renderer. Uses a
 * fixed semi-fixed timestep with a delta accumulator and clamps oversized
 * frame deltas to avoid blow-ups after tab switches.
 */
export class Simulation {
  state: SimulationState;
  callbacks: SimulationCallbacks;
  private accumulator = 0;
  private freshProjectiles: Projectile[] = [];
  private damageEvents: DamageEvent[] = [];

  constructor(callbacks: SimulationCallbacks) {
    this.callbacks = callbacks;
    this.state = this.buildInitialState();
  }

  reset() {
    this.state = this.buildInitialState();
    this.accumulator = 0;
  }

  private buildInitialState(): SimulationState {
    resetBattlefieldEventMemory();
    const mission = createOperationCrossroads();
    const units = new Map<string, Unit>();
    for (const u of mission.units) units.set(u.id, u);
    const state: SimulationState = {
      time: 0,
      units,
      projectiles: [],
      effects: [],
      eventLog: [],
      objective: mission.objective,
      mission,
      result: null,
    };
    pushBattlefieldEvent(state, 'mission_start', 'Operation Crossroads begun', 999);
    return state;
  }

  /**
   * Advance the simulation by dtSeconds of wall-clock time, scaled by speed.
   * Skips work if speed is 0 (paused).
   */
  update(rawDt: number, speedMultiplier: number, controlledUnitId: string | null) {
    if (this.state.result) return;
    if (speedMultiplier <= 0) return;

    const dt = Math.min(rawDt, MAX_FRAME_DT) * speedMultiplier;
    this.accumulator += dt;

    let safety = 8; // up to 8 fixed steps per render frame
    while (this.accumulator >= SIM_DT && safety > 0) {
      this.step(SIM_DT, controlledUnitId);
      this.accumulator -= SIM_DT;
      safety -= 1;
    }
    // If we still have leftover time, run a partial step so motion stays smooth.
    if (this.accumulator > 0 && safety > 0) {
      this.step(this.accumulator, controlledUnitId);
      this.accumulator = 0;
    }

    // Clean up old visual effects.
    const t = this.state.time;
    this.state.effects = this.state.effects.filter((e) => t - e.spawnedAt < e.duration);
  }

  private step(dt: number, controlledUnitId: string | null) {
    this.state.time += dt;

    updateAI(this.state, controlledUnitId);
    updateMovement(this.state, dt, controlledUnitId);

    this.freshProjectiles.length = 0;
    updateCombat(this.state, dt, controlledUnitId, this.freshProjectiles);
    if (this.freshProjectiles.length) {
      for (const p of this.freshProjectiles) this.state.projectiles.push(p);
    }

    this.damageEvents.length = 0;
    updateProjectiles(this.state, dt, this.damageEvents);
    if (this.damageEvents.length) {
      applyDamage(this.state, this.damageEvents, this.callbacks.onPlayerHit, controlledUnitId);
    }

    updateObjective(this.state, dt);
  }

  // ----- player command surface used by tactical input -----
  issueMoveOrder(unitId: string, destination: Vec3) {
    const u = this.state.units.get(unitId);
    if (!u || u.isDestroyed || !u.isPlayerControllable) return;
    const path = planPath(this.state, u.position, destination, u.radius);
    const order: Order = {
      kind: 'move',
      destination: { ...destination, y: 0 },
      path,
      pathIndex: 0,
    };
    u.currentOrder = order;
    u.lastOrderDestination = { ...destination, y: 0 };
    // Drop any existing attack-target so the new move/attack-move overrides it.
    u.targetId = null;
    pushBattlefieldEvent(this.state, `move_${u.id}`, `${u.name} moving`, 1.2);
  }

  /**
   * Player-issued attack order. The selected unit prioritizes the chosen target
   * and moves into range if necessary. Returns true if the order was accepted.
   */
  issueAttackOrder(unitId: string, targetId: string): boolean {
    const u = this.state.units.get(unitId);
    const target = this.state.units.get(targetId);
    if (!u || u.isDestroyed || !u.isPlayerControllable) return false;
    if (!target || target.isDestroyed || target.faction === u.faction) return false;
    u.targetId = targetId;
    u.targetLockedUntil = this.state.time + 6;
    if (u.speed === 0) {
      u.currentOrder = { kind: 'attack', targetUnitId: targetId };
    } else {
      const path = planPath(this.state, u.position, target.position, u.radius);
      u.currentOrder = {
        kind: 'attack',
        targetUnitId: targetId,
        destination: { ...target.position },
        path,
        pathIndex: 0,
      };
      u.lastOrderDestination = { ...target.position };
    }
    pushBattlefieldEvent(this.state, `pAttack_${u.id}`, `${u.name} attacking ${target.name}`, 1.5);
    return true;
  }

  /** Direct-control: spawn a projectile from the controlled unit immediately. */
  fireFromControlled(unitId: string): boolean {
    const u = this.state.units.get(unitId);
    if (!u || u.isDestroyed) return false;
    if (this.state.time - u.weapon.lastFiredAt < u.weapon.reloadSeconds) return false;
    const aimedAngle = u.rotation + u.turretRotation;
    const sin = Math.sin(aimedAngle);
    const cos = Math.cos(aimedAngle);
    const muzzle = {
      x: u.position.x + sin * (u.radius + 0.6),
      y: 1.6,
      z: u.position.z + cos * (u.radius + 0.6),
    };
    const speed = u.weapon.projectileSpeed;
    this.state.projectiles.push({
      id: `P_dc_${this.state.time.toFixed(3)}_${u.id}`,
      ownerId: u.id,
      faction: u.faction,
      position: muzzle,
      velocity: { x: sin * speed, y: 0, z: cos * speed },
      damage: u.weapon.damage,
      splashRadius: u.weapon.splashRadius,
      remainingTime: 4,
      spawnedAt: this.state.time,
    });
    u.weapon.lastFiredAt = this.state.time;
    this.state.effects.push({
      id: `mfx_dc_${u.id}_${this.state.time.toFixed(2)}`,
      kind: 'muzzleFlash',
      position: muzzle,
      spawnedAt: this.state.time,
      duration: 0.08,
    });
    this.state.effects.push({
      id: `smoke_dc_${u.id}_${this.state.time.toFixed(2)}`,
      kind: 'smoke',
      position: { ...muzzle },
      spawnedAt: this.state.time,
      duration: 0.45,
      scale: 0.55,
    });
    return true;
  }

  setControlledUnitOrderToHold(unitId: string | null) {
    if (!unitId) return;
    const u = this.state.units.get(unitId);
    if (!u || u.isDestroyed) return;
    // Restore an idle order so it returns to AI assist behavior after the
    // player jumps back out.
    u.currentOrder = { kind: 'hold', destination: u.lastOrderDestination };
  }
}
