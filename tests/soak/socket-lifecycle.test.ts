import {
  createGameConfig,
  createInitialMatchState,
  MATCH_PHASE,
} from '@skyring/shared';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createSkyRingServer,
  type SkyRingServer,
} from '../../packages/server/src/server.js';
import { TestClient } from '../support/test-client.js';

let server: SkyRingServer | undefined;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

describe('repeated real-WebSocket match soak', () => {
  it('releases every connection, waiting slot, match, and bounded heap trend', async () => {
    const config = createGameConfig({ COUNTDOWN: 0.05, MATCH_DURATION: 0.1 });
    server = createSkyRingServer({
      config,
      nextSeed: () => 42,
      createInitialState: (effective) => {
        const state = createInitialMatchState(effective);
        state.phase = MATCH_PHASE.Playing;
        state.phaseTicksRemaining = 2;
        state.scores = { a: 1, b: 0 };
        state.planes.a.pos = [-600, effective.SPAWN_ALTITUDE, 0];
        state.planes.b.pos = [600, effective.SPAWN_ALTITUDE, 0];
        state.ring.teleportTicksRemaining = 100_000;
        return state;
      },
    });
    const address = await server.start();
    const heapSamples: number[] = [];

    for (let round = 0; round < 30; round += 1) {
      const one = await TestClient.connect(address.wsUrl);
      const two = await TestClient.connect(address.wsUrl);
      await Promise.all([one.handshake(), two.handshake()]);
      const room = `SOAK${String(round).padStart(4, '0')}`;
      one.send({ t: 'queue', mode: 'room', room });
      two.send({ t: 'queue', mode: 'room', room });
      await Promise.all([one.next('matchFound'), two.next('matchFound')]);
      const [endOne, endTwo] = await Promise.all([
        one.next('matchEnd'),
        two.next('matchEnd'),
      ]);
      expect([endOne.result, endTwo.result].sort()).toEqual(['lose', 'win']);
      await Promise.all([one.close(), two.close()]);
      await waitForEmpty(server);
      if (round >= 5) heapSamples.push(process.memoryUsage().heapUsed);
    }

    expect(server.stats()).toEqual({
      connections: 0,
      activeMatches: 0,
      waiting: 0,
    });
    const heapRange = Math.max(...heapSamples) - Math.min(...heapSamples);
    process.stdout.write(
      `[soak] 30 socket matches: heap range ${(heapRange / 1024 / 1024).toFixed(2)} MiB\n`,
    );
    expect(heapRange).toBeLessThan(64 * 1024 * 1024);
  }, 30_000);
});

async function waitForEmpty(running: SkyRingServer): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (
      running.stats().connections === 0 &&
      running.stats().activeMatches === 0 &&
      running.stats().waiting === 0
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(running.stats()).toEqual({
    connections: 0,
    activeMatches: 0,
    waiting: 0,
  });
}
