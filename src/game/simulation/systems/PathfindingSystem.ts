import { MAP_HALF, PATH_OBSTACLE_MARGIN } from '../../constants';
import type { MapDecoration, MissionDefinition, SimulationState, Unit, Vec3 } from '../../types';
import { clamp } from '../math';

interface Obstacle {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export function planPath(state: SimulationState, from: Vec3, destination: Vec3, unitRadius: number): Vec3[] {
  const target = clampToBattlefield(destination, unitRadius);
  const obstacles = getBuildingObstacles(state.mission, unitRadius + PATH_OBSTACLE_MARGIN);
  const path: Vec3[] = [];
  let current = clampToBattlefield(from, unitRadius);
  let guard = 0;

  while (guard < 8) {
    guard += 1;
    const blocker = firstBlockingObstacle(current, target, obstacles);
    if (!blocker) {
      path.push(target);
      break;
    }

    const around = waypointAroundObstacle(current, target, blocker, guard % 2 === 0 ? -1 : 1);
    const alternate = waypointAroundObstacle(current, target, blocker, guard % 2 === 0 ? 1 : -1);
    const chosen = firstBlockingObstacle(current, around, obstacles) ? alternate : around;
    path.push(clampToBattlefield(chosen, unitRadius));
    current = path[path.length - 1];
  }

  if (!path.length || path[path.length - 1] !== target) {
    path.push(target);
  }
  return smoothPath(path, obstacles);
}

export function hasLineOfSight(state: SimulationState, from: Vec3, to: Vec3, clearance = 0.35): boolean {
  const obstacles = getBuildingObstacles(state.mission, clearance);
  return !firstBlockingObstacle(from, to, obstacles);
}

export function segmentHitsBuilding(state: SimulationState, from: Vec3, to: Vec3, clearance = 0.25): boolean {
  return !hasLineOfSight(state, from, to, clearance);
}

export function steerTargetAroundObstacles(state: SimulationState, from: Vec3, target: Vec3, unitRadius: number): Vec3 {
  const obstacles = getBuildingObstacles(state.mission, unitRadius + PATH_OBSTACLE_MARGIN * 0.8);
  const blocker = firstBlockingObstacle(from, target, obstacles);
  if (!blocker) return target;
  return clampToBattlefield(waypointAroundObstacle(from, target, blocker, 1), unitRadius);
}

export function resolveUnitAgainstObstacles(unit: Unit, state: SimulationState) {
  const obstacles = getBuildingObstacles(state.mission, unit.radius + 0.35);
  for (const obstacle of obstacles) {
    const dx = unit.position.x - obstacle.x;
    const dz = unit.position.z - obstacle.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0 || dist >= obstacle.radius) continue;
    const push = obstacle.radius - dist;
    unit.position.x += (dx / dist) * push;
    unit.position.z += (dz / dist) * push;
    unit.currentSpeed *= 0.45;
  }
  unit.position.x = clamp(unit.position.x, -MAP_HALF + unit.radius, MAP_HALF - unit.radius);
  unit.position.z = clamp(unit.position.z, -MAP_HALF + unit.radius, MAP_HALF - unit.radius);
}

export function clampToBattlefield(point: Vec3, margin = 1): Vec3 {
  return {
    x: clamp(point.x, -MAP_HALF + margin, MAP_HALF - margin),
    y: 0,
    z: clamp(point.z, -MAP_HALF + margin, MAP_HALF - margin),
  };
}

function getBuildingObstacles(mission: MissionDefinition, margin: number): Obstacle[] {
  return mission.decorations
    .filter((d): d is MapDecoration => d.kind === 'building')
    .map((d) => ({
      id: d.id,
      x: d.position.x,
      z: d.position.z,
      radius: Math.hypot(d.scale.x, d.scale.z) * 0.58 + margin,
    }));
}

function firstBlockingObstacle(from: Vec3, to: Vec3, obstacles: Obstacle[]): Obstacle | null {
  let best: Obstacle | null = null;
  let bestT = Number.POSITIVE_INFINITY;
  for (const obstacle of obstacles) {
    const hit = segmentCircleIntersection(from, to, obstacle);
    if (!hit) continue;
    if (hit.t < bestT) {
      best = obstacle;
      bestT = hit.t;
    }
  }
  return best;
}

function segmentCircleIntersection(from: Vec3, to: Vec3, obstacle: Obstacle): { t: number } | null {
  const ax = from.x;
  const az = from.z;
  const bx = to.x;
  const bz = to.z;
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) return null;
  const t = clamp(((obstacle.x - ax) * vx + (obstacle.z - az) * vz) / lenSq, 0, 1);
  const px = ax + vx * t;
  const pz = az + vz * t;
  const dist = Math.hypot(px - obstacle.x, pz - obstacle.z);
  if (dist >= obstacle.radius) return null;
  const fromInside = Math.hypot(ax - obstacle.x, az - obstacle.z) < obstacle.radius * 0.55;
  const toInside = Math.hypot(bx - obstacle.x, bz - obstacle.z) < obstacle.radius * 0.55;
  return fromInside || toInside ? null : { t };
}

function waypointAroundObstacle(from: Vec3, to: Vec3, obstacle: Obstacle, side: number): Vec3 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const nx = -dz / len;
  const nz = dx / len;
  const clearance = obstacle.radius + 3.2;
  return {
    x: obstacle.x + nx * clearance * side,
    y: 0,
    z: obstacle.z + nz * clearance * side,
  };
}

function smoothPath(path: Vec3[], obstacles: Obstacle[]): Vec3[] {
  if (path.length <= 2) return path;
  const out: Vec3[] = [];
  for (let i = 0; i < path.length; i += 1) {
    const prev = out[out.length - 1];
    const next = path[i + 1];
    if (prev && next && !firstBlockingObstacle(prev, next, obstacles)) continue;
    out.push(path[i]);
  }
  return out;
}
