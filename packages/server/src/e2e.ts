import {
  createGameConfig,
  createInitialMatchState,
  createRng,
  MATCH_PHASE,
  orientationFacing,
  pickRingCenter,
  secondsToTicks,
  type GameConfig,
  type MatchState,
  type Vec3,
} from '@skyring/shared';

import { readHost, readPort } from './env.js';
import { createSkyRingServer } from './server.js';

import type { MatchContext } from './match.js';

const E2E_SEED = 42;
const config = createGameConfig({
  COUNTDOWN: 0.5,
  MATCH_DURATION: 60,
  RING_DWELL: 6,
  RING_WARNING: 2,
});

const server = createSkyRingServer({
  config,
  nextSeed: () => E2E_SEED,
  createInitialState: createScenario,
});
const address = await server.start(
  readPort(process.env.PORT),
  readHost(process.env.HOST),
);
process.stdout.write(`SkyRing E2E server listening at ${address.httpUrl}\n`);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await server.stop();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown().then(
      () => process.exit(0),
      (error: unknown) => {
        process.stderr.write(`E2E server shutdown failed: ${String(error)}\n`);
        process.exit(1);
      },
    );
  });
}

function createScenario(
  effective: GameConfig,
  context: MatchContext,
): MatchState {
  const state = createInitialMatchState(effective);
  if (context.room?.startsWith('WIN')) {
    configureRegulationWin(state, effective);
  } else if (context.room?.startsWith('TIE')) {
    configureTieIntoSuddenDeath(state, effective);
  } else if (context.room?.startsWith('RING')) {
    configureRingRelocation(state, effective);
  }
  return state;
}

function configureRingRelocation(
  state: MatchState,
  effective: GameConfig,
): void {
  state.phase = MATCH_PHASE.Playing;
  state.phaseTicksRemaining = secondsToTicks(
    effective.MATCH_DURATION,
    effective.SIM_HZ,
  );
  state.ring.teleportTicksRemaining = secondsToTicks(
    effective.RING_WARNING + 0.5,
    effective.SIM_HZ,
  );
  parkOutsideRing(state, effective, false);
}

function configureRegulationWin(
  state: MatchState,
  effective: GameConfig,
): void {
  state.phase = MATCH_PHASE.Playing;
  state.phaseTicksRemaining = Math.ceil(effective.SIM_HZ / 3);
  state.scores = { a: 5, b: 1 };
  parkOutsideRing(state, effective);
}

function configureTieIntoSuddenDeath(
  state: MatchState,
  effective: GameConfig,
): void {
  state.phase = MATCH_PHASE.Playing;
  state.phaseTicksRemaining = 1;
  state.scores = { a: 3, b: 3 };
  state.ring.teleportTicksRemaining = 100_000;

  const target = pickRingCenter(
    state.ring.center,
    effective.SUDDEN_DEATH_RING_RADIUS,
    effective,
    createRng(E2E_SEED),
  );
  const outward = normalize(target);
  const approachDistance = effective.SUDDEN_DEATH_RING_RADIUS + 60;
  const start: Vec3 = [
    target[0] - outward[0] * approachDistance,
    target[1] - outward[1] * approachDistance,
    target[2] - outward[2] * approachDistance,
  ];
  const towardTarget: Vec3 = [
    target[0] - start[0],
    target[1] - start[1],
    target[2] - start[2],
  ];
  state.planes.a.pos = start;
  state.planes.a.rot = orientationFacing(towardTarget);
  state.planes.a.vel = [0, 0, 0];

  const candidate: Vec3 = [-600, effective.SPAWN_ALTITUDE, 0];
  state.planes.b.pos =
    distance(candidate, target) > 200
      ? candidate
      : [600, effective.SPAWN_ALTITUDE, 0];
  state.planes.b.vel = [0, 0, 0];
}

function parkOutsideRing(
  state: MatchState,
  effective: GameConfig,
  holdRing = true,
): void {
  if (holdRing) state.ring.teleportTicksRemaining = 100_000;
  state.planes.a.pos = [-600, effective.SPAWN_ALTITUDE, 0];
  state.planes.b.pos = [600, effective.SPAWN_ALTITUDE, 0];
  state.planes.a.vel = [0, 0, 0];
  state.planes.b.vel = [0, 0, 0];
}

function normalize(value: Vec3): Vec3 {
  const length = Math.hypot(...value) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
