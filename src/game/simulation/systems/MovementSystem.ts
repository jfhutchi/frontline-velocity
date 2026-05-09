import { ARRIVE_RADIUS, MAP_HALF, TURN_RATE } from '../../constants';
import { isStationary } from '../../entities/VehicleUnit';
import type { SimulationState, Unit } from '../../types';
import { angleFromXZ, angleLerp, clamp, shortestAngleDelta, v3 } from '../math';

/** Move units along their currently issued orders. Direct-control units are excluded. */
export function updateMovement(state: SimulationState, dt: number, controlledUnitId: string | null) {
  for (const unit of state.units.values()) {
    if (unit.isDestroyed) continue;
    if (unit.id === controlledUnitId) continue;
    if (isStationary(unit)) continue;

    const order = unit.currentOrder;
    let target = order.destination;

    if (order.kind === 'patrol' && order.patrolFrom && order.patrolTo) {
      // Switch waypoints when reached.
      const dest = order.destination ?? order.patrolTo;
      const distToDest = v3.distanceXZ(unit.position, dest);
      if (distToDest <= ARRIVE_RADIUS + 0.5) {
        const at = order.destination;
        const next = at && at.x === order.patrolTo.x && at.z === order.patrolTo.z ? order.patrolFrom : order.patrolTo;
        order.destination = { ...next };
      }
      target = order.destination;
    }

    if (order.kind === 'attack' && order.targetUnitId) {
      const tgt = state.units.get(order.targetUnitId);
      if (tgt && !tgt.isDestroyed) {
        const dist = v3.distanceXZ(unit.position, tgt.position);
        const desiredEngage = unit.weapon.range * 0.85;
        if (dist > desiredEngage) {
          target = tgt.position;
        } else {
          target = undefined; // close enough; stop and shoot.
        }
      } else {
        unit.currentOrder = { kind: 'idle' };
        target = undefined;
      }
    }

    if (!target) {
      // Face target if we have one but don't move.
      if (unit.targetId) {
        const tgt = state.units.get(unit.targetId);
        if (tgt && !tgt.isDestroyed) {
          const desired = angleFromXZ(tgt.position.x - unit.position.x, tgt.position.z - unit.position.z);
          unit.rotation = angleLerp(unit.rotation, desired, TURN_RATE * dt);
        }
      }
      continue;
    }

    const dx = target.x - unit.position.x;
    const dz = target.z - unit.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= ARRIVE_RADIUS) {
      if (order.kind === 'move') unit.currentOrder = { kind: 'idle' };
      continue;
    }

    const desiredAngle = angleFromXZ(dx, dz);
    unit.rotation = angleLerp(unit.rotation, desiredAngle, TURN_RATE * dt);

    // Forward speed scales with how aligned we are with the target direction.
    const angleDelta = Math.abs(shortestAngleDelta(unit.rotation, desiredAngle));
    const alignment = clamp(1 - angleDelta / Math.PI, 0.1, 1);
    const step = unit.speed * alignment * dt;

    const sin = Math.sin(unit.rotation);
    const cos = Math.cos(unit.rotation);
    const moveX = sin * step;
    const moveZ = cos * step;

    unit.position.x = clamp(unit.position.x + moveX, -MAP_HALF + 2, MAP_HALF - 2);
    unit.position.z = clamp(unit.position.z + moveZ, -MAP_HALF + 2, MAP_HALF - 2);

    avoidUnits(unit, state.units);
  }
}

/** Naive collision avoidance: push out of overlap with other units. */
function avoidUnits(unit: Unit, units: Map<string, Unit>) {
  for (const other of units.values()) {
    if (other.id === unit.id) continue;
    if (other.isDestroyed) continue;
    const dx = unit.position.x - other.position.x;
    const dz = unit.position.z - other.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = unit.radius + other.radius;
    if (dist > 0 && dist < minDist) {
      const push = (minDist - dist) / dist;
      // Push *unit* away. Other unit pushed when its turn comes.
      unit.position.x += dx * push * 0.5;
      unit.position.z += dz * push * 0.5;
    }
  }
}
