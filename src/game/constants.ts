// Tunable constants used across the simulation. Times are in seconds, distances in world units (~ meters).

export const MAP_SIZE = 200;
export const MAP_HALF = MAP_SIZE / 2;

// Fixed simulation timestep target (Hz).
export const SIM_TICK_HZ = 60;
export const SIM_DT = 1 / SIM_TICK_HZ;

// Maximum delta-time we will allow per frame to prevent simulation explosions
// after tab switches.
export const MAX_FRAME_DT = 0.1;

// Game speed levels exposed to UI.
export const SPEED_LEVELS = {
  slow: 0.35,
  normal: 1,
  fast: 1.75,
} as const;

export type SpeedLevel = keyof typeof SPEED_LEVELS;

// Capture zone tuning.
export const CAPTURE_HOLD_SECONDS = 30;
export const CAPTURE_RADIUS = 14;

// Combat tuning.
export const PROJECTILE_LIFETIME = 4;
export const PROJECTILE_HIT_RADIUS = 1.6;
export const SPLASH_BASE_RADIUS = 3.5;
export const SIGHT_RANGE_BONUS = 4; // Units start engaging slightly inside their actual range.
export const AI_THINK_INTERVAL = 0.35;
export const TARGET_STICKY_SECONDS = 1.4;

// Movement / pathing tuning.
export const ARRIVE_RADIUS = 1.0;
export const TURN_RATE = 2.4; // radians/sec for hull turning.
export const TURRET_TURN_RATE = 3.2;
export const VEHICLE_FRICTION = 4.0;
export const PATH_OBSTACLE_MARGIN = 2.4;
export const UNIT_SEPARATION_STRENGTH = 0.35;
export const MOVE_ACCELERATION = 8.0;

// Tactical camera tuning.
export const TACTICAL_CAMERA_DEFAULT = {
  alpha: Math.PI * 0.5,
  beta: Math.PI * 0.25,
  radius: 145,
  target: { x: 0, y: 0, z: 14 },
} as const;
export const TACTICAL_CAMERA_MIN_RADIUS = 26;
export const TACTICAL_CAMERA_MAX_RADIUS = 185;
export const TACTICAL_CAMERA_MIN_BETA = 0.22;
export const TACTICAL_CAMERA_MAX_BETA = Math.PI * 0.48;
export const TACTICAL_CAMERA_PAN_SPEED = 58;
export const TACTICAL_CAMERA_FAST_MULTIPLIER = 2.2;
/** Edge-scroll activation distance from the viewport edge in CSS pixels. */
export const TACTICAL_EDGE_SCROLL_PIXELS = 28;
/** Maximum edge-scroll speed in world units / second at the very edge. */
export const TACTICAL_EDGE_SCROLL_SPEED = 90;
/** Mouse wheel zoom step in world units per wheel notch. */
export const TACTICAL_ZOOM_WHEEL_STEP = 12;
/** How quickly the camera lerps to the desired pan position; higher = snappier. */
export const TACTICAL_CAMERA_PAN_SMOOTHING = 22;
/** How quickly zoom interpolates. */
export const TACTICAL_CAMERA_ZOOM_SMOOTHING = 14;
/** How quickly rotate interpolates. */
export const TACTICAL_CAMERA_ROTATE_SMOOTHING = 16;
/** Q/E rotate angular speed in radians/sec. */
export const TACTICAL_CAMERA_ROTATE_SPEED = 1.6;
/** Threshold (px) past which a pointer-down counts as a drag rather than a click. */
export const SELECTION_BOX_DRAG_THRESHOLD = 6;

// Direct-control tuning.
export const DC_FORWARD_ACCEL = 12;
export const DC_REVERSE_ACCEL = 8;
export const DC_TURN_RATE = 1.5; // radians/sec
export const DC_MAX_FORWARD_SPEED = 9;
export const DC_MAX_REVERSE_SPEED = 5;

// Visual / colors used by the renderer.
export const COLOR = {
  friendlyHull: { r: 0.16, g: 0.19, b: 0.11 },
  friendlyTurret: { r: 0.21, g: 0.24, b: 0.14 },
  friendlyMarker: { r: 0.52, g: 0.68, b: 0.38 },

  enemyHull: { r: 0.38, g: 0.21, b: 0.16 },
  enemyTurret: { r: 0.5, g: 0.25, b: 0.18 },
  enemyMarker: { r: 0.82, g: 0.24, b: 0.18 },

  ground: { r: 0.32, g: 0.42, b: 0.28 },
  road: { r: 0.28, g: 0.27, b: 0.24 },
  building: { r: 0.5, g: 0.46, b: 0.37 },
  buildingRoof: { r: 0.18, g: 0.13, b: 0.1 },
  treeTrunk: { r: 0.32, g: 0.22, b: 0.14 },
  treePine: { r: 0.08, g: 0.22, b: 0.13 },
  treeOak: { r: 0.14, g: 0.27, b: 0.15 },
  shrub: { r: 0.11, g: 0.22, b: 0.09 },
  hill: { r: 0.28, g: 0.36, b: 0.24 },
  fieldPatch: { r: 0.25, g: 0.3, b: 0.14 },
  dirt: { r: 0.36, g: 0.29, b: 0.2 },
  roadShoulder: { r: 0.3, g: 0.25, b: 0.18 },
  sandbag: { r: 0.54, g: 0.48, b: 0.34 },
  hedge: { r: 0.16, g: 0.29, b: 0.12 },
  stoneWall: { r: 0.43, g: 0.4, b: 0.34 },
  fenceWood: { r: 0.36, g: 0.25, b: 0.15 },

  selection: { r: 0.55, g: 0.95, b: 0.55 },
  objective: { r: 1.0, g: 0.8, b: 0.3 },
  projectileFriendly: { r: 0.8, g: 0.9, b: 1.0 },
  projectileEnemy: { r: 1.0, g: 0.7, b: 0.5 },
};
