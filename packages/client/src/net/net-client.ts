import {
  encode,
  parseServerMessage,
  PROTOCOL_VERSION,
  type EventMessage,
  type GameConfig,
  type MatchEndMessage,
  type PlayerSlot,
  type SnapshotMessage,
} from '@skyring/shared';

import { ClockSync } from './clock-sync.js';

// Client-local clock-sync cadence (IMPLEMENTATION §4.5). These are purely local
// timing knobs — they never cross the wire or affect authority — so they live
// here rather than in the shared match config.
const INITIAL_PING_BURST = 5;
const BURST_GAP_MS = 150;
const PING_INTERVAL_MS = 5000;

interface MessageLike {
  data: unknown;
}

/** Structural subset of the browser `WebSocket` this client depends on. */
export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((this: unknown, event: unknown) => void) | null;
  onmessage: ((this: unknown, event: MessageLike) => void) | null;
  onclose: ((this: unknown, event: unknown) => void) | null;
  onerror: ((this: unknown, event: unknown) => void) | null;
}

export type NetPhase =
  | 'connecting'
  | 'connected'
  | 'queued'
  | 'matched'
  | 'ended'
  | 'rejected'
  | 'closed';

export type QueueRequest =
  { readonly mode: 'quick' } | { readonly mode: 'room'; readonly room: string };

export interface NetClientDeps {
  readonly createSocket?: (url: string) => SocketLike;
  readonly now?: () => number;
  readonly setTimer?: (handler: () => void, ms: number) => number;
  readonly clearTimer?: (id: number) => void;
}

/**
 * The single seam to the wire on the client (IMPLEMENTATION §8.2). Owns the
 * WebSocket lifecycle, handshake, queueing, clock sync, and captures the latest
 * authoritative snapshot. Rendering/HUD read from it; it owns zero game logic.
 *
 * Injectable socket/timer/clock deps keep it testable without a real browser.
 */
export class NetClient {
  phase: NetPhase = 'connecting';
  slot: PlayerSlot | undefined;
  constants: GameConfig | undefined;
  latestSnapshot: SnapshotMessage | undefined;
  readonly clock = new ClockSync();

  onUpdate: (() => void) | undefined;
  onEvent: ((message: EventMessage) => void) | undefined;
  onMatchEnd: ((message: MatchEndMessage) => void) | undefined;

  private socket: SocketLike | undefined;
  private readonly timers = new Set<number>();
  private readonly now: () => number;
  private readonly createSocket: (url: string) => SocketLike;
  private readonly setTimer: (handler: () => void, ms: number) => number;
  private readonly clearTimer: (id: number) => void;
  private disposed = false;

  constructor(
    private readonly url: string,
    private readonly queue: QueueRequest,
    deps: NetClientDeps = {},
  ) {
    this.createSocket =
      deps.createSocket ??
      ((url) => new WebSocket(url) as unknown as SocketLike);
    this.now = deps.now ?? (() => performance.now());
    this.setTimer =
      deps.setTimer ??
      ((handler, ms) => setTimeout(handler, ms) as unknown as number);
    this.clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id));
  }

  connect(): void {
    const socket = this.createSocket(this.url);
    this.socket = socket;
    socket.onopen = () => this.send({ t: 'hello', version: PROTOCOL_VERSION });
    socket.onmessage = (event) => this.handleFrame(event.data);
    socket.onclose = () => this.handleClose();
    socket.onerror = () => this.handleClose();
  }

  dispose(): void {
    this.disposed = true;
    for (const id of this.timers) {
      this.clearTimer(id);
    }
    this.timers.clear();
    this.socket?.close();
    this.socket = undefined;
  }

  private send(message: Parameters<typeof encode>[0]): void {
    this.socket?.send(encode(message));
  }

  private handleFrame(data: unknown): void {
    if (typeof data !== 'string') {
      return;
    }
    const message = parseServerMessage(data);
    if (message === undefined) {
      return;
    }

    switch (message.t) {
      case 'welcome':
        this.phase = 'connected';
        this.startClockSync();
        this.send(
          this.queue.mode === 'room'
            ? { t: 'queue', mode: 'room', room: this.queue.room }
            : { t: 'queue', mode: 'quick' },
        );
        break;
      case 'pong':
        this.clock.addSample(
          message.clientTime,
          message.serverTime,
          this.now(),
        );
        if (this.clock.samples < INITIAL_PING_BURST) {
          this.scheduleTimer(() => this.sendPing(), BURST_GAP_MS);
        }
        break;
      case 'queued':
        this.phase = 'queued';
        break;
      case 'matchFound':
        this.phase = 'matched';
        this.slot = message.yourSlot;
        this.constants = message.constants;
        break;
      case 'snapshot':
        this.latestSnapshot = message;
        break;
      case 'event':
        this.onEvent?.(message);
        break;
      case 'matchEnd':
        this.phase = 'ended';
        this.onMatchEnd?.(message);
        break;
      case 'rejected':
        this.phase = 'rejected';
        break;
    }

    this.onUpdate?.();
  }

  private handleClose(): void {
    if (this.phase !== 'ended' && this.phase !== 'rejected') {
      this.phase = 'closed';
    }
    this.onUpdate?.();
  }

  private startClockSync(): void {
    this.sendPing();
    this.scheduleInterval();
  }

  private scheduleInterval(): void {
    if (this.disposed) {
      return;
    }
    this.scheduleTimer(() => {
      this.sendPing();
      this.scheduleInterval();
    }, PING_INTERVAL_MS);
  }

  private scheduleTimer(handler: () => void, ms: number): void {
    if (this.disposed) {
      return;
    }
    const id = this.setTimer(() => {
      this.timers.delete(id);
      handler();
    }, ms);
    this.timers.add(id);
  }

  private sendPing(): void {
    this.send({ t: 'ping', clientTime: this.now() });
  }
}
