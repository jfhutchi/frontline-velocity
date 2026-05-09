import { MAP_HALF, PROJECTILE_HIT_RADIUS, SPLASH_BASE_RADIUS } from '../../constants';
import type { Projectile, SimulationState, Unit } from '../../types';

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

    // Check collision with units.
    let hit: Unit | null = null;
    for (const u of state.units.values()) {
      if (u.isDestroyed) continue;
      if (u.faction === p.faction) continue;
      const dx = u.position.x - p.position.x;
      const dz = u.position.z - p.position.z;
      const r = u.radius + PROJECTILE_HIT_RADIUS;
      if (dx * dx + dz * dz <= r * r) {
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

      if (p.splashRadius && p.splashRadius > 0) {
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
