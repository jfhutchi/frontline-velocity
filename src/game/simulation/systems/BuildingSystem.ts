import type { BuildingState, MapDecoration, MissionDefinition, SimulationState, Vec3 } from '../../types';
import { pushBattlefieldEvent } from './EventLogSystem';

/**
 * Initialize per-building HP entries from a mission's destructible decorations.
 * Buildings without `destructible: true` are skipped — those remain as inert
 * geometry / static obstacles for pathing.
 */
export function buildBuildingStateMap(mission: MissionDefinition): Map<string, BuildingState> {
  const map = new Map<string, BuildingState>();
  for (const d of mission.decorations) {
    if (d.kind !== 'building') continue;
    if (!d.destructible) continue;
    const dec = d as MapDecoration;
    const radius = Math.hypot(dec.scale.x, dec.scale.z) * 0.58;
    const maxHealth = dec.maxHealth ?? defaultBuildingHealth(dec);
    map.set(dec.id, {
      id: dec.id,
      decorationId: dec.id,
      position: { ...dec.position },
      radius,
      health: maxHealth,
      maxHealth,
      isDestroyed: false,
    });
  }
  return map;
}

function defaultBuildingHealth(d: MapDecoration): number {
  // Bigger / taller structures soak more HP; bunkers are extra tough.
  const volumeScore = d.scale.x * d.scale.y * d.scale.z;
  const base = 80 + volumeScore * 1.4;
  if (d.buildingStyle === 'bunker') return base * 2.4;
  if (d.buildingStyle === 'church') return base * 1.4;
  return base;
}

/** Apply direct structural damage to a single building. */
export function applyBuildingDamage(
  state: SimulationState,
  buildingId: string,
  amount: number,
  attackerId: string,
) {
  const b = state.buildings.get(buildingId);
  if (!b || b.isDestroyed) return;
  b.health -= amount;
  if (b.health <= 0) {
    b.health = 0;
    b.isDestroyed = true;
    b.destroyedAt = state.time;
    spawnDemolitionEffects(state, b);
    pushBattlefieldEvent(state, `bldg_${b.id}_down`, 'Structure collapsed', 999);
    void attackerId;
  }
}

/** Apply area damage to every destructible building within radius of `point`. */
export function applyBuildingSplash(
  state: SimulationState,
  point: Vec3,
  splashRadius: number,
  baseAmount: number,
  attackerId: string,
) {
  if (splashRadius <= 0 || baseAmount <= 0) return;
  for (const b of state.buildings.values()) {
    if (b.isDestroyed) continue;
    const dx = b.position.x - point.x;
    const dz = b.position.z - point.z;
    const dist = Math.hypot(dx, dz);
    const reach = splashRadius + b.radius * 0.7;
    if (dist > reach) continue;
    const falloff = 1 - dist / reach;
    applyBuildingDamage(state, b.id, baseAmount * falloff, attackerId);
  }
}

function spawnDemolitionEffects(state: SimulationState, b: BuildingState) {
  const t = state.time;
  state.effects.push({
    id: `bldg_boom_${b.id}_${t.toFixed(2)}`,
    kind: 'explosion',
    position: { ...b.position },
    spawnedAt: t,
    duration: 1.1,
    scale: 1.4 + b.radius * 0.5,
  });
  state.effects.push({
    id: `bldg_smoke_${b.id}_${t.toFixed(2)}`,
    kind: 'smoke',
    position: { ...b.position },
    spawnedAt: t,
    duration: 4.5,
    scale: 1.6 + b.radius * 0.55,
  });
}
