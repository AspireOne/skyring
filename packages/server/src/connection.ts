import { randomUUID } from 'node:crypto';

import { encode, parseClientMessage } from '@skyring/shared';

import type { ClientMessage, ServerMessage } from '@skyring/shared';
import type { RawData, WebSocket } from 'ws';

/**
 * Per-socket transport wrapper (ARCHITECTURE §5). Owns nothing about game
 * logic: it assigns a stable id, parses/validates inbound frames at the
 * boundary, and exposes typed send/close helpers. Malformed frames are dropped
 * silently (ARCHITECTURE §4).
 */
export class Connection {
  readonly id = randomUUID();
  /** Protocol version from `hello`; `null` until a valid handshake. */
  version: number | null = null;

  private messageHandler: ((message: ClientMessage) => void) | undefined;
  private closeHandler: (() => void) | undefined;
  private closed = false;

  constructor(private readonly socket: WebSocket) {
    socket.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        return;
      }
      const message = parseClientMessage(data.toString());
      if (message !== undefined) {
        this.messageHandler?.(message);
      }
    });

    socket.on('close', () => {
      this.closed = true;
      this.closeHandler?.();
    });

    // A socket error is followed by `close`; swallow it so it does not crash
    // the process, and let the close handler run teardown.
    socket.on('error', () => {});
  }

  onMessage(handler: (message: ClientMessage) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  send(message: ServerMessage): void {
    if (this.closed || this.socket.readyState !== this.socket.OPEN) {
      return;
    }
    this.socket.send(encode(message));
  }

  close(code?: number, reason?: string): void {
    if (this.closed) {
      return;
    }
    this.socket.close(code, reason);
  }
}
