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

  // ── Road network ──────────────────────────────────────────────────────────
  // Main cross-axis highways spanning the full map.
  const rL = MAP_SIZE;
  out.push(deco('road_h', 'road', 0, 0, 0, { x: rL, y: 0.05, z: 9 }, 'asphalt'));
  out.push(deco('road_v', 'road', 0, 0, 0, { x: 9, y: 0.05, z: rL }, 'asphalt'));

  // Central village grid (existing cross-streets kept, now slightly wider coverage).
  out.push(deco('road_h2', 'road', 0, -38, 0, { x: rL * 0.55, y: 0.05, z: 6 }, 'asphalt'));
  out.push(deco('road_h3', 'road', 0, 38, 0, { x: rL * 0.55, y: 0.05, z: 6 }, 'asphalt'));
  out.push(deco('road_v2', 'road', -42, 0, 0, { x: 6, y: 0.05, z: rL * 0.55 }, 'asphalt'));
  out.push(deco('road_v3', 'road', 42, 0, 0, { x: 6, y: 0.05, z: rL * 0.55 }, 'asphalt'));

  // Northern ring road connecting eastern and western hamlets at z≈-190.
  out.push(deco('road_north_ring', 'road', 0, -190, 0, { x: 420, y: 0.05, z: 8 }, 'asphalt'));
  // Northern town interior cross-streets.
  out.push(deco('road_nt_v1', 'road', -28, -190, 0, { x: 7, y: 0.05, z: 80 }, 'asphalt'));
  out.push(deco('road_nt_v2', 'road', 28, -190, 0, { x: 7, y: 0.05, z: 80 }, 'asphalt'));
  out.push(deco('road_nt_h2', 'road', 0, -165, 0, { x: 90, y: 0.05, z: 6 }, 'asphalt'));
  out.push(deco('road_nt_h3', 'road', 0, -215, 0, { x: 90, y: 0.05, z: 6 }, 'asphalt'));

  // Southern staging connector (friendly approach road).
  out.push(deco('road_s_ring', 'road', 0, 165, 0, { x: 400, y: 0.05, z: 7 }, 'asphalt'));

  // Diagonal NW approach: central → western hamlet area.
  out.push(deco('road_nw1', 'road', -62, -22, 0.52, { x: 7, y: 0.045, z: 88 }, 'dirt'));
  out.push(deco('road_nw2', 'road', -118, -68, 0.34, { x: 6, y: 0.04, z: 100 }, 'dirt'));
  out.push(deco('road_nw3', 'road', -168, -120, 0.18, { x: 6, y: 0.04, z: 80 }, 'dirt'));

  // Diagonal NE approach: central → eastern hamlet area.
  out.push(deco('road_ne1', 'road', 62, -22, -0.52, { x: 7, y: 0.045, z: 88 }, 'dirt'));
  out.push(deco('road_ne2', 'road', 118, -68, -0.34, { x: 6, y: 0.04, z: 100 }, 'dirt'));
  out.push(deco('road_ne3', 'road', 168, -120, -0.18, { x: 6, y: 0.04, z: 80 }, 'dirt'));

  // Southern approach lanes (friendly staging zone tracks).
  out.push(deco('road_s_lane_w', 'road', -18, 88, -0.14, { x: 6, y: 0.04, z: 120 }, 'dirt'));
  out.push(deco('road_s_lane_e', 'road', 18, 88, 0.14, { x: 6, y: 0.04, z: 120 }, 'dirt'));

  // ── Buildings ─────────────────────────────────────────────────────────────
  type B = [number, number, number, number, number, number, BuildingStyle];

  // Central crossroads village (around objective at origin).
  const centralVillage: B[] = [
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
    [-58, -36, 0, 9, 6, 7, 'factory'],
    [56, -36, -0.1, 9, 6, 7, 'factory'],
    [-58, 38, 0.15, 8, 5, 6, 'barn'],
    [54, 40, 0, 8, 5, 6, 'barn'],
    [0, -22, 0, 5, 2.6, 4, 'bunker'],
    [0, 22, 0, 5, 2.6, 4, 'bunker'],
    // Extra ring buildings now that the map is 3× wider.
    [-70, -8, 0.1, 7, 5, 6, 'house'],
    [70, -12, -0.1, 7, 5, 6, 'house'],
    [-62, 52, 0.2, 8, 4, 6, 'barn'],
    [60, 50, -0.12, 8, 4, 6, 'house'],
    [-48, -54, 0, 7, 5, 5, 'house'],
    [48, -52, 0, 7, 5, 5, 'house'],
  ];

  // Northern town (centered z≈-190, the enemy's main fortified base).
  const northernTown: B[] = [
    [-14, -180, 0, 8, 4, 6, 'house'],
    [14, -180, 0, 8, 4, 6, 'house'],
    [-24, -172, 0.1, 7, 5, 5, 'house'],
    [24, -172, -0.1, 7, 5, 5, 'house'],
    [-34, -185, 0, 9, 5, 7, 'barn'],
    [34, -185, 0.2, 9, 5, 7, 'barn'],
    [-10, -196, 0, 8, 6, 7, 'factory'],
    [10, -196, 0, 8, 6, 7, 'factory'],
    [0, -178, 0, 12, 8, 10, 'church'],
    [-30, -200, 0, 6, 5, 5, 'house'],
    [30, -200, 0, 6, 5, 5, 'house'],
    [-40, -172, 0.15, 7, 4, 6, 'house'],
    [40, -172, -0.15, 7, 4, 6, 'house'],
    [-20, -210, 0, 9, 6, 7, 'factory'],
    [20, -210, 0, 9, 6, 7, 'factory'],
    [0, -188, 0, 5, 2.8, 4, 'bunker'],
    [-18, -194, 0, 5, 2.8, 4, 'bunker'],
    [18, -194, 0, 5, 2.8, 4, 'bunker'],
  ];

  // Western hamlet (x≈-175, z≈-75).
  const westHamlet: B[] = [
    [-172, -68, 0, 8, 4, 6, 'house'],
    [-184, -76, 0.1, 7, 5, 5, 'house'],
    [-165, -80, 0, 9, 5, 7, 'barn'],
    [-180, -60, -0.1, 6, 4, 5, 'house'],
    [-190, -88, 0, 9, 5, 7, 'barn'],
    [-162, -60, 0.2, 7, 4, 6, 'house'],
    [0, 0, 0, 5, 2.6, 4, 'bunker'], // placeholder overwritten below
  ];
  // Replace placeholder with actual bunker position.
  westHamlet[6] = [-176, -88, 0, 5, 2.6, 4, 'bunker'];

  // Eastern hamlet (x≈+175, z≈-75).
  const eastHamlet: B[] = [
    [172, -68, 0, 8, 4, 6, 'house'],
    [184, -76, -0.1, 7, 5, 5, 'house'],
    [165, -80, 0, 9, 5, 7, 'barn'],
    [180, -60, 0.1, 6, 4, 5, 'house'],
    [190, -88, 0, 9, 5, 7, 'barn'],
    [162, -60, -0.2, 7, 4, 6, 'house'],
    [176, -88, 0, 5, 2.6, 4, 'bunker'],
  ];

  // Southern farm cluster (friendly staging area backdrop, z≈+170).
  const southFarms: B[] = [
    [-12, 168, 0, 9, 4, 7, 'barn'],
    [14, 172, 0.1, 8, 4, 6, 'barn'],
    [-24, 176, 0, 7, 5, 5, 'house'],
    [26, 165, -0.1, 7, 5, 5, 'house'],
    [0, 160, 0, 6, 4, 5, 'house'],
  ];

  const allClusters: Array<[B[], string]> = [
    [centralVillage, 'cv'],
    [northernTown, 'nt'],
    [westHamlet, 'wh'],
    [eastHamlet, 'eh'],
    [southFarms, 'sf'],
  ];
  let bIdx = 0;
  for (const [cluster, prefix] of allClusters) {
    for (const [x, z, r, w, h, d, style] of cluster) {
      out.push(
        deco(`bldg_${prefix}_${bIdx++}`, 'building', x, z, r, { x: w, y: h, z: d }, 'wall', {
          buildingStyle: style,
          destructible: true,
        }),
      );
    }
  }

  // ── Linear features: hedgerows, walls, fences ─────────────────────────────
  type LD = [string, MapDecoration['kind'], number, number, number, number, number, MapDecoration['tint']];
  const linearDetails: LD[] = [
    // Central area (existing).
    ['hedge_west_field', 'hedgerow', -70, 18, 0.1, 48, 2.3, 'shrub'],
    ['hedge_east_field', 'hedgerow', 70, 20, -0.08, 50, 2.2, 'shrub'],
    ['hedge_south_left', 'hedgerow', -42, 62, -0.34, 52, 2.1, 'shrub'],
    ['hedge_south_right', 'hedgerow', 38, 62, 0.24, 48, 2.1, 'shrub'],
    ['hedge_north_left', 'hedgerow', -52, -50, 0.82, 44, 2.0, 'shrub'],
    ['hedge_north_right', 'hedgerow', 52, -48, -0.64, 44, 2.0, 'shrub'],
    ['wall_church_front', 'stoneWall', -30, 14, 0, 20, 1.0, 'stone'],
    ['wall_church_side', 'stoneWall', -40, 24, Math.PI / 2, 18, 1.0, 'stone'],
    ['wall_square_west', 'stoneWall', -12, -4, Math.PI / 2, 18, 0.9, 'stone'],
    ['wall_square_east', 'stoneWall', 12, 4, Math.PI / 2, 18, 0.9, 'stone'],
    ['wall_south_approach_left', 'stoneWall', -17, 52, Math.PI / 2, 34, 1.0, 'stone'],
    ['wall_south_approach_right', 'stoneWall', 17, 46, Math.PI / 2, 28, 1.0, 'stone'],
    ['wall_village_garden', 'stoneWall', -27, 38, 0.12, 22, 0.95, 'stone'],
    ['hedge_village_road', 'hedgerow', 28, 34, -0.08, 30, 1.8, 'shrub'],
    ['fence_south_field', 'fence', -57, 78, -0.18, 44, 0.8, 'wood'],
    ['fence_east_field', 'fence', 78, 50, Math.PI / 2, 42, 0.8, 'wood'],
    ['fence_west_lane', 'fence', -79, -18, Math.PI / 2, 38, 0.8, 'wood'],
    // Northern town perimeter.
    ['wall_nt_south', 'stoneWall', 0, -162, 0, 80, 1.2, 'stone'],
    ['wall_nt_west', 'stoneWall', -44, -190, Math.PI / 2, 70, 1.1, 'stone'],
    ['wall_nt_east', 'stoneWall', 44, -190, Math.PI / 2, 70, 1.1, 'stone'],
    ['hedge_nt_rear', 'hedgerow', 0, -222, 0.05, 90, 2.4, 'shrub'],
    // Western hamlet.
    ['hedge_wh_north', 'hedgerow', -175, -55, 0, 50, 2.1, 'shrub'],
    ['wall_wh_east', 'stoneWall', -155, -76, Math.PI / 2, 38, 1.0, 'stone'],
    ['fence_wh_south', 'fence', -175, -100, 0, 48, 0.8, 'wood'],
    // Eastern hamlet.
    ['hedge_eh_north', 'hedgerow', 175, -55, 0, 50, 2.1, 'shrub'],
    ['wall_eh_west', 'stoneWall', 155, -76, Math.PI / 2, 38, 1.0, 'stone'],
    ['fence_eh_south', 'fence', 175, -100, 0, 48, 0.8, 'wood'],
    // Mid-field east/west hedges separating the hamlets from forward lines.
    ['hedge_mid_west', 'hedgerow', -105, -120, 0.22, 80, 2.2, 'shrub'],
    ['hedge_mid_east', 'hedgerow', 105, -120, -0.22, 80, 2.2, 'shrub'],
    // Southern staging area fences.
    ['fence_stage_left', 'fence', -88, 210, Math.PI / 2, 60, 0.8, 'wood'],
    ['fence_stage_right', 'fence', 88, 210, Math.PI / 2, 60, 0.8, 'wood'],
    ['fence_stage_top', 'fence', 0, 240, 0, 120, 0.8, 'wood'],
  ];
  for (const [id, kind, x, z, rot, length, width, tint] of linearDetails) {
    out.push(deco(id, kind, x, z, rot, { x: length, y: 1.2, z: width }, tint));
  }

  out.push(deco('roadsign_south', 'roadSign', -20, 58, 0.2, { x: 1, y: 2.2, z: 1 }, 'wood'));
  out.push(deco('roadsign_crossroads', 'roadSign', 7, 8, -0.35, { x: 1, y: 2, z: 1 }, 'wood'));
  out.push(deco('roadsign_north', 'roadSign', 5, -148, 0.1, { x: 1, y: 2.2, z: 1 }, 'wood'));
  out.push(deco('roadsign_west_hamlet', 'roadSign', -138, -78, 0.3, { x: 1, y: 2.0, z: 1 }, 'wood'));
  out.push(deco('roadsign_east_hamlet', 'roadSign', 138, -78, -0.3, { x: 1, y: 2.0, z: 1 }, 'wood'));

  // ── Trees ──────────────────────────────────────────────────────────────────
  const rng = mulberry32(1337);
  const treeSeed: Array<[number, number, 'pine' | 'oak' | 'shrub']> = [];
  for (let i = 0; i < 500; i += 1) {
    const x = (rng() - 0.5) * (MAP_SIZE - 20);
    const z = (rng() - 0.5) * (MAP_SIZE - 20);
    // Skip central road grid and major village cores.
    if (Math.abs(x) < 11 || Math.abs(z) < 11) continue;
    if (Math.hypot(x, z) < 45) continue;                          // central village
    if (Math.hypot(x + 175, z + 75) < 35) continue;              // west hamlet
    if (Math.hypot(x - 175, z + 75) < 35) continue;              // east hamlet
    if (Math.hypot(x, z + 190) < 50) continue;                    // northern town
    treeSeed.push([x, z, rng() > 0.54 ? 'pine' : rng() > 0.25 ? 'oak' : 'shrub']);
  }
  treeSeed.forEach((t, i) => {
    const [x, z, kind] = t;
    const height = kind === 'shrub' ? 1.1 + rng() * 0.8 : 3 + rng() * 2.5;
    out.push(deco(`tree_${i}`, 'tree', x, z, rng() * Math.PI * 2, { x: 1.4, y: height, z: 1.4 }, kind));
  });

  // ── Field patches ──────────────────────────────────────────────────────────
  for (let i = 0; i < 55; i += 1) {
    const x = (rng() - 0.5) * (MAP_SIZE - 30);
    const z = (rng() - 0.5) * (MAP_SIZE - 30);
    if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
    const w = 10 + rng() * 22;
    const d = 10 + rng() * 22;
    out.push(deco(`field_${i}`, 'fieldPatch', x, z, rng() * Math.PI, { x: w, y: 0.02, z: d }, 'grass'));
  }
  const setPieceFields: Array<[number, number, number, number, number]> = [
    [-74, 54, 0.18, 34, 26],
    [-42, 58, 0.12, 26, 22],
    [72, 58, -0.28, 32, 24],
    [-78, -44, 0.44, 30, 22],
    [78, -52, -0.36, 34, 24],
    // New set-piece fields on the expanded map.
    [-130, 120, 0.22, 48, 34],
    [130, 115, -0.18, 44, 32],
    [-140, -130, 0.35, 52, 38],
    [140, -135, -0.28, 50, 36],
    [-100, -250, 0.1, 40, 28],
    [100, -255, -0.12, 42, 30],
    [-200, 60, 0.4, 56, 40],
    [200, 55, -0.38, 54, 38],
    [-220, -80, 0.15, 44, 32],
    [220, -85, -0.14, 46, 34],
  ];
  setPieceFields.forEach(([x, z, rot, w, d], i) => {
    out.push(deco(`crop_setpiece_${i}`, 'fieldPatch', x, z, rot, { x: w, y: 0.022, z: d }, 'grass'));
  });

  // ── Hills ─────────────────────────────────────────────────────────────────
  const hills: Array<[number, number, number]> = [
    // Original hills (adjusted for larger map context).
    [-72, -52, 18],
    [70, -68, 20],
    [86, 38, 16],
    [-86, 60, 22],
    [0, -98, 24],
    [0, 98, 22],
    // Additional hills across the expanded map.
    [-160, -50, 20],
    [160, -50, 20],
    [-200, -170, 26],
    [200, -170, 26],
    [-100, -270, 22],
    [100, -275, 22],
    [-240, 40, 18],
    [240, 40, 18],
    [-180, 200, 20],
    [180, 200, 20],
    [-260, -260, 30],
    [260, -260, 30],
  ];
  hills.forEach((h, i) => {
    out.push(deco(`hill_${i}`, 'hill', h[0], h[1], 0, { x: h[2], y: 2.8, z: h[2] }, 'dirt'));
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
  // ── Friendly force (~3× original 5) ──────────────────────────────────────
  // Two assault columns plus a flanking scout screen, spawning z≈240-270 (south).
  const friendly: Unit[] = [
    // Heavy assault spearhead.
    makeUnit({ name: 'Heavy Tank Iron', faction: 'friendly', type: 'heavyTank', position: { x: -12, y: 0, z: 258 }, rotation: -Math.PI, idHint: 'F_iron' }),
    makeUnit({ name: 'Heavy Tank Anvil', faction: 'friendly', type: 'heavyTank', position: { x: 12, y: 0, z: 258 }, rotation: -Math.PI, idHint: 'F_anvil' }),
    // Medium tank main body.
    makeUnit({ name: 'Medium Tank Alpha', faction: 'friendly', type: 'mediumTank', position: { x: -8, y: 0, z: 244 }, rotation: -Math.PI, idHint: 'F_alpha' }),
    makeUnit({ name: 'Medium Tank Bravo', faction: 'friendly', type: 'mediumTank', position: { x: 0, y: 0, z: 244 }, rotation: -Math.PI, idHint: 'F_bravo' }),
    makeUnit({ name: 'Medium Tank Charlie', faction: 'friendly', type: 'mediumTank', position: { x: 8, y: 0, z: 244 }, rotation: -Math.PI, idHint: 'F_charlie' }),
    makeUnit({ name: 'Medium Tank Delta', faction: 'friendly', type: 'mediumTank', position: { x: -22, y: 0, z: 256 }, rotation: -Math.PI, idHint: 'F_delta' }),
    makeUnit({ name: 'Medium Tank Echo', faction: 'friendly', type: 'mediumTank', position: { x: 22, y: 0, z: 256 }, rotation: -Math.PI, idHint: 'F_echo' }),
    // Light scout tanks for flanking.
    makeUnit({ name: 'Scout Tank One', faction: 'friendly', type: 'lightTank', position: { x: -36, y: 0, z: 248 }, rotation: -Math.PI, idHint: 'F_scout1' }),
    makeUnit({ name: 'Scout Tank Two', faction: 'friendly', type: 'lightTank', position: { x: 36, y: 0, z: 248 }, rotation: -Math.PI, idHint: 'F_scout2' }),
    makeUnit({ name: 'Scout Tank Three', faction: 'friendly', type: 'lightTank', position: { x: 0, y: 0, z: 268 }, rotation: -Math.PI, idHint: 'F_scout3' }),
    // Recon jeeps.
    makeUnit({ name: 'Recon Jeep Alpha', faction: 'friendly', type: 'reconJeep', position: { x: -48, y: 0, z: 242 }, rotation: -Math.PI, idHint: 'F_jeep1' }),
    makeUnit({ name: 'Recon Jeep Bravo', faction: 'friendly', type: 'reconJeep', position: { x: 48, y: 0, z: 242 }, rotation: -Math.PI, idHint: 'F_jeep2' }),
    // Infantry squads.
    makeUnit({ name: 'Rifle Squad Alpha', faction: 'friendly', type: 'infantry', position: { x: -16, y: 0, z: 264 }, rotation: -Math.PI, idHint: 'F_inf1' }),
    makeUnit({ name: 'Rifle Squad Bravo', faction: 'friendly', type: 'infantry', position: { x: 0, y: 0, z: 270 }, rotation: -Math.PI, idHint: 'F_inf2' }),
    makeUnit({ name: 'Rifle Squad Charlie', faction: 'friendly', type: 'infantry', position: { x: 16, y: 0, z: 264 }, rotation: -Math.PI, idHint: 'F_inf3' }),
  ];

  // ── Enemy force (~5× original 14 ≈ 70) ───────────────────────────────────
  // Organised into five tactical groups with realistic spacing.

  // 1) Central crossroads defence (15 units — original layout + AT East).
  const enemyCentral: Unit[] = [
    makeUnit({ name: 'Enemy Heavy Tank', faction: 'enemy', type: 'heavyTank', position: { x: -2, y: 0, z: -42 }, rotation: 0, idHint: 'E_heavy' }),
    makeUnit({ name: 'Enemy Light Tank Patrol', faction: 'enemy', type: 'lightTank', position: { x: 8, y: 0, z: -8 }, rotation: 0, idHint: 'E_lightTank' }),
    makeUnit({ name: 'Enemy Light Tank East', faction: 'enemy', type: 'lightTank', position: { x: 36, y: 0, z: -22 }, rotation: -0.7, idHint: 'E_lightTankEast' }),
    makeUnit({ name: 'Enemy AT Gun (North)', faction: 'enemy', type: 'antiTankGun', position: { x: -3, y: 0, z: -28 }, rotation: 0, idHint: 'E_atNorth' }),
    makeUnit({ name: 'Enemy AT Gun (South)', faction: 'enemy', type: 'antiTankGun', position: { x: 4, y: 0, z: 28 }, rotation: Math.PI, idHint: 'E_atSouth' }),
    makeUnit({ name: 'Enemy AT Gun (West)', faction: 'enemy', type: 'antiTankGun', position: { x: -36, y: 0, z: -4 }, rotation: Math.PI / 2, idHint: 'E_atWest' }),
    makeUnit({ name: 'Enemy AT Gun (East)', faction: 'enemy', type: 'antiTankGun', position: { x: 36, y: 0, z: 4 }, rotation: -Math.PI / 2, idHint: 'E_atEast' }),
    makeUnit({ name: 'Enemy Mortar Team', faction: 'enemy', type: 'mortar', position: { x: 0, y: 0, z: -68 }, rotation: 0, idHint: 'E_mortar1' }),
    makeUnit({ name: 'Enemy Mortar Team 2', faction: 'enemy', type: 'mortar', position: { x: 22, y: 0, z: -64 }, rotation: 0, idHint: 'E_mortar2' }),
    makeUnit({ name: 'Enemy Infantry (East)', faction: 'enemy', type: 'infantry', position: { x: 28, y: 0, z: 4 }, rotation: 0, idHint: 'E_infEast' }),
    makeUnit({ name: 'Enemy Infantry (West)', faction: 'enemy', type: 'infantry', position: { x: -22, y: 0, z: -2 }, rotation: 0, idHint: 'E_infWest' }),
    makeUnit({ name: 'Enemy Infantry (North)', faction: 'enemy', type: 'infantry', position: { x: 6, y: 0, z: -36 }, rotation: 0, idHint: 'E_infNorth' }),
    makeUnit({ name: 'Enemy Infantry (South)', faction: 'enemy', type: 'infantry', position: { x: -8, y: 0, z: 32 }, rotation: Math.PI, idHint: 'E_infSouth' }),
    makeUnit({ name: 'Enemy Infantry (Bunker N)', faction: 'enemy', type: 'infantry', position: { x: 1.5, y: 0, z: -22 }, rotation: 0, idHint: 'E_bunkerN' }),
    makeUnit({ name: 'Enemy Infantry (Bunker S)', faction: 'enemy', type: 'infantry', position: { x: -1.5, y: 0, z: 22 }, rotation: Math.PI, idHint: 'E_bunkerS' }),
  ];

  // 2) Forward skirmish line between crossroads and northern town (~z=-100 to -130).
  const enemyForward: Unit[] = [
    makeUnit({ name: 'Fwd Light Tank Left', faction: 'enemy', type: 'lightTank', position: { x: -42, y: 0, z: -108 }, rotation: 0.4, idHint: 'E_fwdL1' }),
    makeUnit({ name: 'Fwd Light Tank Centre', faction: 'enemy', type: 'lightTank', position: { x: 0, y: 0, z: -102 }, rotation: 0, idHint: 'E_fwdL2' }),
    makeUnit({ name: 'Fwd Light Tank Right', faction: 'enemy', type: 'lightTank', position: { x: 42, y: 0, z: -108 }, rotation: -0.4, idHint: 'E_fwdL3' }),
    makeUnit({ name: 'Fwd AT Gun Left', faction: 'enemy', type: 'antiTankGun', position: { x: -20, y: 0, z: -98 }, rotation: 0, idHint: 'E_fwdAt1' }),
    makeUnit({ name: 'Fwd AT Gun Right', faction: 'enemy', type: 'antiTankGun', position: { x: 20, y: 0, z: -98 }, rotation: 0, idHint: 'E_fwdAt2' }),
    makeUnit({ name: 'Fwd Infantry Left', faction: 'enemy', type: 'infantry', position: { x: -10, y: 0, z: -112 }, rotation: 0, idHint: 'E_fwdInf1' }),
    makeUnit({ name: 'Fwd Infantry Right', faction: 'enemy', type: 'infantry', position: { x: 10, y: 0, z: -112 }, rotation: 0, idHint: 'E_fwdInf2' }),
    makeUnit({ name: 'Fwd Infantry Centre', faction: 'enemy', type: 'infantry', position: { x: 0, y: 0, z: -122 }, rotation: 0, idHint: 'E_fwdInf3' }),
  ];

  // 3) Western hamlet garrison (~x=-175, z=-65 to -100).
  const enemyWest: Unit[] = [
    makeUnit({ name: 'West Heavy Tank', faction: 'enemy', type: 'heavyTank', position: { x: -172, y: 0, z: -72 }, rotation: 0.6, idHint: 'E_wHeavy' }),
    makeUnit({ name: 'West Light Tank 1', faction: 'enemy', type: 'lightTank', position: { x: -155, y: 0, z: -58 }, rotation: 0.4, idHint: 'E_wL1' }),
    makeUnit({ name: 'West Light Tank 2', faction: 'enemy', type: 'lightTank', position: { x: -190, y: 0, z: -82 }, rotation: 0.8, idHint: 'E_wL2' }),
    makeUnit({ name: 'West AT Gun 1', faction: 'enemy', type: 'antiTankGun', position: { x: -162, y: 0, z: -54 }, rotation: Math.PI / 4, idHint: 'E_wAt1' }),
    makeUnit({ name: 'West AT Gun 2', faction: 'enemy', type: 'antiTankGun', position: { x: -185, y: 0, z: -92 }, rotation: Math.PI / 3, idHint: 'E_wAt2' }),
    makeUnit({ name: 'West Mortar', faction: 'enemy', type: 'mortar', position: { x: -178, y: 0, z: -108 }, rotation: 0, idHint: 'E_wMortar' }),
    makeUnit({ name: 'West Infantry 1', faction: 'enemy', type: 'infantry', position: { x: -160, y: 0, z: -68 }, rotation: 0.5, idHint: 'E_wInf1' }),
    makeUnit({ name: 'West Infantry 2', faction: 'enemy', type: 'infantry', position: { x: -178, y: 0, z: -76 }, rotation: 0.5, idHint: 'E_wInf2' }),
    makeUnit({ name: 'West Infantry 3', faction: 'enemy', type: 'infantry', position: { x: -156, y: 0, z: -84 }, rotation: 0.5, idHint: 'E_wInf3' }),
    makeUnit({ name: 'West Infantry 4', faction: 'enemy', type: 'infantry', position: { x: -183, y: 0, z: -66 }, rotation: 0.5, idHint: 'E_wInf4' }),
  ];

  // 4) Eastern hamlet garrison (~x=+175, z=-65 to -100).
  const enemyEast: Unit[] = [
    makeUnit({ name: 'East Heavy Tank', faction: 'enemy', type: 'heavyTank', position: { x: 172, y: 0, z: -72 }, rotation: -0.6, idHint: 'E_eHeavy' }),
    makeUnit({ name: 'East Light Tank 1', faction: 'enemy', type: 'lightTank', position: { x: 155, y: 0, z: -58 }, rotation: -0.4, idHint: 'E_eL1' }),
    makeUnit({ name: 'East Light Tank 2', faction: 'enemy', type: 'lightTank', position: { x: 190, y: 0, z: -82 }, rotation: -0.8, idHint: 'E_eL2' }),
    makeUnit({ name: 'East AT Gun 1', faction: 'enemy', type: 'antiTankGun', position: { x: 162, y: 0, z: -54 }, rotation: -Math.PI / 4, idHint: 'E_eAt1' }),
    makeUnit({ name: 'East AT Gun 2', faction: 'enemy', type: 'antiTankGun', position: { x: 185, y: 0, z: -92 }, rotation: -Math.PI / 3, idHint: 'E_eAt2' }),
    makeUnit({ name: 'East Mortar', faction: 'enemy', type: 'mortar', position: { x: 178, y: 0, z: -108 }, rotation: 0, idHint: 'E_eMortar' }),
    makeUnit({ name: 'East Infantry 1', faction: 'enemy', type: 'infantry', position: { x: 160, y: 0, z: -68 }, rotation: -0.5, idHint: 'E_eInf1' }),
    makeUnit({ name: 'East Infantry 2', faction: 'enemy', type: 'infantry', position: { x: 178, y: 0, z: -76 }, rotation: -0.5, idHint: 'E_eInf2' }),
    makeUnit({ name: 'East Infantry 3', faction: 'enemy', type: 'infantry', position: { x: 156, y: 0, z: -84 }, rotation: -0.5, idHint: 'E_eInf3' }),
    makeUnit({ name: 'East Infantry 4', faction: 'enemy', type: 'infantry', position: { x: 183, y: 0, z: -66 }, rotation: -0.5, idHint: 'E_eInf4' }),
  ];

  // 5) Northern town — the main enemy stronghold (~z=-165 to -225).
  const enemyNorth: Unit[] = [
    makeUnit({ name: 'North Heavy Tank 1', faction: 'enemy', type: 'heavyTank', position: { x: -14, y: 0, z: -192 }, rotation: 0, idHint: 'E_nHeavy1' }),
    makeUnit({ name: 'North Heavy Tank 2', faction: 'enemy', type: 'heavyTank', position: { x: 14, y: 0, z: -192 }, rotation: 0, idHint: 'E_nHeavy2' }),
    makeUnit({ name: 'North Light Tank 1', faction: 'enemy', type: 'lightTank', position: { x: 0, y: 0, z: -174 }, rotation: 0, idHint: 'E_nL1' }),
    makeUnit({ name: 'North Light Tank 2', faction: 'enemy', type: 'lightTank', position: { x: -32, y: 0, z: -184 }, rotation: 0.3, idHint: 'E_nL2' }),
    makeUnit({ name: 'North Light Tank 3', faction: 'enemy', type: 'lightTank', position: { x: 32, y: 0, z: -184 }, rotation: -0.3, idHint: 'E_nL3' }),
    makeUnit({ name: 'North AT Gun 1', faction: 'enemy', type: 'antiTankGun', position: { x: -10, y: 0, z: -176 }, rotation: 0, idHint: 'E_nAt1' }),
    makeUnit({ name: 'North AT Gun 2', faction: 'enemy', type: 'antiTankGun', position: { x: 10, y: 0, z: -176 }, rotation: 0, idHint: 'E_nAt2' }),
    makeUnit({ name: 'North AT Gun 3', faction: 'enemy', type: 'antiTankGun', position: { x: -22, y: 0, z: -202 }, rotation: 0, idHint: 'E_nAt3' }),
    makeUnit({ name: 'North AT Gun 4', faction: 'enemy', type: 'antiTankGun', position: { x: 22, y: 0, z: -202 }, rotation: 0, idHint: 'E_nAt4' }),
    makeUnit({ name: 'North Mortar 1', faction: 'enemy', type: 'mortar', position: { x: 0, y: 0, z: -222 }, rotation: 0, idHint: 'E_nMortar1' }),
    makeUnit({ name: 'North Mortar 2', faction: 'enemy', type: 'mortar', position: { x: -26, y: 0, z: -218 }, rotation: 0, idHint: 'E_nMortar2' }),
    makeUnit({ name: 'North Infantry 1', faction: 'enemy', type: 'infantry', position: { x: -16, y: 0, z: -184 }, rotation: 0, idHint: 'E_nInf1' }),
    makeUnit({ name: 'North Infantry 2', faction: 'enemy', type: 'infantry', position: { x: 16, y: 0, z: -184 }, rotation: 0, idHint: 'E_nInf2' }),
    makeUnit({ name: 'North Infantry 3', faction: 'enemy', type: 'infantry', position: { x: 0, y: 0, z: -196 }, rotation: 0, idHint: 'E_nInf3' }),
    makeUnit({ name: 'North Infantry 4', faction: 'enemy', type: 'infantry', position: { x: -12, y: 0, z: -206 }, rotation: 0, idHint: 'E_nInf4' }),
    makeUnit({ name: 'North Infantry 5', faction: 'enemy', type: 'infantry', position: { x: 12, y: 0, z: -206 }, rotation: 0, idHint: 'E_nInf5' }),
    makeUnit({ name: 'North Infantry 6', faction: 'enemy', type: 'infantry', position: { x: -26, y: 0, z: -190 }, rotation: 0, idHint: 'E_nInf6' }),
    makeUnit({ name: 'North Infantry 7', faction: 'enemy', type: 'infantry', position: { x: 26, y: 0, z: -190 }, rotation: 0, idHint: 'E_nInf7' }),
    makeUnit({ name: 'North Infantry 8', faction: 'enemy', type: 'infantry', position: { x: 0, y: 0, z: -177 }, rotation: 0, idHint: 'E_nInf8' }),
  ];

  // 6) Deep northern flanks (final reserve, z≈-240 to -270).
  const enemyDeep: Unit[] = [
    makeUnit({ name: 'Deep Light Tank Left', faction: 'enemy', type: 'lightTank', position: { x: -62, y: 0, z: -248 }, rotation: 0, idHint: 'E_deepL1' }),
    makeUnit({ name: 'Deep Light Tank Right', faction: 'enemy', type: 'lightTank', position: { x: 62, y: 0, z: -248 }, rotation: 0, idHint: 'E_deepL2' }),
    makeUnit({ name: 'Deep Mortar Left', faction: 'enemy', type: 'mortar', position: { x: -42, y: 0, z: -242 }, rotation: 0, idHint: 'E_deepMortar1' }),
    makeUnit({ name: 'Deep Mortar Right', faction: 'enemy', type: 'mortar', position: { x: 42, y: 0, z: -242 }, rotation: 0, idHint: 'E_deepMortar2' }),
    makeUnit({ name: 'Deep Infantry 1', faction: 'enemy', type: 'infantry', position: { x: -22, y: 0, z: -258 }, rotation: 0, idHint: 'E_deepInf1' }),
    makeUnit({ name: 'Deep Infantry 2', faction: 'enemy', type: 'infantry', position: { x: 22, y: 0, z: -258 }, rotation: 0, idHint: 'E_deepInf2' }),
    makeUnit({ name: 'Deep Infantry 3', faction: 'enemy', type: 'infantry', position: { x: -44, y: 0, z: -264 }, rotation: 0, idHint: 'E_deepInf3' }),
    makeUnit({ name: 'Deep Infantry 4', faction: 'enemy', type: 'infantry', position: { x: 44, y: 0, z: -264 }, rotation: 0, idHint: 'E_deepInf4' }),
  ];

  const enemy = [...enemyCentral, ...enemyForward, ...enemyWest, ...enemyEast, ...enemyNorth, ...enemyDeep];

  // ── Patrol orders ──────────────────────────────────────────────────────────
  // Central area patrols (existing).
  const lightTank = enemy.find((u) => u.id === 'E_lightTank');
  if (lightTank) {
    lightTank.currentOrder = { kind: 'patrol', patrolFrom: { x: 14, y: 0, z: -10 }, patrolTo: { x: -14, y: 0, z: 10 }, destination: { x: -14, y: 0, z: 10 } };
    lightTank.aiState = 'patrol';
  }
  const lightTankEast = enemy.find((u) => u.id === 'E_lightTankEast');
  if (lightTankEast) {
    lightTankEast.currentOrder = { kind: 'patrol', patrolFrom: { x: 36, y: 0, z: -22 }, patrolTo: { x: 26, y: 0, z: 14 }, destination: { x: 26, y: 0, z: 14 } };
    lightTankEast.aiState = 'patrol';
  }
  // Forward skirmish patrols.
  const patrols: Array<[string, number, number, number, number]> = [
    ['E_fwdL1', -80, -90, -20, -128],
    ['E_fwdL2', -32, -90, 32, -118],
    ['E_fwdL3', 80, -90, 20, -128],
    // Hamlet patrols.
    ['E_wL1', -132, -52, -172, -52],
    ['E_wL2', -192, -62, -155, -102],
    ['E_eL1', 132, -52, 172, -52],
    ['E_eL2', 192, -62, 155, -102],
    // Northern town patrols.
    ['E_nL1', -12, -155, 12, -215],
    ['E_nL2', -62, -168, -22, -198],
    ['E_nL3', 62, -168, 22, -198],
    // Deep north patrols.
    ['E_deepL1', -92, -238, -32, -268],
    ['E_deepL2', 92, -238, 32, -268],
  ];
  for (const [id, fx, fz, tx, tz] of patrols) {
    const u = enemy.find((u) => u.id === id);
    if (u) {
      u.currentOrder = {
        kind: 'patrol',
        patrolFrom: { x: fx, y: 0, z: fz },
        patrolTo: { x: tx, y: 0, z: tz },
        destination: { x: tx, y: 0, z: tz },
      };
      u.aiState = 'patrol';
    }
  }

  // All non-patrol enemies hold position.
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
      'A reinforced Allied armored task force — two heavy tanks, five Shermans, three scout ' +
        'tanks, two recon jeeps and three rifle squads — has been ordered to seize a strongly ' +
        'defended village crossroads at the heart of the enemy line. Recon reports a layered ' +
        'defence: a dug-in heavy tank and anti-tank screen at the crossroads itself, forward ' +
        'light-tank patrols covering the mid-field, two fortified hamlets anchoring the flanks, ' +
        'and a full garrisoned town four hundred metres to the north backed by deep mortar reserve.',
      'Use the tactical map to issue move and attack-move orders, or jump into a tank to ' +
        'lead the assault personally. Walls are destructible — splash damage and direct ' +
        'cannon fire will collapse buildings, opening new firing lanes. Consider flanking ' +
        'through the western or eastern hamlet to avoid the central AT screen. Hold the ' +
        'central crossroads for thirty seconds with at least one surviving combat unit to ' +
        'claim victory.',
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
