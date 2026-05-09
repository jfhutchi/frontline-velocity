import type { SimulationState } from '../../types';
import type { DamageEvent } from './ProjectileSystem';
import { pushBattlefieldEvent } from './EventLogSystem';

export function applyDamage(state: SimulationState, events: DamageEvent[], onPlayerHit: () => void, controlledUnitId: string | null) {
  for (const ev of events) {
    const unit = state.units.get(ev.targetId);
    if (!unit || unit.isDestroyed) continue;
    // Armor reduces damage, but never below 25% of incoming.
    const reduction = unit.armor / (unit.armor + 80);
    const finalDamage = Math.max(ev.amount * 0.25, ev.amount * (1 - reduction));
    unit.health -= finalDamage;
    unit.lastDamagedAt = state.time;
    unit.lastAttackerId = ev.attackerId;
    const attacker = state.units.get(ev.attackerId);
    if (attacker) {
      pushBattlefieldEvent(state, `hit_${unit.id}`, `${unit.name} under fire`, 5);
    }
    if (unit.health <= 0) {
      unit.health = 0;
      unit.isDestroyed = true;
      unit.destroyedAt = state.time;
      unit.targetId = null;
      unit.currentSpeed = 0;
      unit.aiState = 'destroyed';
      unit.currentOrder = { kind: 'hold' };
      state.effects.push({
        id: `wreck_${unit.id}_${state.time.toFixed(2)}`,
        kind: 'explosion',
        position: { ...unit.position },
        spawnedAt: state.time,
        duration: 0.9,
        scale: 1.6 + unit.radius,
      });
      state.effects.push({
        id: `wreck_smoke_${unit.id}_${state.time.toFixed(2)}`,
        kind: 'smoke',
        position: { ...unit.position },
        spawnedAt: state.time,
        duration: 3.5,
        scale: 1.4 + unit.radius * 0.4,
      });
      pushBattlefieldEvent(state, `destroyed_${unit.id}`, `${unit.name} destroyed`, 999);
    }
    if (controlledUnitId && ev.targetId === controlledUnitId) {
      onPlayerHit();
    }
  }
}
