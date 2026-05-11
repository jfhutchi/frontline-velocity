import type { SimulationState, Unit, Vec3 } from '../../../types';
import { SQUAD_ACTIONS } from '../goapActions';
import { pickRelevantGoals } from '../goapGoals';
import { planForGoal } from '../goapPlanner';
import type { CoverSlot, GoapAction, GoapPlanResult, SquadContext, WorldState } from '../goapTypes';

/**
 * Deterministic scenario tests for the squad GOAP planner.
 *
 * These tests do NOT require Babylon or the rendering layer — they fabricate a
 * SquadContext directly so the planner's decisions can be verified in
 * isolation. Each scenario asserts which action chain GOAP should select for
 * a given world-state, satisfying the seven behaviors in the v1 spec.
 *
 * Run from devtools:
 *   window.run_enemy_tactics_scenarios()
 */

export interface ScenarioResult {
  name: string;
  passed: boolean;
  detail: string;
  goalId: string | null;
  plan: string[];
}

function baseWorld(overrides: Partial<WorldState> = {}): WorldState {
  return {
    hasVisibleEnemy: false,
    hasAmmo: true,
    hasCoverNearby: false,
    isInCover: false,
    isSuppressed: false,
    moraleLow: false,
    moraleBroken: false,
    objectiveNearby: false,
    objectiveControlledByEnemy: true,
    supplyAvailable: false,
    healthLow: false,
    enemyThreatHigh: false,
    canFlank: false,
    hasLineOfSight: false,
    ...overrides,
  };
}

function dummyUnit(id: string, faction: 'friendly' | 'enemy', x = 0, z = 0): Unit {
  return {
    id,
    name: `${faction}-${id}`,
    faction,
    type: 'infantry',
    position: { x, y: 0, z },
    rotation: 0,
    turretRotation: 0,
    health: 35,
    maxHealth: 35,
    armor: 0,
    speed: 3,
    weapon: {
      name: 'Test',
      damage: 5,
      range: 22,
      reloadSeconds: 0.8,
      projectileSpeed: 60,
      lastFiredAt: -999,
    },
    currentOrder: { kind: 'idle' },
    targetId: null,
    isDestroyed: false,
    isPlayerControllable: false,
    radius: 0.8,
    currentSpeed: 0,
    aiState: 'idle',
    aiHome: { x, y: 0, z },
    aiLeashRadius: 12,
    aiNextThinkAt: 0,
    targetLockedUntil: 0,
  };
}

function buildCtx(opts: {
  world: WorldState;
  hasTarget?: boolean;
  coverSlots?: CoverSlot[];
  supplyPoint?: Vec3 | null;
}): SquadContext {
  const member = dummyUnit('m1', 'enemy', 0, 0);
  const player = dummyUnit('p1', 'friendly', 18, 0);
  const fakeSim = {
    time: 1,
    objective: {
      id: 'obj',
      name: 'objective',
      position: { x: 0, y: 0, z: 30 },
      radius: 6,
      requiredHoldSeconds: 30,
      heldSeconds: 0,
      captured: false,
      occupiedByFriendly: false,
      contested: false,
    },
    mission: { decorations: [] },
  } as unknown as SimulationState;
  return {
    state: fakeSim,
    squad: {
      id: 'scenario',
      unitIds: ['m1'],
      objectiveId: 'obj',
      fallbackPoint: { x: 0, y: 0, z: -40 },
      supplyPoint: opts.supplyPoint === undefined ? { x: 0, y: 0, z: -90 } : opts.supplyPoint,
      morale: 80,
      ammo: opts.world.hasAmmo ? 30 : 0,
      ammoMax: 60,
      selectedCoverByUnit: {},
      flankWaypointByUnit: {},
      unitCommands: {},
      lastFireSeenAt: {},
      suppressUntil: 0,
    },
    world: opts.world,
    time: 1,
    enemies: opts.hasTarget ? [player] : [],
    members: [member],
    center: { ...member.position },
    preferredTarget: opts.hasTarget ? player : null,
    nearbyCover: opts.coverSlots ?? [],
  };
}

function planFirstRelevant(ctx: SquadContext): GoapPlanResult | null {
  const goals = pickRelevantGoals(ctx);
  for (const goal of goals) {
    const plan = planForGoal(ctx, goal, SQUAD_ACTIONS);
    if (plan) return plan;
  }
  return null;
}

function planIds(plan: GoapPlanResult | null): string[] {
  return plan ? plan.actions.map((a: GoapAction) => a.id) : [];
}

function makeCover(id: string, x: number, z: number, quality = 0.8): CoverSlot {
  return { id, position: { x, y: 0, z }, quality, occupiedBy: null };
}

// -------- individual scenarios ----------------------------------------------

function scenarioAttacksWhenAmmoAndLOS(): ScenarioResult {
  const ctx = buildCtx({
    world: baseWorld({ hasVisibleEnemy: true, hasAmmo: true, hasLineOfSight: true }),
    hasTarget: true,
  });
  const plan = planFirstRelevant(ctx);
  const ids = planIds(plan);
  const passed = plan?.goal.id === 'AttackVisibleEnemy' && ids[0] === 'AttackTarget';
  return {
    name: 'enemy attacks when it has ammo and line of sight',
    passed,
    detail: passed ? 'planned AttackTarget directly' : `unexpected plan: ${ids.join(' -> ')}`,
    goalId: plan?.goal.id ?? null,
    plan: ids,
  };
}

function scenarioMovesToCoverWhenExposed(): ScenarioResult {
  const cover = [makeCover('c1', -2, 0)];
  const ctx = buildCtx({
    world: baseWorld({
      hasVisibleEnemy: true,
      enemyThreatHigh: true,
      hasCoverNearby: true,
      isInCover: false,
      hasAmmo: true,
      hasLineOfSight: true,
    }),
    hasTarget: true,
    coverSlots: cover,
  });
  const plan = planFirstRelevant(ctx);
  const ids = planIds(plan);
  const passed = plan?.goal.id === 'Survive' && ids.includes('MoveToCover');
  return {
    name: 'enemy moves to cover when exposed and under threat',
    passed,
    detail: passed
      ? `planned ${ids.join(' -> ')} for Survive`
      : `expected Survive→MoveToCover, got ${plan?.goal.id ?? 'no goal'}: ${ids.join(' -> ')}`,
    goalId: plan?.goal.id ?? null,
    plan: ids,
  };
}

function scenarioResuppliesBeforeAttackingWhenAmmoEmpty(): ScenarioResult {
  const ctx = buildCtx({
    world: baseWorld({
      hasVisibleEnemy: true,
      hasAmmo: false,
      hasLineOfSight: true,
    }),
    hasTarget: true,
  });
  const plan = planFirstRelevant(ctx);
  const ids = planIds(plan);
  // Resupply goal should fire first; plan should at least contain ResupplyAtDepot.
  const passed = plan?.goal.id === 'Resupply' && ids.includes('ResupplyAtDepot');
  return {
    name: 'enemy resupplies before attacking when ammo is empty',
    passed,
    detail: passed
      ? `planned ${ids.join(' -> ')} for Resupply`
      : `expected Resupply chain, got ${plan?.goal.id ?? 'no goal'}: ${ids.join(' -> ')}`,
    goalId: plan?.goal.id ?? null,
    plan: ids,
  };
}

function scenarioRetreatsWhenMoraleBroken(): ScenarioResult {
  const ctx = buildCtx({
    world: baseWorld({
      hasVisibleEnemy: true,
      moraleBroken: true,
      moraleLow: true,
      hasAmmo: true,
    }),
    hasTarget: true,
  });
  const plan = planFirstRelevant(ctx);
  const ids = planIds(plan);
  const passed = plan?.goal.id === 'RetreatWhenMoraleBroken' && ids[0] === 'RetreatToFallbackPoint';
  return {
    name: 'enemy retreats when morale is broken',
    passed,
    detail: passed
      ? 'planned RetreatToFallbackPoint'
      : `unexpected plan for broken morale: ${plan?.goal.id ?? 'no goal'}: ${ids.join(' -> ')}`,
    goalId: plan?.goal.id ?? null,
    plan: ids,
  };
}

function scenarioCapturesObjectiveWhenThreatLow(): ScenarioResult {
  const ctx = buildCtx({
    world: baseWorld({
      hasVisibleEnemy: false,
      hasAmmo: true,
      enemyThreatHigh: false,
      objectiveNearby: false,
      objectiveControlledByEnemy: false,
    }),
  });
  const plan = planFirstRelevant(ctx);
  const ids = planIds(plan);
  const passed = plan?.goal.id === 'CaptureObjective' && ids.includes('MoveToObjective');
  return {
    name: 'enemy captures objective when threat is low',
    passed,
    detail: passed
      ? `planned ${ids.join(' -> ')}`
      : `unexpected plan: ${plan?.goal.id ?? 'no goal'}: ${ids.join(' -> ')}`,
    goalId: plan?.goal.id ?? null,
    plan: ids,
  };
}

function scenarioSuppressesBeforeFlankingWhenThreatHigh(): ScenarioResult {
  const ctx = buildCtx({
    world: baseWorld({
      hasVisibleEnemy: true,
      hasAmmo: true,
      hasLineOfSight: true,
      enemyThreatHigh: true,
      canFlank: true,
      hasCoverNearby: true,
    }),
    hasTarget: true,
    coverSlots: [makeCover('cf1', 6, -4)],
  });
  const plan = planFirstRelevant(ctx);
  const ids = planIds(plan);
  const passed =
    plan?.goal.id === 'AttackVisibleEnemy' &&
    ids.indexOf('SuppressTarget') >= 0 &&
    ids.indexOf('FlankTarget') > ids.indexOf('SuppressTarget') &&
    ids[ids.length - 1] === 'AttackTarget';
  return {
    name: 'enemy suppresses before flanking when threat is high',
    passed,
    detail: passed
      ? `planned ${ids.join(' -> ')}`
      : `expected Suppress→Flank→Attack, got ${plan?.goal.id ?? 'no goal'}: ${ids.join(' -> ')}`,
    goalId: plan?.goal.id ?? null,
    plan: ids,
  };
}

function scenarioFallsBackWhenNoPlan(): ScenarioResult {
  // No visible enemy, no cover, no objective interest, no morale concerns — no
  // relevant goal will be selected, so the planner should return null and the
  // squad falls back to defensive hold.
  const ctx = buildCtx({
    world: baseWorld({
      hasVisibleEnemy: false,
      hasAmmo: true,
      objectiveControlledByEnemy: true,
    }),
  });
  const plan = planFirstRelevant(ctx);
  const passed = plan === null;
  return {
    name: 'enemy falls back safely when no valid plan exists',
    passed,
    detail: passed
      ? 'planner returned null → defensive hold fallback'
      : `expected null, got ${plan?.goal.id ?? 'no goal'}: ${planIds(plan).join(' -> ')}`,
    goalId: plan?.goal.id ?? null,
    plan: planIds(plan),
  };
}

export function runEnemyTacticsScenarios(): ScenarioResult[] {
  return [
    scenarioAttacksWhenAmmoAndLOS(),
    scenarioMovesToCoverWhenExposed(),
    scenarioResuppliesBeforeAttackingWhenAmmoEmpty(),
    scenarioRetreatsWhenMoraleBroken(),
    scenarioCapturesObjectiveWhenThreatLow(),
    scenarioSuppressesBeforeFlankingWhenThreatHigh(),
    scenarioFallsBackWhenNoPlan(),
  ];
}

declare global {
  interface Window {
    run_enemy_tactics_scenarios?: () => ScenarioResult[];
  }
}

export function installScenarioTestHook() {
  if (typeof window === 'undefined') return;
  window.run_enemy_tactics_scenarios = () => {
    const results = runEnemyTacticsScenarios();
    const passed = results.filter((r) => r.passed).length;
    // eslint-disable-next-line no-console
    console.table(results.map((r) => ({ scenario: r.name, passed: r.passed, plan: r.plan.join(' -> ') })));
    // eslint-disable-next-line no-console
    console.log(`${passed}/${results.length} scenarios passed`);
    return results;
  };
}
