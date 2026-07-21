import { Vector3 } from 'three';

import { type GameConfig } from '../constants.js';
import { fromVector3, toVector3 } from '../math.js';

import type { BounceSurface, GameEvent } from '../messages.js';
import type { PlaneState, PlayerSlot } from '../types.js';

/**
 * Springy arena resolution (GAME.md §6, DECISIONS D008). Planes bounce off the
 * dome, the ground, and each other with restitution and positional
 * separation — never clamped or teleported as ordinary behavior. Mutates in
 * place and pushes `bounce` feedback events.
 */
export function resolvePlaneBoundaries(
  slot: PlayerSlot,
  plane: PlaneState,
  config: GameConfig,
  events: GameEvent[],
): void {
  const r = config.PLANE_COLLISION_RADIUS;
  const pos = toVector3(plane.pos, _pos);
  const vel = toVector3(plane.vel, _vel);

  // Dome: sphere of DOME_RADIUS centered at the ground origin.
  const dist = pos.length();
  const domeLimit = config.DOME_RADIUS - r;
  if (dist > domeLimit && dist > EPSILON) {
    const n = _n.copy(pos).multiplyScalar(1 / dist);
    const outwardSpeed = vel.dot(n);
    pos.copy(n).multiplyScalar(domeLimit);
    if (outwardSpeed > 0) {
      vel.addScaledVector(n, -(1 + config.BOUNDARY_RESTITUTION) * outwardSpeed);
      emitBounce(events, slot, 'dome', pos);
    }
  }

  // Ground: flat floor at GROUND_Y.
  const floor = config.GROUND_Y + r;
  if (pos.y < floor) {
    pos.y = floor;
    if (vel.y < 0) {
      vel.y = -vel.y * config.BOUNDARY_RESTITUTION;
      emitBounce(events, slot, 'ground', pos);
    }
  }

  plane.pos = fromVector3(pos);
  plane.vel = fromVector3(vel);
}

/** Symmetric springy sphere collision between the two planes. */
export function resolvePlanePlane(
  a: PlaneState,
  b: PlaneState,
  config: GameConfig,
  events: GameEvent[],
): void {
  const contactDist = 2 * config.PLANE_COLLISION_RADIUS;
  const posA = toVector3(a.pos, _pos);
  const posB = toVector3(b.pos, _posB);
  const delta = _n.copy(posA).sub(posB);
  const dist = delta.length();
  if (dist >= contactDist) {
    return;
  }

  const n = dist > EPSILON ? delta.multiplyScalar(1 / dist) : _n.set(1, 0, 0);
  const halfOverlap = (contactDist - dist) / 2;
  posA.addScaledVector(n, halfOverlap);
  posB.addScaledVector(n, -halfOverlap);

  const velA = toVector3(a.vel, _vel);
  const velB = toVector3(b.vel, _velB);
  const approaching = _rel.copy(velA).sub(velB).dot(n);
  if (approaching < 0) {
    // Equal-mass impulse split symmetrically (order-independent).
    const j = (-(1 + config.PLANE_COLLISION_RESTITUTION) * approaching) / 2;
    velA.addScaledVector(n, j);
    velB.addScaledVector(n, -j);
  }

  a.pos = fromVector3(posA);
  b.pos = fromVector3(posB);
  a.vel = fromVector3(velA);
  b.vel = fromVector3(velB);
  emitBounce(events, 'a', 'plane', posA);
  emitBounce(events, 'b', 'plane', posB);
}

function emitBounce(
  events: GameEvent[],
  slot: PlayerSlot,
  surface: BounceSurface,
  pos: Vector3,
): void {
  events.push({ kind: 'bounce', slot, surface, pos: [pos.x, pos.y, pos.z] });
}

const EPSILON = 1e-9;
const _pos = new Vector3();
const _posB = new Vector3();
const _vel = new Vector3();
const _velB = new Vector3();
const _n = new Vector3();
const _rel = new Vector3();
