import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import {
  createSkyRingServer,
  type ServerAddress,
  type SkyRingServer,
} from '../../packages/server/src/server.js';

let server: SkyRingServer | undefined;

async function startServer(): Promise<ServerAddress> {
  server = createSkyRingServer();
  return server.start();
}

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

describe('server foundation', () => {
  it('serves a health response from an ephemeral port', async () => {
    const started = await startServer();
    const response = await fetch(`${started.httpUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'skyring-server',
      simHz: 60,
    });
  });

  it('returns structured not-found responses', async () => {
    const started = await startServer();
    const response = await fetch(`${started.httpUrl}/missing`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('rejects duplicate starts and tolerates stopping an idle server', async () => {
    const idleServer = createSkyRingServer();
    await expect(idleServer.stop()).resolves.toBeUndefined();

    const started = await startServer();
    await expect(server?.start(started.port)).rejects.toThrow(
      'SkyRing server has already started.',
    );
  });

  it('accepts a real WebSocket connection and releases it during shutdown', async () => {
    const started = await startServer();
    const client = new WebSocket(started.wsUrl);

    await new Promise<void>((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });

    expect(client.readyState).toBe(WebSocket.OPEN);
    await server?.stop();
    server = undefined;

    await new Promise<void>((resolve) => {
      if (client.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      client.once('close', resolve);
    });
    expect(client.readyState).toBe(WebSocket.CLOSED);
  });
});
