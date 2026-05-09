import type { ObjectiveZone, Vec3 } from '../types';

export function makeObjectiveZone(args: {
  id: string;
  name: string;
  position: Vec3;
  radius: number;
  requiredHoldSeconds: number;
}): ObjectiveZone {
  return {
    id: args.id,
    name: args.name,
    position: { ...args.position },
    radius: args.radius,
    requiredHoldSeconds: args.requiredHoldSeconds,
    heldSeconds: 0,
    captured: false,
    occupiedByFriendly: false,
    contested: false,
  };
}
