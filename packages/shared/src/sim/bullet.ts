import { Vector3 } from 'three';

import { type GameConfig, secondsToTicks } from '../constants.js';
import { fromVector3, noseDirection, toVector3 } from '../math.js';

import type { BulletState, PlaneState, PlayerSlot } from '../types.js';

/** Spawn a projectile at the plane's collision-sphere edge, along its nose. */
export function spawnBullet(
  plane: PlaneState,
  owner: PlayerSlot,
  id: number,
  config: GameConfig,
): BulletState {
  const nose = noseDirection(plane.rot, _nose).normalize();
  const pos = toVector3(plane.pos, _pos).addScaledVector(
    nose,
    config.PLANE_COLLISION_RADIUS,
  );
  const velocity = _velocity.copy(nose).multiplyScalar(config.BULLET_SPEED);

  return {
    id,
    owner,
    previousPos: fromVector3(pos),
    pos: fromVector3(pos),
    vel: fromVector3(velocity),
    lifetimeTicksRemaining: secondsToTicks(
      config.BULLET_LIFETIME,
      config.SIM_HZ,
    ),
  };
}

/**
 * Attempt one shot and apply every local consequence atomically: ammo,
 * cooldown, recoil, and projectile creation. Returns null when firing is not
 * currently legal (GAME.md §5, §9).
 */
export function tryFireBullet(
  plane: PlaneState,
  owner: PlayerSlot,
  id: number,
  config: GameConfig,
): BulletState | null {
  if (
    plane.stumbleTicksRemaining > 0 ||
    plane.fireCooldownTicks > 0 ||
    plane.ammo < config.AMMO_PER_SHOT
  ) {
    return null;
  }

  const bullet = spawnBullet(plane, owner, id, config);
  const recoil = noseDirection(plane.rot, _nose).multiplyScalar(
    -config.RECOIL_IMPULSE,
  );
  const velocity = toVector3(plane.vel, _velocity).add(recoil);
  plane.vel = fromVector3(velocity);
  plane.ammo = Math.max(0, plane.ammo - config.AMMO_PER_SHOT);
  plane.fireCooldownTicks = secondsToTicks(config.FIRE_COOLDOWN, config.SIM_HZ);
  return bullet;
}

/** Integrate projectiles and remove lifetime/arena-boundary expirations. */
export function stepBullets(
  bullets: BulletState[],
  dt: number,
  config: GameConfig,
): void {
  let kept = 0;
  for (const bullet of bullets) {
    bullet.previousPos = [...bullet.pos];
    const pos = toVector3(bullet.pos, _pos).addScaledVector(
      toVector3(bullet.vel, _velocity),
      dt,
    );
    bullet.pos = fromVector3(pos);
    bullet.lifetimeTicksRemaining -= 1;

    if (
      bullet.lifetimeTicksRemaining > 0 &&
      pos.y > config.GROUND_Y &&
      pos.length() < config.DOME_RADIUS
    ) {
      bullets[kept] = bullet;
      kept += 1;
    }
  }
  bullets.length = kept;
}

const _nose = new Vector3();
const _pos = new Vector3();
const _velocity = new Vector3();
