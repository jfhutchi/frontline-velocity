import { CAPTURE_HOLD_SECONDS, CAPTURE_RADIUS, MAP_SIZE } from '../constants';
import { makeObjectiveZone } from '../entities/ObjectiveZone';
import { makeUnit } from '../entities/Unit';
import type { MapDecoration, MissionDefinition, Unit } from '../types';

function deco(
  id: string,
  kind: MapDecoration['kind'],
  x: number,
  z: number,
  rot: number,
  scale: { x: number; y: number; z: number },
  tint?: MapDecoration['tint'],
): MapDecoration {
  return {
    id,
    kind,
    position: { x, y: 0, z },
    rotation: rot,
    scale,
    tint,
  };
}

function buildDecorations(): MapDecoration[] {
  const out: MapDecoration[] = [];

  // Roads forming a crossroads at the origin.
  const roadWidth = 8;
  const roadLength = MAP_SIZE;
  out.push(deco('road_h', 'road', 0, 0, 0, { x: roadLength, y: 0.05, z: roadWidth }, 'asphalt'));
  out.push(deco('road_v', 'road', 0, 0, 0, { x: roadWidth, y: 0.05, z: roadLength }, 'asphalt'));

  // A few buildings near the crossroads (clustered like a small village).
  const buildings: Array<[number, number, number, number, number]> = [
    // x, z, rotY, w, d
    [-18, -18, 0, 8, 6],
    [-22, -10, 0, 6, 5],
    [18, -20, 0.3, 9, 7],
    [22, -8, 0, 5, 5],
    [-20, 20, 0, 7, 6],
    [20, 18, 0.2, 8, 6],
    [12, 10, 0, 5, 5],
    [-12, 10, 0, 6, 5],
  ];
  buildings.forEach((b, i) => {
    const [x, z, r, w, d] = b;
    const h = 4 + (i % 3);
    out.push(deco(`bldg_${i}`, 'building', x, z, r, { x: w, y: h, z: d }, 'wall'));
  });

  // Tree clusters, scattered.
  const treeSeed: Array<[number, number, 'pine' | 'oak' | 'shrub']> = [];
  const rng = mulberry32(1337);
  for (let i = 0; i < 95; i += 1) {
    const x = (rng() - 0.5) * (MAP_SIZE - 16);
    const z = (rng() - 0.5) * (MAP_SIZE - 16);
    // Skip tree spawns too close to roads or crossroads center.
    if (Math.abs(x) < 11 || Math.abs(z) < 11) continue;
    if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
    treeSeed.push([x, z, rng() > 0.54 ? 'pine' : rng() > 0.25 ? 'oak' : 'shrub']);
  }
  treeSeed.forEach((t, i) => {
    const [x, z, kind] = t;
    const height = kind === 'shrub' ? 1.1 + rng() * 0.8 : 3 + rng() * 2.5;
    out.push(deco(`tree_${i}`, 'tree', x, z, rng() * Math.PI * 2, { x: 1.4, y: height, z: 1.4 }, kind));
  });

  // Field patches (visual variation only).
  for (let i = 0; i < 14; i += 1) {
    const x = (rng() - 0.5) * (MAP_SIZE - 30);
    const z = (rng() - 0.5) * (MAP_SIZE - 30);
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
    const w = 8 + rng() * 12;
    const d = 8 + rng() * 12;
    out.push(deco(`field_${i}`, 'fieldPatch', x, z, rng() * Math.PI, { x: w, y: 0.02, z: d }, 'grass'));
  }

  // Simple low hills (flat domes near edges).
  const hills: Array<[number, number, number]> = [
    [-60, -40, 14],
    [55, -55, 16],
    [70, 30, 12],
    [-70, 50, 18],
  ];
  hills.forEach((h, i) => {
    out.push(deco(`hill_${i}`, 'hill', h[0], h[1], 0, { x: h[2], y: 2.5, z: h[2] }, 'dirt'));
  });

  return out;
}

// Tiny seeded PRNG so the map looks the same every run.
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildUnits(): Unit[] {
  const friendly: Unit[] = [
    makeUnit({
      name: 'Medium Tank Alpha',
      faction: 'friendly',
      type: 'mediumTank',
      position: { x: -55, y: 0, z: 70 },
      rotation: -Math.PI,
      idHint: 'F_alpha',
    }),
    makeUnit({
      name: 'Medium Tank Bravo',
      faction: 'friendly',
      type: 'mediumTank',
      position: { x: -45, y: 0, z: 80 },
      rotation: -Math.PI,
      idHint: 'F_bravo',
    }),
    makeUnit({
      name: 'Recon Jeep',
      faction: 'friendly',
      type: 'reconJeep',
      position: { x: -35, y: 0, z: 75 },
      rotation: -Math.PI,
      idHint: 'F_jeep',
    }),
    makeUnit({
      name: 'Infantry Squad',
      faction: 'friendly',
      type: 'infantry',
      position: { x: -50, y: 0, z: 88 },
      rotation: -Math.PI,
      idHint: 'F_inf',
    }),
  ];

  const enemy: Unit[] = [
    makeUnit({
      name: 'Enemy Light Tank',
      faction: 'enemy',
      type: 'lightTank',
      position: { x: 8, y: 0, z: -8 },
      rotation: 0,
      idHint: 'E_lightTank',
    }),
    makeUnit({
      name: 'Enemy AT Gun (North)',
      faction: 'enemy',
      type: 'antiTankGun',
      position: { x: -2, y: 0, z: -28 },
      rotation: 0,
      idHint: 'E_atNorth',
    }),
    makeUnit({
      name: 'Enemy AT Gun (South)',
      faction: 'enemy',
      type: 'antiTankGun',
      position: { x: 4, y: 0, z: 28 },
      rotation: Math.PI,
      idHint: 'E_atSouth',
    }),
    makeUnit({
      name: 'Enemy Infantry (East)',
      faction: 'enemy',
      type: 'infantry',
      position: { x: 28, y: 0, z: 4 },
      rotation: 0,
      idHint: 'E_infEast',
    }),
    makeUnit({
      name: 'Enemy Infantry (West)',
      faction: 'enemy',
      type: 'infantry',
      position: { x: -22, y: 0, z: -2 },
      rotation: 0,
      idHint: 'E_infWest',
    }),
  ];

  // Patrol route for enemy light tank.
  const lightTank = enemy[0];
  lightTank.currentOrder = {
    kind: 'patrol',
    patrolFrom: { x: 12, y: 0, z: -8 },
    patrolTo: { x: -12, y: 0, z: 8 },
    destination: { x: -12, y: 0, z: 8 },
  };
  lightTank.aiState = 'patrol';

  // Hold orders for everyone else (defensive posture).
  for (const u of enemy) {
    if (u.id === lightTank.id) continue;
    u.currentOrder = { kind: 'hold' };
    u.aiState = 'guard';
  }

  return [...friendly, ...enemy];
}

export function createOperationCrossroads(): MissionDefinition {
  const objective = makeObjectiveZone({
    id: 'crossroads',
    name: 'Crossroads Capture Zone',
    position: { x: 0, y: 0, z: 0 },
    radius: CAPTURE_RADIUS,
    requiredHoldSeconds: CAPTURE_HOLD_SECONDS,
  });

  return {
    id: 'operation-crossroads',
    name: 'Operation Crossroads',
    briefingTitle: 'Operation Crossroads',
    briefingParagraphs: [
      'A small allied armored detachment has been ordered to seize a defended village crossroads. ' +
        'Recon spotted a light tank patrolling the junction, two stationary anti-tank guns covering the approaches, ' +
        'and infantry positioned in the buildings flanking the road.',
      'Use the tactical map to issue move orders, or jump into a tank to lead the assault personally. ' +
        'Hold the crossroads for thirty seconds with at least one surviving combat unit to claim victory.',
    ],
    briefingObjectives: [
      'Move at least one friendly unit into the crossroads capture zone.',
      'Hold the zone for 30 seconds while a friendly combat unit remains alive.',
      'Avoid losing all friendly combat units.',
    ],
    units: buildUnits(),
    objective,
    mapSize: MAP_SIZE,
    decorations: buildDecorations(),
  };
}
