import {
  createServer as createHttpServer,
  type ServerResponse,
} from 'node:http';

import {
  DEFAULT_GAME_CONFIG,
  PROTOCOL_VERSION,
  type ClientMessage,
  type GameConfig,
  type MatchState,
} from '@skyring/shared';
import { WebSocketServer } from 'ws';

import { Connection } from './connection.js';
import { Matchmaker } from './matchmaker.js';

import type { MatchContext } from './match.js';
import type { Now } from './scheduler.js';
import type { AddressInfo } from 'node:net';

/** Reject frames larger than this many bytes (inputs/handshakes are tiny). */
const MAX_PAYLOAD_BYTES = 16 * 1024;

export interface ServerAddress {
  readonly host: string;
  readonly port: number;
  readonly httpUrl: string;
  readonly wsUrl: string;
}

interface ServerStats {
  readonly connections: number;
  readonly activeMatches: number;
  readonly waiting: number;
}

export interface SkyRingServerOptions {
  /** Effective match config; production uses {@link DEFAULT_GAME_CONFIG}. */
  readonly config?: GameConfig;
  /** Injectable clock for deterministic tests (TESTING §2). */
  readonly now?: Now;
  /** Injectable per-match seed source for reproducible simulations. */
  readonly nextSeed?: () => number;
  /**
   * Test-only prescribed initial match state (TESTING §9, D011). Never set in
   * production; clients receive no state-mutation backdoor.
   */
  readonly createInitialState?: (
    config: GameConfig,
    context: MatchContext,
  ) => MatchState;
}

export interface SkyRingServer {
  readonly start: (port?: number, host?: string) => Promise<ServerAddress>;
  readonly stop: () => Promise<void>;
  readonly stats: () => ServerStats;
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

function handleHello(connection: Connection, version: number, now: Now): void {
  if (version !== PROTOCOL_VERSION) {
    connection.send({
      t: 'rejected',
      reason: `Unsupported protocol version ${version}; server speaks ${PROTOCOL_VERSION}.`,
    });
    connection.close(1002, 'protocol version');
    return;
  }
  connection.version = version;
  connection.send({
    t: 'welcome',
    yourConnId: connection.id,
    serverTime: now(),
    version: PROTOCOL_VERSION,
  });
}

function routeClientMessage(
  connection: Connection,
  message: ClientMessage,
  matchmaker: Matchmaker,
  now: Now,
): void {
  if (message.t === 'hello') {
    handleHello(connection, message.version, now);
    return;
  }
  if (connection.version === null) {
    return; // must complete the handshake before anything else
  }

  switch (message.t) {
    case 'ping':
      connection.send({
        t: 'pong',
        clientTime: message.clientTime,
        serverTime: now(),
      });
      break;
    case 'queue':
      if (message.mode === 'room' && message.room !== undefined) {
        matchmaker.enqueueRoom(connection, message.room);
      } else {
        matchmaker.enqueueQuick(connection);
      }
      break;
    case 'input':
      matchmaker.routeInput(connection, message.input);
      break;
    case 'leave':
      matchmaker.handleDisconnect(connection);
      break;
  }
}

export function createSkyRingServer(
  options: SkyRingServerOptions = {},
): SkyRingServer {
  const config = options.config ?? DEFAULT_GAME_CONFIG;
  const now = options.now ?? (() => performance.now());
  const nextSeed =
    options.nextSeed ?? (() => Math.floor(Math.random() * 0x7f_ff_ff_ff));

  const matchmaker = new Matchmaker(config, {
    now,
    nextSeed,
    ...(options.createInitialState
      ? { createInitialState: options.createInitialState }
      : {}),
  });
  const connections = new Set<Connection>();

  const httpServer = createHttpServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'skyring-server',
        simHz: config.SIM_HZ,
      });
      return;
    }
    sendJson(response, 404, { error: 'not_found' });
  });

  const webSocketServer = new WebSocketServer({
    server: httpServer,
    maxPayload: MAX_PAYLOAD_BYTES,
  });

  webSocketServer.on('connection', (socket) => {
    const connection = new Connection(socket);
    connections.add(connection);
    connection.onMessage((message) =>
      routeClientMessage(connection, message, matchmaker, now),
    );
    connection.onClose(() => {
      connections.delete(connection);
      matchmaker.handleDisconnect(connection);
    });
  });

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

    matchmaker.stop();
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

  const stats = (): ServerStats => ({
    connections: connections.size,
    activeMatches: matchmaker.activeMatchCount,
    waiting: matchmaker.waitingCount,
  });

  return Object.freeze({ start, stop, stats });
}
