import { create } from 'zustand';
import type { GameMode, ObjectiveZone } from '../types';
import type { SpeedLevel } from '../constants';
import { SPEED_LEVELS } from '../constants';

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
  isDestroyed: boolean;
  isPlayerControllable: boolean;
}

export interface GameStoreState {
  screen: GameMode;
  paused: boolean;
  speedLevel: SpeedLevel;
  /** Multiplier for the simulation (0 when paused). */
  speedMultiplier: number;

  selectedUnitId: string | null;
  controlledUnitId: string | null;

  unitSummaries: UnitSummary[];
  objective: ObjectiveZone | null;
  result: null | 'victory' | 'defeat';

  /** Counter incremented when player takes damage to flash the screen. */
  damageFlashTick: number;

  // ----- actions -----
  goToBriefing: () => void;
  startMission: () => void;
  returnToMenu: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  setSpeedLevel: (level: SpeedLevel) => void;
  setSelectedUnitId: (id: string | null) => void;
  setControlledUnitId: (id: string | null) => void;
  setUnitSummaries: (s: UnitSummary[]) => void;
  setObjective: (o: ObjectiveZone) => void;
  enterDirectControl: () => void;
  exitDirectControl: () => void;
  setResult: (r: 'victory' | 'defeat') => void;
  flashDamage: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: 'menu',
  paused: false,
  speedLevel: 'normal',
  speedMultiplier: SPEED_LEVELS.normal,

  selectedUnitId: null,
  controlledUnitId: null,

  unitSummaries: [],
  objective: null,
  result: null,
  damageFlashTick: 0,

  goToBriefing: () => set({ screen: 'briefing' }),

  startMission: () =>
    set({
      screen: 'tactical',
      paused: false,
      result: null,
      controlledUnitId: null,
      selectedUnitId: null,
      speedLevel: 'normal',
      speedMultiplier: SPEED_LEVELS.normal,
    }),

  returnToMenu: () =>
    set({
      screen: 'menu',
      paused: false,
      result: null,
      selectedUnitId: null,
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

  setSelectedUnitId: (id) => set({ selectedUnitId: id }),
  setControlledUnitId: (id) => set({ controlledUnitId: id }),
  setUnitSummaries: (s) => set({ unitSummaries: s }),
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
}));
