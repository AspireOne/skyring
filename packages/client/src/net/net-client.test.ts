import {
  createInitialMatchState,
  DEFAULT_GAME_CONFIG,
  encode,
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
} from '@skyring/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { NetClient, type SocketLike } from './net-client.js';

class FakeClientSocket implements SocketLike {
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly sent: ClientMessage[] = [];
  closed = false;

  send(data: string): void {
    const message = parseClientMessage(data);
    if (message) {
      this.sent.push(message);
    }
  }

  close(): void {
    this.closed = true;
    this.onclose?.(undefined);
  }

  open(): void {
    this.onopen?.(undefined);
  }

  emit(message: ServerMessage): void {
    this.onmessage?.({ data: encode(message) });
  }

  sentOf<T extends ClientMessage['t']>(
    tag: T,
  ): Extract<ClientMessage, { t: T }>[] {
    return this.sent.filter(
      (message): message is Extract<ClientMessage, { t: T }> =>
        message.t === tag,
    );
  }
}

class FakeTimers {
  private nextId = 1;
  private readonly handlers = new Map<number, () => void>();

  readonly setTimer = (handler: () => void): number => {
    const id = this.nextId++;
    this.handlers.set(id, handler);
    return id;
  };

  readonly clearTimer = (id: number): void => {
    this.handlers.delete(id);
  };

  flush(): void {
    for (const [id, handler] of [...this.handlers]) {
      this.handlers.delete(id);
      handler();
    }
  }

  get pending(): number {
    return this.handlers.size;
  }
}

let socket: FakeClientSocket;
let timers: FakeTimers;
let clock: number;
let updates: number;

function makeClient(queueRoom?: string): NetClient {
  clock = 0;
  updates = 0;
  const client = new NetClient(
    'ws://test',
    queueRoom ? { mode: 'room', room: queueRoom } : { mode: 'quick' },
    {
      createSocket: () => socket,
      now: () => clock,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    },
  );
  client.onUpdate = () => (updates += 1);
  return client;
}

beforeEach(() => {
  socket = new FakeClientSocket();
  timers = new FakeTimers();
});

describe('NetClient handshake and queueing', () => {
  it('sends hello on open and queues after welcome', () => {
    const client = makeClient();
    client.connect();
    socket.open();
    expect(socket.sentOf('hello')[0]).toMatchObject({ version: 1 });

    socket.emit({ t: 'welcome', yourConnId: 'c1', serverTime: 5, version: 1 });
    expect(client.phase).toBe('connected');
    expect(socket.sentOf('queue')[0]).toMatchObject({ mode: 'quick' });
    expect(socket.sentOf('ping')).toHaveLength(1);
  });

  it('queues a room code when configured for a room', () => {
    const client = makeClient('ALPHA');
    client.connect();
    socket.open();
    socket.emit({ t: 'welcome', yourConnId: 'c1', serverTime: 5, version: 1 });
    expect(socket.sentOf('queue')[0]).toMatchObject({
      mode: 'room',
      room: 'ALPHA',
    });
  });

  it('captures slot, constants, and snapshots through the match flow', () => {
    const client = makeClient();
    client.connect();
    socket.open();
    socket.emit({ t: 'welcome', yourConnId: 'c1', serverTime: 5, version: 1 });

    socket.emit({ t: 'queued', mode: 'quick' });
    expect(client.phase).toBe('queued');

    socket.emit({
      t: 'matchFound',
      matchId: 'm1',
      yourSlot: 'b',
      constants: DEFAULT_GAME_CONFIG,
    });
    expect(client.phase).toBe('matched');
    expect(client.slot).toBe('b');
    expect(client.constants?.SIM_HZ).toBe(60);

    socket.emit({
      t: 'snapshot',
      tick: 4,
      serverTime: 10,
      ackSeq: -1,
      state: createInitialMatchState(DEFAULT_GAME_CONFIG),
    });
    expect(client.latestSnapshot?.tick).toBe(4);
    expect(updates).toBeGreaterThan(0);
  });
});

describe('NetClient input and render view', () => {
  it('sends input with a monotonically increasing sequence', () => {
    const client = makeClient();
    client.connect();
    socket.open();
    socket.emit({ t: 'welcome', yourConnId: 'c1', serverTime: 0, version: 1 });

    client.sendInput({ throttle: 1, pitch: 0, roll: 0, yaw: 0, fire: false });
    client.sendInput({ throttle: 0, pitch: 1, roll: 0, yaw: 0, fire: true });
    const inputs = socket.sentOf('input');
    expect(inputs.map((message) => message.input.seq)).toEqual([1, 2]);
    expect(inputs[1]?.input.fire).toBe(true);
  });

  it('exposes an interpolated render view once snapshots arrive', () => {
    const client = makeClient();
    client.connect();
    socket.open();
    socket.emit({ t: 'welcome', yourConnId: 'c1', serverTime: 0, version: 1 });
    socket.emit({
      t: 'matchFound',
      matchId: 'm1',
      yourSlot: 'a',
      constants: DEFAULT_GAME_CONFIG,
    });
    const state = createInitialMatchState(DEFAULT_GAME_CONFIG);
    clock = 0;
    socket.emit({ t: 'snapshot', tick: 1, serverTime: 0, ackSeq: -1, state });
    clock = 1000;
    expect(client.renderView()).toBeDefined();
  });
});

describe('NetClient clock sync', () => {
  it('folds pong round trips into the clock and continues the initial burst', () => {
    const client = makeClient();
    client.connect();
    socket.open();
    socket.emit({ t: 'welcome', yourConnId: 'c1', serverTime: 0, version: 1 });

    // The first ping was sent at now=0; answer it after 20ms of round trip.
    const ping = socket.sentOf('ping')[0];
    expect(ping).toBeDefined();
    clock = 20;
    socket.emit({
      t: 'pong',
      clientTime: ping?.clientTime ?? 0,
      serverTime: 1010,
    });

    expect(client.clock.hasSync).toBe(true);
    expect(client.clock.estimateServerTime(0)).toBe(1000);
    // A burst follow-up ping is scheduled since we are below the burst count.
    expect(timers.pending).toBeGreaterThan(0);
    timers.flush();
    expect(socket.sentOf('ping').length).toBeGreaterThan(1);
  });
});

describe('NetClient lifecycle', () => {
  it('marks ended on matchEnd and keeps it through a later close', () => {
    const client = makeClient();
    const ends: unknown[] = [];
    client.onMatchEnd = (message) => ends.push(message);
    client.connect();
    socket.open();
    socket.emit({ t: 'welcome', yourConnId: 'c1', serverTime: 0, version: 1 });
    socket.emit({
      t: 'matchEnd',
      result: 'win',
      reason: 'opponentLeft',
      scores: { a: 0, b: 0 },
    });
    expect(client.phase).toBe('ended');
    expect(ends).toHaveLength(1);
    socket.close();
    expect(client.phase).toBe('ended');
    client.dispose();
  });

  it('marks rejected and disposes cleanly', () => {
    const client = makeClient();
    client.connect();
    socket.open();
    socket.emit({ t: 'rejected', reason: 'bad version' });
    expect(client.phase).toBe('rejected');
    client.dispose();
    expect(socket.closed).toBe(true);
    expect(timers.pending).toBe(0);
  });
});
