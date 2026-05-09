import { TURRET_TURN_RATE } from '../../constants';
import { makeProjectile } from '../../entities/Projectile';
import type { Projectile, SimulationState, Unit } from '../../types';
import { angleFromXZ, angleLerp, shortestAngleDelta, v3 } from '../math';
import { hasLineOfSight } from './PathfindingSystem';

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
    if (dist > unit.weapon.range || !hasLineOfSight(state, unit.position, target.position, unit.radius * 0.2)) {
      unit.turretRotation = angleLerp(unit.turretRotation, 0, TURRET_TURN_RATE * 0.5 * dt);
      continue;
    }

    const desiredWorldAngle = angleFromXZ(target.position.x - unit.position.x, target.position.z - unit.position.z);
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
      state.effects.push({
        id: `smoke_${unit.id}_${state.time.toFixed(2)}`,
        kind: 'smoke',
        position: muzzlePosition(unit, aimedAngle),
        spawnedAt: state.time,
        duration: 0.35,
        scale: 0.45,
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
    y: unit.type === 'infantry' ? 1.1 : unit.type === 'antiTankGun' ? 0.9 : 1.6,
    z: unit.position.z + cos * offset,
  };
}

function normalizeAngle(a: number): number {
  let r = ((a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

// Re-export so the projectile system can use it.
export const CombatInternals = { v3 };
