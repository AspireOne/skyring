import { Vector3 } from 'three';

import { type GameConfig, secondsToTicks } from '../constants.js';
import { fromVector3, toVector3 } from '../math.js';

import type { BounceSurface, GameEvent } from '../messages.js';
import type { Rng } from '../rng.js';
import type {
  BulletState,
  MatchState,
  PlaneState,
  PlayerSlot,
} from '../types.js';

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

/**
 * Swept projectile-versus-opponent collision. Hits are gathered before any
 * consequence is applied so simultaneous mutual shots cannot suppress one
 * another through array mutation or processing order (GAME-5-MUTUAL-HIT).
 */
export function resolveBulletHits(
  state: MatchState,
  config: GameConfig,
  rng: Rng,
  events: GameEvent[],
): void {
  const hits: Array<{ bullet: BulletState; victim: PlayerSlot }> = [];
  for (const bullet of state.bullets) {
    const victim: PlayerSlot = bullet.owner === 'a' ? 'b' : 'a';
    if (segmentHitsSphere(bullet, state.planes[victim], config)) {
      hits.push({ bullet, victim });
    }
  }
  if (hits.length === 0) {
    return;
  }

  const consumed = new Set(hits.map(({ bullet }) => bullet.id));
  state.bullets = state.bullets.filter((bullet) => !consumed.has(bullet.id));

  for (const { bullet, victim } of hits) {
    const direction = toVector3(bullet.vel, _bulletDirection).normalize();
    const plane = state.planes[victim];
    const velocity = toVector3(plane.vel, _victimVelocity).addScaledVector(
      direction,
      config.HIT_IMPULSE,
    );
    plane.vel = fromVector3(velocity);
    plane.stumbleTicksRemaining = secondsToTicks(
      config.STUMBLE_DURATION,
      config.SIM_HZ,
    );
    plane.stumbleAngularVelocity = randomSpin(rng, config);
    events.push({
      kind: 'hit',
      shooter: bullet.owner,
      victim,
      pos: [...bullet.pos],
      dir: fromVector3(direction),
    });
    events.push({ kind: 'stumble', slot: victim });
  }
}

function segmentHitsSphere(
  bullet: BulletState,
  plane: PlaneState,
  config: GameConfig,
): boolean {
  const start = toVector3(bullet.previousPos, _segmentStart);
  const segment = toVector3(bullet.pos, _segment).sub(start);
  const lengthSquared = segment.lengthSq();
  const towardCenter = toVector3(plane.pos, _centerDelta).sub(start);
  const t =
    lengthSquared > EPSILON
      ? Math.max(0, Math.min(1, towardCenter.dot(segment) / lengthSquared))
      : 0;
  const closest = _closest.copy(start).addScaledVector(segment, t);
  return (
    closest.distanceToSquared(toVector3(plane.pos, _planeCenter)) <=
    config.PLANE_HIT_RADIUS * config.PLANE_HIT_RADIUS
  );
}

function randomSpin(rng: Rng, config: GameConfig): [number, number, number] {
  const y = rng.range(-1, 1);
  const azimuth = rng.range(0, Math.PI * 2);
  const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
  return [
    Math.cos(azimuth) * horizontal * config.STUMBLE_SPIN,
    y * config.STUMBLE_SPIN,
    Math.sin(azimuth) * horizontal * config.STUMBLE_SPIN,
  ];
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
const _bulletDirection = new Vector3();
const _victimVelocity = new Vector3();
const _segmentStart = new Vector3();
const _segment = new Vector3();
const _centerDelta = new Vector3();
const _closest = new Vector3();
const _planeCenter = new Vector3();
