import type { SimulationState, Vec3 } from '../../types';
import { v3 } from '../math';
import type { EnemySquadGOAPBrain } from './EnemySquadGOAPBrain';

// Zones are cylinders (XZ plane) that the commander monitors for player incursion.
interface Zone {
  id: string;
  center: Vec3;
  radius: number;
  /** Squad id that nominally owns / defends this zone. */
  ownerSquadId: string;
  /** Whether a friendly (player) unit was inside last check. */
  wasContested: boolean;
}

// Fraction of squad alive below which the commander orders a fallback replan.
const FALLBACK_HEALTH_THRESHOLD = 0.35;
// How often (sim-seconds) the commander evaluates zones and squad health.
const ZONE_CHECK_INTERVAL = 2.0;
// Morale floor — a squad below this won't be asked to reinforce another zone.
const MIN_REINFORCE_MORALE = 30;

export class EnemyCommanderAI {
  private squads: EnemySquadGOAPBrain[] = [];
  private zoneCheckTimer = 0;

  // Four defensive zones matching the squad layout in Simulation.ts.
  private readonly zones: Zone[] = [
    { id: 'zone-north',       center: { x:  0, y: 0, z: -55 }, radius: 30, ownerSquadId: 'squad-alpha',   wasContested: false },
    { id: 'zone-crossroads',  center: { x:  0, y: 0, z:   0 }, radius: 20, ownerSquadId: 'squad-bravo',   wasContested: false },
    { id: 'zone-east',        center: { x: 28, y: 0, z: -15 }, radius: 25, ownerSquadId: 'squad-charlie', wasContested: false },
    { id: 'zone-south',       center: { x:  0, y: 0, z:  30 }, radius: 25, ownerSquadId: 'squad-delta',   wasContested: false },
  ];

  registerSquad(brain: EnemySquadGOAPBrain) {
    this.squads.push(brain);
  }

  unregisterAll() {
    this.squads = [];
  }

  attachAll(state: SimulationState) {
    for (const s of this.squads) s.attach(state);
  }

  detachAll(state: SimulationState) {
    for (const s of this.squads) s.detach(state);
  }

  update(state: SimulationState, dt: number) {
    for (const squad of this.squads) squad.update(state, dt);

    this.zoneCheckTimer -= dt;
    if (this.zoneCheckTimer > 0) return;
    this.zoneCheckTimer = ZONE_CHECK_INTERVAL;

    this.checkSquadHealth(state);
    this.checkZones(state);
  }

  getSquads(): EnemySquadGOAPBrain[] {
    return this.squads;
  }

  /** Asks every squad to replan; useful when the player completes a phase. */
  broadcastReplan(reason: string) {
    for (const s of this.squads) s.requestReplan(reason);
  }

  // ---- internal coordination --------------------------------------------------

  /** Squads that have suffered heavy losses fall back without waiting for GOAP. */
  private checkSquadHealth(state: SimulationState) {
    for (const brain of this.squads) {
      const fraction = this.livingFraction(state, brain);
      if (fraction < FALLBACK_HEALTH_THRESHOLD) {
        brain.requestReplan('squad-weakened-fallback');
      }
    }
  }

  /** When a zone transitions to contested, redirect an available squad there. */
  private checkZones(state: SimulationState) {
    for (const zone of this.zones) {
      const contested = this.isZoneContested(state, zone.center, zone.radius);
      if (contested && !zone.wasContested) {
        this.dispatchReinforcement(state, zone);
      }
      zone.wasContested = contested;
    }
  }

  /**
   * Find a squad that can reinforce the given zone and redirect it by updating
   * its fallback point and forcing a replan. Prefers the zone's owner squad
   * first, then the nearest idle squad.
   */
  private dispatchReinforcement(state: SimulationState, zone: Zone) {
    // Owner squad gets the primary directive.
    const owner = this.squads.find((b) => b.squad.id === zone.ownerSquadId);
    if (owner && this.isSquadAvailable(state, owner)) {
      owner.squad.fallbackPoint = { ...zone.center };
      owner.requestReplan('obj-contested');
      return;
    }

    // Otherwise pick the nearest available squad by squad center.
    const helper = this.findNearestAvailable(state, zone.center, zone.ownerSquadId);
    if (helper) {
      helper.squad.fallbackPoint = { ...zone.center };
      helper.requestReplan('reinforce-zone');
    }
  }

  /** True if any friendly (player) unit is alive inside the zone cylinder. */
  private isZoneContested(state: SimulationState, center: Vec3, radius: number): boolean {
    for (const u of state.units.values()) {
      if (u.faction !== 'friendly' || u.isDestroyed) continue;
      if (v3.distanceXZ(u.position, center) <= radius) return true;
    }
    return false;
  }

  /** Fraction of the squad's unit list that is still alive in the simulation. */
  private livingFraction(state: SimulationState, brain: EnemySquadGOAPBrain): number {
    const { unitIds } = brain.squad;
    if (!unitIds.length) return 0;
    let alive = 0;
    for (const id of unitIds) {
      const u = state.units.get(id);
      if (u && !u.isDestroyed) alive += 1;
    }
    return alive / unitIds.length;
  }

  /** A squad is "available" to reinforce if it has morale and surviving members. */
  private isSquadAvailable(state: SimulationState, brain: EnemySquadGOAPBrain): boolean {
    return brain.squad.morale >= MIN_REINFORCE_MORALE && this.livingFraction(state, brain) > 0;
  }

  private findNearestAvailable(
    state: SimulationState,
    targetPos: Vec3,
    excludeSquadId: string,
  ): EnemySquadGOAPBrain | null {
    let best: EnemySquadGOAPBrain | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const brain of this.squads) {
      if (brain.squad.id === excludeSquadId) continue;
      if (!this.isSquadAvailable(state, brain)) continue;
      const center = this.squadCenter(state, brain);
      if (!center) continue;
      const d = v3.distanceXZ(center, targetPos);
      if (d < bestDist) { bestDist = d; best = brain; }
    }
    return best;
  }

  /** Average XZ position of living squad members, or null if all dead. */
  private squadCenter(state: SimulationState, brain: EnemySquadGOAPBrain): Vec3 | null {
    let sx = 0, sz = 0, count = 0;
    for (const id of brain.squad.unitIds) {
      const u = state.units.get(id);
      if (!u || u.isDestroyed) continue;
      sx += u.position.x;
      sz += u.position.z;
      count += 1;
    }
    if (!count) return null;
    return { x: sx / count, y: 0, z: sz / count };
  }
}
