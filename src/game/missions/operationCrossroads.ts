import { CAPTURE_HOLD_SECONDS, CAPTURE_RADIUS, MAP_SIZE } from '../constants';
import { makeObjectiveZone } from '../entities/ObjectiveZone';
import { makeUnit } from '../entities/Unit';
import type { BuildingStyle, MapDecoration, MissionDefinition, Unit } from '../types';

function deco(
  id: string,
  kind: MapDecoration['kind'],
  x: number,
  z: number,
  rot: number,
  scale: { x: number; y: number; z: number },
  tint?: MapDecoration['tint'],
  extra?: { buildingStyle?: BuildingStyle; destructible?: boolean; maxHealth?: number },
): MapDecoration {
  return {
    id,
    kind,
    position: { x, y: 0, z },
    rotation: rot,
    scale,
    tint,
    buildingStyle: extra?.buildingStyle,
    destructible: extra?.destructible,
    maxHealth: extra?.maxHealth,
  };
}

function buildDecorations(): MapDecoration[] {
  const out: MapDecoration[] = [];

  // Roads forming a wider crossroads at the origin, plus two ring/peripheral
  // dirt tracks so the bigger city has multiple approach lanes.
  const roadWidth = 9;
  const roadLength = MAP_SIZE;
  out.push(deco('road_h', 'road', 0, 0, 0, { x: roadLength, y: 0.05, z: roadWidth }, 'asphalt'));
  out.push(deco('road_v', 'road', 0, 0, 0, { x: roadWidth, y: 0.05, z: roadLength }, 'asphalt'));
  // Two cross-streets on either side of the central crossroads to make the
  // village feel like a real town grid rather than a single intersection.
  out.push(deco('road_h2', 'road', 0, -38, 0, { x: roadLength * 0.7, y: 0.05, z: 6 }, 'asphalt'));
  out.push(deco('road_h3', 'road', 0, 38, 0, { x: roadLength * 0.7, y: 0.05, z: 6 }, 'asphalt'));
  out.push(deco('road_v2', 'road', -42, 0, 0, { x: 6, y: 0.05, z: roadLength * 0.7 }, 'asphalt'));
  out.push(deco('road_v3', 'road', 42, 0, 0, { x: 6, y: 0.05, z: roadLength * 0.7 }, 'asphalt'));

  // Dense central village. Mix of houses, barns, factory, church, and a
  // fortified bunker covering the crossroads. All marked destructible.
  type B = [number, number, number, number, number, number, BuildingStyle];
  const village: B[] = [
    // x, z, rotY, w, h, d, style
    [-18, -18, 0, 8, 4, 6, 'house'],
    [-22, -10, 0, 6, 5, 5, 'house'],
    [-30, -22, 0.15, 7, 4, 6, 'house'],
    [-36, -8, 0, 6, 5, 5, 'house'],
    [18, -20, 0.3, 9, 5, 7, 'barn'],
    [22, -8, 0, 5, 4, 5, 'house'],
    [28, -16, -0.2, 7, 5, 6, 'house'],
    [34, -6, 0, 9, 6, 7, 'factory'],
    [-20, 20, 0, 7, 4, 6, 'house'],
    [20, 18, 0.2, 8, 5, 6, 'house'],
    [12, 10, 0, 5, 4, 5, 'house'],
    [-12, 10, 0, 6, 4, 5, 'house'],
    [-30, 24, 0, 8, 7, 7, 'church'],
    [30, 28, -0.18, 9, 4, 6, 'barn'],
    [-44, 16, 0.1, 6, 5, 5, 'house'],
    [44, 12, -0.1, 6, 5, 5, 'house'],
    // Outer ring: bigger, harder to crack.
    [-58, -36, 0, 9, 6, 7, 'factory'],
    [56, -36, -0.1, 9, 6, 7, 'factory'],
    [-58, 38, 0.15, 8, 5, 6, 'barn'],
    [54, 40, 0, 8, 5, 6, 'barn'],
    // Bunker covering southern approach to crossroads — heavy HP target.
    [0, -22, 0, 5, 2.6, 4, 'bunker'],
    [0, 22, 0, 5, 2.6, 4, 'bunker'],
  ];
  village.forEach((b, i) => {
    const [x, z, r, w, h, d, style] = b;
    out.push(
      deco(`bldg_${i}`, 'building', x, z, r, { x: w, y: h, z: d }, 'wall', {
        buildingStyle: style,
        destructible: true,
      }),
    );
  });

  // Tree clusters around the perimeter of the city.
  const rng = mulberry32(1337);
  const treeSeed: Array<[number, number, 'pine' | 'oak' | 'shrub']> = [];
  for (let i = 0; i < 165; i += 1) {
    const x = (rng() - 0.5) * (MAP_SIZE - 16);
    const z = (rng() - 0.5) * (MAP_SIZE - 16);
    // Skip tree spawns over road grid and inside village core.
    if (Math.abs(x) < 11 || Math.abs(z) < 11) continue;
    if (Math.hypot(x, z) < 38) continue;
    treeSeed.push([x, z, rng() > 0.54 ? 'pine' : rng() > 0.25 ? 'oak' : 'shrub']);
  }
  treeSeed.forEach((t, i) => {
    const [x, z, kind] = t;
    const height = kind === 'shrub' ? 1.1 + rng() * 0.8 : 3 + rng() * 2.5;
    out.push(deco(`tree_${i}`, 'tree', x, z, rng() * Math.PI * 2, { x: 1.4, y: height, z: 1.4 }, kind));
  });

  for (let i = 0; i < 22; i += 1) {
    const x = (rng() - 0.5) * (MAP_SIZE - 30);
    const z = (rng() - 0.5) * (MAP_SIZE - 30);
    if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
    const w = 8 + rng() * 14;
    const d = 8 + rng() * 14;
    out.push(deco(`field_${i}`, 'fieldPatch', x, z, rng() * Math.PI, { x: w, y: 0.02, z: d }, 'grass'));
  }

  const hills: Array<[number, number, number]> = [
    [-72, -52, 16],
    [70, -68, 18],
    [86, 38, 14],
    [-86, 60, 20],
    [0, -98, 22],
    [0, 98, 20],
  ];
  hills.forEach((h, i) => {
    out.push(deco(`hill_${i}`, 'hill', h[0], h[1], 0, { x: h[2], y: 2.5, z: h[2] }, 'dirt'));
  });

  return out;
}

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
      name: 'Heavy Tank Iron',
      faction: 'friendly',
      type: 'heavyTank',
      position: { x: -10, y: 0, z: 92 },
      rotation: -Math.PI,
      idHint: 'F_iron',
    }),
    makeUnit({
      name: 'Medium Tank Alpha',
      faction: 'friendly',
      type: 'mediumTank',
      position: { x: 0, y: 0, z: 82 },
      rotation: -Math.PI,
      idHint: 'F_alpha',
    }),
    makeUnit({
      name: 'Medium Tank Bravo',
      faction: 'friendly',
      type: 'mediumTank',
      position: { x: 10, y: 0, z: 92 },
      rotation: -Math.PI,
      idHint: 'F_bravo',
    }),
    makeUnit({
      name: 'Recon Jeep',
      faction: 'friendly',
      type: 'reconJeep',
      position: { x: 18, y: 0, z: 82 },
      rotation: -Math.PI,
      idHint: 'F_jeep',
    }),
    makeUnit({
      name: 'Infantry Squad',
      faction: 'friendly',
      type: 'infantry',
      position: { x: -18, y: 0, z: 86 },
      rotation: -Math.PI,
      idHint: 'F_inf',
    }),
  ];

  const enemy: Unit[] = [
    makeUnit({
      name: 'Enemy Heavy Tank',
      faction: 'enemy',
      type: 'heavyTank',
      position: { x: -2, y: 0, z: -42 },
      rotation: 0,
      idHint: 'E_heavy',
    }),
    makeUnit({
      name: 'Enemy Light Tank Patrol',
      faction: 'enemy',
      type: 'lightTank',
      position: { x: 8, y: 0, z: -8 },
      rotation: 0,
      idHint: 'E_lightTank',
    }),
    makeUnit({
      name: 'Enemy Light Tank East',
      faction: 'enemy',
      type: 'lightTank',
      position: { x: 36, y: 0, z: -22 },
      rotation: -0.7,
      idHint: 'E_lightTankEast',
    }),
    makeUnit({
      name: 'Enemy AT Gun (North)',
      faction: 'enemy',
      type: 'antiTankGun',
      position: { x: -3, y: 0, z: -28 },
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
      name: 'Enemy AT Gun (West)',
      faction: 'enemy',
      type: 'antiTankGun',
      position: { x: -36, y: 0, z: -4 },
      rotation: Math.PI / 2,
      idHint: 'E_atWest',
    }),
    makeUnit({
      name: 'Enemy Mortar Team',
      faction: 'enemy',
      type: 'mortar',
      position: { x: 0, y: 0, z: -68 },
      rotation: 0,
      idHint: 'E_mortar1',
    }),
    makeUnit({
      name: 'Enemy Mortar Team 2',
      faction: 'enemy',
      type: 'mortar',
      position: { x: 22, y: 0, z: -64 },
      rotation: 0,
      idHint: 'E_mortar2',
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
    makeUnit({
      name: 'Enemy Infantry (North)',
      faction: 'enemy',
      type: 'infantry',
      position: { x: 6, y: 0, z: -36 },
      rotation: 0,
      idHint: 'E_infNorth',
    }),
    makeUnit({
      name: 'Enemy Infantry (South)',
      faction: 'enemy',
      type: 'infantry',
      position: { x: -8, y: 0, z: 32 },
      rotation: Math.PI,
      idHint: 'E_infSouth',
    }),
    makeUnit({
      name: 'Enemy Infantry (Bunker N)',
      faction: 'enemy',
      type: 'infantry',
      position: { x: 1.5, y: 0, z: -22 },
      rotation: 0,
      idHint: 'E_bunkerN',
    }),
    makeUnit({
      name: 'Enemy Infantry (Bunker S)',
      faction: 'enemy',
      type: 'infantry',
      position: { x: -1.5, y: 0, z: 22 },
      rotation: Math.PI,
      idHint: 'E_bunkerS',
    }),
  ];

  const lightTank = enemy.find((u) => u.id === 'E_lightTank');
  if (lightTank) {
    lightTank.currentOrder = {
      kind: 'patrol',
      patrolFrom: { x: 14, y: 0, z: -10 },
      patrolTo: { x: -14, y: 0, z: 10 },
      destination: { x: -14, y: 0, z: 10 },
    };
    lightTank.aiState = 'patrol';
  }
  const lightTankEast = enemy.find((u) => u.id === 'E_lightTankEast');
  if (lightTankEast) {
    lightTankEast.currentOrder = {
      kind: 'patrol',
      patrolFrom: { x: 36, y: 0, z: -22 },
      patrolTo: { x: 26, y: 0, z: 14 },
      destination: { x: 26, y: 0, z: 14 },
    };
    lightTankEast.aiState = 'patrol';
  }

  for (const u of enemy) {
    if (u.currentOrder.kind === 'patrol') continue;
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
      'A allied armored task force has been ordered to seize a heavily defended village ' +
        'crossroads. Recon spotted an enemy heavy tank dug in to the south, two light-tank ' +
        'patrols, three anti-tank gun positions covering each approach, two mortar teams ' +
        'at the rear, and infantry occupying the buildings throughout the village.',
      'Use the tactical map to issue move and attack-move orders, or jump into a tank to ' +
        'lead the assault personally. Walls are destructible — splash damage and direct ' +
        'cannon fire will collapse buildings, opening new firing lanes. Hold the central ' +
        'crossroads for thirty seconds with at least one surviving combat unit to claim ' +
        'victory.',
    ],
    briefingObjectives: [
      'Move at least one friendly combat unit into the crossroads capture zone.',
      'Hold the zone for 30 seconds while a friendly combat unit remains alive.',
      'Avoid losing all friendly combat units.',
    ],
    units: buildUnits(),
    objective,
    mapSize: MAP_SIZE,
    decorations: buildDecorations(),
  };
}
