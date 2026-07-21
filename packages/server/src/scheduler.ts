export type Now = () => number;

/** Max simulation steps consumed in one wake-up (spiral-of-death clamp). */
const MAX_CATCHUP_STEPS = 5;

/**
 * Drift-corrected fixed-rate driver (ARCHITECTURE §3.3). It computes
 * the next tick deadline from a fixed step and catches up (bounded) when the
 * event loop runs late, so simulation time tracks wall-clock without spiralling.
 *
 * Progression is deliberately separated from scheduling: this only decides
 * *when* to call `onTick`. Tests advance the match by calling its step API
 * directly and never construct a scheduler (TESTING §2).
 */
export class TickScheduler {
  private readonly stepMs: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nextDeadline = 0;
  private running = false;

  constructor(
    hz: number,
    private readonly onTick: () => void,
    private readonly now: Now = () => performance.now(),
  ) {
    this.stepMs = 1000 / hz;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.nextDeadline = this.now() + this.stepMs;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNext(): void {
    if (!this.running) {
      return;
    }
    const delay = Math.max(0, this.nextDeadline - this.now());
    this.timer = setTimeout(() => this.fire(), delay);
  }

  private fire(): void {
    let steps = 0;
    while (this.now() >= this.nextDeadline && steps < MAX_CATCHUP_STEPS) {
      this.onTick();
      this.nextDeadline += this.stepMs;
      steps += 1;
    }

    // If we blew the catch-up budget, resync the deadline to now so we do not
    // accumulate an unpayable debt of ticks.
    if (steps >= MAX_CATCHUP_STEPS && this.now() >= this.nextDeadline) {
      this.nextDeadline = this.now() + this.stepMs;
    }

    this.scheduleNext();
  }
}
