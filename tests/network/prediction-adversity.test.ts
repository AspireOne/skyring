import {
  createInitialMatchState,
  createRng,
  DEFAULT_GAME_CONFIG,
  MATCH_PHASE,
  NEUTRAL_INPUT,
  stepMatch,
  type InputCommand,
  type SnapshotMessage,
} from '@skyring/shared';
import { describe, expect, it } from 'vitest';

import { LocalPrediction } from '../../packages/client/src/net/local-prediction.js';
import { NetworkHarness } from '../support/network-harness.js';
import { makeInput } from '../support/sim-builders.js';

describe('prediction under network adversity (TESTING §10)', () => {
  it('stays responsive through latency/jitter/stall and converges after the final ack', () => {
    const config = DEFAULT_GAME_CONFIG;
    const dt = 1 / config.SIM_HZ;
    const state = createInitialMatchState(config);
    state.phase = MATCH_PHASE.Playing;
    state.phaseTicksRemaining = config.MATCH_DURATION * config.SIM_HZ;
    state.ring.teleportTicksRemaining = 100_000;
    state.planes.b.pos = [600, 150, 0];

    const prediction = new LocalPrediction('a', config);
    prediction.reconcile(state, -1);
    const uplink = new NetworkHarness<InputCommand>(11, {
      latencyTicks: 6,
      jitterTicks: 3,
    });
    const downlink = new NetworkHarness<SnapshotMessage>(17, {
      latencyTicks: 6,
      jitterTicks: 3,
      pauseStartTick: 50,
      pauseTicks: 25,
    });
    const rng = createRng(23);
    let serverInput = NEUTRAL_INPUT;
    let ackSeq = -1;
    let maxDownlink = 0;

    for (let tick = 1; tick <= 180; tick += 1) {
      const input = makeInput({
        seq: tick,
        tick,
        throttle: 1,
        pitch: Math.sin(tick / 20) * 0.4,
        yaw: Math.cos(tick / 25) * 0.3,
      });
      prediction.predict(input, MATCH_PHASE.Playing);
      uplink.send(tick, input);

      const deliveredInputs = uplink.receive(tick);
      const latest = deliveredInputs.at(-1);
      if (latest) {
        serverInput = latest;
        ackSeq = latest.seq;
      }
      stepMatch(
        state,
        { a: serverInput, b: NEUTRAL_INPUT },
        { dt, config, rng, events: [] },
      );

      if (tick % 2 === 0) {
        downlink.send(tick, snapshot(state, ackSeq, tick));
      }
      for (const incoming of downlink.receive(tick)) {
        prediction.reconcile(incoming.state, incoming.ackSeq);
      }
      maxDownlink = Math.max(maxDownlink, downlink.size);

      expect(
        prediction.sample(0)?.pos.every((value) => Number.isFinite(value)),
      ).toBe(true);
      expect(prediction.pendingCount).toBeLessThanOrEqual(
        config.PREDICTION_MAX_INPUTS,
      );
    }

    // Deliver the tail and one final authoritative snapshot. This represents
    // the normal post-stall resync: no permanent drift or lost retained input.
    for (let tick = 181; uplink.size > 0 && tick < 240; tick += 1) {
      const latest = uplink.receive(tick).at(-1);
      if (latest) {
        serverInput = latest;
        ackSeq = latest.seq;
      }
      stepMatch(
        state,
        { a: serverInput, b: NEUTRAL_INPUT },
        { dt, config, rng, events: [] },
      );
    }
    prediction.reconcile(state, ackSeq);

    expect(ackSeq).toBe(180);
    expect(prediction.pendingCount).toBe(0);
    expect(prediction.predictedPlane?.pos).toEqual(state.planes.a.pos);
    expect(maxDownlink).toBeLessThan(30);

    for (let frame = 0; frame < 20; frame += 1) {
      prediction.sample(config.PREDICTION_SMOOTH_TIME);
    }
    const rendered = prediction.sample(0)?.pos;
    expect(distance(rendered, state.planes.a.pos)).toBeLessThan(0.001);
  });
});

function snapshot(
  state: ReturnType<typeof createInitialMatchState>,
  ackSeq: number,
  serverTime: number,
): SnapshotMessage {
  return {
    t: 'snapshot',
    tick: state.tick,
    serverTime,
    ackSeq,
    state: structuredClone(state),
  };
}

function distance(
  a: readonly number[] | undefined,
  b: readonly number[],
): number {
  if (!a) return Infinity;
  return Math.hypot(
    (a[0] ?? 0) - (b[0] ?? 0),
    (a[1] ?? 0) - (b[1] ?? 0),
    (a[2] ?? 0) - (b[2] ?? 0),
  );
}
