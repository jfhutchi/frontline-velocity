import type { SimulationState } from '../../types';
import type { EnemySquadGOAPBrain } from './EnemySquadGOAPBrain';

/**
 * Minimal commander for the first GOAP milestone. It owns a list of squads and
 * keeps each one pointed at its assigned objective. With only one active squad
 * and one battlefield objective it is intentionally near-trivial — but the
 * shape leaves room for "issue a new objective" or "promote a different squad"
 * later without rewriting the squad brains.
 */
export class EnemyCommanderAI {
  private squads: EnemySquadGOAPBrain[] = [];

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
    // Commander is deterministic in v1: every squad just ticks its brain.
    // Cross-squad coordination (e.g. "fire support from squad B while squad A
    // flanks") is intentionally deferred until the second milestone.
    for (const squad of this.squads) {
      squad.update(state, dt);
    }
  }

  getSquads(): EnemySquadGOAPBrain[] {
    return this.squads;
  }

  /** Asks every squad to replan; useful when the player completes a phase. */
  broadcastReplan(reason: string) {
    for (const s of this.squads) s.requestReplan(reason);
  }
}
