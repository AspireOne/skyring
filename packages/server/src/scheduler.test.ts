import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TickScheduler } from './scheduler.js';

describe('TickScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires at the configured rate under steady time', () => {
    let clock = 0;
    const now = (): number => clock;
    let ticks = 0;
    const scheduler = new TickScheduler(60, () => (ticks += 1), now);
    scheduler.start();

    // Advance ~10 sim steps worth of wall time in one-step increments.
    for (let i = 0; i < 10; i += 1) {
      clock += 1000 / 60;
      vi.advanceTimersByTime(1000 / 60);
    }
    scheduler.stop();
    expect(ticks).toBeGreaterThanOrEqual(9);
    expect(ticks).toBeLessThanOrEqual(11);
  });

  it('catches up bounded ticks after a long stall instead of spiralling', () => {
    let clock = 0;
    const now = (): number => clock;
    let ticks = 0;
    const scheduler = new TickScheduler(60, () => (ticks += 1), now);
    scheduler.start();

    // Simulate the event loop being blocked for a full second (60 steps): the
    // clock jumps ahead, then the pending timer finally fires.
    clock += 1000;
    vi.advanceTimersByTime(1000 / 60 + 1);
    scheduler.stop();

    // Clamped to the catch-up budget, not 60.
    expect(ticks).toBeLessThanOrEqual(5);
    expect(ticks).toBeGreaterThan(0);
  });

  it('stops firing after stop()', () => {
    let clock = 0;
    const now = (): number => clock;
    let ticks = 0;
    const scheduler = new TickScheduler(60, () => (ticks += 1), now);
    scheduler.start();
    clock += 1000 / 60;
    vi.advanceTimersByTime(1000 / 60);
    const afterFirst = ticks;
    scheduler.stop();
    clock += 1000;
    vi.advanceTimersByTime(1000);
    expect(ticks).toBe(afterFirst);
  });
});
