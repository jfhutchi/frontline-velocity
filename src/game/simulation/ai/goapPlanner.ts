import type {
  GoapAction,
  GoapGoal,
  GoapPlanResult,
  SquadContext,
  WorldState,
  WorldStateGoal,
} from './goapTypes';

const MAX_PLAN_DEPTH = 5;

/**
 * Forward-search GOAP planner. We expand reachable world-states by trying each
 * action whose preconditions are satisfied, until we satisfy the goal or hit
 * the depth budget. Action ids are de-duplicated within a single plan to keep
 * the search finite without much loss of expressiveness.
 *
 * Lowest-cost satisfying plan wins. If nothing reaches the goal we record the
 * failed preconditions per action — fed to the debug overlay so the player /
 * developer can see *why* the squad fell back.
 */
export function planForGoal(
  ctx: SquadContext,
  goal: GoapGoal,
  actions: GoapAction[],
): GoapPlanResult | null {
  const failedPreconditions: string[] = [];

  if (satisfies(ctx.world, goal.desiredState)) {
    return { goal, actions: [], cost: 0, failedPreconditions };
  }

  interface Node {
    state: WorldState;
    path: GoapAction[];
    cost: number;
  }
  const open: Node[] = [{ state: ctx.world, path: [], cost: 0 }];
  let best: Node | null = null;

  while (open.length) {
    // Cheap priority queue — bounded action set keeps the sort negligible.
    open.sort((a, b) => a.cost - b.cost);
    if (best && open[0].cost >= best.cost) break;
    const node = open.shift()!;
    if (node.path.length >= MAX_PLAN_DEPTH) continue;

    for (const action of actions) {
      if (node.path.some((a) => a.id === action.id)) continue;
      if (action.isValid && !action.isValid(ctx)) continue;
      if (!satisfies(node.state, action.preconditions)) {
        if (!node.path.length) {
          failedPreconditions.push(`${action.id}: ${describeMissing(node.state, action.preconditions)}`);
        }
        continue;
      }
      const stepCost = action.baseCost + (action.dynamicCost?.(node.state) ?? 0);
      const cost = node.cost + stepCost;
      const newState = applyEffects(node.state, action.effects);
      const newPath = [...node.path, action];

      if (satisfies(newState, goal.desiredState)) {
        if (!best || cost < best.cost) {
          best = { state: newState, path: newPath, cost };
        }
        continue;
      }
      open.push({ state: newState, path: newPath, cost });
    }
  }

  if (!best) return null;
  return { goal, actions: best.path, cost: best.cost, failedPreconditions };
}

export function satisfies(state: WorldState, partial: WorldStateGoal): boolean {
  for (const key of Object.keys(partial) as Array<keyof WorldState>) {
    if (state[key] !== partial[key]) return false;
  }
  return true;
}

export function applyEffects(state: WorldState, effects: WorldStateGoal): WorldState {
  return { ...state, ...effects };
}

function describeMissing(state: WorldState, required: WorldStateGoal): string {
  const missing: string[] = [];
  for (const key of Object.keys(required) as Array<keyof WorldState>) {
    if (state[key] !== required[key]) missing.push(`${String(key)}!=${String(required[key])}`);
  }
  return missing.join(', ');
}
