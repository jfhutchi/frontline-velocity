import {
  ARRIVE_RADIUS,
  MAP_HALF,
  MOVE_ACCELERATION,
  TURN_RATE,
  UNIT_SEPARATION_STRENGTH,
} from '../../constants';
import { isStationary } from '../../entities/VehicleUnit';
import type { Order, SimulationState, Unit, Vec3 } from '../../types';
import { angleFromXZ, angleLerp, clamp, shortestAngleDelta, v3 } from '../math';
import { resolveUnitAgainstObstacles, steerTargetAroundObstacles } from './PathfindingSystem';

/** Move units along orders. Direct-control units are excluded. */
export function updateMovement(state: SimulationState, dt: number, controlledUnitId: string | null) {
  for (const unit of state.units.values()) {
    if (unit.isDestroyed) {
      unit.currentSpeed = 0;
      continue;
    }
    if (unit.id === controlledUnitId) continue;
    if (isStationary(unit)) {
      faceTarget(unit, state, dt);
      continue;
    }

    const target = resolveMovementTarget(state, unit);
    if (!target) {
      unit.currentSpeed = approach(unit.currentSpeed, 0, MOVE_ACCELERATION * dt);
      faceTarget(unit, state, dt);
      continue;
    }

    const adjustedTarget = steerTargetAroundObstacles(state, unit.position, target, unit.radius);
    const dx = adjustedTarget.x - unit.position.x;
    const dz = adjustedTarget.z - unit.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= ARRIVE_RADIUS) {
      advanceOrderWaypoint(unit);
      unit.currentSpeed = approach(unit.currentSpeed, 0, MOVE_ACCELERATION * dt);
      continue;
    }

    const desiredAngle = angleFromXZ(dx, dz);
    unit.rotation = angleLerp(unit.rotation, desiredAngle, TURN_RATE * dt);

    const angleDelta = Math.abs(shortestAngleDelta(unit.rotation, desiredAngle));
    const alignment = clamp(1 - angleDelta / Math.PI, 0.14, 1);
    const targetSpeed = unit.speed * alignment * combatMoveScalar(unit, state);
    unit.currentSpeed = approach(unit.currentSpeed, targetSpeed, MOVE_ACCELERATION * dt);

    const separation = separationVector(unit, state.units);
    const sin = Math.sin(unit.rotation);
    const cos = Math.cos(unit.rotation);
    unit.position.x += (sin * unit.currentSpeed + separation.x) * dt;
    unit.position.z += (cos * unit.currentSpeed + separation.z) * dt;

    unit.position.x = clamp(unit.position.x, -MAP_HALF + unit.radius, MAP_HALF - unit.radius);
    unit.position.z = clamp(unit.position.z, -MAP_HALF + unit.radius, MAP_HALF - unit.radius);
    resolveUnitAgainstObstacles(unit, state);
  }
}

function resolveMovementTarget(state: SimulationState, unit: Unit): Vec3 | undefined {
  const order = unit.currentOrder;

  if (order.kind === 'patrol' && order.patrolFrom && order.patrolTo) {
    const dest = order.destination ?? order.patrolTo;
    if (v3.distanceXZ(unit.position, dest) <= ARRIVE_RADIUS + 0.5) {
      const next =
        order.destination && order.destination.x === order.patrolTo.x && order.destination.z === order.patrolTo.z
          ? order.patrolFrom
          : order.patrolTo;
      order.destination = { ...next };
      order.path = undefined;
      order.pathIndex = 0;
    }
    return order.destination;
  }

  if (order.kind === 'move' || order.kind === 'hold') {
    return currentPathTarget(order);
  }

  if (order.kind === 'attack' && order.targetUnitId) {
    const target = state.units.get(order.targetUnitId);
    if (!target || target.isDestroyed) {
      unit.currentOrder = { kind: 'hold', destination: unit.lastOrderDestination };
      unit.targetId = null;
      return currentPathTarget(unit.currentOrder);
    }
    const distance = v3.distanceXZ(unit.position, target.position);
    if (distance > unit.weapon.range * 0.82 && unit.type !== 'infantry') {
      return currentPathTarget(order) ?? target.position;
    }
    return undefined;
  }

  return undefined;
}

function currentPathTarget(order: Order): Vec3 | undefined {
  if (order.path && order.path.length) {
    const index = clamp(order.pathIndex ?? 0, 0, order.path.length - 1);
    return order.path[index];
  }
  return order.destination;
}

function advanceOrderWaypoint(unit: Unit) {
  const order = unit.currentOrder;
  if (order.path && order.path.length) {
    const next = (order.pathIndex ?? 0) + 1;
    if (next < order.path.length) {
      order.pathIndex = next;
      return;
    }
  }

  if (order.kind === 'move') {
    unit.currentOrder = { kind: 'hold', destination: unit.lastOrderDestination ?? order.destination };
    unit.aiState = 'idle';
  }
}

function faceTarget(unit: Unit, state: SimulationState, dt: number) {
  if (!unit.targetId) return;
  const target = state.units.get(unit.targetId);
  if (!target || target.isDestroyed) return;
  const desired = angleFromXZ(target.position.x - unit.position.x, target.position.z - unit.position.z);
  unit.rotation = angleLerp(unit.rotation, desired, TURN_RATE * 0.8 * dt);
}

function combatMoveScalar(unit: Unit, state: SimulationState): number {
  if (!unit.targetId) return 1;
  const target = state.units.get(unit.targetId);
  if (!target || target.isDestroyed) return 1;
  const distance = v3.distanceXZ(unit.position, target.position);
  if (distance > unit.weapon.range) return 1;
  if (unit.type === 'infantry') return 0.2;
  if (unit.type === 'reconJeep') return target.type === 'antiTankGun' ? 0.35 : 0.75;
  return 0.58;
}

function separationVector(unit: Unit, units: Map<string, Unit>): { x: number; z: number } {
  let sx = 0;
  let sz = 0;
  for (const other of units.values()) {
    if (other.id === unit.id || other.isDestroyed) continue;
    const dx = unit.position.x - other.position.x;
    const dz = unit.position.z - other.position.z;
    const dist = Math.hypot(dx, dz);
    const desired = unit.radius + other.radius + 0.75;
    if (dist <= 0 || dist >= desired) continue;
    const force = ((desired - dist) / desired) * UNIT_SEPARATION_STRENGTH * unit.speed;
    sx += (dx / dist) * force;
    sz += (dz / dist) * force;
  }
  return { x: sx, z: sz };
}

function approach(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
