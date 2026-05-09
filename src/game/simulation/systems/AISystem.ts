import { AI_THINK_INTERVAL, SIGHT_RANGE_BONUS, TARGET_STICKY_SECONDS } from '../../constants';
import type { SimulationState, Unit } from '../../types';
import { v3 } from '../math';
import { pushBattlefieldEvent } from './EventLogSystem';
import { hasLineOfSight, planPath } from './PathfindingSystem';

const VEHICLE_TYPES = new Set(['mediumTank', 'reconJeep', 'lightTank']);

export function updateAI(state: SimulationState, controlledUnitId: string | null) {
  for (const unit of state.units.values()) {
    if (unit.isDestroyed) {
      unit.aiState = 'destroyed';
      unit.targetId = null;
      continue;
    }

    validateTarget(state, unit);
    if (state.time >= unit.aiNextThinkAt || !unit.targetId) {
      const previousTarget = unit.targetId;
      const selected = chooseTarget(state, unit);
      unit.targetId = selected?.id ?? null;
      unit.aiNextThinkAt = state.time + AI_THINK_INTERVAL + deterministicJitter(unit.id);
      if (selected && selected.id !== previousTarget) {
        unit.targetLockedUntil = state.time + TARGET_STICKY_SECONDS;
        pushBattlefieldEvent(state, `engage_${unit.id}_${selected.id}`, `${unit.name} engaging ${selected.name}`, 3.5);
      }
    }

    if (unit.id === controlledUnitId) {
      unit.aiState = unit.targetId ? 'alert' : 'idle';
      continue;
    }

    if (unit.faction === 'friendly') {
      updateFriendlyBehavior(state, unit);
    } else {
      updateEnemyBehavior(state, unit);
    }
  }
}

function updateFriendlyBehavior(state: SimulationState, unit: Unit) {
  const target = unit.targetId ? state.units.get(unit.targetId) : null;
  if (target && !target.isDestroyed) {
    const distance = v3.distanceXZ(unit.position, target.position);
    unit.aiState = distance <= unit.weapon.range ? 'engage' : 'alert';
    if (unit.currentOrder.kind === 'idle' || unit.currentOrder.kind === 'hold') {
      unit.currentOrder = { kind: 'attack', targetUnitId: target.id };
    }
    return;
  }

  unit.targetId = null;
  if (unit.currentOrder.kind === 'attack') {
    unit.currentOrder = { kind: 'hold', destination: unit.lastOrderDestination };
  }
  unit.aiState = unit.currentOrder.kind === 'move' ? 'alert' : 'idle';
}

function updateEnemyBehavior(state: SimulationState, unit: Unit) {
  const target = unit.targetId ? state.units.get(unit.targetId) : null;
  if (!target || target.isDestroyed) {
    unit.targetId = null;
    if (unit.type === 'lightTank') {
      restoreLightTankPatrol(unit);
    } else {
      unit.currentOrder = { kind: 'hold', destination: unit.aiHome };
      unit.aiState = unit.speed > 0 ? 'guard' : 'guard';
    }
    return;
  }

  const distance = v3.distanceXZ(unit.position, target.position);
  if (unit.speed === 0 || unit.type === 'antiTankGun') {
    unit.currentOrder = { kind: 'attack', targetUnitId: target.id };
    unit.aiState = 'engage';
    return;
  }

  if (unit.type === 'lightTank') {
    const tooClose = distance < 13;
    if (tooClose) {
      const away = v3.normalizeXZ(v3.sub(unit.position, target.position));
      const destination = {
        x: unit.position.x + away.x * 14,
        y: 0,
        z: unit.position.z + away.z * 14,
      };
      unit.currentOrder = {
        kind: 'attack',
        targetUnitId: target.id,
        destination,
        path: planPath(state, unit.position, destination, unit.radius),
        pathIndex: 0,
      };
      unit.aiState = 'reposition';
    } else if (distance > unit.weapon.range * 0.78) {
      unit.currentOrder = {
        kind: 'attack',
        targetUnitId: target.id,
        destination: { ...target.position },
        path: planPath(state, unit.position, target.position, unit.radius),
        pathIndex: 0,
      };
      unit.aiState = 'alert';
    } else {
      unit.currentOrder = { kind: 'attack', targetUnitId: target.id };
      unit.aiState = 'engage';
    }
    return;
  }

  if (unit.type === 'infantry') {
    const distanceFromHome = v3.distanceXZ(unit.position, unit.aiHome);
    if (distanceFromHome > unit.aiLeashRadius) {
      unit.currentOrder = {
        kind: 'hold',
        destination: { ...unit.aiHome },
        path: planPath(state, unit.position, unit.aiHome, unit.radius),
        pathIndex: 0,
      };
      unit.aiState = 'reposition';
    } else {
      unit.currentOrder = { kind: 'attack', targetUnitId: target.id };
      unit.aiState = distance <= unit.weapon.range ? 'engage' : 'alert';
    }
  }
}

function chooseTarget(state: SimulationState, unit: Unit): Unit | null {
  const sticky = unit.targetId ? state.units.get(unit.targetId) : null;
  if (
    sticky &&
    !sticky.isDestroyed &&
    state.time < unit.targetLockedUntil &&
    isTargetVisible(state, unit, sticky)
  ) {
    return sticky;
  }

  let best: Unit | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const other of state.units.values()) {
    if (other.faction === unit.faction || other.isDestroyed) continue;
    if (!isTargetVisible(state, unit, other)) continue;
    const distance = v3.distanceXZ(unit.position, other.position);
    const score = targetPriorityScore(unit, other) + distance * 0.04;
    if (score < bestScore) {
      bestScore = score;
      best = other;
    }
  }
  return best;
}

function validateTarget(state: SimulationState, unit: Unit) {
  if (!unit.targetId) return;
  const target = state.units.get(unit.targetId);
  if (!target || target.isDestroyed || target.faction === unit.faction || !isTargetVisible(state, unit, target, 1.25)) {
    unit.targetId = null;
  }
}

function isTargetVisible(state: SimulationState, unit: Unit, target: Unit, rangeMultiplier = 1): boolean {
  const sightRange = detectionRange(unit) * rangeMultiplier;
  const distance = v3.distanceXZ(unit.position, target.position);
  if (distance > sightRange) return false;
  return hasLineOfSight(state, unit.position, target.position, Math.min(unit.radius, target.radius) * 0.35);
}

function detectionRange(unit: Unit): number {
  if (unit.type === 'reconJeep') return unit.weapon.range + 16;
  if (unit.type === 'infantry') return unit.weapon.range + 6;
  if (unit.type === 'antiTankGun') return unit.weapon.range + 8;
  return unit.weapon.range + SIGHT_RANGE_BONUS + 8;
}

function targetPriorityScore(unit: Unit, target: Unit): number {
  if (unit.lastAttackerId === target.id) return 0;
  if (unit.type === 'mediumTank' && target.type === 'antiTankGun') return 20;
  if (unit.type === 'antiTankGun' && target.type === 'mediumTank') return 25;
  if (unit.type === 'reconJeep' && target.type === 'antiTankGun') return 260;
  if (VEHICLE_TYPES.has(target.type)) return 80;
  if (target.type === 'antiTankGun') return 90;
  if (target.type === 'infantry') return unit.type === 'reconJeep' ? 40 : 130;
  return 180;
}

function restoreLightTankPatrol(unit: Unit) {
  if (unit.currentOrder.kind === 'patrol' && unit.currentOrder.destination) {
    unit.aiState = 'patrol';
    return;
  }
  unit.currentOrder = {
    kind: 'patrol',
    patrolFrom: { x: 12, y: 0, z: -8 },
    patrolTo: { x: -12, y: 0, z: 8 },
    destination: { x: -12, y: 0, z: 8 },
  };
  unit.aiState = 'patrol';
}

function deterministicJitter(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 11) * 0.015;
}

export function distanceTo(a: Unit, b: Unit): number {
  return v3.distanceXZ(a.position, b.position);
}
