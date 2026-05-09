import type { Vec3 } from '../types';

export const v3 = {
  zero(): Vec3 {
    return { x: 0, y: 0, z: 0 };
  },
  set(out: Vec3, x: number, y: number, z: number): Vec3 {
    out.x = x;
    out.y = y;
    out.z = z;
    return out;
  },
  copy(src: Vec3): Vec3 {
    return { x: src.x, y: src.y, z: src.z };
  },
  add(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  },
  sub(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },
  scale(a: Vec3, s: number): Vec3 {
    return { x: a.x * s, y: a.y * s, z: a.z * s };
  },
  length(a: Vec3): number {
    return Math.hypot(a.x, a.y, a.z);
  },
  lengthXZ(a: Vec3): number {
    return Math.hypot(a.x, a.z);
  },
  distanceXZ(a: Vec3, b: Vec3): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  },
  normalizeXZ(a: Vec3): Vec3 {
    const len = Math.hypot(a.x, a.z);
    if (len < 1e-6) return { x: 0, y: 0, z: 0 };
    return { x: a.x / len, y: 0, z: a.z / len };
  },
};

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function angleLerp(current: number, target: number, maxStep: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

export function angleFromXZ(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export function shortestAngleDelta(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
