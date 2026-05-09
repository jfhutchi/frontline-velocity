import { TURRET_TURN_RATE } from '../../constants';
import { makeProjectile } from '../../entities/Projectile';
import type { Projectile, SimulationState, Unit } from '../../types';
import { angleFromXZ, angleLerp, shortestAngleDelta, v3 } from '../math';

const TURRET_AIM_TOLERANCE = 0.18; // ~10 degrees

/** Turn turrets toward targets and fire when ready. */
export function updateCombat(
  state: SimulationState,
  dt: number,
  controlledUnitId: string | null,
  outProjectiles: Projectile[],
) {
  for (const unit of state.units.values()) {
    if (unit.isDestroyed) continue;
    if (unit.id === controlledUnitId) continue; // direct control handles its own firing

    const targetId = unit.targetId ?? unit.currentOrder.targetUnitId ?? null;
    if (!targetId) {
      // Slowly recenter turret.
      unit.turretRotation = angleLerp(unit.turretRotation, 0, TURRET_TURN_RATE * 0.5 * dt);
      continue;
    }
    const target = state.units.get(targetId);
    if (!target || target.isDestroyed) continue;

    const dx = target.position.x - unit.position.x;
    const dz = target.position.z - unit.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > unit.weapon.range) {
      unit.turretRotation = angleLerp(unit.turretRotation, 0, TURRET_TURN_RATE * 0.5 * dt);
      continue;
    }

    // Lead aim slightly so projectiles connect against moving targets.
    const projectileSpeed = unit.weapon.projectileSpeed;
    const flightTime = dist / projectileSpeed;
    const leadX = target.position.x + (estimateVelocity(target).x * flightTime);
    const leadZ = target.position.z + (estimateVelocity(target).z * flightTime);

    const desiredWorldAngle = angleFromXZ(leadX - unit.position.x, leadZ - unit.position.z);
    const desiredTurretLocal = desiredWorldAngle - unit.rotation;
    unit.turretRotation = angleLerp(unit.turretRotation, normalizeAngle(desiredTurretLocal), TURRET_TURN_RATE * dt);

    const aimedAngle = unit.rotation + unit.turretRotation;
    const aimError = Math.abs(shortestAngleDelta(aimedAngle, desiredWorldAngle));

    if (aimError <= TURRET_AIM_TOLERANCE && state.time - unit.weapon.lastFiredAt >= unit.weapon.reloadSeconds) {
      const proj = spawnProjectile(unit, aimedAngle, state.time);
      outProjectiles.push(proj);
      unit.weapon.lastFiredAt = state.time;
      // Brief muzzle flash effect.
      state.effects.push({
        id: `mfx_${unit.id}_${state.time.toFixed(2)}`,
        kind: 'muzzleFlash',
        position: muzzlePosition(unit, aimedAngle),
        spawnedAt: state.time,
        duration: 0.08,
      });
    }
  }
}

function spawnProjectile(unit: Unit, worldAngle: number, time: number): Projectile {
  const muzzle = muzzlePosition(unit, worldAngle);
  const speed = unit.weapon.projectileSpeed;
  const sin = Math.sin(worldAngle);
  const cos = Math.cos(worldAngle);
  return makeProjectile({
    ownerId: unit.id,
    faction: unit.faction,
    position: muzzle,
    velocity: { x: sin * speed, y: 0, z: cos * speed },
    damage: unit.weapon.damage,
    splashRadius: unit.weapon.splashRadius,
    spawnedAt: time,
    lifetime: 4,
  });
}

function muzzlePosition(unit: Unit, worldAngle: number) {
  const sin = Math.sin(worldAngle);
  const cos = Math.cos(worldAngle);
  const offset = unit.radius + 0.6;
  return {
    x: unit.position.x + sin * offset,
    y: 1.6,
    z: unit.position.z + cos * offset,
  };
}

function normalizeAngle(a: number): number {
  let r = ((a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

// Tracking previous positions for crude velocity estimation. Module-level
// cache keyed by unit id.
const __prevPos = new Map<string, { x: number; z: number; t: number }>();
function estimateVelocity(unit: Unit): { x: number; z: number } {
  const prev = __prevPos.get(unit.id);
  const now = performance.now() / 1000;
  __prevPos.set(unit.id, { x: unit.position.x, z: unit.position.z, t: now });
  if (!prev) return { x: 0, z: 0 };
  const dt = now - prev.t;
  if (dt < 1e-3) return { x: 0, z: 0 };
  return {
    x: (unit.position.x - prev.x) / dt,
    z: (unit.position.z - prev.z) / dt,
  };
}

// Re-export so the projectile system can use it.
export const CombatInternals = { v3 };
