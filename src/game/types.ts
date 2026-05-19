// Core simulation types. Kept independent of Babylon and React.

export type Vec3 = { x: number; y: number; z: number };

export type Faction = 'friendly' | 'enemy';

export type UnitType =
  | 'mediumTank'
  | 'heavyTank'
  | 'reconJeep'
  | 'infantry'
  | 'lightTank'
  | 'antiTankGun'
  | 'mortar';

export type OrderKind = 'idle' | 'move' | 'attack' | 'hold' | 'patrol';
export type AIState = 'idle' | 'patrol' | 'guard' | 'alert' | 'engage' | 'reposition' | 'destroyed';

export interface Order {
  kind: OrderKind;
  destination?: Vec3;
  targetUnitId?: string;
  patrolFrom?: Vec3;
  patrolTo?: Vec3;
  path?: Vec3[];
  pathIndex?: number;
}

export interface Weapon {
  name: string;
  damage: number;
  range: number;
  reloadSeconds: number;
  projectileSpeed: number;
  splashRadius?: number;
  /** Simulation timestamp (seconds) of last fire. */
  lastFiredAt: number;
}

export interface Unit {
  id: string;
  name: string;
  faction: Faction;
  type: UnitType;
  position: Vec3;
  /** Hull rotation in radians around the Y axis. */
  rotation: number;
  /** Turret rotation relative to hull, radians. */
  turretRotation: number;
  health: number;
  maxHealth: number;
  armor: number;
  speed: number;
  weapon: Weapon;
  currentOrder: Order;
  targetId: string | null;
  isDestroyed: boolean;
  isPlayerControllable: boolean;
  /** Visual radius for selection / collision approximations. */
  radius: number;
  /** Time of death (sim seconds), for wreck cleanup logic. */
  destroyedAt?: number;
  /** Last time we registered a damage hit for visual feedback. */
  lastDamagedAt?: number;
  /** Last hostile unit that damaged this unit, used for target priority. */
  lastAttackerId?: string;
  /** Current smoothed movement speed for non-direct-control movement. */
  currentSpeed: number;
  /** Last issued tactical destination, kept visible after hold/engage state changes. */
  lastOrderDestination?: Vec3;
  /** Coarse AI state for behavior and HUD readability. */
  aiState: AIState;
  /** Defensive home position used by guard/patrol behavior. */
  aiHome: Vec3;
  /** Maximum distance a guarding AI should chase before returning. */
  aiLeashRadius: number;
  /** Next simulation timestamp when this unit may reconsider targets. */
  aiNextThinkAt: number;
  /** Simulation timestamp until which the current target is sticky. */
  targetLockedUntil: number;
  /**
   * When true, the unit's targetId / currentOrder are written by an external
   * controller (e.g. the enemy squad GOAP brain) and the per-unit AI loop
   * should leave them alone. Friendly behavior and the unit's own combat /
   * movement systems remain unaffected.
   */
  aiManagedExternally?: boolean;
}

export type ProjectileKind = 'shell' | 'bullet';

export interface Projectile {
  id: string;
  ownerId: string;
  faction: Faction;
  position: Vec3;
  velocity: Vec3;
  damage: number;
  remainingTime: number;
  splashRadius?: number;
  spawnedAt: number;
  /** Visual + audio classification. Defaults to 'shell' for tank cannons; infantry small arms use 'bullet'. */
  kind?: ProjectileKind;
}

export interface ObjectiveZone {
  id: string;
  name: string;
  position: Vec3;
  radius: number;
  /** Seconds of friendly presence required to win. */
  requiredHoldSeconds: number;
  /** Accumulated friendly hold time. */
  heldSeconds: number;
  /** True once the zone has been captured. */
  captured: boolean;
  /** True if a friendly unit is currently in the zone. */
  occupiedByFriendly: boolean;
  /** True if an enemy unit is currently contesting. */
  contested: boolean;
  /** Last computed status, used to avoid repeating battlefield log messages. */
  lastStatus?: 'empty' | 'friendly' | 'contested' | 'captured';
}

export interface MissionDefinition {
  id: string;
  name: string;
  briefingTitle: string;
  briefingParagraphs: string[];
  briefingObjectives: string[];
  units: Unit[];
  objective: ObjectiveZone;
  /** Map dimensions on the X/Z plane, centered at origin. */
  mapSize: number;
  /** Static map decorations (buildings, trees) for renderer. */
  decorations: MapDecoration[];
}

export type DecorationKind =
  | 'building'
  | 'tree'
  | 'road'
  | 'fieldPatch'
  | 'hill'
  | 'hedgerow'
  | 'stoneWall'
  | 'fence'
  | 'roadSign';

export type BuildingStyle = 'house' | 'barn' | 'factory' | 'church' | 'bunker';

export interface MapDecoration {
  id: string;
  kind: DecorationKind;
  position: Vec3;
  rotation: number;
  scale: Vec3;
  /** Optional palette tint hint for the renderer. */
  tint?: 'wall' | 'roof' | 'pine' | 'oak' | 'shrub' | 'dirt' | 'grass' | 'asphalt' | 'stone' | 'wood';
  /** Building variant; renderer picks geometry/color based on this. */
  buildingStyle?: BuildingStyle;
  /** Whether this decoration can be destroyed by splash/projectile damage. */
  destructible?: boolean;
  /** Initial structural HP for destructible buildings. */
  maxHealth?: number;
}

/** Live structural HP state for a destructible decoration. */
export interface BuildingState {
  id: string;
  decorationId: string;
  position: Vec3;
  /** Same blocker radius the pathing system uses. */
  radius: number;
  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  destroyedAt?: number;
}

export interface EffectEvent {
  id: string;
  kind: 'muzzleFlash' | 'explosion' | 'hit' | 'smoke' | 'wreck';
  position: Vec3;
  spawnedAt: number;
  duration: number;
  scale?: number;
}

export interface BattlefieldEvent {
  id: string;
  time: number;
  message: string;
}

export interface SimulationState {
  /** Simulation time in seconds. */
  time: number;
  units: Map<string, Unit>;
  projectiles: Projectile[];
  effects: EffectEvent[];
  eventLog: BattlefieldEvent[];
  objective: ObjectiveZone;
  mission: MissionDefinition;
  /** Per-building structural HP for destructible decorations. */
  buildings: Map<string, BuildingState>;
  /** Set if the simulation is over: 'victory' | 'defeat'. */
  result: null | 'victory' | 'defeat';
}

export type GameMode =
  | 'menu'
  | 'briefing'
  | 'tactical'
  | 'directControl'
  | 'paused'
  | 'victory'
  | 'defeat';

export interface InputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  fire: boolean;
  /** Where the camera is currently aiming on the ground (world-space). Used for turret aim. */
  aimPoint: Vec3 | null;
}
