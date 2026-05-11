import type { GoapGoal, SquadContext } from './goapTypes';

/**
 * Goals are evaluated in priority order each replan. The first relevant goal
 * the planner can build a plan for becomes the squad's active goal.
 */
export const SQUAD_GOALS: GoapGoal[] = [
  {
    id: 'Survive',
    basePriority: 90,
    isRelevant: (ctx) =>
      (ctx.world.healthLow || ctx.world.isSuppressed || ctx.world.enemyThreatHigh) &&
      !ctx.world.moraleBroken,
    desiredState: { isInCover: true, isSuppressed: false },
    priorityBonus: (ctx) => (ctx.world.healthLow ? 10 : 0),
  },
  {
    id: 'RetreatWhenMoraleBroken',
    basePriority: 120,
    isRelevant: (ctx) => ctx.world.moraleBroken,
    desiredState: { hasVisibleEnemy: false, isSuppressed: false },
  },
  {
    id: 'Resupply',
    basePriority: 80,
    isRelevant: (ctx) => !ctx.world.hasAmmo,
    desiredState: { hasAmmo: true },
  },
  {
    id: 'AttackVisibleEnemy',
    basePriority: 70,
    isRelevant: (ctx) => ctx.world.hasVisibleEnemy && !ctx.world.moraleBroken,
    desiredState: { hasVisibleEnemy: false },
    priorityBonus: (ctx) => (ctx.world.hasLineOfSight && ctx.world.hasAmmo ? 8 : 0),
  },
  {
    id: 'MoveToCover',
    basePriority: 50,
    isRelevant: (ctx) => !ctx.world.isInCover && ctx.world.hasCoverNearby,
    desiredState: { isInCover: true },
  },
  {
    id: 'CaptureObjective',
    basePriority: 60,
    isRelevant: (ctx) =>
      !ctx.world.objectiveControlledByEnemy &&
      !ctx.world.enemyThreatHigh &&
      !ctx.world.moraleBroken,
    desiredState: { objectiveControlledByEnemy: true },
    priorityBonus: (ctx) => (ctx.world.objectiveNearby ? 6 : 0),
  },
];

export function pickRelevantGoals(ctx: SquadContext): GoapGoal[] {
  return SQUAD_GOALS.filter((g) => g.isRelevant(ctx)).sort((a, b) => {
    const pa = a.basePriority + (a.priorityBonus?.(ctx) ?? 0);
    const pb = b.basePriority + (b.priorityBonus?.(ctx) ?? 0);
    return pb - pa;
  });
}
