import {
  createInitialMatchState,
  createRng,
  DEFAULT_GAME_CONFIG,
  MATCH_PHASE,
  NEUTRAL_INPUT,
  stepMatch,
  type BulletState,
} from '@skyring/shared';
import { describe, expect, it } from 'vitest';

const EXPECTED_CONCURRENT_MATCHES = 32;
const SERVER_FRAME_BUDGET_MS = 1000 / DEFAULT_GAME_CONFIG.SIM_HZ;
const FIRE_INPUT = Object.freeze({ ...NEUTRAL_INPUT, fire: true });

describe('release performance budgets', () => {
  it('steps 32 concurrent authoritative matches inside one 60 Hz server frame', () => {
    const config = DEFAULT_GAME_CONFIG;
    const dt = 1 / config.SIM_HZ;
    const matches = Array.from(
      { length: EXPECTED_CONCURRENT_MATCHES },
      (_, index) => {
        const state = createInitialMatchState(config);
        state.phase = MATCH_PHASE.Playing;
        state.phaseTicksRemaining = config.MATCH_DURATION * config.SIM_HZ;
        return { state, rng: createRng(index + 1) };
      },
    );
    const durations: number[] = [];

    for (let frame = 0; frame < 360; frame += 1) {
      const startedAt = performance.now();
      for (const match of matches) {
        stepMatch(
          match.state,
          { a: FIRE_INPUT, b: FIRE_INPUT },
          { dt, config, rng: match.rng, events: [] },
        );
      }
      if (frame >= 60) durations.push(performance.now() - startedAt);
    }

    const p95 = percentile(durations, 0.95);
    process.stdout.write(
      `[performance] server batch: ${EXPECTED_CONCURRENT_MATCHES} matches, p95=${p95.toFixed(3)}ms\n`,
    );
    expect(p95).toBeLessThan(SERVER_FRAME_BUDGET_MS);
  });

  it('keeps a maximum-projectile recipient snapshot below 16 KiB', () => {
    const state = createInitialMatchState(DEFAULT_GAME_CONFIG);
    state.bullets = Array.from(
      { length: DEFAULT_GAME_CONFIG.MAX_BULLETS },
      (_, index): BulletState => ({
        id: index + 1,
        owner: index % 2 === 0 ? ('a' as const) : ('b' as const),
        previousPos: [index, 150, -index],
        pos: [index + 1, 150, -index - 1],
        vel: [400, 0, -400],
        lifetimeTicksRemaining: 72,
      }),
    );
    const payload = JSON.stringify({
      t: 'snapshot',
      tick: state.tick,
      serverTime: 0,
      ackSeq: -1,
      state,
    });
    const bytes = Buffer.byteLength(payload);
    process.stdout.write(
      `[performance] max-projectile snapshot: ${bytes} bytes\n`,
    );
    expect(bytes).toBeLessThan(16 * 1024);
  });
});

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * quantile),
  );
  return sorted[index] ?? Infinity;
}
