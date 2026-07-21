import { describe, expect, it } from 'vitest';

import { noseDirection, orientationFacing } from './math.js';

import type { Vec3 } from './types.js';

function expectDirection(actual: readonly number[], expected: Vec3): void {
  for (const [i, component] of expected.entries()) {
    expect(actual[i]).toBeCloseTo(component, 5);
  }
}

describe('orientationFacing / noseDirection', () => {
  it('round-trips cardinal directions through the nose convention', () => {
    const directions: Vec3[] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0, 1, 0],
    ];
    for (const dir of directions) {
      const rot = orientationFacing(dir);
      const nose = noseDirection(rot);
      expectDirection([nose.x, nose.y, nose.z], dir);
    }
  });

  it('normalizes non-unit target directions', () => {
    const rot = orientationFacing([3, 0, 0]);
    const nose = noseDirection(rot);
    expectDirection([nose.x, nose.y, nose.z], [1, 0, 0]);
  });
});
