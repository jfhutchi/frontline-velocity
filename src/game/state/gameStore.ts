import { create } from 'zustand';
import type { GameMode, ObjectiveZone } from '../types';
import type { SpeedLevel } from '../constants';
import { SPEED_LEVELS } from '../constants';
import type { SquadDebugSnapshot } from '../simulation/ai';

export interface UnitSummary {
  id: string;
  name: string;
  type: string;
  faction: 'friendly' | 'enemy';
  health: number;
  maxHealth: number;
  armor: number;
  speed: number;
  weaponName: string;
  weaponRange: number;
  reloadSeconds: number;
  reloadProgress: number; // 0..1, 1 = ready to fire
  orderKind: string;
  orderLabel: string;
  aiState: string;
  targetId: string | null;
  targetName: string | null;
  isUnderAttack: boolean;
  isDestroyed: boolean;
  isPlayerControllable: boolean;
}

export interface EventLogEntry {
  id: string;
  time: number;
  message: string;
}

export interface GameStoreState {
  screen: GameMode;
  paused: boolean;
  speedLevel: SpeedLevel;
  /** Multiplier for the simulation (0 when paused). */
  speedMultiplier: number;

  /** All currently selected friendly units. Empty when nothing is selected. */
  selectedUnitIds: string[];
  /** Convenience: the unit treated as primary for single-target HUD/jump-in. */
  selectedUnitId: string | null;
  /** Optional: unit currently under the cursor for hover highlight. */
  hoveredUnitId: string | null;
  controlledUnitId: string | null;
  /** Numeric control groups (1-9) -> selected unit ids. */
  controlGroups: Record<number, string[]>;

  unitSummaries: UnitSummary[];
  eventLog: EventLogEntry[];
  objective: ObjectiveZone | null;
  result: null | 'victory' | 'defeat';

  /** Counter incremented when player takes damage to flash the screen. */
  damageFlashTick: number;

  /** Optional enemy AI debug snapshot pushed by the simulation each tick. */
  enemyDebug: SquadDebugSnapshot[];
  /** Player toggle for the enemy AI debug overlay. */
  showEnemyDebug: boolean;

  // ----- actions -----
  goToBriefing: () => void;
  startMission: () => void;
  returnToMenu: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  setSpeedLevel: (level: SpeedLevel) => void;
  /** Replace selection with the provided list (or clear). */
  setSelection: (ids: string[]) => void;
  /** Backwards-compatible single-unit selection helper. */
  setSelectedUnitId: (id: string | null) => void;
  /** Toggle a single unit in the current selection (Shift+click). */
  toggleUnitInSelection: (id: string) => void;
  /** Add a single unit to the selection if not already present. */
  addUnitToSelection: (id: string) => void;
  setHoveredUnitId: (id: string | null) => void;
  setControlledUnitId: (id: string | null) => void;
  /** Assign the current selection to control group N (1-9). */
  assignControlGroup: (group: number) => void;
  /** Recall a control group; returns the ids selected. */
  recallControlGroup: (group: number) => string[];
  /** With multiple units selected, rotate which id is primary (first in list). */
  rotatePrimarySelection: () => void;
  setUnitSummaries: (s: UnitSummary[]) => void;
  setEventLog: (events: EventLogEntry[]) => void;
  setObjective: (o: ObjectiveZone) => void;
  enterDirectControl: () => void;
  exitDirectControl: () => void;
  setResult: (r: 'victory' | 'defeat') => void;
  flashDamage: () => void;
  setEnemyDebug: (snaps: SquadDebugSnapshot[]) => void;
  toggleEnemyDebug: () => void;
  setShowEnemyDebug: (v: boolean) => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: 'menu',
  paused: false,
  speedLevel: 'normal',
  speedMultiplier: SPEED_LEVELS.normal,

  selectedUnitIds: [],
  selectedUnitId: null,
  hoveredUnitId: null,
  controlledUnitId: null,
  controlGroups: {},

  unitSummaries: [],
  eventLog: [],
  objective: null,
  result: null,
  damageFlashTick: 0,
  enemyDebug: [],
  showEnemyDebug: false,

  goToBriefing: () => set({ screen: 'briefing' }),

  startMission: () =>
    set({
      screen: 'tactical',
      paused: false,
      result: null,
      controlledUnitId: null,
      selectedUnitIds: [],
      selectedUnitId: null,
      hoveredUnitId: null,
      controlGroups: {},
      speedLevel: 'normal',
      speedMultiplier: SPEED_LEVELS.normal,
      eventLog: [],
    }),

  returnToMenu: () =>
    set({
      screen: 'menu',
      paused: false,
      result: null,
      selectedUnitIds: [],
      selectedUnitId: null,
      hoveredUnitId: null,
      controlGroups: {},
      controlledUnitId: null,
    }),

  pause: () => {
    if (get().screen === 'menu' || get().screen === 'briefing') return;
    set({ paused: true, speedMultiplier: 0 });
  },

  resume: () => {
    if (get().screen === 'menu' || get().screen === 'briefing') return;
    const lvl = get().speedLevel;
    set({ paused: false, speedMultiplier: SPEED_LEVELS[lvl] });
  },

  togglePause: () => {
    if (get().paused) {
      get().resume();
    } else {
      get().pause();
    }
  },

  setSpeedLevel: (level) => {
    const paused = get().paused;
    set({ speedLevel: level, speedMultiplier: paused ? 0 : SPEED_LEVELS[level] });
  },

  setSelection: (ids) => {
    const unique: string[] = [];
    for (const id of ids) {
      if (!unique.includes(id)) unique.push(id);
    }
    set({ selectedUnitIds: unique, selectedUnitId: unique[0] ?? null });
  },

  setSelectedUnitId: (id) => {
    if (id === null) set({ selectedUnitIds: [], selectedUnitId: null });
    else set({ selectedUnitIds: [id], selectedUnitId: id });
  },

  toggleUnitInSelection: (id) => {
    const current = get().selectedUnitIds;
    if (current.includes(id)) {
      const next = current.filter((x) => x !== id);
      set({ selectedUnitIds: next, selectedUnitId: next[0] ?? null });
    } else {
      const next = [...current, id];
      // Promote the just-clicked unit to "primary" so HUD reacts to the latest click.
      set({ selectedUnitIds: next, selectedUnitId: id });
    }
  },

  addUnitToSelection: (id) => {
    const current = get().selectedUnitIds;
    if (current.includes(id)) {
      set({ selectedUnitId: id });
      return;
    }
    const next = [...current, id];
    set({ selectedUnitIds: next, selectedUnitId: id });
  },

  setHoveredUnitId: (id) => set({ hoveredUnitId: id }),
  setControlledUnitId: (id) => set({ controlledUnitId: id }),

  assignControlGroup: (group) => {
    const ids = [...get().selectedUnitIds];
    if (!ids.length) return;
    set({ controlGroups: { ...get().controlGroups, [group]: ids } });
  },

  recallControlGroup: (group) => {
    const ids = get().controlGroups[group];
    if (!ids || !ids.length) return [];
    // Filter out destroyed/missing units against the latest summaries.
    const summaries = get().unitSummaries;
    const stillAlive = ids.filter((id) => {
      const s = summaries.find((u) => u.id === id);
      return s && !s.isDestroyed;
    });
    if (!stillAlive.length) return [];
    set({ selectedUnitIds: stillAlive, selectedUnitId: stillAlive[0] });
    return stillAlive;
  },

  rotatePrimarySelection: () => {
    const ids = [...get().selectedUnitIds];
    if (ids.length <= 1) return;
    const first = ids.shift();
    if (first === undefined) return;
    ids.push(first);
    set({ selectedUnitIds: ids, selectedUnitId: ids[0] });
  },

  setUnitSummaries: (s) => {
    // Prune selection of any units that no longer exist or are destroyed.
    const live = new Set(s.filter((u) => !u.isDestroyed).map((u) => u.id));
    const prevIds = get().selectedUnitIds;
    const filtered = prevIds.filter((id) => live.has(id));
    if (filtered.length !== prevIds.length) {
      set({
        unitSummaries: s,
        selectedUnitIds: filtered,
        selectedUnitId: filtered[0] ?? null,
      });
    } else {
      set({ unitSummaries: s });
    }
  },
  setEventLog: (events) => set({ eventLog: events }),
  setObjective: (o) => set({ objective: o }),

  enterDirectControl: () => {
    const { selectedUnitId } = get();
    if (!selectedUnitId) return;
    set({ controlledUnitId: selectedUnitId, screen: 'directControl' });
  },

  exitDirectControl: () => {
    set({ controlledUnitId: null, screen: 'tactical' });
  },

  setResult: (r) => {
    set({ result: r, screen: r, paused: true, speedMultiplier: 0 });
  },

  flashDamage: () => {
    set({ damageFlashTick: get().damageFlashTick + 1 });
  },

  setEnemyDebug: (snaps) => set({ enemyDebug: snaps }),
  toggleEnemyDebug: () => set({ showEnemyDebug: !get().showEnemyDebug }),
  setShowEnemyDebug: (v) => set({ showEnemyDebug: v }),
}));
