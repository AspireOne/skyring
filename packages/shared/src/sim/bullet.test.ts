import { describe, expect, it } from 'vitest';

import {
  makeInput,
  makePlaneState,
} from '../../../../tests/support/sim-builders.js';
import { DEFAULT_GAME_CONFIG, secondsToTicks } from '../constants.js';
import { spawnBullet, stepBullets, tryFireBullet } from './bullet.js';
import { stepPlane } from './plane.js';

const config = DEFAULT_GAME_CONFIG;
const dt = 1 / config.SIM_HZ;

describe('GAME-5-PROJECTILES: projectile spawning and stepping', () => {
  it('spawns at the muzzle along the documented local -Z nose', () => {
    const plane = makePlaneState({ pos: [10, 150, 20] });
    const bullet = spawnBullet(plane, 'a', 7, config);

    expect(bullet).toMatchObject({ id: 7, owner: 'a' });
    expect(bullet.pos).toEqual([10, 150, 20 - config.PLANE_COLLISION_RADIUS]);
    expect(bullet.previousPos).toEqual(bullet.pos);
    expect(bullet.vel).toEqual([0, 0, -config.BULLET_SPEED]);
    expect(bullet.lifetimeTicksRemaining).toBe(
      secondsToTicks(config.BULLET_LIFETIME, config.SIM_HZ),
    );
  });

  it('retains previous position and integrates one fixed tick', () => {
    const bullet = spawnBullet(makePlaneState(), 'a', 1, config);
    const start = [...bullet.pos];
    const bullets = [bullet];

    stepBullets(bullets, dt, config);

    expect(bullets).toHaveLength(1);
    expect(bullet.previousPos).toEqual(start);
    expect(bullet.pos[2]).toBeCloseTo(
      bullet.previousPos[2] - config.BULLET_SPEED * dt,
      8,
    );
  });

  it('expires instead of bouncing at lifetime, ground, and dome boundaries', () => {
    const lifetime = spawnBullet(makePlaneState(), 'a', 1, config);
    lifetime.lifetimeTicksRemaining = 1;
    const ground = spawnBullet(
      makePlaneState({ pos: [0, config.GROUND_Y + 1, 0] }),
      'a',
      2,
      config,
    );
    ground.vel = [0, -config.BULLET_SPEED, 0];
    const dome = spawnBullet(
      makePlaneState({ pos: [config.DOME_RADIUS - 1, 150, 0] }),
      'a',
      3,
      config,
    );
    dome.vel = [config.BULLET_SPEED, 0, 0];
    const bullets = [lifetime, ground, dome];

    stepBullets(bullets, dt, config);
    expect(bullets).toHaveLength(0);
  });
});

describe('gun eligibility, ammo, cooldown, and recoil (GAME-5)', () => {
  it('fires atomically, spends ammo, starts cooldown, and recoils backward', () => {
    const plane = makePlaneState({ vel: [0, 0, 0] });
    const bullet = tryFireBullet(plane, 'b', 1, config);

    expect(bullet).not.toBeNull();
    expect(plane.ammo).toBe(config.AMMO_MAX - config.AMMO_PER_SHOT);
    expect(plane.fireCooldownTicks).toBe(
      secondsToTicks(config.FIRE_COOLDOWN, config.SIM_HZ),
    );
    // Identity nose is -Z, so recoil pushes toward +Z.
    expect(plane.vel[2]).toBeCloseTo(config.RECOIL_IMPULSE, 8);
  });

  it('regenerates ammo to its maximum and counts cooldown down in stepPlane', () => {
    const plane = makePlaneState({ ammo: 0, fireCooldownTicks: 2 });
    stepPlane(plane, makeInput(), dt, config);
    expect(plane.ammo).toBeCloseTo(config.AMMO_REGEN_PER_SEC * dt, 8);
    expect(plane.fireCooldownTicks).toBe(1);

    for (let tick = 0; tick < config.SIM_HZ * 10; tick += 1) {
      stepPlane(plane, makeInput(), dt, config);
    }
    expect(plane.ammo).toBe(config.AMMO_MAX);
    expect(plane.fireCooldownTicks).toBe(0);
  });

  it('GAME-9-OUT-OF-AMMO: rejects a shot without enough energy', () => {
    const plane = makePlaneState({ ammo: config.AMMO_PER_SHOT / 2 });
    expect(tryFireBullet(plane, 'a', 1, config)).toBeNull();
    expect(plane.ammo).toBe(config.AMMO_PER_SHOT / 2);
  });

  it('rejects a shot during cooldown', () => {
    const plane = makePlaneState({ fireCooldownTicks: 1 });
    expect(tryFireBullet(plane, 'a', 1, config)).toBeNull();
  });

  it('GAME-9-SHOOT-WHILE-STUMBLING: a stumbling plane cannot fire', () => {
    const plane = makePlaneState({ stumbleTicksRemaining: 2 });
    expect(tryFireBullet(plane, 'a', 1, config)).toBeNull();
    expect(plane.ammo).toBe(config.AMMO_MAX);
  });
});
