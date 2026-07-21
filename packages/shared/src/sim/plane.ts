import { Quaternion, Vector3 } from 'three';

import { type GameConfig } from '../constants.js';
import {
  fromQuaternion,
  fromVector3,
  toQuaternion,
  toVector3,
} from '../math.js';

import type { InputCommand, PlaneState } from '../types.js';

/**
 * Advances one plane by a fixed step (IMPLEMENTATION §5.3, §6). Pure and
 * mutating-in-place; callable in isolation so the client can predict exactly
 * this plane (Milestone 5).
 *
 * The feel, in order:
 *  1. throttle nudges `flightSpeed` within `[MIN_SPEED, MAX_SPEED]`;
 *  2. control input rotates the nose (skipped while stumbling — D006);
 *  3. total `vel` eases toward `nose * flightSpeed` at `VELOCITY_ALIGN` — this
 *     is the soul of the game: a shove injects sideways velocity that decays as
 *     alignment reasserts, so you drift and recover rather than snapping back;
 *  4. integrate position.
 */
export function stepPlane(
  plane: PlaneState,
  input: InputCommand,
  dt: number,
  config: GameConfig,
): void {
  updateWeaponState(plane, dt, config);
  updateFlightSpeed(plane, input, dt, config);

  const rot = toQuaternion(plane.rot, _rot);
  if (plane.stumbleTicksRemaining > 0) {
    integrateStumble(plane, rot, dt);
  } else {
    applyControl(input, rot, dt, config);
  }
  plane.rot = fromQuaternion(rot.normalize());

  alignVelocity(plane, rot, dt, config);
  integratePosition(plane, dt);
}

function updateWeaponState(
  plane: PlaneState,
  dt: number,
  config: GameConfig,
): void {
  plane.fireCooldownTicks = Math.max(0, plane.fireCooldownTicks - 1);
  plane.ammo = Math.min(
    config.AMMO_MAX,
    plane.ammo + config.AMMO_REGEN_PER_SEC * dt,
  );
}

function updateFlightSpeed(
  plane: PlaneState,
  input: InputCommand,
  dt: number,
  config: GameConfig,
): void {
  const next = plane.flightSpeed + input.throttle * config.THROTTLE_ACCEL * dt;
  plane.flightSpeed = clamp(next, config.MIN_SPEED, config.MAX_SPEED);
}

function applyControl(
  input: InputCommand,
  rot: Quaternion,
  dt: number,
  config: GameConfig,
): void {
  // Body-frame angular velocity: pitch about +X (right), yaw about +Y (up),
  // roll about +Z. Signs are arcade-tuned and may be adjusted in Milestone 6.
  const omega = _omega.set(
    input.pitch * config.PITCH_RATE,
    input.yaw * config.YAW_RATE,
    input.roll * config.ROLL_RATE,
  );
  const angle = omega.length() * dt;
  if (angle < EPSILON) {
    return;
  }
  const delta = _delta.setFromAxisAngle(omega.normalize(), angle);
  rot.multiply(delta); // local-frame rotation
}

function integrateStumble(
  plane: PlaneState,
  rot: Quaternion,
  dt: number,
): void {
  const omega = toVector3(plane.stumbleAngularVelocity, _omega);
  const angle = omega.length() * dt;
  if (angle >= EPSILON) {
    const delta = _delta.setFromAxisAngle(omega.normalize(), angle);
    rot.premultiply(delta); // world-frame tumble
  }
  plane.stumbleTicksRemaining -= 1;
  if (plane.stumbleTicksRemaining <= 0) {
    plane.stumbleTicksRemaining = 0;
    plane.stumbleAngularVelocity = [0, 0, 0];
  }
}

function alignVelocity(
  plane: PlaneState,
  rot: Quaternion,
  dt: number,
  config: GameConfig,
): void {
  const nose = _nose.set(0, 0, -1).applyQuaternion(rot);
  const target = nose.multiplyScalar(plane.flightSpeed);
  const vel = toVector3(plane.vel, _vel);
  const t = clamp(config.VELOCITY_ALIGN * dt, 0, 1);
  vel.lerp(target, t);
  plane.vel = fromVector3(vel);
}

function integratePosition(plane: PlaneState, dt: number): void {
  const pos = toVector3(plane.pos, _pos);
  const vel = toVector3(plane.vel, _vel);
  pos.addScaledVector(vel, dt);
  plane.pos = fromVector3(pos);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

const EPSILON = 1e-9;
const _rot = new Quaternion();
const _delta = new Quaternion();
const _omega = new Vector3();
const _nose = new Vector3();
const _vel = new Vector3();
const _pos = new Vector3();
