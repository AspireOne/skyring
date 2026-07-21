import { createRng } from '@skyring/shared';

import type { Rng } from '@skyring/shared';

export interface NetworkProfile {
  readonly latencyTicks: number;
  readonly jitterTicks: number;
  readonly pauseStartTick?: number;
  readonly pauseTicks?: number;
}

interface Scheduled<T> {
  readonly deliveryTick: number;
  readonly value: T;
}

/**
 * Deterministic ordered-link fault harness for tests (TESTING §10). It models
 * latency, jitter, and a receive stall while retaining TCP/WebSocket ordering.
 */
export class NetworkHarness<T> {
  private readonly rng: Rng;
  private readonly scheduled: Scheduled<T>[] = [];
  private lastDeliveryTick = -1;

  constructor(
    seed: number,
    private readonly profile: NetworkProfile,
  ) {
    this.rng = createRng(seed);
  }

  send(nowTick: number, value: T): void {
    const jitter = Math.round(
      this.rng.range(-this.profile.jitterTicks, this.profile.jitterTicks),
    );
    let deliveryTick = Math.max(
      nowTick,
      nowTick + this.profile.latencyTicks + jitter,
      this.lastDeliveryTick,
    );
    const pauseStart = this.profile.pauseStartTick;
    const pauseEnd =
      pauseStart === undefined
        ? undefined
        : pauseStart + (this.profile.pauseTicks ?? 0);
    if (
      pauseStart !== undefined &&
      pauseEnd !== undefined &&
      deliveryTick >= pauseStart &&
      deliveryTick < pauseEnd
    ) {
      deliveryTick = pauseEnd;
    }
    this.lastDeliveryTick = deliveryTick;
    this.scheduled.push({ deliveryTick, value });
  }

  receive(nowTick: number): T[] {
    let count = 0;
    while ((this.scheduled[count]?.deliveryTick ?? Infinity) <= nowTick) {
      count += 1;
    }
    return count === 0
      ? []
      : this.scheduled.splice(0, count).map(({ value }) => value);
  }

  get size(): number {
    return this.scheduled.length;
  }
}
