import { describe, expect, it } from 'vitest';

import {
  runTicks,
  testConfig,
} from '../../../../tests/support/sim-builders.js';
import { MATCH_PHASE, type MatchState, type Vec3 } from '../types.js';
import { createInitialMatchState } from './state.js';

const config = testConfig();

/** Park both planes far from the ring so scoring never perturbs a scenario. */
function parkOutside(state: MatchState): void {
  state.planes.a.pos = [600, 150, 0];
  state.planes.b.pos = [-600, 150, 0];
  state.planes.a.flightSpeed = config.MIN_SPEED;
  state.planes.b.flightSpeed = config.MIN_SPEED;
}

describe('match lifecycle (GAME-3, GAME-8)', () => {
  it('ends with the higher score when regulation time runs out', () => {
    const state = createInitialMatchState(config);
    state.phase = MATCH_PHASE.Playing;
    state.phaseTicksRemaining = 1;
    state.scores = { a: 5, b: 2 };
    parkOutside(state);

    runTicks(state, 1, config);
    expect(state.phase).toBe(MATCH_PHASE.Ended);
    expect(state.scores.a).toBeGreaterThan(state.scores.b);
  });

  it('GAME-8-SUDDEN-DEATH: a tie at time-up enters sudden death and shrinks the ring', () => {
    const state = createInitialMatchState(config);
    state.phase = MATCH_PHASE.Playing;
    state.phaseTicksRemaining = 1;
    state.scores = { a: 3, b: 3 };
    parkOutside(state);

    const { events } = runTicks(state, 1, config);
    expect(state.phase).toBe(MATCH_PHASE.SuddenDeath);
    expect(state.ring.radius).toBe(config.SUDDEN_DEATH_RING_RADIUS);
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: 'phaseChange',
        phase: MATCH_PHASE.SuddenDeath,
      }),
    );
    expect(events.some((e) => e.kind === 'ringTeleport')).toBe(true);
  });

  it('GAME-8-SUDDEN-DEATH: the first scoring tick ends it for the scorer', () => {
    const state = createInitialMatchState(config);
    state.phase = MATCH_PHASE.SuddenDeath;
    state.scores = { a: 3, b: 3 };
    state.ring.radius = config.SUDDEN_DEATH_RING_RADIUS;
    // Ring hugs plane A; keep it from teleporting this tick.
    state.ring.center = [...state.planes.a.pos] as Vec3;
    state.ring.teleportTicksRemaining = 10_000;
    state.planes.b.pos = [-600, 150, 0];

    runTicks(state, 1, config);
    expect(state.phase).toBe(MATCH_PHASE.Ended);
    expect(state.scores.a).toBeGreaterThan(state.scores.b);
  });

  it('a dead-center tie in sudden death does NOT end the match', () => {
    const state = createInitialMatchState(config);
    state.phase = MATCH_PHASE.SuddenDeath;
    state.scores = { a: 3, b: 3 };
    state.ring.radius = config.SUDDEN_DEATH_RING_RADIUS;
    state.ring.teleportTicksRemaining = 10_000;
    const center: Vec3 = [0, 150, 0];
    state.ring.center = center;
    // Both equidistant from center (within tie epsilon) → nobody scores.
    state.planes.a.pos = [3, 150, 0];
    state.planes.b.pos = [-3, 150, 0];

    runTicks(state, 1, config);
    expect(state.phase).toBe(MATCH_PHASE.SuddenDeath);
  });

  it('Ended is terminal: no further scoring or movement', () => {
    const state = createInitialMatchState(config);
    state.phase = MATCH_PHASE.Ended;
    state.scores = { a: 4, b: 1 };
    const posA = [...state.planes.a.pos];

    runTicks(state, 10, config);
    expect(state.scores).toEqual({ a: 4, b: 1 });
    expect(state.planes.a.pos).toEqual(posA);
  });
});
