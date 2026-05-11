import { planPath } from '../systems/PathfindingSystem';
import type { Order, SimulationState, Unit, Vec3 } from '../../types';
import type { UnitCommand } from './goapTypes';
import { v3 } from '../math';

export type UnitFSMState =
  | 'Idle'
  | 'Moving'
  | 'TakingCover'
  | 'Aiming'
  | 'Firing'
  | 'Reloading'
  | 'Suppressed'
  | 'Retreating'
  | 'Dead';

const SUPPRESSED_RECENT_HIT_SECONDS = 1.2;
const FIRING_RECENT_FIRE_SECONDS = 0.25;
const COMMAND_REISSUE_RADIUS = 1.5;

/**
 * Per-unit finite state machine. Translates the squad brain's high-level
 * commands into the same low-level unit fields the existing
 * MovementSystem / CombatSystem already consume (`currentOrder`,
 * `targetId`), so the simulation's downstream code is unchanged.
 *
 * The FSM state itself is mostly diagnostic — it tells the debug overlay and
 * any future animation layer what the unit is doing right now. The exception
 * is `Suppressed`, which is set when the unit has taken damage very recently
 * regardless of its issued command.
 */
export class EnemyUnitController {
  readonly unitId: string;
  state: UnitFSMState = 'Idle';
  private lastCommandKind: UnitCommand['kind'] | null = null;
  private lastCommandDestination: Vec3 | null = null;
  private lastCommandTargetId: string | null = null;

  constructor(unitId: string) {
    this.unitId = unitId;
  }

  /**
   * Apply the latest squad command for this unit. Called every squad tick;
   * idempotent — if the command hasn't changed since the last call we don't
   * re-plan the unit's path.
   */
  tick(sim: SimulationState, command: UnitCommand | undefined) {
    const unit = sim.units.get(this.unitId);
    if (!unit) return;
    if (unit.isDestroyed) {
      this.state = 'Dead';
      unit.aiState = 'destroyed';
      unit.targetId = null;
      return;
    }
    if (!command) {
      this.applyHold(unit);
      this.state = 'Idle';
      return;
    }

    switch (command.kind) {
      case 'idle':
        this.applyHold(unit);
        break;
      case 'hold':
        this.applyHold(unit, command.position);
        break;
      case 'moveTo':
        this.applyMove(sim, unit, command.destination, false);
        break;
      case 'takeCover':
        this.applyMove(sim, unit, command.destination, false);
        break;
      case 'attack':
        this.applyAttack(sim, unit, command.targetId, command.allowAdvance);
        break;
      case 'suppress':
        this.applyAttack(sim, unit, command.targetId, false);
        break;
      case 'retreat':
        this.applyMove(sim, unit, command.destination, true);
        break;
      case 'regroup':
        this.applyMove(sim, unit, command.destination, false);
        break;
    }

    this.state = this.deriveState(sim, unit, command);
    unit.aiState = this.mapToSimAiState(this.state);
  }

  /** Called by the squad brain when this unit is dropped from the squad. */
  releaseUnit(sim: SimulationState) {
    const unit = sim.units.get(this.unitId);
    if (!unit) return;
    unit.aiManagedExternally = false;
  }

  // -------- low-level transitions --------------------------------------------

  private applyHold(unit: Unit, position?: Vec3) {
    const order: Order = { kind: 'hold', destination: position ?? unit.position };
    unit.currentOrder = order;
    unit.targetId = null;
    this.lastCommandKind = 'hold';
    this.lastCommandDestination = position ?? null;
    this.lastCommandTargetId = null;
  }

  private applyMove(sim: SimulationState, unit: Unit, destination: Vec3, isRetreat: boolean) {
    // Only re-plan a path if the destination meaningfully changed.
    const sameDest =
      this.lastCommandDestination &&
      v3.distanceXZ(this.lastCommandDestination, destination) < COMMAND_REISSUE_RADIUS &&
      (unit.currentOrder.kind === 'move' || unit.currentOrder.kind === 'hold');
    if (!sameDest) {
      const path = planPath(sim, unit.position, destination, unit.radius);
      unit.currentOrder = {
        kind: 'move',
        destination: { ...destination, y: 0 },
        path,
        pathIndex: 0,
      };
      unit.lastOrderDestination = { ...destination, y: 0 };
    }
    unit.targetId = null;
    this.lastCommandKind = isRetreat ? 'retreat' : 'moveTo';
    this.lastCommandDestination = { ...destination };
    this.lastCommandTargetId = null;
  }

  private applyAttack(sim: SimulationState, unit: Unit, targetId: string, allowAdvance: boolean) {
    const target = sim.units.get(targetId);
    if (!target || target.isDestroyed || target.faction === unit.faction) {
      this.applyHold(unit);
      return;
    }
    const sameTarget = this.lastCommandTargetId === targetId;
    const distance = v3.distanceXZ(unit.position, target.position);
    const inRange = distance <= unit.weapon.range * 0.85;
    if (allowAdvance && !inRange && unit.speed > 0) {
      if (!sameTarget || unit.currentOrder.kind !== 'attack') {
        const path = planPath(sim, unit.position, target.position, unit.radius);
        unit.currentOrder = {
          kind: 'attack',
          targetUnitId: targetId,
          destination: { ...target.position },
          path,
          pathIndex: 0,
        };
        unit.lastOrderDestination = { ...target.position };
      }
    } else {
      unit.currentOrder = { kind: 'attack', targetUnitId: targetId };
    }
    unit.targetId = targetId;
    unit.targetLockedUntil = sim.time + 4;
    this.lastCommandKind = 'attack';
    this.lastCommandTargetId = targetId;
    this.lastCommandDestination = null;
  }

  private deriveState(sim: SimulationState, unit: Unit, command: UnitCommand): UnitFSMState {
    // Heavy recent damage outranks the command kind for diagnostic purposes.
    if (
      unit.lastDamagedAt !== undefined &&
      sim.time - unit.lastDamagedAt < SUPPRESSED_RECENT_HIT_SECONDS &&
      command.kind !== 'retreat'
    ) {
      return 'Suppressed';
    }
    switch (command.kind) {
      case 'idle':
      case 'hold':
        return 'Idle';
      case 'moveTo':
      case 'regroup':
        return 'Moving';
      case 'takeCover':
        return 'TakingCover';
      case 'retreat':
        return 'Retreating';
      case 'attack':
      case 'suppress': {
        const sinceFire = sim.time - unit.weapon.lastFiredAt;
        if (sinceFire < FIRING_RECENT_FIRE_SECONDS) return 'Firing';
        if (sinceFire < unit.weapon.reloadSeconds) return 'Reloading';
        return 'Aiming';
      }
    }
  }

  private mapToSimAiState(state: UnitFSMState): Unit['aiState'] {
    switch (state) {
      case 'Idle':
        return 'idle';
      case 'Moving':
      case 'TakingCover':
      case 'Retreating':
        return 'reposition';
      case 'Aiming':
      case 'Firing':
      case 'Reloading':
        return 'engage';
      case 'Suppressed':
        return 'alert';
      case 'Dead':
        return 'destroyed';
    }
  }
}
