import type { Simulation } from '../simulation/Simulation';
import type { Unit, Vec3 } from '../types';

/**
 * Issues simulation orders on behalf of the tactical input system. Multi-unit
 * orders are spread out into a small formation so units don't all path to the
 * exact same point and stack on top of each other.
 */
export class CommandController {
  private sim: Simulation;

  constructor(sim: Simulation) {
    this.sim = sim;
  }

  setSimulation(sim: Simulation) {
    this.sim = sim;
  }

  /** Right-click ground: dispatch attack-move-style move orders to every selected unit. */
  issueGroundOrder(units: Unit[], destination: Vec3): boolean {
    const movers = units.filter((u) => u.isPlayerControllable && !u.isDestroyed && u.speed > 0);
    if (!movers.length) return false;
    const offsets = formationOffsets(movers);
    for (let i = 0; i < movers.length; i += 1) {
      const off = offsets[i] ?? { x: 0, z: 0 };
      const dest: Vec3 = { x: destination.x + off.x, y: 0, z: destination.z + off.z };
      this.sim.issueMoveOrder(movers[i].id, dest);
    }
    return true;
  }

  /** Right-click enemy: order all selected units to engage that enemy. */
  issueAttackTarget(units: Unit[], targetId: string): boolean {
    const attackers = units.filter((u) => u.isPlayerControllable && !u.isDestroyed);
    if (!attackers.length) return false;
    let issued = false;
    for (const u of attackers) {
      if (this.sim.issueAttackOrder(u.id, targetId)) issued = true;
    }
    return issued;
  }
}

/**
 * Returns a list of small (x,z) offsets — same length as the input — arranging
 * units in a roughly square grid around the click point. Spacing scales with
 * the largest unit radius so vehicles don't stack.
 */
function formationOffsets(units: Unit[]): Array<{ x: number; z: number }> {
  if (units.length <= 1) return [{ x: 0, z: 0 }];
  const radius = Math.max(...units.map((u) => u.radius));
  const spacing = Math.max(2.4, radius * 2.5);
  if (units.length === 2) {
    return [
      { x: -spacing * 0.5, z: 0 },
      { x: spacing * 0.5, z: 0 },
    ];
  }
  if (units.length === 3) {
    return [
      { x: 0, z: -spacing * 0.5 },
      { x: -spacing * 0.7, z: spacing * 0.4 },
      { x: spacing * 0.7, z: spacing * 0.4 },
    ];
  }
  // 4+ units: square grid centered on the click.
  const cols = Math.ceil(Math.sqrt(units.length));
  const rows = Math.ceil(units.length / cols);
  const offsets: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < units.length; i += 1) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = (c - (cols - 1) / 2) * spacing;
    const z = (r - (rows - 1) / 2) * spacing;
    offsets.push({ x, z });
  }
  return offsets;
}
