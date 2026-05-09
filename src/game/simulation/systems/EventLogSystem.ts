import type { SimulationState } from '../../types';

const EVENT_LIMIT = 6;
const eventCooldowns = new Map<string, number>();

export function resetBattlefieldEventMemory() {
  eventCooldowns.clear();
}

export function pushBattlefieldEvent(
  state: SimulationState,
  key: string,
  message: string,
  minIntervalSeconds = 4,
) {
  const last = eventCooldowns.get(key);
  if (last !== undefined && state.time - last < minIntervalSeconds) return;
  eventCooldowns.set(key, state.time);
  state.eventLog.push({
    id: `${key}_${state.time.toFixed(2)}`,
    time: state.time,
    message,
  });
  if (state.eventLog.length > EVENT_LIMIT) {
    state.eventLog.splice(0, state.eventLog.length - EVENT_LIMIT);
  }
}
