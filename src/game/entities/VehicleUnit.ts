import type { Unit } from '../types';

// Vehicles share the Unit shape but provide helpers used by movement/AI/direct-control.
export function isVehicle(unit: Unit): boolean {
  return unit.type === 'mediumTank' || unit.type === 'reconJeep' || unit.type === 'lightTank';
}

export function isStationary(unit: Unit): boolean {
  return unit.speed === 0;
}
