import { describe, expect, it } from 'vitest';

import { ClockSync } from './clock-sync.js';

describe('ClockSync', () => {
  it('reports no sync before any sample', () => {
    const clock = new ClockSync();
    expect(clock.hasSync).toBe(false);
    expect(clock.estimateServerTime(100)).toBe(100);
  });

  it('estimates offset from the round-trip midpoint', () => {
    const clock = new ClockSync();
    // sent at 0, received at 20 (rtt 20), server stamped 1010 at midpoint (t=10)
    clock.addSample(0, 1010, 20);
    expect(clock.rtt).toBe(20);
    // offset = 1010 - (0 + 10) = 1000
    expect(clock.estimateServerTime(0)).toBe(1000);
    expect(clock.estimateServerTime(50)).toBe(1050);
  });

  it('keeps the lowest-RTT sample and ignores worse ones', () => {
    const clock = new ClockSync();
    clock.addSample(0, 1000, 200); // rtt 200, offset 900
    clock.addSample(0, 1010, 20); // rtt 20, offset 1000 — better
    clock.addSample(0, 5000, 400); // rtt 400 — ignored
    expect(clock.rtt).toBe(20);
    expect(clock.estimateServerTime(0)).toBe(1000);
    expect(clock.samples).toBe(3);
  });

  it('ignores samples with a negative RTT', () => {
    const clock = new ClockSync();
    clock.addSample(100, 1000, 50);
    expect(clock.hasSync).toBe(false);
  });
});
