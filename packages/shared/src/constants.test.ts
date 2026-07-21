import { describe, expect, it } from 'vitest';

import {
  createGameConfig,
  DEFAULT_GAME_CONFIG,
  secondsToTicks,
} from './constants.js';

describe('game config', () => {
  it('creates an immutable validated override without mutating defaults', () => {
    const config = createGameConfig({ MATCH_DURATION: 5, SIM_HZ: 30 });

    expect(config.MATCH_DURATION).toBe(5);
    expect(config.SIM_HZ).toBe(30);
    expect(DEFAULT_GAME_CONFIG.MATCH_DURATION).toBe(240);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([
    [{ SIM_HZ: 0 }, 'SIM_HZ must be greater than zero.'],
    [{ SIM_HZ: 30, SNAPSHOT_HZ: 60 }, 'SNAPSHOT_HZ cannot exceed SIM_HZ.'],
    [
      { RING_DWELL: 4, RING_WARNING: 4 },
      'RING_WARNING must be shorter than RING_DWELL.',
    ],
    [
      { RING_RADIUS: 60, SUDDEN_DEATH_RING_RADIUS: 70 },
      'SUDDEN_DEATH_RING_RADIUS cannot exceed RING_RADIUS.',
    ],
    [
      { SIM_HZ: 60, SNAPSHOT_HZ: 24 },
      'SNAPSHOT_HZ must divide SIM_HZ exactly.',
    ],
    [
      { BOUNDARY_RESTITUTION: -0.1 },
      'BOUNDARY_RESTITUTION must be in the range (0, 1].',
    ],
  ])('rejects an invalid override', (override, message) => {
    expect(() => createGameConfig(override)).toThrow(message);
  });
});

describe('secondsToTicks', () => {
  it('converts configured seconds at the fixed simulation rate', () => {
    expect(secondsToTicks(0.6, 60)).toBe(36);
    expect(secondsToTicks(1 / 120, 60)).toBe(1);
  });

  it('rejects invalid time inputs', () => {
    expect(() => secondsToTicks(Number.NaN, 60)).toThrow(RangeError);
    expect(() => secondsToTicks(1, 0)).toThrow(RangeError);
  });
});
