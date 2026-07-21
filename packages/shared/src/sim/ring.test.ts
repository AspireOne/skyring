import { describe, expect, it } from 'vitest';

import { createGameConfig, DEFAULT_GAME_CONFIG } from '../constants.js';
import { type GameEvent } from '../messages.js';
import { createRng } from '../rng.js';
import { type MatchState, type Vec3 } from '../types.js';
import { pickRingCenter, resolveScoring, stepRing } from './ring.js';
import { createInitialMatchState } from './state.js';

const config = DEFAULT_GAME_CONFIG;
const dt = 1 / config.SIM_HZ;

function stateWithRing(center: Vec3, radius = config.RING_RADIUS): MatchState {
  const state = createInitialMatchState(config);
  state.ring.center = center;
  state.ring.radius = radius;
  return state;
}

function place(state: MatchState, a: Vec3, b: Vec3): void {
  state.planes.a.pos = a;
  state.planes.b.pos = b;
}

describe('resolveScoring (GAME-4, GAME-4.1)', () => {
  it('GAME-4-NEITHER: nobody scores when both are outside', () => {
    const state = stateWithRing([0, 150, 0]);
    place(state, [500, 150, 0], [-500, 150, 0]);
    expect(resolveScoring(state, config, dt)).toBeNull();
    expect(state.scores).toEqual({ a: 0, b: 0 });
    expect(state.planes.a.scoring).toBe(false);
  });

  it('GAME-4-SOLO-SCORING: a lone occupant accrues points', () => {
    const state = stateWithRing([0, 150, 0]);
    place(state, [0, 150, 0], [-500, 150, 0]);
    expect(resolveScoring(state, config, dt)).toBe('a');
    expect(state.scores.a).toBeCloseTo(config.RING_POINTS_PER_SEC * dt, 9);
    expect(state.planes.a.inRing).toBe(true);
    expect(state.planes.a.scoring).toBe(true);
    expect(state.planes.b.inRing).toBe(false);
  });

  it('GAME-4.1-CLOSER: with both inside, the plane nearer the center scores', () => {
    const state = stateWithRing([0, 150, 0]);
    place(state, [10, 150, 0], [40, 150, 0]);
    expect(resolveScoring(state, config, dt)).toBe('a');
    expect(state.planes.b.inRing).toBe(true);
    expect(state.planes.b.scoring).toBe(false);
  });

  it('GAME-4.1-CENTER-TIE: within the tie epsilon nobody scores', () => {
    const eps = config.RING_CENTER_TIE_EPS;
    const state = stateWithRing([0, 150, 0]);
    // dA=5, dB=5+eps/2 → difference below epsilon.
    place(state, [5, 150, 0], [5 + eps / 2, 150, 0]);
    expect(resolveScoring(state, config, dt)).toBeNull();
    expect(state.scores).toEqual({ a: 0, b: 0 });
  });

  it('GAME-4.1-CENTER-TIE boundary: exactly at epsilon is still a tie; just past it scores', () => {
    const eps = config.RING_CENTER_TIE_EPS;
    const atEps = stateWithRing([0, 150, 0]);
    place(atEps, [5, 150, 0], [5 + eps, 150, 0]); // |dA-dB| == eps
    expect(resolveScoring(atEps, config, dt)).toBeNull();

    const pastEps = stateWithRing([0, 150, 0]);
    place(pastEps, [5, 150, 0], [5 + eps + 0.5, 150, 0]);
    expect(resolveScoring(pastEps, config, dt)).toBe('a');
  });

  it('GAME-9-KNOCK-OUT: leaving the ring stops scoring that tick', () => {
    const state = stateWithRing([0, 150, 0]);
    place(state, [config.RING_RADIUS + 1, 150, 0], [-500, 150, 0]);
    expect(resolveScoring(state, config, dt)).toBeNull();
    expect(state.planes.a.inRing).toBe(false);
  });
});

describe('stepRing dwell/warning/teleport (GAME-4)', () => {
  const ringConfig = createGameConfig({
    SIM_HZ: 10,
    SNAPSHOT_HZ: 10,
    RING_DWELL: 1,
    RING_WARNING: 0.5,
  });

  it('warns once, revealing a stable next center that does not change', () => {
    const state = createInitialMatchState(ringConfig);
    const rng = createRng(3);
    const events: GameEvent[] = [];
    let revealed: Vec3 | null = null;

    for (let i = 0; i < 6; i += 1) {
      stepRing(state, ringConfig, rng, events);
      if (state.ring.warning && revealed === null) {
        revealed = state.ring.nextCenter;
      }
    }
    expect(state.ring.warning).toBe(true);
    expect(revealed).not.toBeNull();
    expect(state.ring.nextCenter).toEqual(revealed);
  });

  it('teleports once to the revealed center and resets dwell', () => {
    const state = createInitialMatchState(ringConfig);
    const rng = createRng(5);
    const events: GameEvent[] = [];

    // Advance to just before the teleport and grab the revealed target.
    let target: Vec3 | null = null;
    for (let i = 0; i < 9; i += 1) {
      stepRing(state, ringConfig, rng, events);
      if (state.ring.warning) {
        target = state.ring.nextCenter;
      }
    }
    expect(target).not.toBeNull();

    stepRing(state, ringConfig, rng, events); // the 10th tick teleports
    expect(state.ring.center).toEqual(target);
    expect(state.ring.warning).toBe(false);
    expect(state.ring.nextCenter).toBeNull();
    expect(events.filter((e) => e.kind === 'ringTeleport')).toHaveLength(1);
    expect(state.ring.teleportTicksRemaining).toBe(
      ringConfig.SIM_HZ * ringConfig.RING_DWELL,
    );
  });

  it('GAME-9-RING-TELEPORT-OCCUPANCY: old-zone occupancy stops immediately after teleport', () => {
    const state = createInitialMatchState(ringConfig);
    const oldCenter: Vec3 = [...state.ring.center];
    state.planes.a.pos = oldCenter;
    state.planes.b.pos = [-500, 150, 0];
    state.ring.warning = true;
    state.ring.nextCenter = [300, 300, 300];
    state.ring.teleportTicksRemaining = 1;

    stepRing(state, ringConfig, createRng(1), []);
    expect(resolveScoring(state, ringConfig, 1 / ringConfig.SIM_HZ)).toBeNull();
    expect(state.planes.a.inRing).toBe(false);
    expect(state.scores.a).toBe(0);
  });
});

describe('pickRingCenter (GAME-4, TESTING §6.3)', () => {
  it('keeps the whole sphere inside the dome and above the ground', () => {
    const rng = createRng(11);
    for (let i = 0; i < 200; i += 1) {
      const c = pickRingCenter([0, 150, 0], config.RING_RADIUS, config, rng);
      expect(Math.hypot(...c) + config.RING_RADIUS).toBeLessThanOrEqual(
        config.DOME_RADIUS + 1e-6,
      );
      expect(c[1]).toBeGreaterThanOrEqual(
        config.GROUND_Y + config.RING_RADIUS - 1e-6,
      );
    }
  });

  it('respects the minimum teleport distance when reachable', () => {
    const rng = createRng(7);
    const current: Vec3 = [0, 150, 0];
    const c = pickRingCenter(current, config.RING_RADIUS, config, rng);
    expect(Math.hypot(c[0], c[1] - 150, c[2])).toBeGreaterThanOrEqual(
      config.RING_MIN_TELEPORT_DIST,
    );
  });

  it('terminates with an in-dome center even when the distance rule is impossible', () => {
    const impossible = createGameConfig({ RING_MIN_TELEPORT_DIST: 5000 });
    const rng = createRng(1);
    const c = pickRingCenter(
      [0, 150, 0],
      impossible.RING_RADIUS,
      impossible,
      rng,
    );
    expect(Math.hypot(...c) + impossible.RING_RADIUS).toBeLessThanOrEqual(
      impossible.DOME_RADIUS + 1e-6,
    );
  });
});
