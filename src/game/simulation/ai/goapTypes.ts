import type { SimulationState, Unit, Vec3 } from '../../types';

/**
 * Booleanized world-state facts the GOAP layer reasons about. Kept small and
 * coarse on purpose — the planner runs forward-search over this space, so every
 * extra fact roughly doubles the search frontier.
 */
export interface WorldState {
  hasVisibleEnemy: boolean;
  hasAmmo: boolean;
  hasCoverNearby: boolean;
  isInCover: boolean;
  isSuppressed: boolean;
  moraleLow: boolean;
  moraleBroken: boolean;
  objectiveNearby: boolean;
  objectiveControlledByEnemy: boolean;
  supplyAvailable: boolean;
  healthLow: boolean;
  enemyThreatHigh: boolean;
  canFlank: boolean;
  hasLineOfSight: boolean;
}

export type WorldStateGoal = Partial<WorldState>;

/** Commands the squad brain issues to individual units (executed by the FSM). */
export type UnitCommand =
  | { kind: 'idle' }
  | { kind: 'hold'; position?: Vec3 }
  | { kind: 'moveTo'; destination: Vec3 }
  | { kind: 'takeCover'; destination: Vec3; coverId: string }
  | { kind: 'attack'; targetId: string; allowAdvance: boolean }
  | { kind: 'suppress'; targetId: string }
  | { kind: 'retreat'; destination: Vec3 }
  | { kind: 'regroup'; destination: Vec3 };

/** A cover slot somewhere on the map, scored for desirability. */
export interface CoverSlot {
  id: string;
  position: Vec3;
  /** 0..1 — higher = better protection. */
  quality: number;
  /** Unit id currently occupying this slot, if any. */
  occupiedBy: string | null;
}

export interface EnemySquadState {
  id: string;
  unitIds: string[];
  /** Whose objective the squad is currently working toward. */
  objectiveId: string | null;
  /** Position the squad falls back to when broken or out of plans. */
  fallbackPoint: Vec3;
  /** Optional supply depot; supplyAvailable depends on its existence + distance. */
  supplyPoint: Vec3 | null;
  /** 0..100 — drops on casualties / suppression, recovers in cover / near allies. */
  morale: number;
  /** Magazine pool shared by the whole squad. */
  ammo: number;
  ammoMax: number;
  /** Set by FindCover; consumed by MoveToCover. */
  selectedCoverByUnit: Record<string, CoverSlot | null>;
  /** Set by FlankTarget; the chosen flank waypoint per unit. */
  flankWaypointByUnit: Record<string, Vec3 | null>;
  /** Last assigned per-unit command, kept around for the FSM to re-execute. */
  unitCommands: Record<string, UnitCommand>;
  /** Sim timestamp of last weapon fire we counted (for ammo accounting). */
  lastFireSeenAt: Record<string, number>;
  /** Sim timestamp until which SuppressTarget keeps firing. */
  suppressUntil: number;
}

export interface SquadContext {
  state: SimulationState;
  squad: EnemySquadState;
  world: WorldState;
  /** Current sim time, copied here so actions don't re-read state.time everywhere. */
  time: number;
  /** Friendly (player) units that are alive, cached at context build time. */
  enemies: Unit[];
  /** Squad members that are alive, cached at context build time. */
  members: Unit[];
  /** Average squad position. */
  center: Vec3;
  /** Best engageable enemy (visible, in range or near-range). */
  preferredTarget: Unit | null;
  /** All cover slots near the squad, sorted by descending quality. */
  nearbyCover: CoverSlot[];
}

export type ActionStatus = 'running' | 'success' | 'failure';

export interface GoapAction {
  id: string;
  /** Base cost; planner may add a dynamic component. */
  baseCost: number;
  preconditions: WorldStateGoal;
  effects: WorldStateGoal;
  /** Optional state-aware cost adjustment used while searching the plan space. */
  dynamicCost?: (state: WorldState) => number;
  /** Cheap context-dependent veto used to skip wholly inapplicable actions. */
  isValid?: (ctx: SquadContext) => boolean;
  /** Called when this action becomes current. Returns failure if it can't even start. */
  start?: (ctx: SquadContext) => ActionStatus;
  /** Called every tick while running. */
  tick: (ctx: SquadContext, dt: number) => ActionStatus;
  /** Called when leaving the action (success, failure, or replan). */
  stop?: (ctx: SquadContext) => void;
}

export interface GoapGoal {
  id: string;
  basePriority: number;
  /** Cheap check: is this goal even applicable right now? */
  isRelevant: (ctx: SquadContext) => boolean;
  /** What world-state facts the planner is trying to achieve. */
  desiredState: WorldStateGoal;
  /** Optional dynamic priority offset used to pick between two relevant goals. */
  priorityBonus?: (ctx: SquadContext) => number;
  /** True once this goal has been fully satisfied — drops the goal. */
  isSuccess?: (ctx: SquadContext) => boolean;
  /** True if the goal must be abandoned (e.g. squad wiped). */
  isFailure?: (ctx: SquadContext) => boolean;
}

export interface SquadDebugSnapshot {
  squadId: string;
  morale: number;
  ammo: number;
  ammoMax: number;
  goalId: string | null;
  planActionIds: string[];
  currentActionId: string | null;
  worldState: WorldState;
  preferredTargetName: string | null;
  lastReplanReason: string | null;
  failedPreconditions: string[];
  members: Array<{ id: string; name: string; fsmState: string; isDestroyed: boolean }>;
}

/** Returned by the planner — null means "no plan exists, fall back." */
export interface GoapPlanResult {
  goal: GoapGoal;
  actions: GoapAction[];
  cost: number;
  /** Trace of preconditions that prevented any candidate plan from being built. */
  failedPreconditions: string[];
}
