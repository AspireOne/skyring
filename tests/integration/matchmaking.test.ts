import { PROTOCOL_VERSION } from '@skyring/shared';
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

async function connect(): Promise<TestClient> {
  const client = await TestClient.connect(address.wsUrl);
  clients.push(client);
  return client;
}

beforeEach(async () => {
  server = createSkyRingServer({ nextSeed: () => 42 });
  address = await server.start();
});

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()));
  clients.length = 0;
  await server.stop();
});

describe('handshake and clock sync', () => {
  it('welcomes a valid handshake with an id and server time', async () => {
    const client = await connect();
    const welcome = await client.handshake();
    expect(welcome.version).toBe(PROTOCOL_VERSION);
    expect(typeof welcome.yourConnId).toBe('string');
    expect(Number.isFinite(welcome.serverTime)).toBe(true);
  });

  it('rejects and closes a mismatched protocol version', async () => {
    const client = await connect();
    client.send({ t: 'hello', version: PROTOCOL_VERSION + 999 });
    const rejected = await client.next('rejected');
    expect(rejected.reason).toContain('Unsupported protocol version');
    await client.next('rejected').catch(() => undefined);
    // The server closes the socket after rejecting.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(client.closed).toBe(true);
  });

  it('answers ping with a pong echoing client time and adding server time', async () => {
    const client = await connect();
    await client.handshake();
    client.send({ t: 'ping', clientTime: 123.5 });
    const pong = await client.next('pong');
    expect(pong.clientTime).toBe(123.5);
    expect(Number.isFinite(pong.serverTime)).toBe(true);
  });
});

describe('quick-queue matchmaking', () => {
  it('pairs two quick-queue clients into opposite slots with the config', async () => {
    const one = await connect();
    const two = await connect();
    await one.handshake();
    await two.handshake();

    one.send({ t: 'queue', mode: 'quick' });
    expect((await one.next('queued')).mode).toBe('quick');
    two.send({ t: 'queue', mode: 'quick' });

    const [foundOne, foundTwo] = await Promise.all([
      one.next('matchFound'),
      two.next('matchFound'),
    ]);
    expect(new Set([foundOne.yourSlot, foundTwo.yourSlot])).toEqual(
      new Set(['a', 'b']),
    );
    expect(foundOne.matchId).toBe(foundTwo.matchId);
    expect(foundOne.constants.SIM_HZ).toBe(60);
    expect(server.stats().activeMatches).toBe(1);
  });

  it('streams authoritative snapshots to both clients after pairing', async () => {
    const one = await connect();
    const two = await connect();
    await one.handshake();
    await two.handshake();
    one.send({ t: 'queue', mode: 'quick' });
    two.send({ t: 'queue', mode: 'quick' });
    await Promise.all([one.next('matchFound'), two.next('matchFound')]);

    const [snapOne, snapTwo] = await Promise.all([
      one.next('snapshot'),
      two.next('snapshot'),
    ]);
    expect(snapOne.state.planes.a.pos).toHaveLength(3);
    expect(snapTwo.state.phase).toBe('countdown');
    expect(snapOne.tick).toBeGreaterThanOrEqual(0);
  });
});

describe('room-code matchmaking', () => {
  it('pairs same-room clients and isolates other rooms', async () => {
    const one = await connect();
    const two = await connect();
    const other = await connect();
    await Promise.all([one.handshake(), two.handshake(), other.handshake()]);

    one.send({ t: 'queue', mode: 'room', room: 'alpha' });
    other.send({ t: 'queue', mode: 'room', room: 'beta' });
    await Promise.all([one.next('queued'), other.next('queued')]);

    two.send({ t: 'queue', mode: 'room', room: 'alpha' });
    await Promise.all([one.next('matchFound'), two.next('matchFound')]);

    expect(server.stats().activeMatches).toBe(1);
    // The beta-room client is still waiting, never matched.
    expect(server.stats().waiting).toBe(1);
  });
});

describe('disconnection and teardown', () => {
  it('awards the survivor and releases the match when a peer disconnects', async () => {
    const one = await connect();
    const two = await connect();
    await one.handshake();
    await two.handshake();
    one.send({ t: 'queue', mode: 'quick' });
    two.send({ t: 'queue', mode: 'quick' });
    await Promise.all([one.next('matchFound'), two.next('matchFound')]);

    await one.close();
    // Countdown phase disconnect is a no-contest for the survivor.
    const ended = await two.next('matchEnd');
    expect(ended.reason).toBe('opponentLeft');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.stats().activeMatches).toBe(0);
  });

  it('reports zero connections and matches after full teardown', async () => {
    const one = await connect();
    await one.handshake();
    await one.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.stats().connections).toBe(0);
  });
});
