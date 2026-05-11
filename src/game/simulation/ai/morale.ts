import type { Unit } from '../../types';
import type { EnemySquadState } from './goapTypes';

export const MORALE_MAX = 100;
export const MORALE_LOW_THRESHOLD = 45;
export const MORALE_BROKEN_THRESHOLD = 20;

/**
 * Tracks morale per squad. Casualties and recent suppression drop morale,
 * being in cover or near allies or successfully damaging the player nudge it
 * back up. The brain consumes the boolean facts (moraleLow / moraleBroken),
 * not the raw value, to keep planning behavior readable.
 */
export class MoraleTracker {
  /** Previous-tick health of each unit, used to detect new casualties. */
  private lastHealth: Record<string, number> = {};
  /** Previous-tick destroyed flag, so a death only deducts morale once. */
  private lastDestroyed: Record<string, boolean> = {};

  reset(units: Unit[]) {
    this.lastHealth = {};
    this.lastDestroyed = {};
    for (const u of units) {
      this.lastHealth[u.id] = u.health;
      this.lastDestroyed[u.id] = u.isDestroyed;
    }
  }

  update(squad: EnemySquadState, members: Unit[], inCoverFraction: number, dt: number, simTime: number) {
    let delta = 0;
    let casualties = 0;
    let damageTaken = 0;
    let suppressed = 0;

    for (const u of members) {
      const prevHealth = this.lastHealth[u.id] ?? u.health;
      const prevDestroyed = this.lastDestroyed[u.id] ?? false;
      const lost = Math.max(0, prevHealth - u.health);
      if (lost > 0) damageTaken += lost;
      if (u.isDestroyed && !prevDestroyed) casualties += 1;
      // Recent damage but still alive = currently suppressed.
      if (!u.isDestroyed && u.lastDamagedAt !== undefined && simTime - u.lastDamagedAt < 1.5) {
        suppressed += 1;
      }
      this.lastHealth[u.id] = u.health;
      this.lastDestroyed[u.id] = u.isDestroyed;
    }

    // Damage / casualty pressure.
    delta -= casualties * 18;
    delta -= Math.min(20, damageTaken * 0.35);
    delta -= suppressed * 1.5;
    // Low ammo nibbles confidence.
    if (squad.ammo < squad.ammoMax * 0.25) delta -= 1 * dt;
    // Being in cover and near friends nudges morale up.
    delta += inCoverFraction * 6 * dt;
    if (members.length >= 2) delta += 1.0 * dt;

    // Natural recovery when nothing bad happened.
    if (casualties === 0 && damageTaken === 0 && suppressed === 0) {
      delta += 0.8 * dt;
    }

    squad.morale = clamp(squad.morale + delta, 0, MORALE_MAX);
  }

  /** Adds morale credit when the squad lands meaningful damage on the player. */
  rewardDamageDealt(squad: EnemySquadState, amount: number) {
    squad.morale = clamp(squad.morale + Math.min(8, amount * 0.25), 0, MORALE_MAX);
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
