import type { SimulationState, Unit, Vec3 } from '../../types';
import { v3 } from '../math';
import { hasLineOfSight } from '../systems/PathfindingSystem';
import type { CoverProvider } from './coverProvider';
import { MORALE_BROKEN_THRESHOLD, MORALE_LOW_THRESHOLD, MoraleTracker } from './morale';
import { SQUAD_ACTIONS } from './goapActions';
import { pickRelevantGoals } from './goapGoals';
import { planForGoal } from './goapPlanner';
import { EnemyUnitController } from './EnemyUnitController';
import type {
  ActionStatus,
  EnemySquadState,
  GoapAction,
  GoapGoal,
  GoapPlanResult,
  SquadContext,
  SquadDebugSnapshot,
  UnitCommand,
  WorldState,
} from './goapTypes';

const REPLAN_MIN_INTERVAL = 0.6;
const SQUAD_LOS_CLEARANCE = 0.6;
const NEARBY_THREAT_RADIUS = 60;
const HEALTH_LOW_FRACTION = 0.55;
const OBJECTIVE_NEAR_RADIUS = 22;
const SUPPLY_PROXIMITY = 8;
const SUPPRESSED_WINDOW = 1.5;
const FLANK_LATERAL_OFFSET = 12;

export interface SquadBrainConfig {
  squadId: string;
  unitIds: string[];
  objectiveId: string | null;
  fallbackPoint: Vec3;
  supplyPoint?: Vec3 | null;
  ammoMax?: number;
  startingMorale?: number;
}

/**
 * Squad-level GOAP brain.
 *
 * One brain instance owns a single enemy squad. Each tick it:
 *   1. Computes the boolean world-state facts from the simulation.
 *   2. If something interesting changed (or the previous action finished /
 *      failed), it picks a relevant goal and runs the planner to produce an
 *      ordered action chain.
 *   3. Ticks the current action, which writes `UnitCommand`s into the squad.
 *   4. Each unit's FSM applies its command to the underlying `Unit` fields the
 *      MovementSystem / CombatSystem consume.
 *
 * GOAP intentionally does NOT run every frame and does NOT run per unit.
 */
export class EnemySquadGOAPBrain {
  readonly squad: EnemySquadState;
  private cover: CoverProvider;
  private morale = new MoraleTracker();
  private controllers = new Map<string, EnemyUnitController>();
  private currentPlan: GoapAction[] = [];
  private currentActionIndex = 0;
  private currentGoal: GoapGoal | null = null;
  private replanCooldown = 0;
  private lastReplanReason: string | null = null;
  private lastWorld: WorldState | null = null;
  private lastFailedPreconditions: string[] = [];
  private lastDebug: SquadDebugSnapshot | null = null;

  constructor(cfg: SquadBrainConfig, cover: CoverProvider) {
    this.cover = cover;
    this.squad = {
      id: cfg.squadId,
      unitIds: [...cfg.unitIds],
      objectiveId: cfg.objectiveId,
      fallbackPoint: { ...cfg.fallbackPoint },
      supplyPoint: cfg.supplyPoint ? { ...cfg.supplyPoint } : null,
      morale: cfg.startingMorale ?? 80,
      ammo: cfg.ammoMax ?? 60,
      ammoMax: cfg.ammoMax ?? 60,
      selectedCoverByUnit: {},
      flankWaypointByUnit: {},
      unitCommands: {},
      lastFireSeenAt: {},
      suppressUntil: 0,
    };
  }

  /** Should be called once when the brain is attached to a SimulationState. */
  attach(state: SimulationState) {
    for (const id of this.squad.unitIds) {
      const u = state.units.get(id);
      if (!u) continue;
      u.aiManagedExternally = true;
      this.controllers.set(id, new EnemyUnitController(id));
      this.squad.lastFireSeenAt[id] = u.weapon.lastFiredAt;
    }
    this.morale.reset(this.aliveMembers(state));
  }

  /** Called when the simulation is reset; releases units before the state is replaced. */
  detach(state: SimulationState) {
    for (const ctrl of this.controllers.values()) ctrl.releaseUnit(state);
    this.controllers.clear();
  }

  /** Main tick — called every simulation step. */
  update(state: SimulationState, dt: number) {
    this.replanCooldown = Math.max(0, this.replanCooldown - dt);
    this.accountAmmo(state);
    const ctx = this.buildContext(state);
    this.morale.update(this.squad, ctx.members, this.coverFraction(ctx), dt, state.time);
    // Refresh world-state with morale-derived flags.
    ctx.world.moraleLow = this.squad.morale <= MORALE_LOW_THRESHOLD;
    ctx.world.moraleBroken = this.squad.morale <= MORALE_BROKEN_THRESHOLD;

    this.maybeReplan(ctx);

    if (this.currentPlan.length === 0) {
      // No valid plan — defensive fallback: hold at fallback point.
      for (const u of ctx.members) {
        this.squad.unitCommands[u.id] = { kind: 'hold', position: this.squad.fallbackPoint };
      }
    } else {
      this.tickCurrentAction(ctx);
    }

    // Apply each unit's command via the FSM. Squad members that died this
    // frame are routed to their controller too so they transition into Dead.
    for (const id of this.squad.unitIds) {
      const ctrl = this.controllers.get(id);
      if (!ctrl) continue;
      ctrl.tick(state, this.squad.unitCommands[id]);
    }

    this.lastDebug = this.snapshotDebug(ctx);
    this.lastWorld = ctx.world;
  }

  getDebugSnapshot(): SquadDebugSnapshot | null {
    return this.lastDebug;
  }

  /** Returns the active goal id, or null if no plan is running. */
  getActiveGoalId(): string | null {
    return this.currentGoal?.id ?? null;
  }

  // -------- planning ---------------------------------------------------------

  /** Force a replan on the next update. Used by external triggers (commander, tests). */
  requestReplan(reason: string) {
    this.replanCooldown = 0;
    this.lastReplanReason = reason;
    this.currentPlan = [];
    this.currentActionIndex = 0;
  }

  private maybeReplan(ctx: SquadContext) {
    const reasons = this.detectReplanReasons(ctx);
    const shouldReplan = this.currentPlan.length === 0 || reasons.length > 0;
    if (!shouldReplan) return;
    if (this.replanCooldown > 0 && this.currentPlan.length > 0) return;

    this.lastReplanReason = reasons[0] ?? this.lastReplanReason ?? 'initial';
    this.runPlanner(ctx);
    this.replanCooldown = REPLAN_MIN_INTERVAL;
  }

  private detectReplanReasons(ctx: SquadContext): string[] {
    const reasons: string[] = [];
    const prev = this.lastWorld;
    const next = ctx.world;
    if (!prev) {
      reasons.push('initial plan');
      return reasons;
    }
    if (prev.hasAmmo && !next.hasAmmo) reasons.push('squad out of ammo');
    if (prev.hasLineOfSight && !next.hasLineOfSight) reasons.push('lost line of sight');
    if (prev.moraleBroken !== next.moraleBroken) reasons.push('morale broken changed');
    if (prev.moraleLow !== next.moraleLow) reasons.push('morale low changed');
    if (prev.objectiveControlledByEnemy !== next.objectiveControlledByEnemy) {
      reasons.push('objective ownership changed');
    }
    if (prev.healthLow !== next.healthLow) reasons.push('heavy casualties / health low');
    if (prev.hasVisibleEnemy && !next.hasVisibleEnemy) reasons.push('lost visual on enemy');
    return reasons;
  }

  private runPlanner(ctx: SquadContext) {
    const goals = pickRelevantGoals(ctx);
    let chosen: GoapPlanResult | null = null;
    let failedPreconditions: string[] = [];
    for (const goal of goals) {
      const plan = planForGoal(ctx, goal, SQUAD_ACTIONS);
      if (plan) {
        chosen = plan;
        break;
      }
      // Track first goal's failure trace for the debug overlay.
      if (!failedPreconditions.length) {
        failedPreconditions = [`goal=${goal.id} unreachable`];
      }
    }
    if (!chosen) {
      this.currentPlan = [];
      this.currentActionIndex = 0;
      this.currentGoal = null;
      this.lastFailedPreconditions = failedPreconditions.length
        ? failedPreconditions
        : ['no relevant goals'];
      return;
    }
    this.currentPlan = chosen.actions;
    this.currentActionIndex = 0;
    this.currentGoal = chosen.goal;
    this.lastFailedPreconditions = chosen.failedPreconditions;
    const first = this.currentPlan[0];
    if (first?.start) {
      const status = first.start(ctx);
      if (status === 'failure') this.advanceOrFail(ctx, 'start failed: ' + first.id);
    }
  }

  private tickCurrentAction(ctx: SquadContext) {
    const action = this.currentPlan[this.currentActionIndex];
    if (!action) return;
    if (!ctx.members.length) return; // squad wiped
    const status: ActionStatus = action.tick(ctx, 1 / 60);
    if (status === 'running') return;
    action.stop?.(ctx);
    if (status === 'success') {
      this.currentActionIndex += 1;
      if (this.currentActionIndex >= this.currentPlan.length) {
        // Plan complete — drop it so the next update picks a new goal.
        this.currentPlan = [];
        this.currentGoal = null;
        this.lastReplanReason = 'plan completed';
      } else {
        const next = this.currentPlan[this.currentActionIndex];
        if (next.start) {
          const startStatus = next.start(ctx);
          if (startStatus === 'failure') this.advanceOrFail(ctx, 'start failed: ' + next.id);
        }
      }
    } else {
      this.advanceOrFail(ctx, `action failed: ${action.id}`);
    }
  }

  private advanceOrFail(_ctx: SquadContext, reason: string) {
    this.currentPlan = [];
    this.currentActionIndex = 0;
    this.currentGoal = null;
    this.lastReplanReason = reason;
  }

  // -------- world-state computation ------------------------------------------

  private buildContext(state: SimulationState): SquadContext {
    const members = this.aliveMembers(state);
    const center = this.averagePosition(members);
    const enemies = [...state.units.values()].filter((u) => u.faction === 'friendly' && !u.isDestroyed);
    const preferredTarget = this.pickTarget(state, members, enemies);
    const threatOrigin = preferredTarget?.position ?? null;
    const nearbyCover = this.cover.nearby(
      center,
      threatOrigin,
      new Set(members.map((u) => u.id)),
    );
    const world = this.computeWorldState(state, members, enemies, preferredTarget, nearbyCover.length > 0);
    return {
      state,
      squad: this.squad,
      world,
      time: state.time,
      enemies,
      members,
      center,
      preferredTarget,
      nearbyCover,
    };
  }

  private aliveMembers(state: SimulationState): Unit[] {
    const out: Unit[] = [];
    for (const id of this.squad.unitIds) {
      const u = state.units.get(id);
      if (u && !u.isDestroyed) out.push(u);
    }
    return out;
  }

  private averagePosition(members: Unit[]): Vec3 {
    if (!members.length) return { ...this.squad.fallbackPoint };
    let x = 0;
    let z = 0;
    for (const u of members) {
      x += u.position.x;
      z += u.position.z;
    }
    return { x: x / members.length, y: 0, z: z / members.length };
  }

  private pickTarget(state: SimulationState, members: Unit[], enemies: Unit[]): Unit | null {
    let best: Unit | null = null;
    let bestScore = Infinity;
    for (const enemy of enemies) {
      let visible = false;
      let minDist = Infinity;
      for (const m of members) {
        const d = v3.distanceXZ(m.position, enemy.position);
        if (d < minDist) minDist = d;
        if (d <= m.weapon.range + 12 && hasLineOfSight(state, m.position, enemy.position, SQUAD_LOS_CLEARANCE)) {
          visible = true;
        }
      }
      if (!visible) continue;
      const score = minDist + (enemy.type === 'reconJeep' ? -6 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  private computeWorldState(
    state: SimulationState,
    members: Unit[],
    enemies: Unit[],
    target: Unit | null,
    coverNearby: boolean,
  ): WorldState {
    const hasAmmo = this.squad.ammo > 0;
    const aggregateHealth = members.length
      ? members.reduce((s, u) => s + u.health / u.maxHealth, 0) / members.length
      : 0;
    const healthLow = members.length > 0 && aggregateHealth < HEALTH_LOW_FRACTION;
    const inCoverFraction = members.length
      ? members.filter((u) => this.cover.isUnitInCover(u)).length / members.length
      : 0;
    const isInCover = inCoverFraction >= 0.6;
    const isSuppressed = members.some(
      (u) => u.lastDamagedAt !== undefined && state.time - u.lastDamagedAt < SUPPRESSED_WINDOW,
    );
    const nearbyEnemies = enemies.filter(
      (e) => v3.distanceXZ(e.position, this.averagePosition(members)) < NEARBY_THREAT_RADIUS,
    );
    const enemyThreatHigh =
      nearbyEnemies.length >= Math.max(2, members.length) ||
      nearbyEnemies.some((e) => e.type === 'mediumTank' || e.type === 'lightTank');
    const objectiveNearby = state.objective
      ? v3.distanceXZ(this.averagePosition(members), state.objective.position) < OBJECTIVE_NEAR_RADIUS
      : false;
    const objectiveControlledByEnemy = state.objective
      ? !state.objective.occupiedByFriendly && state.objective.heldSeconds <= 0.01 && objectiveNearby
      : false;
    const supplyAvailable =
      this.squad.supplyPoint !== null &&
      v3.distanceXZ(this.averagePosition(members), this.squad.supplyPoint) < SUPPLY_PROXIMITY;
    const hasLineOfSightToTarget = target
      ? members.some((m) => hasLineOfSight(state, m.position, target.position, SQUAD_LOS_CLEARANCE))
      : false;
    const canFlank = target ? this.computeCanFlank(state, members, target, coverNearby) : false;
    return {
      hasVisibleEnemy: target !== null,
      hasAmmo,
      hasCoverNearby: coverNearby,
      isInCover,
      isSuppressed,
      moraleLow: this.squad.morale <= MORALE_LOW_THRESHOLD,
      moraleBroken: this.squad.morale <= MORALE_BROKEN_THRESHOLD,
      objectiveNearby,
      objectiveControlledByEnemy,
      supplyAvailable,
      healthLow,
      enemyThreatHigh,
      canFlank,
      hasLineOfSight: hasLineOfSightToTarget,
    };
  }

  private computeCanFlank(state: SimulationState, members: Unit[], target: Unit, coverNearby: boolean): boolean {
    if (!coverNearby || !members.length) return false;
    const center = this.averagePosition(members);
    const dir = v3.normalizeXZ(v3.sub(target.position, center));
    const perp = { x: -dir.z, y: 0, z: dir.x };
    const flankCandidate: Vec3 = {
      x: target.position.x + perp.x * FLANK_LATERAL_OFFSET,
      y: 0,
      z: target.position.z + perp.z * FLANK_LATERAL_OFFSET,
    };
    return hasLineOfSight(state, flankCandidate, target.position, SQUAD_LOS_CLEARANCE);
  }

  private coverFraction(ctx: SquadContext): number {
    if (!ctx.members.length) return 0;
    return ctx.members.filter((u) => this.cover.isUnitInCover(u)).length / ctx.members.length;
  }

  // -------- ammo accounting --------------------------------------------------

  private accountAmmo(state: SimulationState) {
    for (const id of this.squad.unitIds) {
      const u = state.units.get(id);
      if (!u) continue;
      const last = this.squad.lastFireSeenAt[id] ?? u.weapon.lastFiredAt;
      if (u.weapon.lastFiredAt > last + 1e-3) {
        this.squad.ammo = Math.max(0, this.squad.ammo - 1);
        this.squad.lastFireSeenAt[id] = u.weapon.lastFiredAt;
      }
    }
  }

  // -------- debug ------------------------------------------------------------

  private snapshotDebug(ctx: SquadContext): SquadDebugSnapshot {
    const currentAction = this.currentPlan[this.currentActionIndex];
    return {
      squadId: this.squad.id,
      morale: Math.round(this.squad.morale),
      ammo: this.squad.ammo,
      ammoMax: this.squad.ammoMax,
      goalId: this.currentGoal?.id ?? null,
      planActionIds: this.currentPlan.map((a) => a.id),
      currentActionId: currentAction?.id ?? null,
      worldState: ctx.world,
      preferredTargetName: ctx.preferredTarget?.name ?? null,
      lastReplanReason: this.lastReplanReason,
      failedPreconditions: this.lastFailedPreconditions,
      members: ctx.members.map((u) => {
        const ctrl = this.controllers.get(u.id);
        return {
          id: u.id,
          name: u.name,
          fsmState: ctrl?.state ?? 'Idle',
          isDestroyed: u.isDestroyed,
        };
      }),
    };
  }

  // Test/inspection helpers — kept narrow on purpose.
  /** Forces the squad's world-state for deterministic unit tests. */
  _testForceWorld(world: WorldState) {
    this.lastWorld = world;
  }
  /** Test helper: re-run the planner against a fabricated context. */
  _testRunPlanner(ctx: SquadContext): GoapPlanResult | null {
    const goals = pickRelevantGoals(ctx);
    for (const goal of goals) {
      const plan = planForGoal(ctx, goal, SQUAD_ACTIONS);
      if (plan) return plan;
    }
    return null;
  }
  /** Test helper: hand-set the squad's last-known unit commands. */
  _testReadUnitCommand(unitId: string): UnitCommand | undefined {
    return this.squad.unitCommands[unitId];
  }
}
