import type { SimulationState, Unit, Vec3 } from '../../types';
import { v3 } from '../math';
import type { CoverSlot } from './goapTypes';

const COVER_OFFSET = 3.6;
const COVER_OCCUPATION_RADIUS = 2.0;
const COVER_SEARCH_RADIUS = 65;

/**
 * Pre-computes cover slots from static mission decorations (buildings and
 * hills). Each obstacle exposes four candidate slots — one per cardinal side —
 * which is plenty for a single squad and avoids paying for a real navmesh in
 * the first GOAP iteration.
 */
export class CoverProvider {
  private allSlots: CoverSlot[] = [];

  buildFromMission(state: SimulationState) {
    this.allSlots = [];
    for (const d of state.mission.decorations) {
      if (d.kind !== 'building' && d.kind !== 'hill') continue;
      const baseQuality = d.kind === 'building' ? 0.85 : 0.55;
      const r = Math.hypot(d.scale.x, d.scale.z) * 0.55 + COVER_OFFSET;
      const offsets: Array<[number, number]> = [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ];
      offsets.forEach(([dx, dz], i) => {
        this.allSlots.push({
          id: `${d.id}_cover_${i}`,
          position: { x: d.position.x + dx, y: 0, z: d.position.z + dz },
          quality: baseQuality,
          occupiedBy: null,
        });
      });
    }
  }

  /** Returns nearby cover slots sorted by descending quality. */
  nearby(squadCenter: Vec3, threatOrigin: Vec3 | null, exclude: Set<string>): CoverSlot[] {
    const out: CoverSlot[] = [];
    for (const slot of this.allSlots) {
      if (slot.occupiedBy && !exclude.has(slot.occupiedBy)) continue;
      if (v3.distanceXZ(slot.position, squadCenter) > COVER_SEARCH_RADIUS) continue;
      out.push(slot);
    }
    // Prefer cover that puts the building between the squad and the threat.
    const scored = out.map((slot) => {
      let score = slot.quality;
      const distToSquad = v3.distanceXZ(slot.position, squadCenter);
      score -= distToSquad * 0.004;
      if (threatOrigin) {
        const distToThreat = v3.distanceXZ(slot.position, threatOrigin);
        // Slots farther from the threat are slightly better.
        score += distToThreat * 0.002;
      }
      return { slot, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.slot);
  }

  /** Marks a slot as occupied by a unit. */
  claim(slotId: string, unitId: string) {
    const slot = this.allSlots.find((s) => s.id === slotId);
    if (slot) slot.occupiedBy = unitId;
  }

  /** Releases a slot if it was held by this unit. */
  release(unitId: string) {
    for (const slot of this.allSlots) {
      if (slot.occupiedBy === unitId) slot.occupiedBy = null;
    }
  }

  /** Quick test for "is this unit currently within a cover slot?" */
  isUnitInCover(unit: Unit): boolean {
    for (const slot of this.allSlots) {
      if (v3.distanceXZ(slot.position, unit.position) <= COVER_OCCUPATION_RADIUS) return true;
    }
    return false;
  }

  get all(): readonly CoverSlot[] {
    return this.allSlots;
  }
}
