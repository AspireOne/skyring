import {
  createGameConfig,
  createInitialMatchState,
  DEFAULT_GAME_CONFIG,
  MATCH_PHASE,
  stepPlane,
  type InputCommand,
  type PlaneState,
} from '@skyring/shared';
import { describe, expect, it } from 'vitest';

import { LocalPrediction } from './local-prediction.js';
import { makeInput } from '../../../../tests/support/sim-builders.js';

const config = DEFAULT_GAME_CONFIG;

function playingState() {
  const state = createInitialMatchState(config);
  state.phase = MATCH_PHASE.Playing;
  state.phaseTicksRemaining = config.MATCH_DURATION * config.SIM_HZ;
  return state;
}

function input(
  seq: number,
  overrides: Partial<InputCommand> = {},
): InputCommand {
  return makeInput({ seq, ...overrides });
}

describe('LocalPrediction (IMPL-4.4-RECONCILIATION)', () => {
  it('applies local input immediately and retains it until acknowledged', () => {
    const state = playingState();
    const prediction = new LocalPrediction('a', config);
    prediction.reconcile(state, -1);
    const before = prediction.predictedPlane?.pos;

    prediction.predict(input(1, { throttle: 1 }), state.phase);

    expect(prediction.pendingCount).toBe(1);
    expect(prediction.predictedPlane?.pos).not.toEqual(before);
  });

  it('discards acknowledged input once and replays remaining input in sequence', () => {
    const initial = playingState();
    const prediction = new LocalPrediction('a', config);
    prediction.reconcile(initial, -1);
    prediction.predict(input(1, { throttle: 1 }), initial.phase);
    prediction.predict(input(2, { pitch: 1 }), initial.phase);

    const authoritative = playingState();
    authoritative.planes.a.pos = [-100, 200, 30];
    authoritative.planes.a.vel = [10, 0, -20];
    const expected = clonePlane(authoritative.planes.a);
    stepPlane(expected, input(2, { pitch: 1 }), 1 / config.SIM_HZ, config);

    prediction.reconcile(authoritative, 1);
    expect(prediction.pendingCount).toBe(1);
    expect(prediction.predictedPlane).toEqual(expected);

    prediction.reconcile(authoritative, 2);
    expect(prediction.pendingCount).toBe(0);
    prediction.reconcile(authoritative, 2);
    expect(prediction.pendingCount).toBe(0);
  });

  it('eases a small position correction without changing simulation truth', () => {
    const initial = playingState();
    const prediction = new LocalPrediction('a', config);
    prediction.reconcile(initial, -1);
    prediction.predict(input(1), initial.phase);
    const beforeCorrection = prediction.sample(0)?.pos;

    const corrected = playingState();
    corrected.planes.a.pos = [
      initial.planes.a.pos[0] + 1,
      initial.planes.a.pos[1],
      initial.planes.a.pos[2],
    ];
    prediction.reconcile(corrected, 1);

    expect(prediction.sample(0)?.pos).toEqual(beforeCorrection);
    const truth = prediction.predictedPlane?.pos;
    prediction.sample(config.PREDICTION_SMOOTH_TIME);
    const eased = prediction.sample(0)?.pos;
    expect(distance(eased, truth)).toBeLessThan(
      distance(beforeCorrection, truth),
    );
    expect(prediction.predictedPlane?.pos).toEqual(truth);
  });

  it('snaps a large correction directly to authoritative truth', () => {
    const initial = playingState();
    const prediction = new LocalPrediction('a', config);
    prediction.reconcile(initial, -1);
    prediction.predict(input(1), initial.phase);

    const corrected = playingState();
    corrected.planes.a.pos = [
      initial.planes.a.pos[0] + config.PREDICTION_SNAP_DISTANCE * 2,
      initial.planes.a.pos[1],
      initial.planes.a.pos[2],
    ];
    prediction.reconcile(corrected, 1);

    expect(prediction.sample(0)?.pos).toEqual(corrected.planes.a.pos);
  });

  it('predicts ammo, recoil, and the local tracer through shared gun helpers', () => {
    const state = playingState();
    const prediction = new LocalPrediction('a', config);
    prediction.reconcile(state, -1);
    prediction.predict(input(1, { fire: true }), state.phase);

    expect(prediction.predictedPlane?.ammo).toBe(
      config.AMMO_MAX - config.AMMO_PER_SHOT,
    );
    expect(prediction.predictedPlane?.vel[0]).toBeLessThan(0);
    expect(prediction.sample(0)?.bullets).toHaveLength(1);
  });

  it('does not predict forbidden movement during countdown or fire while stumbling', () => {
    const countdown = createInitialMatchState(config);
    const prediction = new LocalPrediction('a', config);
    prediction.reconcile(countdown, -1);
    const start = prediction.predictedPlane;
    prediction.predict(input(1, { throttle: 1, fire: true }), countdown.phase);
    expect(prediction.predictedPlane).toEqual(start);

    const playing = playingState();
    playing.planes.a.stumbleTicksRemaining = 2;
    prediction.reconcile(playing, 1);
    prediction.predict(input(2, { fire: true }), playing.phase);
    expect(prediction.sample(0)?.bullets).toHaveLength(0);
  });

  it('keeps the unacknowledged input buffer bounded under a stalled ack', () => {
    const bounded = createGameConfig({ PREDICTION_MAX_INPUTS: 2 });
    const state = createInitialMatchState(bounded);
    state.phase = MATCH_PHASE.Playing;
    const prediction = new LocalPrediction('a', bounded);
    prediction.reconcile(state, -1);

    prediction.predict(input(1), state.phase);
    prediction.predict(input(2), state.phase);
    prediction.predict(input(3), state.phase);
    expect(prediction.pendingCount).toBe(2);
  });
});

function clonePlane(plane: PlaneState): PlaneState {
  return {
    ...plane,
    pos: [...plane.pos],
    vel: [...plane.vel],
    rot: [...plane.rot],
    stumbleAngularVelocity: [...plane.stumbleAngularVelocity],
  };
}

function distance(
  a: readonly number[] | undefined,
  b: readonly number[] | undefined,
): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    (a[0] ?? 0) - (b[0] ?? 0),
    (a[1] ?? 0) - (b[1] ?? 0),
    (a[2] ?? 0) - (b[2] ?? 0),
  );
}
