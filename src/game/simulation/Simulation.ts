import { MAX_FRAME_DT, SIM_DT } from '../constants';
import { createOperationCrossroads } from '../missions/operationCrossroads';
import type { Order, Projectile, SimulationState, Unit, Vec3 } from '../types';
import { CoverProvider, EnemyCommanderAI, EnemySquadGOAPBrain, type SquadDebugSnapshot } from './ai';
import { updateAI } from './systems/AISystem';
import { buildBuildingStateMap } from './systems/BuildingSystem';
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
  /** Enemy commander / squad GOAP layer. Friendly AI is unchanged. */
  enemyCommander: EnemyCommanderAI;
  private cover = new CoverProvider();
  private accumulator = 0;
  private freshProjectiles: Projectile[] = [];
  private damageEvents: DamageEvent[] = [];

  constructor(callbacks: SimulationCallbacks) {
    this.callbacks = callbacks;
    this.enemyCommander = new EnemyCommanderAI();
    this.state = this.buildInitialState();
    this.buildEnemyTactics();
  }

  reset() {
    this.enemyCommander.detachAll(this.state);
    this.enemyCommander.unregisterAll();
    this.state = this.buildInitialState();
    this.accumulator = 0;
    this.buildEnemyTactics();
  }

  /**
   * Returns the latest debug snapshot for each enemy squad. Used by the
   * EnemyTacticsDebug overlay and by the scenario tests.
   */
  getEnemyDebugSnapshots(): SquadDebugSnapshot[] {
    const out: SquadDebugSnapshot[] = [];
    for (const squad of this.enemyCommander.getSquads()) {
      const snap = squad.getDebugSnapshot();
      if (snap) out.push(snap);
    }
    return out;
  }

  private buildEnemyTactics() {
    this.cover.buildFromMission(this.state);
    const supplyPoint: Vec3 = { x: 0, y: 0, z: -90 };

    // Split enemy units into 4 zone-based squads so the CommanderAI can
    // coordinate zone defence, reinforcements, and fallback independently.
    //   Alpha — northern heavy defence (tanks + mortars + northern infantry)
    //   Bravo — central crossroads patrol
    //   Charlie — eastern flank
    //   Delta — southern approach
    type SquadDef = { id: string; ids: string[]; fallback: Vec3; morale: number; ammo: number };
    const squads: SquadDef[] = [
      {
        id: 'squad-alpha',
        ids: ['E_heavy', 'E_mortar1', 'E_mortar2', 'E_infNorth', 'E_atNorth'],
        fallback: { x: 0, y: 0, z: -58 },
        morale: 90,
        ammo: 90,
      },
      {
        id: 'squad-bravo',
        ids: ['E_lightTank', 'E_bunkerN', 'E_infWest'],
        fallback: { x: 0, y: 0, z: -18 },
        morale: 85,
        ammo: 70,
      },
      {
        id: 'squad-charlie',
        ids: ['E_lightTankEast', 'E_atWest', 'E_infEast'],
        fallback: { x: 18, y: 0, z: -14 },
        morale: 85,
        ammo: 70,
      },
      {
        id: 'squad-delta',
        ids: ['E_atSouth', 'E_infSouth', 'E_bunkerS'],
        fallback: { x: 0, y: 0, z: 28 },
        morale: 80,
        ammo: 65,
      },
    ];

    for (const def of squads) {
      // Only include units that actually exist in the state map.
      const unitIds = def.ids.filter((id) => this.state.units.has(id));
      if (!unitIds.length) continue;
      const brain = new EnemySquadGOAPBrain(
        {
          squadId: def.id,
          unitIds,
          objectiveId: this.state.objective.id,
          fallbackPoint: def.fallback,
          supplyPoint,
          ammoMax: def.ammo,
          startingMorale: def.morale,
        },
        this.cover,
      );
      this.enemyCommander.registerSquad(brain);
    }
    this.enemyCommander.attachAll(this.state);
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
      buildings: buildBuildingStateMap(mission),
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

    // Enemy squad GOAP runs first; it writes unit.targetId / unit.currentOrder
    // for managed enemies before the per-unit AI loop runs. The friendly AI
    // path is unchanged because the old AISystem skips units flagged
    // aiManagedExternally.
    this.enemyCommander.update(this.state, dt);
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
    // Player-facing move line comes from TacticalInputController to avoid log spam
    // when several units receive formation orders at once.
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
    return true;
  }

  /**
   * Player "Stop / Hold position" command. Cancels active move orders and clears
   * any auto-acquired target so the unit holds at its current position. Combat
   * AI may still re-engage if a fresh threat appears in detection range — this
   * is intentional so a held unit still defends itself.
   */
  issueHoldOrder(unitId: string): boolean {
    const u = this.state.units.get(unitId);
    if (!u || u.isDestroyed || !u.isPlayerControllable) return false;
    u.targetId = null;
    u.currentOrder = { kind: 'hold', destination: { x: u.position.x, y: 0, z: u.position.z } };
    u.lastOrderDestination = { x: u.position.x, y: 0, z: u.position.z };
    u.currentSpeed = 0;
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
