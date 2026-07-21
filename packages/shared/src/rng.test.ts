import { describe, expect, it } from 'vitest';

import { createRng } from './rng.js';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(12_345);
    const b = createRng(12_345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays within [0, 1) and range() within [min, max)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const ranged = rng.range(-5, 5);
      expect(ranged).toBeGreaterThanOrEqual(-5);
      expect(ranged).toBeLessThan(5);
    }
  });

  it('exposes advancing internal state', () => {
    const rng = createRng(7);
    const before = rng.getState();
    rng.next();
    expect(rng.getState()).not.toBe(before);
  });
});
