import {
  createGameConfig,
  createInitialMatchState,
  MATCH_PHASE,
  type GameConfig,
  type MatchState,
} from '@skyring/shared';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createSkyRingServer,
  type ServerAddress,
  type SkyRingServer,
} from '../../packages/server/src/server.js';
import { TestClient } from '../support/test-client.js';

let server: SkyRingServer;
let address: ServerAddress;
const clients: TestClient[] = [];

async function startWith(
  config: GameConfig,
  createState: (config: GameConfig) => MatchState,
): Promise<void> {
  server = createSkyRingServer({
    config,
    nextSeed: () => 42,
    createInitialState: createState,
  });
  address = await server.start();
}

async function pairTwo(): Promise<[TestClient, TestClient]> {
  const one = await TestClient.connect(address.wsUrl);
  const two = await TestClient.connect(address.wsUrl);
  clients.push(one, two);
  await one.handshake();
  await two.handshake();
  one.send({ t: 'queue', mode: 'quick' });
  two.send({ t: 'queue', mode: 'quick' });
  const [foundOne] = await Promise.all([
    one.next('matchFound'),
    two.next('matchFound'),
  ]);
  // Return them in slot order (a, b).
  return foundOne.yourSlot === 'a' ? [one, two] : [two, one];
}

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()));
  clients.length = 0;
  await server.stop();
});

describe('regulation result over the wire (GAME-3)', () => {
  it('awards win/lose to the correct slots at time-up', async () => {
    await startWith(
      createGameConfig({ COUNTDOWN: 1, MATCH_DURATION: 1 }),
      (config) => {
        const state = createInitialMatchState(config);
        state.planes.a.pos = [0, config.SPAWN_ALTITUDE, 0]; // sits in the ring
        state.planes.b.pos = [-600, config.SPAWN_ALTITUDE, 0]; // far outside
        return state;
      },
    );

    const [a, b] = await pairTwo();
    const [endA, endB] = await Promise.all([
      a.next('matchEnd', 8000),
      b.next('matchEnd', 8000),
    ]);
    expect(endA).toMatchObject({ result: 'win', reason: 'time' });
    expect(endB).toMatchObject({ result: 'lose', reason: 'time' });
  }, 15_000);
});

describe('tie enters sudden death (GAME-8)', () => {
  it('reaches the suddenDeath phase when regulation ends level', async () => {
    await startWith(createGameConfig({ MATCH_DURATION: 1 }), (config) => {
      const state = createInitialMatchState(config);
      state.phase = MATCH_PHASE.Playing;
      state.phaseTicksRemaining = 30; // ~0.5s of regulation left
      // Both parked far from the ring so neither scores → 0-0 tie.
      state.planes.a.pos = [600, config.SPAWN_ALTITUDE, 0];
      state.planes.b.pos = [-600, config.SPAWN_ALTITUDE, 0];
      return state;
    });

    const [a] = await pairTwo();
    for (let i = 0; i < 200; i += 1) {
      const snapshot = await a.next('snapshot', 4000);
      if (snapshot.state.phase === 'suddenDeath') {
        expect(snapshot.state.ring.radius).toBe(70);
        return;
      }
    }
    throw new Error('never reached sudden death');
  }, 15_000);
});

describe('sudden death ends on the first point (GAME-8)', () => {
  it('awards the match to the first scorer', async () => {
    await startWith(createGameConfig(), (config) => {
      const state = createInitialMatchState(config);
      state.phase = MATCH_PHASE.SuddenDeath;
      state.scores = { a: 3, b: 3 };
      state.ring.radius = config.SUDDEN_DEATH_RING_RADIUS;
      state.ring.center = [0, config.SPAWN_ALTITUDE, 0];
      state.ring.teleportTicksRemaining = 100_000;
      state.planes.a.pos = [0, config.SPAWN_ALTITUDE, 0]; // in the ring
      state.planes.b.pos = [-600, config.SPAWN_ALTITUDE, 0];
      return state;
    });

    const [a, b] = await pairTwo();
    const [endA, endB] = await Promise.all([
      a.next('matchEnd', 8000),
      b.next('matchEnd', 8000),
    ]);
    expect(endA).toMatchObject({ result: 'win', reason: 'suddenDeath' });
    expect(endB).toMatchObject({ result: 'lose', reason: 'suddenDeath' });
  }, 15_000);
});
