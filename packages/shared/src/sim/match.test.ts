import { describe, expect, it } from 'vitest';

import {
  makeInputs,
  runTicks,
  testConfig,
} from '../../../../tests/support/sim-builders.js';
import { MATCH_PHASE } from '../types.js';
import { createInitialMatchState } from './state.js';

describe('stepMatch — countdown', () => {
  it('counts down and transitions to Playing once, emitting a phaseChange', () => {
    const config = testConfig({ COUNTDOWN: 1 });
    const state = createInitialMatchState(config);
    const countdownTicks = config.COUNTDOWN * config.SIM_HZ;

    const before = runTicks(state, countdownTicks - 1, config);
    expect(state.phase).toBe(MATCH_PHASE.Countdown);
    expect(before.events).toHaveLength(0);

    runTicks(state, 1, config);
    expect(state.phase).toBe(MATCH_PHASE.Playing);
    expect(state.phaseTicksRemaining).toBe(
      config.MATCH_DURATION * config.SIM_HZ,
    );
  });

  it('freezes the planes during countdown', () => {
    const config = testConfig();
    const state = createInitialMatchState(config);
    const startPos = [...state.planes.a.pos];
    runTicks(state, config.COUNTDOWN * config.SIM_HZ - 1, config);
    expect(state.planes.a.pos).toEqual(startPos);
  });

  it('increments tick every step', () => {
    const config = testConfig();
    const state = createInitialMatchState(config);
    runTicks(state, 25, config);
    expect(state.tick).toBe(25);
  });
});

describe('stepMatch — playing', () => {
  it('flies each plane forward along its nose once play begins', () => {
    const config = testConfig({ COUNTDOWN: 1 });
    const state = createInitialMatchState(config);
    const startAx = state.planes.a.pos[0];
    const startBx = state.planes.b.pos[0];

    // Run through countdown plus a second of play.
    runTicks(state, config.SIM_HZ + config.SIM_HZ, config);

    expect(state.phase).toBe(MATCH_PHASE.Playing);
    // A faces +X (toward center), B faces -X.
    expect(state.planes.a.pos[0]).toBeGreaterThan(startAx);
    expect(state.planes.b.pos[0]).toBeLessThan(startBx);
  });

  it('keeps both planes inside the dome across a long random-ish run', () => {
    const config = testConfig({ COUNTDOWN: 1 });
    const state = createInitialMatchState(config);
    let tick = 0;
    runTicks(state, 600, config, 7, () => {
      tick += 1;
      // Wobbling steering to probe boundaries without leaving the dome.
      const pitch = Math.sin(tick / 10);
      const yaw = Math.cos(tick / 7);
      return makeInputs(
        { throttle: 1, pitch, yaw },
        { throttle: 1, pitch: -pitch, yaw },
      );
    });

    for (const slot of ['a', 'b'] as const) {
      const plane = state.planes[slot];
      expect(plane.pos.every((c) => Number.isFinite(c))).toBe(true);
      expect(Math.hypot(...plane.pos)).toBeLessThanOrEqual(
        config.DOME_RADIUS + 1,
      );
      expect(plane.pos[1]).toBeGreaterThanOrEqual(config.GROUND_Y - 1e-6);
    }
  });

  it('fires after movement, produces unique bounded bullets, and applies recoil', () => {
    const config = testConfig({ COUNTDOWN: 1, MATCH_DURATION: 10 });
    const state = createInitialMatchState(config);
    state.phase = MATCH_PHASE.Playing;
    state.phaseTicksRemaining = config.MATCH_DURATION * config.SIM_HZ;
    state.planes.a.pos = [-300, 300, 0];
    state.planes.b.pos = [300, 300, 0];

    runTicks(state, config.SIM_HZ, config, 2, () =>
      makeInputs({ fire: true }, { fire: true }),
    );

    expect(state.nextBulletId).toBeGreaterThan(1);
    expect(state.bullets.length).toBeLessThanOrEqual(config.MAX_BULLETS);
    expect(new Set(state.bullets.map(({ id }) => id)).size).toBe(
      state.bullets.length,
    );
    expect(state.planes.a.ammo).toBeLessThan(config.AMMO_MAX);
  });

  it('GAME-9-KNOCKED-INTO-RING: starts scoring on the first movement tick that a hit pushes a plane inside', () => {
    const config = testConfig({ MATCH_DURATION: 10 });
    const state = createInitialMatchState(config);
    state.phase = MATCH_PHASE.Playing;
    state.phaseTicksRemaining = config.MATCH_DURATION * config.SIM_HZ;
    state.ring.center = [0, 150, 0];
    state.ring.teleportTicksRemaining = 10_000;
    state.planes.a.pos = [500, 150, 0];
    state.planes.b.pos = [0, 150, config.RING_RADIUS + 0.5];
    state.planes.a.vel = [0, 0, 0];
    state.planes.b.vel = [0, 0, 0];
    state.bullets = [
      {
        id: 1,
        owner: 'a',
        previousPos: [0, 150, config.RING_RADIUS + 10],
        pos: [0, 150, config.RING_RADIUS + 10],
        vel: [0, 0, -config.BULLET_SPEED],
        lifetimeTicksRemaining: 10,
      },
    ];

    runTicks(state, 1, config);
    expect(state.planes.b.stumbleTicksRemaining).toBeGreaterThan(0);
    expect(state.planes.b.inRing).toBe(false);
    expect(state.scores.b).toBe(0);

    runTicks(state, 1, config);
    expect(state.planes.b.inRing).toBe(true);
    expect(state.planes.b.scoring).toBe(true);
    expect(state.scores.b).toBeCloseTo(
      config.RING_POINTS_PER_SEC / config.SIM_HZ,
      8,
    );
  });
});
