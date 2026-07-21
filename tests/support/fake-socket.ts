import { EventEmitter } from 'node:events';

import {
  encode,
  parseServerMessage,
  type ServerMessage,
} from '@skyring/shared';

import { Connection } from '../../packages/server/src/connection.js';

import type { ClientMessage } from '@skyring/shared';
import type { WebSocket } from 'ws';

/**
 * Minimal in-memory stand-in for a `ws` socket, structurally compatible with
 * the fields {@link Connection} touches. Lets server logic (matchmaker, match,
 * cadence) be unit-tested without opening real sockets.
 */
class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readonly CLOSED = 3;
  readyState = 1;
  readonly outbound: ServerMessage[] = [];

  send(data: string): void {
    const message = parseServerMessage(data);
    if (message !== undefined) {
      this.outbound.push(message);
    }
  }

  close(): void {
    if (this.readyState === this.CLOSED) {
      return;
    }
    this.readyState = this.CLOSED;
    this.emit('close');
  }

  /** Simulate the client sending a frame to the server. */
  receive(message: ClientMessage): void {
    this.emit('message', Buffer.from(encode(message)), false);
  }
}

export interface FakeLink {
  readonly socket: FakeSocket;
  readonly connection: Connection;
}

export function makeFakeLink(): FakeLink {
  const socket = new FakeSocket();
  const connection = new Connection(socket as unknown as WebSocket);
  return { socket, connection };
}
