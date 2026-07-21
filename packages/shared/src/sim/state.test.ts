import { describe, expect, it } from 'vitest';

import { createGameConfig, DEFAULT_GAME_CONFIG } from '../constants.js';
import { noseDirection } from '../math.js';
import { MATCH_PHASE } from '../types.js';
import { createInitialMatchState } from './state.js';

const config = DEFAULT_GAME_CONFIG;

describe('createInitialMatchState', () => {
  it('opens in countdown with zeroed scores and no bullets', () => {
    const state = createInitialMatchState(config);
    expect(state.phase).toBe(MATCH_PHASE.Countdown);
    expect(state.scores).toEqual({ a: 0, b: 0 });
    expect(state.bullets).toEqual([]);
    expect(state.nextBulletId).toBe(1);
    expect(state.tick).toBe(0);
    expect(state.phaseTicksRemaining).toBe(config.COUNTDOWN * config.SIM_HZ);
  });

  it('spawns planes on opposite sides at spawn altitude, full ammo, at rest', () => {
    const state = createInitialMatchState(config);
    expect(state.planes.a.pos).toEqual([
      -config.SPAWN_SEPARATION,
      config.SPAWN_ALTITUDE,
      0,
    ]);
    expect(state.planes.b.pos).toEqual([
      config.SPAWN_SEPARATION,
      config.SPAWN_ALTITUDE,
      0,
    ]);
    for (const slot of ['a', 'b'] as const) {
      expect(state.planes[slot].vel).toEqual([0, 0, 0]);
      expect(state.planes[slot].ammo).toBe(config.AMMO_MAX);
      expect(state.planes[slot].flightSpeed).toBe(config.MIN_SPEED);
      expect(state.planes[slot].stumbleTicksRemaining).toBe(0);
    }
  });

  it('faces each plane toward the arena center', () => {
    const state = createInitialMatchState(config);
    // Plane A is on -X and should look toward +X; B mirrors it.
    expect(noseDirection(state.planes.a.rot).x).toBeCloseTo(1, 5);
    expect(noseDirection(state.planes.b.rot).x).toBeCloseTo(-1, 5);
  });

  it('places the ring at arena center primed for its full dwell', () => {
    const state = createInitialMatchState(config);
    expect(state.ring.center).toEqual([0, config.SPAWN_ALTITUDE, 0]);
    expect(state.ring.radius).toBe(config.RING_RADIUS);
    expect(state.ring.warning).toBe(false);
    expect(state.ring.nextCenter).toBeNull();
    expect(state.ring.teleportTicksRemaining).toBe(
      config.RING_DWELL * config.SIM_HZ,
    );
  });

  it('respects config overrides', () => {
    const custom = createGameConfig({
      SPAWN_SEPARATION: 100,
      MATCH_DURATION: 60,
    });
    const state = createInitialMatchState(custom);
    expect(state.planes.a.pos[0]).toBe(-100);
  });
});
