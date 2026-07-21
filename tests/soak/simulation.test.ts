import {
  createInitialMatchState,
  createRng,
  DEFAULT_GAME_CONFIG,
  MATCH_PHASE,
  stepMatch,
  type GameEvent,
  type InputCommand,
  type MatchState,
  type Rng,
} from '@skyring/shared';
import { describe, expect, it } from 'vitest';

const SOAK_SEEDS = 12;

describe('seeded authoritative simulation soak', () => {
  it('completes full production-duration matches reproducibly with invariants intact', () => {
    for (let seed = 1; seed <= SOAK_SEEDS; seed += 1) {
      const first = runMatch(seed);
      const replay = runMatch(seed);
      expect(replay).toEqual(first);
      expect(first.phase).toBe(MATCH_PHASE.Ended);
    }
  }, 30_000);
});

function runMatch(seed: number): MatchState {
  const config = DEFAULT_GAME_CONFIG;
  const state = createInitialMatchState(config);
  state.phase = MATCH_PHASE.Playing;
  state.phaseTicksRemaining = config.MATCH_DURATION * config.SIM_HZ;
  // Guarantee a non-tied regulation result without shortening production timing.
  state.planes.a.pos = [...state.ring.center];
  state.planes.b.pos = [500, config.SPAWN_ALTITUDE, 0];

  const simulationRng = createRng(seed);
  const inputRng = createRng(seed ^ 0x51_7a_9e);
  const dt = 1 / config.SIM_HZ;
  let previousScores = { ...state.scores };
  const maxTicks = config.MATCH_DURATION * config.SIM_HZ + config.SIM_HZ;

  for (let tick = 0; tick < maxTicks && !matchEnded(state); tick += 1) {
    const events: GameEvent[] = [];
    stepMatch(
      state,
      {
        a: botInput(tick, inputRng, 0),
        b: botInput(tick, inputRng, 10_000),
      },
      { dt, config, rng: simulationRng, events },
    );
    assertInvariants(state, previousScores, seed, tick);
    previousScores = { ...state.scores };
  }

  return structuredClone(state);
}

function matchEnded(state: MatchState): boolean {
  return state.phase === MATCH_PHASE.Ended;
}

function botInput(
  tick: number,
  rng: Rng,
  sequenceOffset: number,
): InputCommand {
  // New intent every tick, with smoothly varying axes and seeded fire cadence.
  return {
    seq: sequenceOffset + tick,
    tick,
    throttle: Math.sin(tick / 71),
    pitch: Math.sin(tick / 113) * 0.7,
    roll: Math.cos(tick / 97) * 0.8,
    yaw: Math.sin(tick / 137) * 0.6,
    fire: rng.next() < 0.08,
  };
}

function assertInvariants(
  state: MatchState,
  previousScores: MatchState['scores'],
  seed: number,
  tick: number,
): void {
  const config = DEFAULT_GAME_CONFIG;
  invariant(
    state.scores.a >= previousScores.a && state.scores.b >= previousScores.b,
    seed,
    tick,
    'score decreased',
  );
  invariant(
    Number(state.scores.a > previousScores.a) +
      Number(state.scores.b > previousScores.b) <=
      1,
    seed,
    tick,
    'both players scored on one tick',
  );
  invariant(
    state.bullets.length <= config.MAX_BULLETS,
    seed,
    tick,
    'bullet buffer exceeded its cap',
  );
  invariant(
    new Set(state.bullets.map(({ id }) => id)).size === state.bullets.length,
    seed,
    tick,
    'duplicate bullet id',
  );
  invariant(
    Number.isFinite(state.scores.a) && Number.isFinite(state.scores.b),
    seed,
    tick,
    'non-finite score',
  );
  invariant(
    [...state.ring.center].every((value) => Number.isFinite(value)) &&
      state.ring.radius > 0 &&
      state.ring.teleportTicksRemaining > 0,
    seed,
    tick,
    'invalid ring state',
  );

  for (const bullet of state.bullets) {
    invariant(
      [
        ...bullet.previousPos,
        ...bullet.pos,
        ...bullet.vel,
        bullet.lifetimeTicksRemaining,
      ].every((value) => Number.isFinite(value)) &&
        bullet.lifetimeTicksRemaining > 0,
      seed,
      tick,
      'invalid bullet state',
    );
  }

  for (const plane of Object.values(state.planes)) {
    invariant(
      [...plane.pos, ...plane.vel, ...plane.rot].every((value) =>
        Number.isFinite(value),
      ),
      seed,
      tick,
      'non-finite plane state',
    );
    invariant(
      Math.abs(Math.hypot(...plane.rot) - 1) < 1e-8,
      seed,
      tick,
      'non-normalized rotation',
    );
    invariant(
      plane.ammo >= 0 && plane.ammo <= config.AMMO_MAX,
      seed,
      tick,
      'ammo outside configured range',
    );
    invariant(
      plane.flightSpeed >= config.MIN_SPEED &&
        plane.flightSpeed <= config.MAX_SPEED &&
        plane.fireCooldownTicks >= 0 &&
        plane.stumbleTicksRemaining >= 0,
      seed,
      tick,
      'plane timers or flight speed outside configured range',
    );
    invariant(
      plane.pos[1] >= config.GROUND_Y + config.PLANE_COLLISION_RADIUS - 1e-8,
      seed,
      tick,
      'plane below ground',
    );
    invariant(
      Math.hypot(...plane.pos) <=
        config.DOME_RADIUS - config.PLANE_COLLISION_RADIUS + 1e-8,
      seed,
      tick,
      'plane outside dome',
    );
  }
}

function invariant(
  condition: boolean,
  seed: number,
  tick: number,
  message: string,
): asserts condition {
  if (!condition)
    throw new Error(`Soak seed ${seed}, tick ${tick}: ${message}`);
}
