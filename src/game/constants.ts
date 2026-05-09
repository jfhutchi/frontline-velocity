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

// Movement / pathing tuning.
export const ARRIVE_RADIUS = 1.0;
export const TURN_RATE = 2.4; // radians/sec for hull turning.
export const TURRET_TURN_RATE = 3.2;
export const VEHICLE_FRICTION = 4.0;

// Direct-control tuning.
export const DC_FORWARD_ACCEL = 12;
export const DC_REVERSE_ACCEL = 8;
export const DC_TURN_RATE = 1.5; // radians/sec
export const DC_MAX_FORWARD_SPEED = 9;
export const DC_MAX_REVERSE_SPEED = 5;

// Visual / colors used by the renderer.
export const COLOR = {
  friendlyHull: { r: 0.35, g: 0.55, b: 0.85 },
  friendlyTurret: { r: 0.45, g: 0.65, b: 0.95 },
  friendlyMarker: { r: 0.4, g: 0.6, b: 1.0 },

  enemyHull: { r: 0.7, g: 0.2, b: 0.2 },
  enemyTurret: { r: 0.85, g: 0.3, b: 0.3 },
  enemyMarker: { r: 0.95, g: 0.3, b: 0.3 },

  ground: { r: 0.32, g: 0.42, b: 0.28 },
  road: { r: 0.28, g: 0.27, b: 0.24 },
  building: { r: 0.55, g: 0.5, b: 0.42 },
  buildingRoof: { r: 0.4, g: 0.27, b: 0.22 },
  treeTrunk: { r: 0.32, g: 0.22, b: 0.14 },
  treePine: { r: 0.18, g: 0.36, b: 0.22 },
  treeOak: { r: 0.28, g: 0.46, b: 0.28 },
  hill: { r: 0.28, g: 0.36, b: 0.24 },
  fieldPatch: { r: 0.42, g: 0.46, b: 0.24 },

  selection: { r: 0.55, g: 0.95, b: 0.55 },
  objective: { r: 1.0, g: 0.8, b: 0.3 },
  projectileFriendly: { r: 0.8, g: 0.9, b: 1.0 },
  projectileEnemy: { r: 1.0, g: 0.7, b: 0.5 },
};
