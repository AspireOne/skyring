import { encode, parseServerMessage, PROTOCOL_VERSION } from '@skyring/shared';
import WebSocket from 'ws';

import type { ClientMessage, ServerMessage } from '@skyring/shared';

type Tag = ServerMessage['t'];
type ByTag<T extends Tag> = Extract<ServerMessage, { t: T }>;

/**
 * Promise-driven WebSocket client for integration tests. Buffers inbound
 * server messages and lets a test await the next message of a given tag, so
 * scenarios read as a linear script instead of nested callbacks.
 */
export class TestClient {
  private readonly buffer: ServerMessage[] = [];
  private readonly waiters: {
    tag: Tag;
    resolve: (message: ServerMessage) => void;
  }[] = [];

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', (data: WebSocket.RawData) => {
      const message = parseServerMessage(data.toString());
      if (message === undefined) {
        return;
      }
      const waiterIndex = this.waiters.findIndex((w) => w.tag === message.t);
      if (waiterIndex >= 0) {
        const [waiter] = this.waiters.splice(waiterIndex, 1);
        waiter?.resolve(message);
      } else {
        this.buffer.push(message);
      }
    });
  }

  static async connect(wsUrl: string): Promise<TestClient> {
    const socket = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return new TestClient(socket);
  }

  send(message: ClientMessage): void {
    this.socket.send(encode(message));
  }

  /** Complete the standard handshake and resolve with the welcome. */
  async handshake(): Promise<ByTag<'welcome'>> {
    this.send({ t: 'hello', version: PROTOCOL_VERSION });
    return this.next('welcome');
  }

  next<T extends Tag>(tag: T, timeoutMs = 2000): Promise<ByTag<T>> {
    const buffered = this.buffer.findIndex((message) => message.t === tag);
    if (buffered >= 0) {
      const [message] = this.buffer.splice(buffered, 1);
      return Promise.resolve(message as ByTag<T>);
    }
    return new Promise<ByTag<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for "${tag}"`));
      }, timeoutMs);
      this.waiters.push({
        tag,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message as ByTag<T>);
        },
      });
    });
  }

  get closed(): boolean {
    return this.socket.readyState === WebSocket.CLOSED;
  }

  async close(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.socket.once('close', () => resolve());
      this.socket.close();
    });
  }
}
