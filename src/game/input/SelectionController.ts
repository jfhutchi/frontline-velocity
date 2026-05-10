import { useGameStore } from '../state/gameStore';
import type { SimulationState, Unit } from '../types';

export type SelectionResult = 'cleared' | 'replaced' | 'added' | 'removed' | 'none';

/**
 * Pure logic that mutates the gameStore selection in response to mouse / key
 * inputs. Keeps SelectionRendering and command-issuance free of click semantics.
 */
export class SelectionController {
  private state: SimulationState;

  constructor(state: SimulationState) {
    this.state = state;
  }

  setSimulationState(state: SimulationState) {
    this.state = state;
  }

  /** Click a friendly unit. additive=true (Shift) toggles it instead of replacing. */
  selectFriendly(unit: Unit, additive: boolean): SelectionResult {
    if (unit.faction !== 'friendly' || unit.isDestroyed) return 'none';
    const store = useGameStore.getState();
    if (additive) {
      const wasSelected = store.selectedUnitIds.includes(unit.id);
      store.toggleUnitInSelection(unit.id);
      return wasSelected ? 'removed' : 'added';
    }
    store.setSelection([unit.id]);
    return 'replaced';
  }

  /** Replace selection with all the given friendly, alive units. Returns the number kept. */
  setBoxSelection(units: Unit[], additive: boolean): number {
    const friendly = units.filter((u) => u.faction === 'friendly' && !u.isDestroyed);
    if (!friendly.length && !additive) {
      // Box-drag over empty ground: only clear if not additive.
      useGameStore.getState().setSelection([]);
      return 0;
    }
    const ids = friendly.map((u) => u.id);
    const store = useGameStore.getState();
    if (additive) {
      const merged = [...store.selectedUnitIds];
      for (const id of ids) if (!merged.includes(id)) merged.push(id);
      store.setSelection(merged);
      return merged.length;
    }
    if (!ids.length) return 0;
    store.setSelection(ids);
    return ids.length;
  }

  /** Click on empty ground / nothing. */
  clear(): SelectionResult {
    const store = useGameStore.getState();
    if (!store.selectedUnitIds.length) return 'none';
    store.setSelection([]);
    return 'cleared';
  }

  /** Returns the currently-selected friendly units (filtered against the live state). */
  getSelectedUnits(): Unit[] {
    const ids = useGameStore.getState().selectedUnitIds;
    const out: Unit[] = [];
    for (const id of ids) {
      const u = this.state.units.get(id);
      if (u && !u.isDestroyed && u.faction === 'friendly') out.push(u);
    }
    return out;
  }

  hasSelection(): boolean {
    return useGameStore.getState().selectedUnitIds.length > 0;
  }
}
