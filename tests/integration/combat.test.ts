import {
  createGameConfig,
  createInitialMatchState,
  MATCH_PHASE,
  type GameConfig,
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
let config: GameConfig;
const clients: TestClient[] = [];

beforeEach(async () => {
  config = createGameConfig({ MATCH_DURATION: 10 });
  server = createSkyRingServer({
    config,
    nextSeed: () => 99,
    createInitialState: (effective) => {
      const state = createInitialMatchState(effective);
      state.phase = MATCH_PHASE.Playing;
      state.phaseTicksRemaining = effective.MATCH_DURATION * effective.SIM_HZ;
      state.planes.a.pos = [-50, effective.SPAWN_ALTITUDE, 0];
      state.planes.b.pos = [50, effective.SPAWN_ALTITUDE, 0];
      state.ring.center = [0, effective.SPAWN_ALTITUDE + 300, 0];
      state.ring.teleportTicksRemaining = 100_000;
      return state;
    },
  });
  address = await server.start();
});

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()));
  clients.length = 0;
  await server.stop();
});

describe('authoritative combat over real WebSockets', () => {
  it('GAME-5-MUTUAL-HIT: both fire intents produce ammo use, hits, impulses, stumble, and ack', async () => {
    const [a, b] = await pairBySlot();
    a.send({ t: 'input', input: command(1, true) });
    b.send({ t: 'input', input: command(1, true) });

    const victims = new Set<string>();
    for (
      let messageCount = 0;
      messageCount < 30 && victims.size < 2;
      messageCount += 1
    ) {
      const message = await a.next('event', 4000);
      for (const event of message.events) {
        if (event.kind === 'hit') victims.add(event.victim);
      }
    }
    expect(victims).toEqual(new Set(['a', 'b']));

    let snapshot = await a.next('snapshot', 4000);
    while (
      (snapshot.ackSeq < 1 ||
        snapshot.state.planes.a.stumbleTicksRemaining === 0 ||
        snapshot.state.planes.b.stumbleTicksRemaining === 0) &&
      snapshot.tick < 300
    ) {
      snapshot = await a.next('snapshot', 4000);
    }
    expect(snapshot.ackSeq).toBeGreaterThanOrEqual(1);
    expect(snapshot.state.planes.a.ammo).toBeLessThan(config.AMMO_MAX);
    expect(snapshot.state.planes.a.stumbleTicksRemaining).toBeGreaterThan(0);
    expect(snapshot.state.planes.b.stumbleTicksRemaining).toBeGreaterThan(0);
    expect(Math.hypot(...snapshot.state.planes.a.vel)).toBeGreaterThan(0);

    a.send({ t: 'input', input: command(2, false) });
    b.send({ t: 'input', input: command(2, false) });
  }, 12_000);
});

async function pairBySlot(): Promise<[TestClient, TestClient]> {
  const one = await TestClient.connect(address.wsUrl);
  const two = await TestClient.connect(address.wsUrl);
  clients.push(one, two);
  await Promise.all([one.handshake(), two.handshake()]);
  one.send({ t: 'queue', mode: 'room', room: 'COMBAT' });
  two.send({ t: 'queue', mode: 'room', room: 'COMBAT' });
  const [foundOne] = await Promise.all([
    one.next('matchFound'),
    two.next('matchFound'),
  ]);
  return foundOne.yourSlot === 'a' ? [one, two] : [two, one];
}

function command(seq: number, fire: boolean) {
  return {
    seq,
    tick: 0,
    throttle: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    fire,
  };
}
