import { describe, expect, it } from 'vitest';

import { makePlaneState } from '../../../../tests/support/sim-builders.js';
import { DEFAULT_GAME_CONFIG } from '../constants.js';
import { resolvePlaneBoundaries, resolvePlanePlane } from './collision.js';

import type { GameEvent } from '../messages.js';

const config = DEFAULT_GAME_CONFIG;
const r = config.PLANE_COLLISION_RADIUS;

describe('resolvePlaneBoundaries — dome', () => {
  it('reflects an outward plane back inside and emits a dome bounce', () => {
    const plane = makePlaneState({
      pos: [config.DOME_RADIUS + 50, 0, 0],
      vel: [100, 0, 0],
    });
    const events: GameEvent[] = [];
    resolvePlaneBoundaries('a', plane, config, events);

    expect(plane.pos[0]).toBeCloseTo(config.DOME_RADIUS - r, 4);
    expect(plane.vel[0]).toBeLessThan(0); // reversed inward
    expect(Math.abs(plane.vel[0])).toBeCloseTo(
      100 * config.BOUNDARY_RESTITUTION,
      4,
    );
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'bounce', slot: 'a', surface: 'dome' }),
    );
  });

  it('leaves an interior plane untouched', () => {
    const plane = makePlaneState({ pos: [0, 150, 0], vel: [10, 0, 0] });
    const events: GameEvent[] = [];
    resolvePlaneBoundaries('a', plane, config, events);
    expect(plane.pos).toEqual([0, 150, 0]);
    expect(events).toHaveLength(0);
  });
});

describe('resolvePlaneBoundaries — ground', () => {
  it('bounces a descending plane off the floor with restitution', () => {
    const plane = makePlaneState({
      pos: [0, config.GROUND_Y - 5, 0],
      vel: [0, -80, 0],
    });
    const events: GameEvent[] = [];
    resolvePlaneBoundaries('b', plane, config, events);

    expect(plane.pos[1]).toBeCloseTo(config.GROUND_Y + r, 4);
    expect(plane.vel[1]).toBeCloseTo(80 * config.BOUNDARY_RESTITUTION, 4);
    expect(events).toContainEqual(
      expect.objectContaining({ surface: 'ground', slot: 'b' }),
    );
  });

  it('keeps every resolved plane in a valid position (finite, above ground)', () => {
    const plane = makePlaneState({
      pos: [config.DOME_RADIUS, config.GROUND_Y - 100, 0],
      vel: [200, -200, 0],
    });
    resolvePlaneBoundaries('a', plane, config, []);
    expect(plane.pos.every((c) => Number.isFinite(c))).toBe(true);
    expect(plane.pos[1]).toBeGreaterThanOrEqual(config.GROUND_Y);
    expect(Math.hypot(...plane.pos)).toBeLessThanOrEqual(
      config.DOME_RADIUS + 1,
    );
  });
});

describe('resolvePlanePlane', () => {
  it('separates overlapping planes symmetrically and reflects approach', () => {
    const a = makePlaneState({ pos: [-r / 2, 150, 0], vel: [20, 0, 0] });
    const b = makePlaneState({ pos: [r / 2, 150, 0], vel: [-20, 0, 0] });
    const events: GameEvent[] = [];
    resolvePlanePlane(a, b, config, events);

    // Pushed apart to at least contact distance.
    expect(a.pos[0]).toBeLessThan(-r / 2);
    expect(b.pos[0]).toBeGreaterThan(r / 2);
    // Approaching velocities reversed.
    expect(a.vel[0]).toBeLessThan(0);
    expect(b.vel[0]).toBeGreaterThan(0);
    expect(events.filter((e) => e.kind === 'bounce')).toHaveLength(2);
  });

  it('is order-independent for the resulting velocities', () => {
    const makePair = () => ({
      a: makePlaneState({ pos: [-r / 2, 150, 0], vel: [20, 5, 0] }),
      b: makePlaneState({ pos: [r / 2, 150, 0], vel: [-20, -5, 0] }),
    });
    const forward = makePair();
    resolvePlanePlane(forward.a, forward.b, config, []);
    const reversed = makePair();
    resolvePlanePlane(reversed.b, reversed.a, config, []);

    expect(forward.a.vel).toEqual(reversed.a.vel);
    expect(forward.b.vel).toEqual(reversed.b.vel);
  });

  it('does nothing when planes are far apart', () => {
    const a = makePlaneState({ pos: [-500, 150, 0] });
    const b = makePlaneState({ pos: [500, 150, 0] });
    const events: GameEvent[] = [];
    resolvePlanePlane(a, b, config, events);
    expect(a.pos[0]).toBe(-500);
    expect(events).toHaveLength(0);
  });
});
