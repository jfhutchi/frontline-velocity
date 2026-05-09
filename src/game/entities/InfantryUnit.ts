import type { Unit } from '../types';

export function isInfantry(unit: Unit): boolean {
  return unit.type === 'infantry';
}
