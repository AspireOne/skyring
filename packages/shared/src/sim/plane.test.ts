import { describe, expect, it } from 'vitest';

import {
  makeInput,
  makePlaneState,
} from '../../../../tests/support/sim-builders.js';
import { DEFAULT_GAME_CONFIG } from '../constants.js';
import { noseDirection } from '../math.js';
import { stepPlane } from './plane.js';

const config = DEFAULT_GAME_CONFIG;
const dt = 1 / config.SIM_HZ;

function stepN(
  plane: ReturnType<typeof makePlaneState>,
  input: ReturnType<typeof makeInput>,
  n: number,
): void {
  for (let i = 0; i < n; i += 1) {
    stepPlane(plane, input, dt, config);
  }
}

describe('stepPlane — throttle', () => {
  it('holds flight speed at neutral throttle', () => {
    const plane = makePlaneState({ flightSpeed: 80 });
    stepN(plane, makeInput(), 30);
    expect(plane.flightSpeed).toBe(80);
  });

  it('accelerates toward and clamps at MAX_SPEED', () => {
    const plane = makePlaneState({ flightSpeed: config.MIN_SPEED });
    stepN(plane, makeInput({ throttle: 1 }), 600);
    expect(plane.flightSpeed).toBe(config.MAX_SPEED);
  });

  it('decelerates toward and clamps at MIN_SPEED', () => {
    const plane = makePlaneState({ flightSpeed: config.MAX_SPEED });
    stepN(plane, makeInput({ throttle: -1 }), 600);
    expect(plane.flightSpeed).toBe(config.MIN_SPEED);
  });
});

describe('stepPlane — steering', () => {
  it('pitches the nose up under positive pitch and keeps rotation normalized', () => {
    const plane = makePlaneState();
    stepN(plane, makeInput({ pitch: 1 }), 20);
    const nose = noseDirection(plane.rot);
    expect(nose.y).toBeGreaterThan(0.1);
    expect(nose.length()).toBeCloseTo(1, 6);
    expect(quatLength(plane.rot)).toBeCloseTo(1, 6);
  });

  it('yaws the nose sideways under yaw input', () => {
    const plane = makePlaneState();
    stepN(plane, makeInput({ yaw: 1 }), 20);
    const nose = noseDirection(plane.rot);
    expect(Math.abs(nose.x)).toBeGreaterThan(0.05);
  });
});

describe('stepPlane — momentum and alignment', () => {
  it('eases velocity toward nose * flightSpeed from rest', () => {
    const plane = makePlaneState({ flightSpeed: 60 });
    stepN(plane, makeInput(), 300);
    // Identity rotation: nose points -Z.
    expect(plane.vel[0]).toBeCloseTo(0, 3);
    expect(plane.vel[1]).toBeCloseTo(0, 3);
    expect(plane.vel[2]).toBeCloseTo(-60, 2);
  });

  it('lets an external shove decay as alignment reasserts (recovery)', () => {
    const plane = makePlaneState({ flightSpeed: 60, vel: [120, 0, 0] });
    // Immediately after the shove the sideways velocity dominates.
    stepPlane(plane, makeInput(), dt, config);
    expect(plane.vel[0]).toBeGreaterThan(50);
    // After enough time the plane recovers to its nose-aligned cruise.
    stepN(plane, makeInput(), 300);
    expect(plane.vel[0]).toBeCloseTo(0, 2);
    expect(plane.vel[2]).toBeCloseTo(-60, 1);
  });
});

describe('stepPlane — stumble (D006)', () => {
  it('ignores control, tumbles, and restores control on the defined tick', () => {
    const plane = makePlaneState({
      stumbleTicksRemaining: 5,
      stumbleAngularVelocity: [0, config.STUMBLE_SPIN, 0],
    });
    const before = [...plane.rot];
    // Control input during stumble must not steer.
    stepPlane(plane, makeInput({ pitch: 1 }), dt, config);
    expect(plane.stumbleTicksRemaining).toBe(4);
    expect(plane.rot).not.toEqual(before); // tumbling

    stepN(plane, makeInput({ pitch: 1 }), 4);
    expect(plane.stumbleTicksRemaining).toBe(0);
    expect(plane.stumbleAngularVelocity).toEqual([0, 0, 0]);
  });

  it('tumbles reproducibly for identical stumble state', () => {
    const a = makePlaneState({
      stumbleTicksRemaining: 3,
      stumbleAngularVelocity: [1, 2, 0.5],
    });
    const b = makePlaneState({
      stumbleTicksRemaining: 3,
      stumbleAngularVelocity: [1, 2, 0.5],
    });
    stepN(a, makeInput(), 3);
    stepN(b, makeInput(), 3);
    expect(a.rot).toEqual(b.rot);
  });
});

function quatLength(q: readonly number[]): number {
  return Math.hypot(q[0] ?? 0, q[1] ?? 0, q[2] ?? 0, q[3] ?? 0);
}
