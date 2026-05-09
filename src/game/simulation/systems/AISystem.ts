import { SIGHT_RANGE_BONUS } from '../../constants';
import type { SimulationState, Unit } from '../../types';
import { v3 } from '../math';

/**
 * Each unit picks the nearest visible hostile target. Friendly units controlled
 * directly by the player still get a target chosen for HUD display, but they
 * will not move (Movement system skips controlled unit) and the player drives
 * their firing.
 */
export function updateAI(state: SimulationState) {
  for (const unit of state.units.values()) {
    if (unit.isDestroyed) continue;

    // Validate existing target.
    if (unit.targetId) {
      const t = state.units.get(unit.targetId);
      if (!t || t.isDestroyed) {
        unit.targetId = null;
        if (unit.currentOrder.kind === 'attack') {
          unit.currentOrder = unit.faction === 'enemy' ? { kind: 'hold' } : { kind: 'idle' };
        }
      }
    }

    // Pick nearest hostile within slightly extended sight range.
    const sightRange = unit.weapon.range + SIGHT_RANGE_BONUS;
    let bestId: string | null = unit.targetId;
    let bestDist = Number.POSITIVE_INFINITY;
    if (bestId) {
      const cur = state.units.get(bestId);
      if (cur && !cur.isDestroyed) {
        bestDist = v3.distanceXZ(unit.position, cur.position);
        if (bestDist > sightRange * 1.2) {
          bestId = null;
          bestDist = Number.POSITIVE_INFINITY;
        }
      } else {
        bestId = null;
      }
    }

    for (const other of state.units.values()) {
      if (other.faction === unit.faction) continue;
      if (other.isDestroyed) continue;
      const d = v3.distanceXZ(unit.position, other.position);
      if (d < bestDist && d <= sightRange) {
        bestDist = d;
        bestId = other.id;
      }
    }

    unit.targetId = bestId;

    // Enemy AI behavior. Friendly AI is opportunistic only (doesn't override
    // player move orders) but enemy AI will engage actively.
    if (unit.faction === 'enemy' && bestId) {
      const target = state.units.get(bestId)!;
      const distance = v3.distanceXZ(unit.position, target.position);

      // Stationary units: never set move orders, just attack-in-place.
      if (unit.speed === 0) {
        unit.currentOrder = {
          kind: 'attack',
          targetUnitId: bestId,
        };
      } else if (unit.type === 'lightTank') {
        // Light tank breaks patrol to engage.
        if (distance > unit.weapon.range * 0.8) {
          unit.currentOrder = {
            kind: 'attack',
            targetUnitId: bestId,
            destination: { ...target.position },
          };
        } else {
          unit.currentOrder = {
            kind: 'attack',
            targetUnitId: bestId,
          };
        }
      } else {
        // Infantry hold their ground but face the target.
        unit.currentOrder = {
          kind: 'attack',
          targetUnitId: bestId,
        };
      }
    } else if (unit.faction === 'enemy' && !bestId) {
      // No target: revert to default behavior.
      if (unit.type === 'lightTank' && unit.currentOrder.kind === 'attack') {
        // Resume patrol — Mission setup keeps original waypoints when restored.
        unit.currentOrder = {
          kind: 'patrol',
          patrolFrom: { x: 12, y: 0, z: -8 },
          patrolTo: { x: -12, y: 0, z: 8 },
          destination: { x: -12, y: 0, z: 8 },
        };
      } else if (unit.speed === 0) {
        unit.currentOrder = { kind: 'hold' };
      }
    }

    // Friendly opportunity fire: if not currently moving and a target is in
    // range, set order kind to attack but DO NOT change destination — that
    // way the player's commanded movement still resumes after the target
    // dies.
    if (unit.faction === 'friendly' && bestId) {
      const order = unit.currentOrder;
      if (order.kind === 'idle' || order.kind === 'hold') {
        unit.currentOrder = { kind: 'attack', targetUnitId: bestId };
      }
    } else if (unit.faction === 'friendly' && !bestId) {
      if (unit.currentOrder.kind === 'attack') {
        unit.currentOrder = { kind: 'idle' };
      }
    }
  }
}

export function distanceTo(a: Unit, b: Unit): number {
  return v3.distanceXZ(a.position, b.position);
}
