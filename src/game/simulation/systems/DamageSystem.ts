import type { SimulationState } from '../../types';
import type { DamageEvent } from './ProjectileSystem';

export function applyDamage(state: SimulationState, events: DamageEvent[], onPlayerHit: () => void, controlledUnitId: string | null) {
  for (const ev of events) {
    const unit = state.units.get(ev.targetId);
    if (!unit || unit.isDestroyed) continue;
    // Armor reduces damage, but never below 25% of incoming.
    const reduction = unit.armor / (unit.armor + 80);
    const finalDamage = Math.max(ev.amount * 0.25, ev.amount * (1 - reduction));
    unit.health -= finalDamage;
    unit.lastDamagedAt = state.time;
    if (unit.health <= 0) {
      unit.health = 0;
      unit.isDestroyed = true;
      unit.destroyedAt = state.time;
      state.effects.push({
        id: `wreck_${unit.id}_${state.time.toFixed(2)}`,
        kind: 'explosion',
        position: { ...unit.position },
        spawnedAt: state.time,
        duration: 0.9,
        scale: 1.6 + unit.radius,
      });
    }
    if (controlledUnitId && ev.targetId === controlledUnitId) {
      onPlayerHit();
    }
  }
}
