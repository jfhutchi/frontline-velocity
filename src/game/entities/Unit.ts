import type { Faction, Unit, UnitType, Vec3, Weapon } from '../types';

let __idCounter = 0;
export function nextId(prefix: string): string {
  __idCounter += 1;
  return `${prefix}_${__idCounter.toString(36)}`;
}

export interface UnitTemplate {
  type: UnitType;
  health: number;
  armor: number;
  speed: number;
  radius: number;
  weapon: Omit<Weapon, 'lastFiredAt'>;
  isPlayerControllable: boolean;
}

export const UNIT_TEMPLATES: Record<UnitType, UnitTemplate> = {
  mediumTank: {
    type: 'mediumTank',
    health: 100,
    armor: 40,
    speed: 7.5,
    radius: 1.6,
    isPlayerControllable: true,
    weapon: {
      name: '75mm Cannon',
      damage: 45,
      range: 42,
      reloadSeconds: 2.5,
      projectileSpeed: 70,
      splashRadius: 2.5,
    },
  },
  heavyTank: {
    type: 'heavyTank',
    health: 180,
    armor: 65,
    speed: 5.4,
    radius: 1.9,
    isPlayerControllable: true,
    weapon: {
      name: '88mm Cannon',
      damage: 70,
      range: 56,
      reloadSeconds: 4.2,
      projectileSpeed: 78,
      splashRadius: 3.4,
    },
  },
  reconJeep: {
    type: 'reconJeep',
    health: 45,
    armor: 10,
    speed: 13.5,
    radius: 1.0,
    isPlayerControllable: true,
    weapon: {
      name: 'Mounted MG',
      damage: 8,
      range: 26,
      reloadSeconds: 0.4,
      projectileSpeed: 80,
    },
  },
  infantry: {
    type: 'infantry',
    health: 35,
    armor: 0,
    speed: 3.2,
    radius: 0.8,
    isPlayerControllable: true,
    weapon: {
      // Squad volley: a short burst of automatic-rifle fire, not a single cannon shot.
      name: 'Rifle Squad',
      damage: 2,
      range: 22,
      reloadSeconds: 0.85,
      projectileSpeed: 90,
    },
  },
  lightTank: {
    type: 'lightTank',
    health: 75,
    armor: 25,
    speed: 8.5,
    radius: 1.4,
    isPlayerControllable: true,
    weapon: {
      name: '47mm Cannon',
      damage: 30,
      range: 38,
      reloadSeconds: 2.7,
      projectileSpeed: 65,
      splashRadius: 1.8,
    },
  },
  antiTankGun: {
    type: 'antiTankGun',
    health: 50,
    armor: 5,
    speed: 0,
    radius: 1.1,
    isPlayerControllable: true,
    weapon: {
      name: 'AT Gun',
      damage: 55,
      range: 48,
      reloadSeconds: 3.5,
      projectileSpeed: 90,
      splashRadius: 2.2,
    },
  },
  mortar: {
    type: 'mortar',
    health: 38,
    armor: 0,
    speed: 0,
    radius: 1.0,
    isPlayerControllable: true,
    weapon: {
      name: '81mm Mortar',
      damage: 42,
      range: 78,
      reloadSeconds: 5.5,
      projectileSpeed: 38,
      splashRadius: 4.6,
    },
  },
};

export function makeUnit(opts: {
  name: string;
  faction: Faction;
  type: UnitType;
  position: Vec3;
  rotation?: number;
  idHint?: string;
}): Unit {
  const tpl = UNIT_TEMPLATES[opts.type];
  return {
    id: opts.idHint ?? nextId(opts.faction === 'friendly' ? 'F' : 'E'),
    name: opts.name,
    faction: opts.faction,
    type: opts.type,
    position: { ...opts.position },
    rotation: opts.rotation ?? 0,
    turretRotation: 0,
    health: tpl.health,
    maxHealth: tpl.health,
    armor: tpl.armor,
    speed: tpl.speed,
    weapon: { ...tpl.weapon, lastFiredAt: -999 },
    currentOrder: { kind: 'idle' },
    targetId: null,
    isDestroyed: false,
    isPlayerControllable: tpl.isPlayerControllable && opts.faction === 'friendly',
    radius: tpl.radius,
    currentSpeed: 0,
    aiState: opts.faction === 'enemy' ? 'guard' : 'idle',
    aiHome: { ...opts.position },
    aiLeashRadius:
      opts.type === 'lightTank' ? 34 :
      opts.type === 'infantry' ? 22 :
      opts.type === 'heavyTank' ? 28 :
      opts.type === 'mortar' ? 8 :
      18,
    aiNextThinkAt: 0,
    targetLockedUntil: 0,
  };
}
