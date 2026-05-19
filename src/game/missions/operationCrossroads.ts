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

type Aabb2 = { minX: number; maxX: number; minZ: number; maxZ: number };

/** AABB enclosing an oriented box (width × depth, rotated `rot`) around (cx, cz), with optional margin. */
function obbAabb(cx: number, cz: number, w: number, d: number, rot: number, margin: number): Aabb2 {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const halfX = (w * c + d * s) / 2 + margin;
  const halfZ = (w * s + d * c) / 2 + margin;
  return { minX: cx - halfX, maxX: cx + halfX, minZ: cz - halfZ, maxZ: cz + halfZ };
}

function aabbsOverlap(a: Aabb2, b: Aabb2): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/**
 * If a unit's authored spawn position falls inside any building footprint,
 * shift the unit just outside the building along the shortest axis. The
 * authored mission file mostly avoids this, but rounding plus rotated
 * building boxes occasionally end up overlapping infantry / AT-gun spawns
 * which looked like soldiers standing on top of houses. Run a few passes
 * because pushing out of one building can land inside the next.
 */
function shiftUnitsOutsideBuildings(units: Unit[], decorations: MapDecoration[]) {
  const buildings = decorations.filter((d) => d.kind === 'building');
  if (buildings.length === 0) return;
  for (const unit of units) {
    for (let pass = 0; pass < 4; pass += 1) {
      let moved = false;
      for (const b of buildings) {
        const margin = unit.radius + 0.4;
        const halfX = b.scale.x / 2 + margin;
        const halfZ = b.scale.z / 2 + margin;
        const dx = unit.position.x - b.position.x;
        const dz = unit.position.z - b.position.z;
        const cs = Math.cos(b.rotation);
        const sn = Math.sin(b.rotation);
        // Rotate into building local space by -rotation.
        const lx = dx * cs + dz * sn;
        const lz = -dx * sn + dz * cs;
        if (Math.abs(lx) >= halfX || Math.abs(lz) >= halfZ) continue;
        const slackX = halfX - Math.abs(lx);
        const slackZ = halfZ - Math.abs(lz);
        let nx = lx;
        let nz = lz;
        if (slackX < slackZ) {
          nx = (lx >= 0 ? 1 : -1) * halfX;
        } else {
          nz = (lz >= 0 ? 1 : -1) * halfZ;
        }
        // Rotate back into world space and write through.
        unit.position.x = b.position.x + nx * cs - nz * sn;
        unit.position.z = b.position.z + nx * sn + nz * cs;
        unit.aiHome = { x: unit.position.x, y: 0, z: unit.position.z };
        moved = true;
      }
      if (!moved) break;
    }
  }
}

function buildDecorations(): MapDecoration[] {
  const out: MapDecoration[] = [];

  // ── Road network ─────────────────────────────────────────────────────────
  // Main cross-axis highways spanning the full map.
  const RL = MAP_SIZE;
  out.push(deco('road_h',  'road', 0, 0, 0, { x: RL,        y: 0.05, z: 10 }, 'asphalt'));
  out.push(deco('road_v',  'road', 0, 0, 0, { x: 10,        y: 0.05, z: RL }, 'asphalt'));

  // Central cross-streets (keeps the crossroads feeling urban).
  out.push(deco('road_h2', 'road', 0, -42, 0, { x: RL * 0.65, y: 0.05, z: 7 }, 'asphalt'));
  out.push(deco('road_h3', 'road', 0,  42, 0, { x: RL * 0.65, y: 0.05, z: 7 }, 'asphalt'));
  out.push(deco('road_v2', 'road', -46, 0, 0, { x: 7, y: 0.05, z: RL * 0.65 }, 'asphalt'));
  out.push(deco('road_v3', 'road',  46, 0, 0, { x: 7, y: 0.05, z: RL * 0.65 }, 'asphalt'));

  // South-Town ring road (z ≈ +108).
  out.push(deco('road_south_town', 'road', 0, 108, 0, { x: RL * 0.6, y: 0.05, z: 7 }, 'asphalt'));

  // North-Village cross road (z ≈ −175).
  out.push(deco('road_north_village', 'road', -18, -175, 0, { x: RL * 0.5, y: 0.05, z: 7 }, 'asphalt'));

  // East-factory spur: straight east from (50,−40) to (175,−40).
  out.push(deco('road_east_spur', 'road', 112, -40, 0, { x: 130, y: 0.05, z: 6 }, 'dirt'));

  // West-farmstead spur: straight west from (−50,+50) to (−168,+50).
  out.push(deco('road_west_spur', 'road', -109, 50, 0, { x: 128, y: 0.05, z: 6 }, 'dirt'));

  // Diagonal: southwest hamlet (−138, +138) → centre. Length ≈ 195, rot ≈ −0.785.
  out.push(deco('road_sw_hamlet', 'road', -69, 69, -0.785, { x: 6, y: 0.045, z: 195 }, 'dirt'));

  // Diagonal: NE outpost (148, −208) → main E road (80, −120). Length ≈ 118, rot ≈ 1.82.
  out.push(deco('road_ne_outpost', 'road', 114, -164, 1.82, { x: 6, y: 0.045, z: 118 }, 'dirt'));

  // Dirt lanes near the approach corridors.
  out.push(deco('road_south_lane',  'road', -16, 66,  -0.38, { x: 7, y: 0.045, z: 90 }, 'asphalt'));
  out.push(deco('road_east_lane',   'road',  72, 8,    1.18, { x: 6, y: 0.04,  z: 76 }, 'dirt'));
  out.push(deco('road_north_lane',  'road', -36, -72,  0.74, { x: 6, y: 0.04,  z: 70 }, 'dirt'));

  // ── Building clusters ─────────────────────────────────────────────────────
  type B = [number, number, number, number, number, number, BuildingStyle];

  // CLUSTER A — Central Crossroads (main objective village, ~22 buildings).
  const clusterA: B[] = [
    [-18, -18, 0,     8, 4, 6, 'house'],
    [-22, -10, 0,     6, 5, 5, 'house'],
    [-30, -22, 0.15,  7, 4, 6, 'house'],
    [-36,  -8, 0,     6, 5, 5, 'house'],
    [ 18, -20, 0.3,   9, 5, 7, 'barn'],
    [ 22,  -8, 0,     5, 4, 5, 'house'],
    [ 28, -16, -0.2,  7, 5, 6, 'house'],
    [ 34,  -6, 0,     9, 6, 7, 'factory'],
    [-20,  20, 0,     7, 4, 6, 'house'],
    [ 20,  18, 0.2,   8, 5, 6, 'house'],
    [ 12,  10, 0,     5, 4, 5, 'house'],
    [-12,  10, 0,     6, 4, 5, 'house'],
    [-30,  24, 0,     8, 7, 7, 'church'],
    [ 30,  28, -0.18, 9, 4, 6, 'barn'],
    [-44,  16, 0.1,   6, 5, 5, 'house'],
    [ 44,  12, -0.1,  6, 5, 5, 'house'],
    [-58, -36, 0,     9, 6, 7, 'factory'],
    [ 56, -36, -0.1,  9, 6, 7, 'factory'],
    [-58,  38, 0.15,  8, 5, 6, 'barn'],
    [ 54,  40, 0,     8, 5, 6, 'barn'],
    [  0, -22, 0,     5, 2.6, 4, 'bunker'],
    [  0,  22, 0,     5, 2.6, 4, 'bunker'],
  ];

  // CLUSTER B — South Town (player passes through advancing north, ~8 buildings).
  const clusterB: B[] = [
    [-22,  94, 0.12,  8, 4, 6, 'house'],
    [-12, 106, 0,     7, 5, 5, 'house'],
    [  8,  98, -0.1,  6, 4, 5, 'house'],
    [ 20, 108, 0.08,  9, 5, 7, 'barn'],
    [ 30,  96, 0,     6, 4, 6, 'house'],
    [-28, 112, 0.15,  8, 4, 6, 'house'],
    [ 16, 118, 0,     7, 5, 6, 'house'],
    [  2, 120, -0.15, 5, 2.5, 4, 'bunker'],
  ];

  // CLUSTER C — North Village (heavily fortified northern enemy HQ, ~9 buildings).
  const clusterC: B[] = [
    [-30, -164, 0,     8, 4, 6, 'house'],
    [-18, -172, 0.1,   7, 5, 5, 'house'],
    [ -8, -158, -0.12, 6, 4, 5, 'house'],
    [-38, -155, 0,     9, 6, 7, 'barn'],
    [-24, -148, 0.2,   7, 4, 6, 'house'],
    [-44, -170, -0.1,  6, 5, 5, 'house'],
    [-14, -182, 0,     8, 7, 7, 'church'],
    [  0, -165, 0,     5, 2.5, 4, 'bunker'],
    [ -2, -152, 0.15,  5, 2.5, 4, 'bunker'],
  ];

  // CLUSTER D — East Factory Complex (~6 buildings, heavy armour lair).
  const clusterD: B[] = [
    [156, -48, 0,     10, 6, 8, 'factory'],
    [170, -38, -0.1,   9, 6, 7, 'factory'],
    [158, -26, 0,      9, 5, 7, 'factory'],
    [144, -40, 0.15,   8, 5, 6, 'barn'],
    [172, -52, 0,      8, 5, 6, 'barn'],
    [148, -28, -0.1,   7, 4, 6, 'house'],
  ];

  // CLUSTER E — West Farmstead (~5 buildings, rural hamlet).
  const clusterE: B[] = [
    [-154,  44, 0,     8, 4, 6, 'house'],
    [-168,  52, 0.15,  7, 4, 5, 'house'],
    [-148,  58, -0.1,  9, 5, 7, 'barn'],
    [-162,  38, 0,     9, 5, 6, 'barn'],
    [-144,  52, 0.1,   6, 4, 5, 'house'],
  ];

  // CLUSTER F — Northeast Outpost (~4 buildings, fortified ridge position).
  const clusterF: B[] = [
    [136, -198, 0,      6, 4, 5, 'house'],
    [148, -206, 0.1,    6, 4, 5, 'house'],
    [128, -210, -0.15,  5, 2.5, 4, 'bunker'],
    [144, -192, 0,      5, 2.5, 4, 'bunker'],
  ];

  // CLUSTER G — Southwest Hamlet (~5 buildings, enemy left-flank rear guard).
  const clusterG: B[] = [
    [-126, 124, 0,     7, 4, 5, 'house'],
    [-138, 132, 0.12,  7, 4, 6, 'house'],
    [-118, 136, -0.08, 9, 5, 7, 'barn'],
    [-130, 118, 0,     6, 4, 5, 'house'],
    [-142, 118, 0.1,   8, 5, 6, 'barn'],
  ];

  const allClusters: Array<[string, B[]]> = [
    ['A', clusterA], ['B', clusterB], ['C', clusterC], ['D', clusterD],
    ['E', clusterE], ['F', clusterF], ['G', clusterG],
  ];
  let bldgIdx = 0;
  for (const [prefix, cluster] of allClusters) {
    for (const [x, z, r, w, h, d, style] of cluster) {
      out.push(
        deco(`bldg_${prefix}_${bldgIdx++}`, 'building', x, z, r, { x: w, y: h, z: d }, 'wall', {
          buildingStyle: style,
          destructible: true,
        }),
      );
    }
  }

  // ── Linear details (hedgerows, stone walls, fences) ───────────────────────
  type L = [string, MapDecoration['kind'], number, number, number, number, number, MapDecoration['tint']];
  const linearDetails: L[] = [
    // Central village perimeter.
    ['hedge_west_field',      'hedgerow',  -70,  18,  0.1,   48, 2.3, 'shrub'],
    ['hedge_east_field',      'hedgerow',   70,  20, -0.08,  50, 2.2, 'shrub'],
    ['hedge_south_left',      'hedgerow',  -42,  62, -0.34,  52, 2.1, 'shrub'],
    ['hedge_south_right',     'hedgerow',   38,  62,  0.24,  48, 2.1, 'shrub'],
    ['hedge_north_left',      'hedgerow',  -52, -50,  0.82,  44, 2.0, 'shrub'],
    ['hedge_north_right',     'hedgerow',   52, -48, -0.64,  44, 2.0, 'shrub'],
    ['wall_church_front',     'stoneWall', -30,  14,  0,     20, 1.0, 'stone'],
    ['wall_church_side',      'stoneWall', -40,  24,  Math.PI / 2, 18, 1.0, 'stone'],
    ['wall_square_west',      'stoneWall', -12,  -4,  Math.PI / 2, 18, 0.9, 'stone'],
    ['wall_square_east',      'stoneWall',  12,   4,  Math.PI / 2, 18, 0.9, 'stone'],
    ['wall_south_approach_l', 'stoneWall', -17,  52,  Math.PI / 2, 34, 1.0, 'stone'],
    ['wall_south_approach_r', 'stoneWall',  17,  46,  Math.PI / 2, 28, 1.0, 'stone'],
    ['wall_village_garden',   'stoneWall', -27,  38,  0.12,  22, 0.95,'stone'],
    ['hedge_village_road',    'hedgerow',   28,  34, -0.08,  30, 1.8, 'shrub'],
    ['fence_south_field',     'fence',     -57,  78, -0.18,  44, 0.8, 'wood'],
    ['fence_east_field',      'fence',      78,  50,  Math.PI / 2, 42, 0.8, 'wood'],
    ['fence_west_lane',       'fence',     -79, -18,  Math.PI / 2, 38, 0.8, 'wood'],
    // South Town perimeter.
    ['hedge_south_town_w',    'hedgerow',  -50, 100,  0,     60, 2.0, 'shrub'],
    ['hedge_south_town_e',    'hedgerow',   48, 102,  0,     54, 2.0, 'shrub'],
    ['wall_south_town_sq',    'stoneWall', -18, 110,  Math.PI / 2, 24, 0.9, 'stone'],
    ['fence_south_town_n',    'fence',      32, 122,  0,     46, 0.8, 'wood'],
    // North Village perimeter.
    ['wall_north_village_w',  'stoneWall', -50,-165,  Math.PI / 2, 34, 1.0, 'stone'],
    ['wall_north_village_sq', 'stoneWall', -22,-147,  0,          28, 0.9, 'stone'],
    ['hedge_north_village_e', 'hedgerow',   10,-168,  0.1,  44, 2.1, 'shrub'],
    // East factory fences.
    ['fence_factory_n',       'fence',     155, -20,  0,     50, 0.8, 'wood'],
    ['fence_factory_s',       'fence',     158, -60,  0,     48, 0.8, 'wood'],
    ['wall_factory_w',        'stoneWall', 140, -40,  Math.PI / 2, 36, 1.0, 'stone'],
    // West farmstead hedges.
    ['hedge_west_farm_n',     'hedgerow', -155,  30,  0,     50, 2.0, 'shrub'],
    ['hedge_west_farm_s',     'hedgerow', -152,  68,  0,     46, 2.0, 'shrub'],
    // NE outpost walls.
    ['wall_ne_outpost_w',     'stoneWall', 122,-200,  Math.PI / 2, 30, 1.0, 'stone'],
    ['wall_ne_outpost_s',     'stoneWall', 140,-218,  0,          26, 0.9, 'stone'],
    // SW hamlet hedges.
    ['hedge_sw_hamlet_n',     'hedgerow', -120, 110,  0.3,   48, 2.0, 'shrub'],
    ['hedge_sw_hamlet_e',     'hedgerow', -110, 128, -Math.PI / 2, 40, 2.0, 'shrub'],
  ];
  for (const [id, kind, x, z, rot, length, width, tint] of linearDetails) {
    out.push(deco(id, kind, x, z, rot, { x: length, y: 1.2, z: width }, tint));
  }

  // Road signs.
  out.push(deco('roadsign_south',      'roadSign', -20,  58,  0.2,  { x: 1, y: 2.2, z: 1 }, 'wood'));
  out.push(deco('roadsign_crossroads', 'roadSign',   7,   8, -0.35, { x: 1, y: 2.0, z: 1 }, 'wood'));
  out.push(deco('roadsign_north',      'roadSign', -14, -80,  0.1,  { x: 1, y: 2.2, z: 1 }, 'wood'));
  out.push(deco('roadsign_east',       'roadSign',  80,  -4, -0.8,  { x: 1, y: 2.0, z: 1 }, 'wood'));

  // ── Trees ─────────────────────────────────────────────────────────────────
  const rng = mulberry32(1337);
  const half = MAP_SIZE / 2;
  const treeSeed: Array<[number, number, 'pine' | 'oak' | 'shrub']> = [];
  for (let i = 0; i < 340; i += 1) {
    const x = (rng() - 0.5) * (MAP_SIZE - 20);
    const z = (rng() - 0.5) * (MAP_SIZE - 20);
    // Skip trees over road grid centre and all seven village cores.
    if (Math.abs(x) < 14 || Math.abs(z) < 14) continue;
    if (Math.hypot(x, z) < 42) continue;
    if (Math.hypot(x, z - 108) < 28) continue;
    if (Math.hypot(x + 18, z + 175) < 28) continue;
    if (Math.hypot(x - 165, z + 40) < 28) continue;
    if (Math.hypot(x + 158, z - 50) < 28) continue;
    if (Math.hypot(x - 140, z + 200) < 22) continue;
    if (Math.hypot(x + 130, z - 128) < 24) continue;
    treeSeed.push([x, z, rng() > 0.54 ? 'pine' : rng() > 0.25 ? 'oak' : 'shrub']);
  }
  treeSeed.forEach((t, i) => {
    const [x, z, kind] = t;
    const height = kind === 'shrub' ? 1.1 + rng() * 0.8 : 3 + rng() * 2.5;
    out.push(deco(`tree_${i}`, 'tree', x, z, rng() * Math.PI * 2, { x: 1.4, y: height, z: 1.4 }, kind));
  });

  // ── Field patches ─────────────────────────────────────────────────────────
  // Fields paint a tan ground patch and previously got placed by pure random
  // sampling — they regularly overlapped roads and building footprints, which
  // looked like crops spilling onto asphalt and over houses. Reject any
  // candidate whose rotation-expanded AABB intersects an existing road or
  // building (with a small margin so the eaves still get a green edge).
  const fieldBlockerKinds = new Set<MapDecoration['kind']>(['road', 'building']);
  const FIELD_KEEPOUT_MARGIN = 1.5;
  const placedBoundsForFields = out
    .filter((d) => fieldBlockerKinds.has(d.kind))
    .map((d) => obbAabb(d.position.x, d.position.z, d.scale.x, d.scale.z, d.rotation, FIELD_KEEPOUT_MARGIN));
  const fieldOverlapsStructure = (x: number, z: number, w: number, depth: number, rot: number) => {
    const candidate = obbAabb(x, z, w, depth, rot, 0);
    for (const b of placedBoundsForFields) {
      if (aabbsOverlap(candidate, b)) return true;
    }
    return false;
  };
  let placedFields = 0;
  let fieldAttempts = 0;
  while (placedFields < 38 && fieldAttempts < 38 * 12) {
    fieldAttempts += 1;
    const x = (rng() - 0.5) * (MAP_SIZE - 40);
    const z = (rng() - 0.5) * (MAP_SIZE - 40);
    if (Math.abs(x) < 16 && Math.abs(z) < 16) continue;
    const w = 10 + rng() * 18;
    const d = 10 + rng() * 18;
    const rot = rng() * Math.PI;
    if (fieldOverlapsStructure(x, z, w, d, rot)) continue;
    out.push(deco(`field_${placedFields}`, 'fieldPatch', x, z, rot, { x: w, y: 0.02, z: d }, 'grass'));
    placedFields += 1;
  }
  const setPieceFields: Array<[number, number, number, number, number]> = [
    [ -74,   54,  0.18, 34, 26],
    [ -42,   58,  0.12, 26, 22],
    [  72,   58, -0.28, 32, 24],
    [ -78,  -44,  0.44, 30, 22],
    [  78,  -52, -0.36, 34, 24],
    [-140,   80,  0.22, 42, 30],
    [ 130,  -80, -0.18, 38, 28],
    [ -80,  160,  0.34, 44, 32],
    [ 100,  150, -0.26, 40, 28],
    [-180,  -80,  0.12, 36, 26],
    [ 180,   90, -0.30, 40, 30],
  ];
  setPieceFields.forEach(([x, z, rot, w, d], i) => {
    if (fieldOverlapsStructure(x, z, w, d, rot)) return;
    out.push(deco(`crop_setpiece_${i}`, 'fieldPatch', x, z, rot, { x: w, y: 0.022, z: d }, 'grass'));
  });

  // ── Hills ─────────────────────────────────────────────────────────────────
  const hills: Array<[number, number, number]> = [
    [  -72,  -52, 16],
    [   70,  -68, 18],
    [   86,   38, 14],
    [  -86,   60, 20],
    [    0,  -98, 22],
    [    0,   98, 20],
    [ -160, -140, 24],
    [  160, -120, 20],
    [ -120,  180, 18],
    [  140,  190, 22],
    [   80, -200, 18],
    [ -200,   20, 16],
    [  200,  -60, 20],
    [ -100, -260, 14],
    [  120,  240, 16],
  ];
  hills.forEach((h, i) => {
    if (Math.abs(h[0]) > half - 10 || Math.abs(h[1]) > half - 10) return;
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
  // ── FRIENDLY — 15 units, staging at the southern map edge (z ≈ +238-260) ──
  const friendly: Unit[] = [
    // 1st Armored Platoon — centre-south.
    makeUnit({ name: 'Heavy Tank Iron',      faction: 'friendly', type: 'heavyTank',  position: { x: -14, y: 0, z: 248 }, rotation: -Math.PI, idHint: 'F_iron' }),
    makeUnit({ name: 'Heavy Tank Anvil',     faction: 'friendly', type: 'heavyTank',  position: { x:  -4, y: 0, z: 238 }, rotation: -Math.PI, idHint: 'F_anvil' }),
    makeUnit({ name: 'Medium Tank Alpha',    faction: 'friendly', type: 'mediumTank', position: { x:   6, y: 0, z: 248 }, rotation: -Math.PI, idHint: 'F_alpha' }),
    makeUnit({ name: 'Medium Tank Bravo',    faction: 'friendly', type: 'mediumTank', position: { x:  16, y: 0, z: 238 }, rotation: -Math.PI, idHint: 'F_bravo' }),
    // 2nd Armored Platoon — east-south.
    makeUnit({ name: 'Medium Tank Charlie',  faction: 'friendly', type: 'mediumTank', position: { x:  32, y: 0, z: 252 }, rotation: -Math.PI, idHint: 'F_charlie' }),
    makeUnit({ name: 'Medium Tank Delta',    faction: 'friendly', type: 'mediumTank', position: { x:  44, y: 0, z: 240 }, rotation: -Math.PI, idHint: 'F_delta' }),
    makeUnit({ name: 'Light Tank Scout 1',   faction: 'friendly', type: 'lightTank',  position: { x:  58, y: 0, z: 252 }, rotation: -Math.PI, idHint: 'F_scout1' }),
    makeUnit({ name: 'Light Tank Scout 2',   faction: 'friendly', type: 'lightTank',  position: { x:  70, y: 0, z: 240 }, rotation: -Math.PI, idHint: 'F_scout2' }),
    makeUnit({ name: 'Light Tank Scout 3',   faction: 'friendly', type: 'lightTank',  position: { x:  84, y: 0, z: 252 }, rotation: -Math.PI, idHint: 'F_scout3' }),
    // 3rd Infantry Company — west-south.
    makeUnit({ name: '1st Infantry Platoon', faction: 'friendly', type: 'infantry',   position: { x: -28, y: 0, z: 258 }, rotation: -Math.PI, idHint: 'F_inf1' }),
    makeUnit({ name: '2nd Infantry Platoon', faction: 'friendly', type: 'infantry',   position: { x: -40, y: 0, z: 246 }, rotation: -Math.PI, idHint: 'F_inf2' }),
    makeUnit({ name: '3rd Infantry Platoon', faction: 'friendly', type: 'infantry',   position: { x: -52, y: 0, z: 258 }, rotation: -Math.PI, idHint: 'F_inf3' }),
    makeUnit({ name: '4th Infantry Platoon', faction: 'friendly', type: 'infantry',   position: { x: -64, y: 0, z: 246 }, rotation: -Math.PI, idHint: 'F_inf4' }),
    // Recon section.
    makeUnit({ name: 'Recon Jeep 1', faction: 'friendly', type: 'reconJeep', position: { x: 100, y: 0, z: 244 }, rotation: -Math.PI, idHint: 'F_recon1' }),
    makeUnit({ name: 'Recon Jeep 2', faction: 'friendly', type: 'reconJeep', position: { x: 112, y: 0, z: 256 }, rotation: -Math.PI, idHint: 'F_recon2' }),
  ];

  // ── ENEMY — 45 units across 7 zones ────────────────────────────────────────

  // ZONE A — Central Crossroads (14 units, main objective defence).
  const zoneA: Unit[] = [
    makeUnit({ name: 'Enemy Heavy Tank',          faction: 'enemy', type: 'heavyTank',   position: { x:  -2, y: 0, z: -42 }, rotation: 0,           idHint: 'E_heavy' }),
    makeUnit({ name: 'Enemy Medium West',         faction: 'enemy', type: 'mediumTank',  position: { x: -28, y: 0, z: -50 }, rotation: 0,           idHint: 'E_medW' }),
    makeUnit({ name: 'Enemy Medium East',         faction: 'enemy', type: 'mediumTank',  position: { x:  30, y: 0, z: -50 }, rotation: 0,           idHint: 'E_medE' }),
    makeUnit({ name: 'Enemy Light Tank Patrol',   faction: 'enemy', type: 'lightTank',   position: { x:   8, y: 0, z:  -8 }, rotation: 0,           idHint: 'E_lightTank' }),
    makeUnit({ name: 'Enemy Light Tank East',     faction: 'enemy', type: 'lightTank',   position: { x:  36, y: 0, z: -22 }, rotation: -0.7,        idHint: 'E_lightTankE' }),
    makeUnit({ name: 'Enemy AT Gun (North)',      faction: 'enemy', type: 'antiTankGun', position: { x:  -3, y: 0, z: -28 }, rotation: 0,           idHint: 'E_atN' }),
    makeUnit({ name: 'Enemy AT Gun (South)',      faction: 'enemy', type: 'antiTankGun', position: { x:   4, y: 0, z:  28 }, rotation: Math.PI,     idHint: 'E_atS' }),
    makeUnit({ name: 'Enemy AT Gun (West)',       faction: 'enemy', type: 'antiTankGun', position: { x: -36, y: 0, z:  -4 }, rotation: Math.PI / 2, idHint: 'E_atW' }),
    makeUnit({ name: 'Enemy Mortar Team 1',       faction: 'enemy', type: 'mortar',      position: { x:   0, y: 0, z: -68 }, rotation: 0,           idHint: 'E_mortar1' }),
    makeUnit({ name: 'Enemy Mortar Team 2',       faction: 'enemy', type: 'mortar',      position: { x:  22, y: 0, z: -64 }, rotation: 0,           idHint: 'E_mortar2' }),
    makeUnit({ name: 'Enemy Infantry (Bunker N)', faction: 'enemy', type: 'infantry',    position: { x:  1.5,y: 0, z: -22 }, rotation: 0,           idHint: 'E_infBunkN' }),
    makeUnit({ name: 'Enemy Infantry (Bunker S)', faction: 'enemy', type: 'infantry',    position: { x: -1.5,y: 0, z:  22 }, rotation: Math.PI,     idHint: 'E_infBunkS' }),
    makeUnit({ name: 'Enemy Infantry (East)',     faction: 'enemy', type: 'infantry',    position: { x:  28, y: 0, z:   4 }, rotation: 0,           idHint: 'E_infE' }),
    makeUnit({ name: 'Enemy Infantry (West)',     faction: 'enemy', type: 'infantry',    position: { x: -22, y: 0, z:  -2 }, rotation: 0,           idHint: 'E_infW' }),
  ];

  // ZONE B — South Town screen (5 units, covers approach from south).
  const zoneB: Unit[] = [
    makeUnit({ name: 'South Town Light Tank',   faction: 'enemy', type: 'lightTank',   position: { x:  10, y: 0, z:  82 }, rotation: Math.PI,     idHint: 'E_southLT' }),
    makeUnit({ name: 'South AT Gun (West)',      faction: 'enemy', type: 'antiTankGun', position: { x: -20, y: 0, z:  96 }, rotation: Math.PI,     idHint: 'E_southAT1' }),
    makeUnit({ name: 'South AT Gun (East)',      faction: 'enemy', type: 'antiTankGun', position: { x:  18, y: 0, z: 104 }, rotation: Math.PI,     idHint: 'E_southAT2' }),
    makeUnit({ name: 'South Infantry (West)',    faction: 'enemy', type: 'infantry',    position: { x: -12, y: 0, z: 100 }, rotation: Math.PI,     idHint: 'E_southInfW' }),
    makeUnit({ name: 'South Infantry (East)',    faction: 'enemy', type: 'infantry',    position: { x:   8, y: 0, z: 112 }, rotation: Math.PI,     idHint: 'E_southInfE' }),
  ];

  // ZONE C — North Village (9 units, strong enemy HQ).
  const zoneC: Unit[] = [
    makeUnit({ name: 'North Heavy Tank 1',  faction: 'enemy', type: 'heavyTank',   position: { x: -20, y: 0, z: -152 }, rotation: 0, idHint: 'E_nHeavy1' }),
    makeUnit({ name: 'North Heavy Tank 2',  faction: 'enemy', type: 'heavyTank',   position: { x: -35, y: 0, z: -170 }, rotation: 0, idHint: 'E_nHeavy2' }),
    makeUnit({ name: 'North AT Gun 1',      faction: 'enemy', type: 'antiTankGun', position: { x: -15, y: 0, z: -162 }, rotation: Math.PI, idHint: 'E_nAT1' }),
    makeUnit({ name: 'North AT Gun 2',      faction: 'enemy', type: 'antiTankGun', position: { x:  -5, y: 0, z: -178 }, rotation: Math.PI, idHint: 'E_nAT2' }),
    makeUnit({ name: 'North Mortar 1',      faction: 'enemy', type: 'mortar',      position: { x: -30, y: 0, z: -188 }, rotation: 0, idHint: 'E_nMortar1' }),
    makeUnit({ name: 'North Mortar 2',      faction: 'enemy', type: 'mortar',      position: { x: -10, y: 0, z: -195 }, rotation: 0, idHint: 'E_nMortar2' }),
    makeUnit({ name: 'North Infantry 1',    faction: 'enemy', type: 'infantry',    position: { x:  -8, y: 0, z: -158 }, rotation: 0, idHint: 'E_nInf1' }),
    makeUnit({ name: 'North Infantry 2',    faction: 'enemy', type: 'infantry',    position: { x: -28, y: 0, z: -160 }, rotation: 0, idHint: 'E_nInf2' }),
    makeUnit({ name: 'North Infantry 3',    faction: 'enemy', type: 'infantry',    position: { x: -18, y: 0, z: -175 }, rotation: 0, idHint: 'E_nInf3' }),
  ];

  // ZONE D — East Factory (7 units, heavy armour flank threat).
  const zoneD: Unit[] = [
    makeUnit({ name: 'East Heavy Tank',   faction: 'enemy', type: 'heavyTank',   position: { x: 158, y: 0, z: -48 }, rotation: -Math.PI / 2, idHint: 'E_eHeavy' }),
    makeUnit({ name: 'East Medium Tank',  faction: 'enemy', type: 'mediumTank',  position: { x: 170, y: 0, z: -35 }, rotation: -Math.PI / 2, idHint: 'E_eMed' }),
    makeUnit({ name: 'East Light Tank',   faction: 'enemy', type: 'lightTank',   position: { x: 148, y: 0, z: -55 }, rotation: -Math.PI / 2, idHint: 'E_eLight' }),
    makeUnit({ name: 'East AT Gun 1',     faction: 'enemy', type: 'antiTankGun', position: { x: 160, y: 0, z: -28 }, rotation: -Math.PI / 2, idHint: 'E_eAT1' }),
    makeUnit({ name: 'East AT Gun 2',     faction: 'enemy', type: 'antiTankGun', position: { x: 172, y: 0, z: -52 }, rotation: -Math.PI / 2, idHint: 'E_eAT2' }),
    makeUnit({ name: 'East Infantry 1',   faction: 'enemy', type: 'infantry',    position: { x: 162, y: 0, z: -40 }, rotation: -Math.PI / 2, idHint: 'E_eInf1' }),
    makeUnit({ name: 'East Infantry 2',   faction: 'enemy', type: 'infantry',    position: { x: 154, y: 0, z: -30 }, rotation: -Math.PI / 2, idHint: 'E_eInf2' }),
  ];

  // ZONE E — West Farmstead (4 units, light patrol screen).
  const zoneE: Unit[] = [
    makeUnit({ name: 'West Light Tank',   faction: 'enemy', type: 'lightTank',   position: { x: -152, y: 0, z:  42 }, rotation: Math.PI / 2, idHint: 'E_wLight' }),
    makeUnit({ name: 'West AT Gun',       faction: 'enemy', type: 'antiTankGun', position: { x: -158, y: 0, z:  56 }, rotation: Math.PI / 2, idHint: 'E_wAT' }),
    makeUnit({ name: 'West Infantry 1',   faction: 'enemy', type: 'infantry',    position: { x: -148, y: 0, z:  48 }, rotation: Math.PI / 2, idHint: 'E_wInf1' }),
    makeUnit({ name: 'West Infantry 2',   faction: 'enemy', type: 'infantry',    position: { x: -162, y: 0, z:  38 }, rotation: Math.PI / 2, idHint: 'E_wInf2' }),
  ];

  // ZONE F — NE Outpost ridge (6 units, indirect-fire and AT coverage).
  const zoneF: Unit[] = [
    makeUnit({ name: 'NE Outpost Tank',   faction: 'enemy', type: 'mediumTank',  position: { x: 140, y: 0, z: -198 }, rotation: Math.PI, idHint: 'E_neTank' }),
    makeUnit({ name: 'NE AT Gun',         faction: 'enemy', type: 'antiTankGun', position: { x: 128, y: 0, z: -196 }, rotation: Math.PI, idHint: 'E_neAT' }),
    makeUnit({ name: 'NE Mortar 1',       faction: 'enemy', type: 'mortar',      position: { x: 130, y: 0, z: -210 }, rotation: 0,       idHint: 'E_neMortar1' }),
    makeUnit({ name: 'NE Mortar 2',       faction: 'enemy', type: 'mortar',      position: { x: 148, y: 0, z: -205 }, rotation: 0,       idHint: 'E_neMortar2' }),
    makeUnit({ name: 'NE Infantry 1',     faction: 'enemy', type: 'infantry',    position: { x: 136, y: 0, z: -192 }, rotation: Math.PI, idHint: 'E_neInf1' }),
    makeUnit({ name: 'NE Infantry 2',     faction: 'enemy', type: 'infantry',    position: { x: 145, y: 0, z: -208 }, rotation: Math.PI, idHint: 'E_neInf2' }),
  ];

  // ZONE G — SW Hamlet rear guard (5 units, threatens friendly left flank).
  const zoneG: Unit[] = [
    makeUnit({ name: 'SW Hamlet Light Tank 1', faction: 'enemy', type: 'lightTank',   position: { x: -126, y: 0, z: 120 }, rotation: Math.PI, idHint: 'E_swLT1' }),
    makeUnit({ name: 'SW Hamlet Light Tank 2', faction: 'enemy', type: 'lightTank',   position: { x: -140, y: 0, z: 132 }, rotation: Math.PI, idHint: 'E_swLT2' }),
    makeUnit({ name: 'SW Hamlet AT Gun',       faction: 'enemy', type: 'antiTankGun', position: { x: -132, y: 0, z: 142 }, rotation: Math.PI, idHint: 'E_swAT' }),
    makeUnit({ name: 'SW Infantry 1',          faction: 'enemy', type: 'infantry',    position: { x: -122, y: 0, z: 128 }, rotation: Math.PI, idHint: 'E_swInf1' }),
    makeUnit({ name: 'SW Infantry 2',          faction: 'enemy', type: 'infantry',    position: { x: -144, y: 0, z: 122 }, rotation: Math.PI, idHint: 'E_swInf2' }),
  ];

  const enemy = [...zoneA, ...zoneB, ...zoneC, ...zoneD, ...zoneE, ...zoneF, ...zoneG];

  // ── Patrol orders ─────────────────────────────────────────────────────────
  const setPatrol = (id: string, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) => {
    const u = enemy.find((u) => u.id === id);
    if (!u) return;
    u.currentOrder = { kind: 'patrol', patrolFrom: from, patrolTo: to, destination: to };
    u.aiState = 'patrol';
  };

  setPatrol('E_lightTank',  { x: 14,   y: 0, z: -10 },  { x: -14,  y: 0, z:  10 });
  setPatrol('E_lightTankE', { x: 36,   y: 0, z: -22 },  { x:  26,  y: 0, z:  14 });
  setPatrol('E_southLT',    { x: 10,   y: 0, z:  82 },  { x: -10,  y: 0, z: 100 });
  setPatrol('E_wLight',     { x: -152, y: 0, z:  42 },  { x: -152, y: 0, z:  62 });
  setPatrol('E_swLT1',      { x: -126, y: 0, z: 120 },  { x: -110, y: 0, z: 100 });
  setPatrol('E_swLT2',      { x: -140, y: 0, z: 132 },  { x: -158, y: 0, z: 112 });

  // All other enemy units guard their positions.
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

  const decorations = buildDecorations();
  const units = buildUnits();
  shiftUnitsOutsideBuildings(units, decorations);

  return {
    id: 'operation-crossroads',
    name: 'Operation Crossroads',
    briefingTitle: 'Operation Crossroads',
    briefingParagraphs: [
      'Intelligence confirms a deeply-layered enemy defence across a six-kilometre front. ' +
        'A mechanised screening force holds the South Town approach; the central crossroads ' +
        'village is garrisoned by two medium tanks, a heavy, three anti-tank guns, two ' +
        'mortar teams and entrenched infantry. A heavy-armour flanking threat lurks at the ' +
        'East Factory complex, a light patrol covers the western farm lane, and a fortified ' +
        'ridge outpost to the northeast provides long-range indirect fire. Far north, two ' +
        'enemy heavy tanks anchor the main defensive line.',
      'Your task force deploys fifteen vehicles and infantry sections. Use the tactical ' +
        'map to co-ordinate attacks on multiple objectives simultaneously, or jump into a ' +
        'tank and lead the assault personally. Buildings and walls are destructible — ' +
        'cannon fire and splash damage open new firing lanes. Hold the central crossroads ' +
        'for thirty seconds with at least one surviving combat unit to claim victory.',
    ],
    briefingObjectives: [
      'Break through the South Town screen and advance on the crossroads.',
      'Neutralise or bypass the East Factory armour and West Farm patrol.',
      'Seize and hold the central crossroads capture zone for 30 seconds.',
      'Avoid losing all friendly combat units.',
    ],
    units,
    objective,
    mapSize: MAP_SIZE,
    decorations,
  };
}
