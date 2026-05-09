import type { SimulationState } from '../../types';
import { v3 } from '../math';
import { pushBattlefieldEvent } from './EventLogSystem';

export function updateObjective(state: SimulationState, dt: number) {
  const obj = state.objective;
  let friendlyInside = false;
  let enemyInside = false;
  let aliveFriendlyCombatants = 0;

  for (const u of state.units.values()) {
    if (u.faction === 'friendly' && !u.isDestroyed) {
      aliveFriendlyCombatants += 1;
    }
    if (u.isDestroyed) continue;
    const d = v3.distanceXZ(u.position, obj.position);
    if (d <= obj.radius) {
      if (u.faction === 'friendly') friendlyInside = true;
      else enemyInside = true;
    }
  }

  obj.occupiedByFriendly = friendlyInside;
  obj.contested = friendlyInside && enemyInside;

  const nextStatus = obj.captured
    ? 'captured'
    : obj.contested
      ? 'contested'
      : obj.occupiedByFriendly
        ? 'friendly'
        : 'empty';
  if (obj.lastStatus !== nextStatus) {
    obj.lastStatus = nextStatus;
    if (nextStatus === 'contested') pushBattlefieldEvent(state, 'objective_contested', 'Crossroads contested', 3);
    if (nextStatus === 'friendly') pushBattlefieldEvent(state, 'objective_hold', 'Friendly unit holding crossroads', 4);
  }

  if (obj.captured) {
    return;
  }

  if (friendlyInside && !enemyInside) {
    obj.heldSeconds = Math.min(obj.requiredHoldSeconds, obj.heldSeconds + dt);
    if (obj.heldSeconds >= obj.requiredHoldSeconds && aliveFriendlyCombatants > 0) {
      obj.captured = true;
      state.result = 'victory';
      obj.lastStatus = 'captured';
      pushBattlefieldEvent(state, 'objective_captured', 'Crossroads secured', 999);
    }
  } else if (!friendlyInside) {
    // Slowly decay if abandoned, but don't reset entirely so an interrupted
    // capture is recoverable.
    obj.heldSeconds = Math.max(0, obj.heldSeconds - dt * 0.5);
  }

  if (aliveFriendlyCombatants === 0) {
    state.result = 'defeat';
    pushBattlefieldEvent(state, 'friendly_defeat', 'All friendly units lost', 999);
  }
}
