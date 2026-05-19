import type { Faction, Projectile, ProjectileKind, Vec3 } from '../types';
import { nextId } from './Unit';

export function makeProjectile(args: {
  ownerId: string;
  faction: Faction;
  position: Vec3;
  velocity: Vec3;
  damage: number;
  splashRadius?: number;
  spawnedAt: number;
  lifetime: number;
  kind?: ProjectileKind;
}): Projectile {
  return {
    id: nextId('P'),
    ownerId: args.ownerId,
    faction: args.faction,
    position: { ...args.position },
    velocity: { ...args.velocity },
    damage: args.damage,
    splashRadius: args.splashRadius,
    remainingTime: args.lifetime,
    spawnedAt: args.spawnedAt,
    kind: args.kind ?? 'shell',
  };
}
