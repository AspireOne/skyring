import {
  createServer as createHttpServer,
  type ServerResponse,
} from 'node:http';

import { DEFAULT_GAME_CONFIG } from '@skyring/shared';
import { WebSocketServer } from 'ws';

import type { AddressInfo } from 'node:net';

export interface ServerAddress {
  readonly host: string;
  readonly port: number;
  readonly httpUrl: string;
  readonly wsUrl: string;
}

export interface SkyRingServer {
  readonly start: (port?: number, host?: string) => Promise<ServerAddress>;
  readonly stop: () => Promise<void>;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

export function createSkyRingServer(): SkyRingServer {
  const httpServer = createHttpServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'skyring-server',
        simHz: DEFAULT_GAME_CONFIG.SIM_HZ,
      });
      return;
    }

    sendJson(response, 404, { error: 'not_found' });
  });
  const webSocketServer = new WebSocketServer({ server: httpServer });
  let started = false;

  const start = async (
    port = 0,
    host = '127.0.0.1',
  ): Promise<ServerAddress> => {
    if (started) {
      throw new Error('SkyRing server has already started.');
    }

    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error): void => {
        httpServer.off('listening', handleListening);
        reject(error);
      };
      const handleListening = (): void => {
        httpServer.off('error', handleError);
        resolve();
      };

      httpServer.once('error', handleError);
      httpServer.once('listening', handleListening);
      httpServer.listen(port, host);
    });

    started = true;
    const address = httpServer.address() as AddressInfo;

    return Object.freeze({
      host,
      port: address.port,
      httpUrl: `http://${host}:${address.port}`,
      wsUrl: `ws://${host}:${address.port}`,
    });
  };

  const stop = async (): Promise<void> => {
    if (!started) {
      return;
    }

    for (const client of webSocketServer.clients) {
      client.terminate();
    }

    await new Promise<void>((resolve, reject) => {
      webSocketServer.close((webSocketError) => {
        if (webSocketError) {
          reject(webSocketError);
          return;
        }

        httpServer.close((httpError) => {
          if (httpError) {
            reject(httpError);
            return;
          }

          resolve();
        });
      });
    });

    started = false;
  };

  return Object.freeze({ start, stop });
}
