/**
 * NTP-lite clock estimation (IMPLEMENTATION §4.5). From ping/pong round trips
 * it estimates `serverTime ≈ localTime + offset`, keeping the sample with the
 * lowest RTT (the least jittered, most trustworthy estimate).
 *
 * Pure and side-effect free so it is fully unit-testable with controlled
 * samples (TESTING §8).
 */
export class ClockSync {
  private bestRtt = Number.POSITIVE_INFINITY;
  private offset = 0;
  private sampleCount = 0;

  /**
   * Fold in one round trip. `serverTime` is the server's stamp on the pong;
   * the send/receive times are the client's local clock readings.
   */
  addSample(
    clientSendTime: number,
    serverTime: number,
    clientReceiveTime: number,
  ): void {
    const rtt = clientReceiveTime - clientSendTime;
    if (rtt < 0) {
      return; // clock went backwards mid-flight; ignore
    }
    this.sampleCount += 1;
    if (rtt < this.bestRtt) {
      this.bestRtt = rtt;
      // Assume the server stamped serverTime at the round-trip midpoint.
      this.offset = serverTime - (clientSendTime + rtt / 2);
    }
  }

  get hasSync(): boolean {
    return this.sampleCount > 0;
  }

  get samples(): number {
    return this.sampleCount;
  }

  get rtt(): number {
    return this.bestRtt === Number.POSITIVE_INFINITY ? 0 : this.bestRtt;
  }

  /** Best estimate of the server's clock for a given local time. */
  estimateServerTime(localTime: number): number {
    return localTime + this.offset;
  }
}
