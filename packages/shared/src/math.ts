import { Quaternion, Vector3 } from 'three';

import type { Quat, Vec3 } from './types.js';

/**
 * Shared math conventions. World is **Y-up, right-handed** (three.js default).
 *
 * NOSE CONVENTION (documented once, per IMPLEMENTATION §6): a plane's nose
 * points along its local **-Z** axis — three.js "forward". Every muzzle,
 * thrust, and alignment calculation derives its world forward vector by
 * rotating {@link LOCAL_NOSE} by the plane's orientation quaternion.
 */
export const LOCAL_NOSE: Readonly<Vec3> = [0, 0, -1];
export const WORLD_UP: Readonly<Vec3> = [0, 1, 0];

const NOSE_VECTOR = new Vector3(0, 0, -1);

export function toVector3(v: Vec3, out = new Vector3()): Vector3 {
  return out.set(v[0], v[1], v[2]);
}

export function fromVector3(v: Vector3): Vec3 {
  return [v.x, v.y, v.z];
}

export function toQuaternion(q: Quat, out = new Quaternion()): Quaternion {
  return out.set(q[0], q[1], q[2], q[3]);
}

export function fromQuaternion(q: Quaternion): Quat {
  return [q.x, q.y, q.z, q.w];
}

/** World-space forward (nose) direction for an orientation. */
export function noseDirection(rot: Quat, out = new Vector3()): Vector3 {
  return out.copy(NOSE_VECTOR).applyQuaternion(toQuaternion(rot, _scratchQuat));
}

const _scratchQuat = new Quaternion();

/**
 * Orientation whose nose points along `dir` (with world-up as the reference),
 * used to spawn planes facing a target. `dir` need not be normalized.
 */
export function orientationFacing(dir: Vec3): Quat {
  const forward = toVector3(dir).normalize();
  const quaternion = new Quaternion().setFromUnitVectors(NOSE_VECTOR, forward);
  return fromQuaternion(quaternion);
}
