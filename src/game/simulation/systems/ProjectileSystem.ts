import { MAP_HALF, PROJECTILE_HIT_RADIUS, SPLASH_BASE_RADIUS } from '../../constants';
import type { Projectile, SimulationState, Unit } from '../../types';
import { findBuildingHitByRay } from './PathfindingSystem';
import { applyBuildingDamage, applyBuildingSplash } from './BuildingSystem';

export interface DamageEvent {
  targetId: string;
  amount: number;
  attackerId: string;
  position: { x: number; y: number; z: number };
}

/** Move projectiles, detect collisions, emit damage events and explosion effects. */
export function updateProjectiles(
  state: SimulationState,
  dt: number,
  damageOut: DamageEvent[],
) {
  const next: Projectile[] = [];
  for (const p of state.projectiles) {
    p.remainingTime -= dt;
    const previous = { ...p.position };
    p.position.x += p.velocity.x * dt;
    p.position.z += p.velocity.z * dt;
    p.position.y = Math.max(0, p.position.y); // stay on surface

    if (p.remainingTime <= 0) {
      // Expire harmlessly.
      state.effects.push({
        id: `expire_${p.id}`,
        kind: 'hit',
        position: { ...p.position },
        spawnedAt: state.time,
        duration: 0.18,
        scale: 0.6,
      });
      continue;
    }

    if (Math.abs(p.position.x) > MAP_HALF || Math.abs(p.position.z) > MAP_HALF) {
      continue; // off map, drop
    }

    const buildingHitId = findBuildingHitByRay(state, previous, p.position, 0.45);
    if (buildingHitId) {
      // Direct shell impact on a wall: apply structural damage. Tank cannons
      // chip through walls; mortar/AT shells with splash radius do area damage
      // to any other walls right next to the impact too.
      applyBuildingDamage(state, buildingHitId, p.damage * 0.55, p.ownerId);
      if (p.splashRadius && p.splashRadius > 0.01) {
        applyBuildingSplash(state, p.position, p.splashRadius, p.damage * 0.35, p.ownerId);
      }
      state.effects.push({
        id: `wallhit_${p.id}`,
        kind: 'hit',
        position: { ...p.position },
        spawnedAt: state.time,
        duration: 0.22,
        scale: 0.85,
      });
      state.effects.push({
        id: `wallsmoke_${p.id}`,
        kind: 'smoke',
        position: { ...p.position },
        spawnedAt: state.time,
        duration: 0.65,
        scale: 0.75,
      });
      continue;
    }

    // Check collision with units.
    let hit: Unit | null = null;
    for (const u of state.units.values()) {
      if (u.isDestroyed) continue;
      if (u.faction === p.faction) continue;
      const r = u.radius + PROJECTILE_HIT_RADIUS;
      if (distancePointToSegmentXZ(u.position, previous, p.position) <= r) {
        hit = u;
        break;
      }
    }

    if (hit) {
      damageOut.push({
        targetId: hit.id,
        amount: p.damage,
        attackerId: p.ownerId,
        position: { ...p.position },
      });
      state.effects.push({
        id: `boom_${p.id}`,
        kind: 'explosion',
        position: { ...p.position },
        spawnedAt: state.time,
        duration: 0.5,
        scale: 1 + (p.splashRadius ?? SPLASH_BASE_RADIUS) * 0.15,
      });
      state.effects.push({
        id: `spark_${p.id}`,
        kind: 'hit',
        position: { ...p.position },
        spawnedAt: state.time,
        duration: 0.18,
        scale: 0.8,
      });
      state.effects.push({
        id: `smokehit_${p.id}`,
        kind: 'smoke',
        position: { ...p.position },
        spawnedAt: state.time,
        duration: 0.75,
        scale: 0.9,
      });

      if (p.splashRadius && p.splashRadius > 0) {
        // Splash also blasts any nearby destructible buildings.
        applyBuildingSplash(state, p.position, p.splashRadius, p.damage * 0.45, p.ownerId);
        for (const u of state.units.values()) {
          if (u.id === hit.id) continue;
          if (u.isDestroyed) continue;
          if (u.faction === p.faction) continue;
          const dx = u.position.x - p.position.x;
          const dz = u.position.z - p.position.z;
          const d = Math.hypot(dx, dz);
          if (d <= p.splashRadius) {
            const falloff = 1 - d / p.splashRadius;
            damageOut.push({
              targetId: u.id,
              amount: p.damage * 0.4 * falloff,
              attackerId: p.ownerId,
              position: { ...u.position },
            });
          }
        }
      }
      continue;
    }

    next.push(p);
  }
  state.projectiles = next;
}

function distancePointToSegmentXZ(point: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * vx + (point.z - a.z) * vz) / lenSq));
  const px = a.x + vx * t;
  const pz = a.z + vz * t;
  return Math.hypot(point.x - px, point.z - pz);
}
