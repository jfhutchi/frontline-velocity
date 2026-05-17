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

function bldg(
  prefix: string,
  idx: number,
  x: number,
  z: number,
  rot: number,
  w: number,
  h: number,
  d: number,
  style: BuildingStyle,
): MapDecoration {
  return deco(`bldg_${prefix}${idx}`, 'building', x, z, rot, { x: w, y: h, z: d }, 'wall', {
    buildingStyle: style,
    destructible: true,
  });
}

function buildDecorations(): MapDecoration[] {
  const out: MapDecoration[] = [];
  const H = MAP_SIZE; // 600

  // ─── ROAD NETWORK ──────────────────────────────────────────────────────────
  const rw = 9; // road width
  // Main cross highways
  out.push(deco('road_h', 'road', 0, 0, 0, { x: H, y: 0.05, z: rw }, 'asphalt'));
  out.push(deco('road_v', 'road', 0, 0, 0, { x: rw, y: 0.05, z: H }, 'asphalt'));
  // Ring roads E-W at ±150
  out.push(deco('road_north_ring', 'road', 0, -150, 0, { x: H * 0.88, y: 0.05, z: 6 }, 'asphalt'));
  out.push(deco('road_south_ring', 'road', 0, 150, 0, { x: H * 0.88, y: 0.05, z: 6 }, 'asphalt'));
  // Ring roads N-S at ±150
  out.push(deco('road_west_ring', 'road', -150, 0, 0, { x: 6, y: 0.05, z: H * 0.82 }, 'dirt'));
  out.push(deco('road_east_ring', 'road', 150, 0, 0, { x: 6, y: 0.05, z: H * 0.82 }, 'dirt'));
  // Local cross-streets flanking the central village
  out.push(deco('road_h2', 'road', 0, -38, 0, { x: H * 0.38, y: 0.05, z: 6 }, 'asphalt'));
  out.push(deco('road_h3', 'road', 0, 38, 0, { x: H * 0.38, y: 0.05, z: 6 }, 'asphalt'));
  out.push(deco('road_v2', 'road', -42, 0, 0, { x: 6, y: 0.05, z: H * 0.38 }, 'asphalt'));
  out.push(deco('road_v3', 'road', 42, 0, 0, { x: 6, y: 0.05, z: H * 0.38 }, 'asphalt'));
  // Diagonal approach lanes
  out.push(deco('road_diag_nw', 'road', -90, -128, -0.52, { x: 7, y: 0.04, z: 118 }, 'dirt'));
  out.push(deco('road_diag_ne', 'road', 88, -126, 0.48, { x: 7, y: 0.04, z: 114 }, 'dirt'));
  out.push(deco('road_diag_sw', 'road', -88, 128, 0.40, { x: 6, y: 0.04, z: 98 }, 'dirt'));
  out.push(deco('road_diag_se', 'road', 90, 120, -0.44, { x: 6, y: 0.04, z: 96 }, 'dirt'));
  // Far approach spurs
  out.push(deco('road_north_spur', 'road', -22, -232, 0.10, { x: 6, y: 0.04, z: 58 }, 'dirt'));
  out.push(deco('road_east_spur', 'road', 180, 30, Math.PI / 2, { x: 6, y: 0.04, z: 68 }, 'asphalt'));

  // ─── CENTRAL CROSSROADS VILLAGE (dense urban core, 0, 0) ───────────────────
  const centralBlocks: Array<[number, number, number, number, number, number, BuildingStyle]> = [
    [-18, -18, 0, 8, 4, 6, 'house'],
    [-22, -10, 0, 6, 5, 5, 'house'],
    [-30, -22, 0.15, 7, 4, 6, 'house'],
    [-36, -8, 0, 6, 5, 5, 'house'],
    [-42, -28, 0.10, 9, 5, 7, 'barn'],
    [18, -20, 0.30, 9, 5, 7, 'barn'],
    [22, -8, 0, 5, 4, 5, 'house'],
    [28, -16, -0.20, 7, 5, 6, 'house'],
    [34, -6, 0, 9, 6, 7, 'factory'],
    [-20, 20, 0, 7, 4, 6, 'house'],
    [20, 18, 0.20, 8, 5, 6, 'house'],
    [12, 10, 0, 5, 4, 5, 'house'],
    [-12, 10, 0, 6, 4, 5, 'house'],
    [-30, 24, 0, 8, 7, 7, 'church'],
    [30, 28, -0.18, 9, 4, 6, 'barn'],
    [-44, 16, 0.10, 6, 5, 5, 'house'],
    [44, 12, -0.10, 6, 5, 5, 'house'],
    [-58, -36, 0, 9, 6, 7, 'factory'],
    [56, -36, -0.10, 9, 6, 7, 'factory'],
    [-58, 38, 0.15, 8, 5, 6, 'barn'],
    [54, 40, 0, 8, 5, 6, 'barn'],
    [0, -22, 0, 5, 2.6, 4, 'bunker'],
    [0, 22, 0, 5, 2.6, 4, 'bunker'],
  ];
  centralBlocks.forEach((b, i) => out.push(bldg('c', i, b[0], b[1], b[2], b[3], b[4], b[5], b[6])));

  // ─── NORTHERN TOWN (~-20, -200) ─────────────────────────────────────────────
  const northBlocks: Array<[number, number, number, number, number, number, BuildingStyle]> = [
    [-22, -198, 0, 7, 5, 6, 'house'],
    [-14, -206, 0, 8, 7, 7, 'church'],
    [-32, -206, 0.10, 7, 4, 6, 'house'],
    [-40, -196, 0, 6, 5, 5, 'house'],
    [-8, -196, 0, 6, 4, 5, 'house'],
    [4, -204, -0.10, 8, 5, 7, 'barn'],
    [-26, -216, 0.15, 9, 4, 6, 'barn'],
    [-46, -210, 0, 9, 6, 7, 'factory'],
    [-18, -188, 0, 5, 2.6, 4, 'bunker'],
    [8, -192, 0, 5, 2.6, 4, 'bunker'],
  ];
  northBlocks.forEach((b, i) => out.push(bldg('n', i, b[0], b[1], b[2], b[3], b[4], b[5], b[6])));

  // ─── EASTERN DEPOT (~200, 30) ────────────────────────────────────────────────
  const eastBlocks: Array<[number, number, number, number, number, number, BuildingStyle]> = [
    [194, 28, 0, 11, 7, 8, 'factory'],
    [206, 38, 0, 9, 6, 7, 'factory'],
    [188, 42, 0.10, 8, 5, 6, 'barn'],
    [200, 16, 0, 7, 5, 6, 'house'],
    [214, 20, 0, 6, 4, 5, 'house'],
    [194, 50, -0.10, 8, 4, 6, 'house'],
    [210, 50, 0, 6, 5, 5, 'house'],
    [182, 22, 0, 5, 2.6, 4, 'bunker'],
    [216, 36, 0, 5, 2.6, 4, 'bunker'],
  ];
  eastBlocks.forEach((b, i) => out.push(bldg('e', i, b[0], b[1], b[2], b[3], b[4], b[5], b[6])));

  // ─── WESTERN HAMLET (~-200, -60) ─────────────────────────────────────────────
  const westBlocks: Array<[number, number, number, number, number, number, BuildingStyle]> = [
    [-198, -62, 0, 7, 4, 6, 'house'],
    [-206, -54, 0.10, 6, 5, 5, 'house'],
    [-190, -72, 0, 8, 4, 6, 'house'],
    [-214, -68, -0.10, 9, 5, 7, 'barn'],
    [-202, -78, 0, 8, 7, 7, 'church'],
    [-190, -52, 0, 5, 4, 5, 'house'],
    [-218, -58, 0, 5, 2.6, 4, 'bunker'],
  ];
  westBlocks.forEach((b, i) => out.push(bldg('w', i, b[0], b[1], b[2], b[3], b[4], b[5], b[6])));

  // ─── SOUTHERN FARMSTEAD (~-80, 220) ──────────────────────────────────────────
  const southBlocks: Array<[number, number, number, number, number, number, BuildingStyle]> = [
    [-82, 218, 0, 12, 5, 8, 'barn'],
    [-92, 228, 0.10, 9, 4, 7, 'barn'],
    [-70, 226, 0, 7, 4, 6, 'house'],
    [-78, 236, 0, 8, 5, 6, 'house'],
    [-94, 212, 0, 6, 4, 5, 'house'],
    [-66, 214, -0.10, 6, 5, 5, 'house'],
  ];
  southBlocks.forEach((b, i) => out.push(bldg('s', i, b[0], b[1], b[2], b[3], b[4], b[5], b[6])));

  // ─── NE MILITARY OUTPOST (~155, -155) ────────────────────────────────────────
  const neBlocks: Array<[number, number, number, number, number, number, BuildingStyle]> = [
    [155, -152, 0, 10, 3, 8, 'bunker'],
    [163, -164, 0, 8, 2.6, 6, 'bunker'],
    [145, -162, 0.10, 9, 5, 7, 'factory'],
    [168, -148, 0, 7, 4, 6, 'house'],
    [150, -142, 0, 6, 5, 5, 'house'],
    [172, -168, 0, 5, 2.6, 4, 'bunker'],
  ];
  neBlocks.forEach((b, i) => out.push(bldg('ne', i, b[0], b[1], b[2], b[3], b[4], b[5], b[6])));

  // ─── LINEAR DETAILS: hedgerows, stone walls, fences ──────────────────────────
  type LD = [string, MapDecoration['kind'], number, number, number, number, number, MapDecoration['tint']];
  const linearDetails: LD[] = [
    // Central village perimeter
    ['hedge_west_field', 'hedgerow', -70, 18, 0.10, 48, 2.3, 'shrub'],
    ['hedge_east_field', 'hedgerow', 70, 20, -0.08, 50, 2.2, 'shrub'],
    ['hedge_south_l', 'hedgerow', -42, 62, -0.34, 52, 2.1, 'shrub'],
    ['hedge_south_r', 'hedgerow', 38, 62, 0.24, 48, 2.1, 'shrub'],
    ['hedge_north_l', 'hedgerow', -52, -50, 0.82, 44, 2.0, 'shrub'],
    ['hedge_north_r', 'hedgerow', 52, -48, -0.64, 44, 2.0, 'shrub'],
    ['wall_church_front', 'stoneWall', -30, 14, 0, 20, 1.0, 'stone'],
    ['wall_church_side', 'stoneWall', -40, 24, Math.PI / 2, 18, 1.0, 'stone'],
    ['wall_sq_west', 'stoneWall', -12, -4, Math.PI / 2, 18, 0.9, 'stone'],
    ['wall_sq_east', 'stoneWall', 12, 4, Math.PI / 2, 18, 0.9, 'stone'],
    ['fence_south_field', 'fence', -57, 78, -0.18, 44, 0.8, 'wood'],
    ['fence_east_field', 'fence', 78, 50, Math.PI / 2, 42, 0.8, 'wood'],
    // Northern town
    ['hedge_north_town', 'hedgerow', -24, -180, 0.05, 60, 2.2, 'shrub'],
    ['wall_north_church', 'stoneWall', -14, -222, 0, 24, 1.0, 'stone'],
    ['fence_north_farm', 'fence', -36, -224, Math.PI / 2, 36, 0.8, 'wood'],
    ['wall_north_approach', 'stoneWall', -8, -170, 0, 30, 1.1, 'stone'],
    // Eastern depot perimeter
    ['wall_depot_e', 'stoneWall', 226, 34, Math.PI / 2, 50, 1.2, 'stone'],
    ['fence_depot_s', 'fence', 200, 60, 0, 50, 0.8, 'wood'],
    ['wall_depot_n', 'stoneWall', 198, 8, 0, 40, 1.0, 'stone'],
    // Western hamlet
    ['hedge_west_town', 'hedgerow', -216, -58, 0, 40, 2.1, 'shrub'],
    ['wall_west_church', 'stoneWall', -202, -92, 0, 22, 1.0, 'stone'],
    ['fence_west_lane', 'fence', -176, -65, Math.PI / 2, 38, 0.8, 'wood'],
    // Southern farmstead
    ['fence_farm_n', 'fence', -80, 208, 0, 60, 0.8, 'wood'],
    ['fence_farm_e', 'fence', -50, 224, Math.PI / 2, 40, 0.8, 'wood'],
    ['fence_farm_w', 'fence', -110, 224, Math.PI / 2, 40, 0.8, 'wood'],
    // NE military outpost perimeter
    ['wall_ne_n', 'stoneWall', 158, -178, 0, 44, 1.2, 'stone'],
    ['wall_ne_w', 'stoneWall', 136, -158, Math.PI / 2, 40, 1.2, 'stone'],
    // Mid-map hedge lines (aid navigation / cover)
    ['hedge_mid_nw', 'hedgerow', -110, -100, 0.18, 60, 2.0, 'shrub'],
    ['hedge_mid_ne', 'hedgerow', 110, -110, -0.22, 56, 2.0, 'shrub'],
    ['hedge_mid_sw', 'hedgerow', -120, 110, 0.12, 58, 2.1, 'shrub'],
    ['hedge_mid_se', 'hedgerow', 115, 105, -0.15, 52, 2.0, 'shrub'],
  ];
  linearDetails.forEach(([id, kind, x, z, rot, length, width, tint]) => {
    out.push(deco(id, kind, x, z, rot, { x: length, y: 1.2, z: width }, tint));
  });

  // Road signs at key navigation points
  out.push(deco('sign_crossroads', 'roadSign', 7, 8, -0.35, { x: 1, y: 2, z: 1 }, 'wood'));
  out.push(deco('sign_south', 'roadSign', -20, 58, 0.20, { x: 1, y: 2.2, z: 1 }, 'wood'));
  out.push(deco('sign_north_jct', 'roadSign', 4, -128, 0.10, { x: 1, y: 2.2, z: 1 }, 'wood'));
  out.push(deco('sign_east_jct', 'roadSign', 140, -4, Math.PI / 2, { x: 1, y: 2.2, z: 1 }, 'wood'));

  // ─── TREES (controlled density, clustered around villages + perimeter) ────────
  const rng = mulberry32(1337);
  const treeSeed: Array<[number, number, 'pine' | 'oak' | 'shrub']> = [];
  const half = H / 2;
  for (let i = 0; i < 520; i += 1) {
    const x = (rng() - 0.5) * (H - 20);
    const z = (rng() - 0.5) * (H - 20);
    // Skip main road grid
    if (Math.abs(x) < 12 || Math.abs(z) < 12) continue;
    // Skip ring roads
    if (Math.abs(z + 150) < 9 && Math.abs(x) < half * 0.9) continue;
    if (Math.abs(z - 150) < 9 && Math.abs(x) < half * 0.9) continue;
    if (Math.abs(x + 150) < 8 || Math.abs(x - 150) < 8) continue;
    // Skip village cores (clearance radius)
    if (Math.hypot(x, z) < 52) continue;
    if (Math.hypot(x + 20, z + 200) < 38) continue;
    if (Math.hypot(x - 200, z - 30) < 38) continue;
    if (Math.hypot(x + 200, z + 60) < 32) continue;
    if (Math.hypot(x + 80, z - 220) < 32) continue;
    if (Math.hypot(x - 155, z + 155) < 32) continue;
    treeSeed.push([x, z, rng() > 0.54 ? 'pine' : rng() > 0.25 ? 'oak' : 'shrub']);
  }
  treeSeed.forEach((t, i) => {
    const [x, z, kind] = t;
    const height = kind === 'shrub' ? 1.1 + rng() * 0.8 : 3 + rng() * 2.5;
    out.push(deco(`tree_${i}`, 'tree', x, z, rng() * Math.PI * 2, { x: 1.4, y: height, z: 1.4 }, kind));
  });

  // ─── FIELD PATCHES ────────────────────────────────────────────────────────────
  for (let i = 0; i < 42; i += 1) {
    const x = (rng() - 0.5) * (H - 40);
    const z = (rng() - 0.5) * (H - 40);
    if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
    const w = 12 + rng() * 24;
    const d = 12 + rng() * 24;
    out.push(deco(`field_${i}`, 'fieldPatch', x, z, rng() * Math.PI, { x: w, y: 0.02, z: d }, 'grass'));
  }
  const setPieceFields: Array<[number, number, number, number, number]> = [
    // Near central village
    [-74, 54, 0.18, 34, 26],
    [-42, 58, 0.12, 26, 22],
    [72, 58, -0.28, 32, 24],
    [-78, -44, 0.44, 30, 22],
    [78, -52, -0.36, 34, 24],
    // Mid-map
    [-160, -122, 0.22, 42, 30],
    [160, -118, -0.18, 38, 26],
    [-130, 182, 0.34, 38, 26],
    [130, 178, -0.28, 44, 32],
    // Outer edges
    [-220, 78, 0.10, 40, 30],
    [222, -82, 0.24, 38, 28],
    [-200, -170, 0.14, 36, 24],
    [200, 170, -0.18, 40, 28],
  ];
  setPieceFields.forEach(([x, z, rot, w, d], i) => {
    out.push(deco(`crop_sp_${i}`, 'fieldPatch', x, z, rot, { x: w, y: 0.022, z: d }, 'grass'));
  });

  // ─── HILLS ────────────────────────────────────────────────────────────────────
  const hills: Array<[number, number, number]> = [
    // Inner ring (same as original)
    [-72, -52, 16],
    [70, -68, 18],
    [86, 38, 14],
    [-86, 60, 20],
    [0, -98, 22],
    [0, 98, 20],
    // Outer ring for expanded map
    [-180, -82, 24],
    [192, -102, 20],
    [-192, 102, 22],
    [182, 102, 18],
    [-124, -212, 28],
    [122, -192, 24],
    [-102, 212, 20],
    [104, 220, 22],
    [0, -232, 26],
    [-252, 0, 30],
    [252, 42, 28],
    // Far corners
    [-262, -222, 32],
    [258, -228, 28],
    [-240, 228, 30],
    [244, 232, 26],
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
  // ── Friendly task force (15 units) — staging south at z≈250-280 ─────────────
  const friendly: Unit[] = [
    // Heavy tank troop — spearhead
    makeUnit({ name: 'Heavy Tank Iron', faction: 'friendly', type: 'heavyTank', position: { x: -24, y: 0, z: 278 }, rotation: -Math.PI, idHint: 'F_iron' }),
    makeUnit({ name: 'Heavy Tank Steel', faction: 'friendly', type: 'heavyTank', position: { x: 24, y: 0, z: 278 }, rotation: -Math.PI, idHint: 'F_steel' }),
    makeUnit({ name: 'Heavy Tank Hammer', faction: 'friendly', type: 'heavyTank', position: { x: 0, y: 0, z: 270 }, rotation: -Math.PI, idHint: 'F_hammer' }),
    // Medium tank line
    makeUnit({ name: 'Medium Tank Alpha', faction: 'friendly', type: 'mediumTank', position: { x: -12, y: 0, z: 264 }, rotation: -Math.PI, idHint: 'F_alpha' }),
    makeUnit({ name: 'Medium Tank Bravo', faction: 'friendly', type: 'mediumTank', position: { x: 12, y: 0, z: 264 }, rotation: -Math.PI, idHint: 'F_bravo' }),
    makeUnit({ name: 'Medium Tank Charlie', faction: 'friendly', type: 'mediumTank', position: { x: -36, y: 0, z: 260 }, rotation: -Math.PI, idHint: 'F_charlie' }),
    makeUnit({ name: 'Medium Tank Delta', faction: 'friendly', type: 'mediumTank', position: { x: 36, y: 0, z: 260 }, rotation: -Math.PI, idHint: 'F_delta' }),
    makeUnit({ name: 'Medium Tank Echo', faction: 'friendly', type: 'mediumTank', position: { x: 0, y: 0, z: 252 }, rotation: -Math.PI, idHint: 'F_echo' }),
    // Recon screen
    makeUnit({ name: 'Recon Jeep Baker', faction: 'friendly', type: 'reconJeep', position: { x: 52, y: 0, z: 270 }, rotation: -Math.PI, idHint: 'F_jeepB' }),
    makeUnit({ name: 'Recon Jeep Charlie', faction: 'friendly', type: 'reconJeep', position: { x: -52, y: 0, z: 270 }, rotation: -Math.PI, idHint: 'F_jeepC' }),
    // Infantry
    makeUnit({ name: 'Infantry Alpha', faction: 'friendly', type: 'infantry', position: { x: -20, y: 0, z: 254 }, rotation: -Math.PI, idHint: 'F_infA' }),
    makeUnit({ name: 'Infantry Bravo', faction: 'friendly', type: 'infantry', position: { x: 20, y: 0, z: 254 }, rotation: -Math.PI, idHint: 'F_infB' }),
    makeUnit({ name: 'Infantry Charlie', faction: 'friendly', type: 'infantry', position: { x: 0, y: 0, z: 246 }, rotation: -Math.PI, idHint: 'F_infC' }),
    makeUnit({ name: 'Scout Team Alpha', faction: 'friendly', type: 'infantry', position: { x: 62, y: 0, z: 258 }, rotation: -Math.PI, idHint: 'F_scoutA' }),
    makeUnit({ name: 'Scout Team Bravo', faction: 'friendly', type: 'infantry', position: { x: -62, y: 0, z: 258 }, rotation: -Math.PI, idHint: 'F_scoutB' }),
  ];

  // ── Enemy forces (~46 units) spread across five named objectives ─────────────

  // GROUP 1: Central Defense — crossroads village and approaches
  const enemyCentral: Unit[] = [
    makeUnit({ name: 'Enemy Heavy (Alpha)', faction: 'enemy', type: 'heavyTank', position: { x: -2, y: 0, z: -30 }, rotation: 0, idHint: 'E_heavy1' }),
    makeUnit({ name: 'Enemy Heavy (Beta)', faction: 'enemy', type: 'heavyTank', position: { x: -20, y: 0, z: -55 }, rotation: 0.20, idHint: 'E_heavy2' }),
    makeUnit({ name: 'Enemy Light (Alpha)', faction: 'enemy', type: 'lightTank', position: { x: 14, y: 0, z: -16 }, rotation: 0, idHint: 'E_ltA' }),
    makeUnit({ name: 'Enemy Light (Beta)', faction: 'enemy', type: 'lightTank', position: { x: 50, y: 0, z: -35 }, rotation: -0.70, idHint: 'E_ltB' }),
    makeUnit({ name: 'Enemy AT Gun 1', faction: 'enemy', type: 'antiTankGun', position: { x: -4, y: 0, z: -40 }, rotation: 0, idHint: 'E_at1' }),
    makeUnit({ name: 'Enemy AT Gun 2', faction: 'enemy', type: 'antiTankGun', position: { x: 6, y: 0, z: -40 }, rotation: 0, idHint: 'E_at2' }),
    makeUnit({ name: 'Enemy AT Gun 3', faction: 'enemy', type: 'antiTankGun', position: { x: -38, y: 0, z: -8 }, rotation: Math.PI / 2, idHint: 'E_at3' }),
    makeUnit({ name: 'Enemy AT Gun 4', faction: 'enemy', type: 'antiTankGun', position: { x: 40, y: 0, z: -10 }, rotation: -Math.PI / 2, idHint: 'E_at4' }),
    makeUnit({ name: 'Enemy AT Gun 5', faction: 'enemy', type: 'antiTankGun', position: { x: 4, y: 0, z: 28 }, rotation: Math.PI, idHint: 'E_at5' }),
    makeUnit({ name: 'Enemy Mortar 1', faction: 'enemy', type: 'mortar', position: { x: 6, y: 0, z: -90 }, rotation: 0, idHint: 'E_mortar1' }),
    makeUnit({ name: 'Enemy Mortar 2', faction: 'enemy', type: 'mortar', position: { x: -22, y: 0, z: -82 }, rotation: 0, idHint: 'E_mortar2' }),
    makeUnit({ name: 'Enemy Mortar 3', faction: 'enemy', type: 'mortar', position: { x: 22, y: 0, z: -82 }, rotation: 0, idHint: 'E_mortar3' }),
    makeUnit({ name: 'Enemy Infantry 1', faction: 'enemy', type: 'infantry', position: { x: -2, y: 0, z: -22 }, rotation: 0, idHint: 'E_inf1' }),
    makeUnit({ name: 'Enemy Infantry 2', faction: 'enemy', type: 'infantry', position: { x: 26, y: 0, z: 4 }, rotation: 0, idHint: 'E_inf2' }),
    makeUnit({ name: 'Enemy Infantry 3', faction: 'enemy', type: 'infantry', position: { x: -22, y: 0, z: -6 }, rotation: 0, idHint: 'E_inf3' }),
    makeUnit({ name: 'Enemy Infantry 4', faction: 'enemy', type: 'infantry', position: { x: 4, y: 0, z: 32 }, rotation: Math.PI, idHint: 'E_inf4' }),
    makeUnit({ name: 'Enemy Infantry 5', faction: 'enemy', type: 'infantry', position: { x: -4, y: 0, z: -68 }, rotation: 0, idHint: 'E_inf5' }),
  ];

  // GROUP 2: Northern Town Garrison
  const enemyNorth: Unit[] = [
    makeUnit({ name: 'Enemy Heavy (North)', faction: 'enemy', type: 'heavyTank', position: { x: -18, y: 0, z: -218 }, rotation: 0, idHint: 'E_heavyN' }),
    makeUnit({ name: 'Enemy Light (North)', faction: 'enemy', type: 'lightTank', position: { x: -40, y: 0, z: -192 }, rotation: 0, idHint: 'E_ltN' }),
    makeUnit({ name: 'Enemy AT Gun (N1)', faction: 'enemy', type: 'antiTankGun', position: { x: -12, y: 0, z: -196 }, rotation: 0, idHint: 'E_atN1' }),
    makeUnit({ name: 'Enemy AT Gun (N2)', faction: 'enemy', type: 'antiTankGun', position: { x: 8, y: 0, z: -196 }, rotation: 0, idHint: 'E_atN2' }),
    makeUnit({ name: 'Enemy Mortar (North)', faction: 'enemy', type: 'mortar', position: { x: -24, y: 0, z: -238 }, rotation: 0, idHint: 'E_mortarN' }),
    makeUnit({ name: 'Enemy Infantry (N1)', faction: 'enemy', type: 'infantry', position: { x: -28, y: 0, z: -208 }, rotation: 0, idHint: 'E_infN1' }),
    makeUnit({ name: 'Enemy Infantry (N2)', faction: 'enemy', type: 'infantry', position: { x: -8, y: 0, z: -200 }, rotation: 0, idHint: 'E_infN2' }),
    makeUnit({ name: 'Enemy Infantry (N3)', faction: 'enemy', type: 'infantry', position: { x: 4, y: 0, z: -182 }, rotation: 0, idHint: 'E_infN3' }),
  ];

  // GROUP 3: Eastern Depot
  const enemyEast: Unit[] = [
    makeUnit({ name: 'Enemy Heavy (East)', faction: 'enemy', type: 'heavyTank', position: { x: 198, y: 0, z: 22 }, rotation: -Math.PI / 2, idHint: 'E_heavyE' }),
    makeUnit({ name: 'Enemy Light (E1)', faction: 'enemy', type: 'lightTank', position: { x: 176, y: 0, z: 44 }, rotation: 0, idHint: 'E_ltE1' }),
    makeUnit({ name: 'Enemy Light (E2)', faction: 'enemy', type: 'lightTank', position: { x: 210, y: 0, z: -18 }, rotation: 0, idHint: 'E_ltE2' }),
    makeUnit({ name: 'Enemy AT Gun (E1)', faction: 'enemy', type: 'antiTankGun', position: { x: 184, y: 0, z: 36 }, rotation: -Math.PI / 2, idHint: 'E_atE1' }),
    makeUnit({ name: 'Enemy AT Gun (E2)', faction: 'enemy', type: 'antiTankGun', position: { x: 194, y: 0, z: -8 }, rotation: -Math.PI / 2, idHint: 'E_atE2' }),
    makeUnit({ name: 'Enemy Mortar (East)', faction: 'enemy', type: 'mortar', position: { x: 220, y: 0, z: 30 }, rotation: -Math.PI / 2, idHint: 'E_mortarE' }),
    makeUnit({ name: 'Enemy Infantry (E1)', faction: 'enemy', type: 'infantry', position: { x: 180, y: 0, z: 42 }, rotation: 0, idHint: 'E_infE1' }),
    makeUnit({ name: 'Enemy Infantry (E2)', faction: 'enemy', type: 'infantry', position: { x: 200, y: 0, z: 54 }, rotation: 0, idHint: 'E_infE2' }),
    makeUnit({ name: 'Enemy Infantry (E3)', faction: 'enemy', type: 'infantry', position: { x: 215, y: 0, z: 10 }, rotation: 0, idHint: 'E_infE3' }),
  ];

  // GROUP 4: NE Military Outpost
  const enemyNE: Unit[] = [
    makeUnit({ name: 'Enemy Heavy (NE)', faction: 'enemy', type: 'heavyTank', position: { x: 156, y: 0, z: -154 }, rotation: 0.30, idHint: 'E_heavyNE' }),
    makeUnit({ name: 'Enemy Light (NE)', faction: 'enemy', type: 'lightTank', position: { x: 140, y: 0, z: -172 }, rotation: 0, idHint: 'E_ltNE' }),
    makeUnit({ name: 'Enemy AT Gun (NE1)', faction: 'enemy', type: 'antiTankGun', position: { x: 148, y: 0, z: -160 }, rotation: 0, idHint: 'E_atNE1' }),
    makeUnit({ name: 'Enemy AT Gun (NE2)', faction: 'enemy', type: 'antiTankGun', position: { x: 170, y: 0, z: -154 }, rotation: 0, idHint: 'E_atNE2' }),
    makeUnit({ name: 'Enemy Infantry (NE1)', faction: 'enemy', type: 'infantry', position: { x: 160, y: 0, z: -168 }, rotation: 0, idHint: 'E_infNE1' }),
    makeUnit({ name: 'Enemy Infantry (NE2)', faction: 'enemy', type: 'infantry', position: { x: 144, y: 0, z: -148 }, rotation: 0, idHint: 'E_infNE2' }),
  ];

  // GROUP 5: Western Flank
  const enemyWest: Unit[] = [
    makeUnit({ name: 'Enemy Light (W1)', faction: 'enemy', type: 'lightTank', position: { x: -186, y: 0, z: -78 }, rotation: Math.PI / 2, idHint: 'E_ltW1' }),
    makeUnit({ name: 'Enemy Light (W2)', faction: 'enemy', type: 'lightTank', position: { x: -204, y: 0, z: -42 }, rotation: Math.PI / 2, idHint: 'E_ltW2' }),
    makeUnit({ name: 'Enemy AT Gun (West)', faction: 'enemy', type: 'antiTankGun', position: { x: -194, y: 0, z: -64 }, rotation: Math.PI / 2, idHint: 'E_atW' }),
    makeUnit({ name: 'Enemy Mortar (West)', faction: 'enemy', type: 'mortar', position: { x: -218, y: 0, z: -62 }, rotation: Math.PI / 2, idHint: 'E_mortarW' }),
    makeUnit({ name: 'Enemy Infantry (W1)', faction: 'enemy', type: 'infantry', position: { x: -198, y: 0, z: -74 }, rotation: 0, idHint: 'E_infW1' }),
    makeUnit({ name: 'Enemy Infantry (W2)', faction: 'enemy', type: 'infantry', position: { x: -178, y: 0, z: -52 }, rotation: 0, idHint: 'E_infW2' }),
  ];

  const enemy = [...enemyCentral, ...enemyNorth, ...enemyEast, ...enemyNE, ...enemyWest];

  // ── Patrol assignments ────────────────────────────────────────────────────────
  const patrols: Array<[string, { x: number; y: number; z: number }, { x: number; y: number; z: number }]> = [
    ['E_ltA', { x: 14, y: 0, z: -16 }, { x: -14, y: 0, z: 16 }],
    ['E_ltB', { x: 50, y: 0, z: -35 }, { x: 30, y: 0, z: 10 }],
    ['E_ltN', { x: -40, y: 0, z: -192 }, { x: -60, y: 0, z: -218 }],
    ['E_ltE1', { x: 176, y: 0, z: 44 }, { x: 200, y: 0, z: 14 }],
    ['E_ltNE', { x: 140, y: 0, z: -172 }, { x: 174, y: 0, z: -144 }],
    ['E_ltW1', { x: -186, y: 0, z: -78 }, { x: -205, y: 0, z: -40 }],
  ];
  for (const [id, from, to] of patrols) {
    const u = enemy.find((e) => e.id === id);
    if (u) {
      u.currentOrder = { kind: 'patrol', patrolFrom: from, patrolTo: to, destination: to };
      u.aiState = 'patrol';
    }
  }

  // All non-patrol enemy units guard their spawn point
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
      'Allied high command has identified the central crossroads village as the hinge of the entire ' +
        'Axis defensive line. Reconnaissance has confirmed five reinforced positions: a heavily fortified ' +
        'central crossing, a northern town garrison, an eastern military depot, a fortified northeast ' +
        'outpost, and roving armored patrols covering the western approach.',
      'Use the tactical map to coordinate your fifteen-unit task force across the expanded battlefield. ' +
        'Walls and structures are destructible — use cannon fire and splash damage to collapse firing ' +
        'positions and open new lanes. Seize and hold the central crossroads for thirty seconds to ' +
        'break the Axis line and secure the sector.',
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
