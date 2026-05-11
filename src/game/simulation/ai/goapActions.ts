import { v3 } from '../math';
import { hasLineOfSight } from '../systems/PathfindingSystem';
import type { Unit, Vec3 } from '../../types';
import type { ActionStatus, GoapAction, SquadContext, UnitCommand, WorldState } from './goapTypes';

const ARRIVAL_RADIUS = 4.5;
const SUPPRESS_DURATION = 2.5;

/**
 * GOAP-friendly enemy squad actions. Each action keeps its own state on the
 * squad object (via `unitCommands` etc.) so the FSM can replay the last
 * command between ticks without us having to remember "did I already issue
 * the move order".
 */

function assignCommands(ctx: SquadContext, factory: (unit: Unit, idx: number) => UnitCommand) {
  ctx.members.forEach((unit, i) => {
    ctx.squad.unitCommands[unit.id] = factory(unit, i);
  });
}

function squadAt(units: Unit[], destination: Vec3, radius = ARRIVAL_RADIUS): boolean {
  if (!units.length) return false;
  return units.every((u) => v3.distanceXZ(u.position, destination) <= radius);
}

function spread(destination: Vec3, idx: number): Vec3 {
  // Tiny offset so units don't stack on the same waypoint when given a shared
  // destination. Kept small — formation logic for real movement lives in
  // CommandController; this is just to break ties.
  const angle = idx * 1.31;
  return { x: destination.x + Math.cos(angle) * 2.0, y: 0, z: destination.z + Math.sin(angle) * 2.0 };
}

// -------- AttackTarget --------------------------------------------------------

export const AttackTarget: GoapAction = {
  id: 'AttackTarget',
  baseCost: 3,
  preconditions: { hasVisibleEnemy: true, hasAmmo: true, hasLineOfSight: true },
  effects: { hasVisibleEnemy: false },
  dynamicCost: (state: WorldState) => (state.enemyThreatHigh ? 6 : 0) - (state.isInCover ? 3 : 0),
  isValid: (ctx) => ctx.preferredTarget !== null,
  tick: (ctx) => {
    const target = ctx.preferredTarget;
    if (!target || target.isDestroyed) return 'success';
    assignCommands(ctx, () => ({ kind: 'attack', targetId: target.id, allowAdvance: true }));
    return 'running';
  },
};

// -------- SuppressTarget -----------------------------------------------------

export const SuppressTarget: GoapAction = {
  id: 'SuppressTarget',
  baseCost: 1,
  preconditions: { hasVisibleEnemy: true, hasAmmo: true },
  effects: { enemyThreatHigh: false, hasLineOfSight: true },
  isValid: (ctx) => ctx.preferredTarget !== null,
  start: (ctx) => {
    ctx.squad.suppressUntil = ctx.time + SUPPRESS_DURATION;
    return 'running';
  },
  tick: (ctx) => {
    const target = ctx.preferredTarget;
    if (!target || target.isDestroyed) return 'success';
    assignCommands(ctx, () => ({ kind: 'suppress', targetId: target.id }));
    if (ctx.time >= ctx.squad.suppressUntil) return 'success';
    return 'running';
  },
};

// -------- FlankTarget --------------------------------------------------------

export const FlankTarget: GoapAction = {
  id: 'FlankTarget',
  baseCost: 1,
  preconditions: { hasVisibleEnemy: true, canFlank: true },
  effects: { canFlank: false, isInCover: true, hasLineOfSight: true },
  isValid: (ctx) => ctx.preferredTarget !== null && ctx.nearbyCover.length > 0,
  start: (ctx) => {
    const target = ctx.preferredTarget;
    if (!target) return 'failure';
    // Pick a cover slot perpendicular to the squad→target vector.
    const dir = v3.normalizeXZ(v3.sub(target.position, ctx.center));
    const perp = { x: -dir.z, y: 0, z: dir.x };
    let best = ctx.nearbyCover[0];
    let bestDot = -Infinity;
    for (const slot of ctx.nearbyCover) {
      const rel = v3.sub(slot.position, ctx.center);
      const dot = Math.abs(rel.x * perp.x + rel.z * perp.z);
      if (dot > bestDot) {
        bestDot = dot;
        best = slot;
      }
    }
    for (const unit of ctx.members) ctx.squad.flankWaypointByUnit[unit.id] = best.position;
    return 'running';
  },
  tick: (ctx) => {
    const target = ctx.preferredTarget;
    if (!target || target.isDestroyed) return 'success';
    let arrived = true;
    ctx.members.forEach((unit, idx) => {
      const waypoint = ctx.squad.flankWaypointByUnit[unit.id];
      if (!waypoint) return;
      const dest = spread(waypoint, idx);
      ctx.squad.unitCommands[unit.id] = { kind: 'moveTo', destination: dest };
      if (v3.distanceXZ(unit.position, waypoint) > ARRIVAL_RADIUS) arrived = false;
    });
    return arrived ? 'success' : 'running';
  },
};

// -------- FindCover ----------------------------------------------------------

export const FindCover: GoapAction = {
  id: 'FindCover',
  baseCost: 1,
  preconditions: {},
  effects: { hasCoverNearby: true },
  isValid: (ctx) => ctx.nearbyCover.length > 0,
  tick: (ctx) => {
    // Reserve a slot for each squad member from the sorted nearby cover list.
    const taken = new Set<string>();
    for (const unit of ctx.members) {
      const slot = ctx.nearbyCover.find((s) => !taken.has(s.id));
      if (slot) {
        taken.add(slot.id);
        ctx.squad.selectedCoverByUnit[unit.id] = slot;
      }
    }
    return Object.values(ctx.squad.selectedCoverByUnit).some(Boolean) ? 'success' : 'failure';
  },
};

// -------- MoveToCover --------------------------------------------------------

export const MoveToCover: GoapAction = {
  id: 'MoveToCover',
  baseCost: 1,
  preconditions: { hasCoverNearby: true },
  effects: { isInCover: true, isSuppressed: false },
  tick: (ctx) => {
    let arrived = true;
    ctx.members.forEach((unit) => {
      const slot = ctx.squad.selectedCoverByUnit[unit.id];
      if (!slot) {
        ctx.squad.unitCommands[unit.id] = { kind: 'hold' };
        return;
      }
      ctx.squad.unitCommands[unit.id] = {
        kind: 'takeCover',
        destination: slot.position,
        coverId: slot.id,
      };
      if (v3.distanceXZ(unit.position, slot.position) > ARRIVAL_RADIUS) arrived = false;
    });
    return arrived ? 'success' : 'running';
  },
};

// -------- MoveToObjective ----------------------------------------------------

export const MoveToObjective: GoapAction = {
  id: 'MoveToObjective',
  baseCost: 2,
  preconditions: {},
  effects: { objectiveControlledByEnemy: true, objectiveNearby: true },
  tick: (ctx) => {
    const obj = ctx.state.objective;
    if (!obj) return 'failure';
    let arrived = true;
    ctx.members.forEach((unit, idx) => {
      const dest = spread(obj.position, idx);
      ctx.squad.unitCommands[unit.id] = { kind: 'moveTo', destination: dest };
      if (v3.distanceXZ(unit.position, obj.position) > obj.radius) arrived = false;
    });
    return arrived ? 'success' : 'running';
  },
};

// -------- MoveToSupply -------------------------------------------------------

export const MoveToSupply: GoapAction = {
  id: 'MoveToSupply',
  baseCost: 3,
  preconditions: {},
  effects: { supplyAvailable: true },
  isValid: (ctx) => ctx.squad.supplyPoint !== null,
  tick: (ctx) => {
    const depot = ctx.squad.supplyPoint;
    if (!depot) return 'failure';
    let arrived = true;
    ctx.members.forEach((unit, idx) => {
      const dest = spread(depot, idx);
      ctx.squad.unitCommands[unit.id] = { kind: 'moveTo', destination: dest };
      if (v3.distanceXZ(unit.position, depot) > ARRIVAL_RADIUS) arrived = false;
    });
    return arrived ? 'success' : 'running';
  },
};

// -------- ResupplyAtDepot ----------------------------------------------------

export const ResupplyAtDepot: GoapAction = {
  id: 'ResupplyAtDepot',
  baseCost: 1,
  preconditions: { supplyAvailable: true },
  effects: { hasAmmo: true },
  tick: (ctx) => {
    const depot = ctx.squad.supplyPoint;
    if (!depot) return 'failure';
    // Squad must actually be at the depot for the resupply to land.
    if (!squadAt(ctx.members, depot, 6)) return 'failure';
    ctx.squad.ammo = ctx.squad.ammoMax;
    return 'success';
  },
};

// -------- RetreatToFallbackPoint --------------------------------------------

export const RetreatToFallbackPoint: GoapAction = {
  id: 'RetreatToFallbackPoint',
  baseCost: 2,
  preconditions: {},
  effects: { hasVisibleEnemy: false, isSuppressed: false, isInCover: true },
  tick: (ctx) => {
    let arrived = true;
    ctx.members.forEach((unit, idx) => {
      const dest = spread(ctx.squad.fallbackPoint, idx);
      ctx.squad.unitCommands[unit.id] = { kind: 'retreat', destination: dest };
      if (v3.distanceXZ(unit.position, ctx.squad.fallbackPoint) > ARRIVAL_RADIUS) arrived = false;
    });
    return arrived ? 'success' : 'running';
  },
};

// -------- Regroup ------------------------------------------------------------

export const Regroup: GoapAction = {
  id: 'Regroup',
  baseCost: 1,
  preconditions: {},
  effects: { isSuppressed: false },
  tick: (ctx) => {
    let arrived = true;
    ctx.members.forEach((unit, idx) => {
      const dest = spread(ctx.center, idx);
      ctx.squad.unitCommands[unit.id] = { kind: 'regroup', destination: dest };
      if (v3.distanceXZ(unit.position, ctx.center) > ARRIVAL_RADIUS * 1.6) arrived = false;
    });
    return arrived ? 'success' : 'running';
  },
};

export const SQUAD_ACTIONS: GoapAction[] = [
  AttackTarget,
  SuppressTarget,
  FlankTarget,
  FindCover,
  MoveToCover,
  MoveToObjective,
  MoveToSupply,
  ResupplyAtDepot,
  RetreatToFallbackPoint,
  Regroup,
];

/** Helper for action.tick implementations / scenarios — LOS from squad center to target. */
export function squadHasLineOfSight(ctx: SquadContext, target: Vec3): boolean {
  return hasLineOfSight(ctx.state, ctx.center, target, 0.6);
}

/**
 * Returns whether this action could even be considered as a fallback — useful
 * when GOAP returns null and we want a sensible defensive default.
 */
export function actionStatusToString(status: ActionStatus): string {
  return status;
}
