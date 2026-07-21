import {
  createGameConfig,
  type MatchPhase,
  type SnapshotMessage,
} from '@skyring/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSkyRingServer,
  type ServerAddress,
  type SkyRingServer,
} from '../../packages/server/src/server.js';
import { TestClient } from '../support/test-client.js';

let server: SkyRingServer;
let address: ServerAddress;
const clients: TestClient[] = [];

async function connectQueued(): Promise<TestClient> {
  const client = await TestClient.connect(address.wsUrl);
  clients.push(client);
  await client.handshake();
  client.send({ t: 'queue', mode: 'quick' });
  return client;
}

async function waitForPhase(
  client: TestClient,
  phase: MatchPhase,
): Promise<SnapshotMessage> {
  for (let i = 0; i < 400; i += 1) {
    const snapshot = await client.next('snapshot', 4000);
    if (snapshot.state.phase === phase) {
      return snapshot;
    }
  }
  throw new Error(`Never reached phase "${phase}"`);
}

beforeEach(async () => {
  // Short countdown so the match reaches play quickly under the real scheduler.
  server = createSkyRingServer({
    config: createGameConfig({ COUNTDOWN: 1 }),
    nextSeed: () => 42,
  });
  address = await server.start();
});

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()));
  clients.length = 0;
  await server.stop();
});

describe('authoritative flight over the wire', () => {
  it('transitions countdown → playing and moves both planes', async () => {
    const one = await connectQueued();
    const two = await connectQueued();
    await Promise.all([one.next('matchFound'), two.next('matchFound')]);

    const playing = await waitForPhase(one, 'playing');
    expect(playing.state.phase).toBe('playing');

    // A few ticks into play the planes carry velocity along their nose.
    let latest = playing;
    for (let i = 0; i < 5; i += 1) {
      latest = await one.next('snapshot', 4000);
    }
    const speedA = Math.hypot(...latest.state.planes.a.vel);
    expect(speedA).toBeGreaterThan(0);
    expect(latest.state.planes.a.pos[0]).toBeGreaterThan(
      playing.state.planes.a.pos[0],
    );

    // Both clients agree on the authoritative phase.
    const playingTwo = await waitForPhase(two, 'playing');
    expect(playingTwo.state.phase).toBe('playing');
  }, 10_000);

  it('delivers a phaseChange event when play starts', async () => {
    const one = await connectQueued();
    const two = await connectQueued();
    await Promise.all([one.next('matchFound'), two.next('matchFound')]);

    let sawPlayingPhaseChange = false;
    for (let i = 0; i < 200 && !sawPlayingPhaseChange; i += 1) {
      const event = await one.next('event', 4000);
      sawPlayingPhaseChange = event.events.some(
        (e) => e.kind === 'phaseChange' && e.phase === 'playing',
      );
    }
    expect(sawPlayingPhaseChange).toBe(true);
  }, 10_000);
});
