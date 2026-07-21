import { randomUUID } from 'node:crypto';

import {
  type GameConfig,
  type InputCommand,
  type MatchState,
} from '@skyring/shared';

import { Match } from './match.js';

import type { Connection } from './connection.js';
import type { MatchContext } from './match.js';
import type { Now } from './scheduler.js';

export interface MatchmakerDeps {
  readonly now: Now;
  /** Fresh seed per match; injectable so tests get reproducible simulations. */
  readonly nextSeed: () => number;
  /**
   * Test-only prescribed initial state (TESTING §9, D011). Absent in
   * production, where matches always start from `createInitialMatchState`.
   */
  readonly createInitialState?: (
    config: GameConfig,
    context: MatchContext,
  ) => MatchState;
}

/**
 * Contained 1v1 pairing (IMPLEMENTATION §7.2): a single quick-queue slot plus
 * room-code rendezvous. Owns the set of live matches and routes per-connection
 * traffic to the right one. No shared mutable state leaks between matches.
 */
export class Matchmaker {
  private quickWaiting: Connection | undefined;
  private readonly roomWaiting = new Map<string, Connection>();
  private readonly matches = new Set<Match>();
  private readonly connectionMatch = new Map<Connection, Match>();

  constructor(
    private readonly config: GameConfig,
    private readonly deps: MatchmakerDeps,
  ) {}

  enqueueQuick(connection: Connection): void {
    if (this.isBusy(connection)) {
      return;
    }
    if (this.quickWaiting === undefined) {
      this.quickWaiting = connection;
      connection.send({ t: 'queued', mode: 'quick' });
      return;
    }
    if (this.quickWaiting === connection) {
      return;
    }
    const opponent = this.quickWaiting;
    this.quickWaiting = undefined;
    this.pair(opponent, connection, {});
  }

  enqueueRoom(connection: Connection, room: string): void {
    if (this.isBusy(connection)) {
      return;
    }
    const waiting = this.roomWaiting.get(room);
    if (waiting === undefined) {
      this.roomWaiting.set(room, connection);
      connection.send({ t: 'queued', mode: 'room', room });
      return;
    }
    if (waiting === connection) {
      return;
    }
    this.roomWaiting.delete(room);
    this.pair(waiting, connection, { room });
  }

  routeInput(connection: Connection, input: InputCommand): void {
    this.connectionMatch.get(connection)?.receiveInput(connection, input);
  }

  /** Voluntary leave or socket close: identical handling in v1. */
  handleDisconnect(connection: Connection): void {
    this.dequeue(connection);
    this.connectionMatch.get(connection)?.handleDisconnect(connection);
  }

  /** Stop every live match without notifying clients (server shutdown). */
  stop(): void {
    for (const match of this.matches) {
      match.stop();
    }
    this.matches.clear();
    this.connectionMatch.clear();
    this.roomWaiting.clear();
    this.quickWaiting = undefined;
  }

  get activeMatchCount(): number {
    return this.matches.size;
  }

  get waitingCount(): number {
    return (this.quickWaiting ? 1 : 0) + this.roomWaiting.size;
  }

  private isBusy(connection: Connection): boolean {
    return this.connectionMatch.has(connection) || this.isWaiting(connection);
  }

  private isWaiting(connection: Connection): boolean {
    if (this.quickWaiting === connection) {
      return true;
    }
    for (const waiting of this.roomWaiting.values()) {
      if (waiting === connection) {
        return true;
      }
    }
    return false;
  }

  private dequeue(connection: Connection): void {
    if (this.quickWaiting === connection) {
      this.quickWaiting = undefined;
    }
    for (const [room, waiting] of this.roomWaiting) {
      if (waiting === connection) {
        this.roomWaiting.delete(room);
      }
    }
  }

  private pair(a: Connection, b: Connection, context: MatchContext): void {
    const match = new Match(
      randomUUID(),
      this.config,
      this.deps.nextSeed(),
      a,
      b,
      context,
      {
        now: this.deps.now,
        onEnded: (ended) => this.removeMatch(ended),
        ...(this.deps.createInitialState
          ? { createInitialState: this.deps.createInitialState }
          : {}),
      },
    );
    this.matches.add(match);
    this.connectionMatch.set(a, match);
    this.connectionMatch.set(b, match);
    match.start();
  }

  private removeMatch(match: Match): void {
    this.matches.delete(match);
    for (const [connection, owner] of this.connectionMatch) {
      if (owner === match) {
        this.connectionMatch.delete(connection);
      }
    }
  }
}
