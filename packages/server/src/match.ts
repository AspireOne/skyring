import {
  clampInputCommand,
  createInitialMatchState,
  createRng,
  MATCH_PHASE,
  NEUTRAL_INPUT,
  stepMatch,
  type GameConfig,
  type InputCommand,
  type MatchInputs,
  type MatchResult,
  type MatchState,
  type PlayerScores,
  type PlayerSlot,
  type Rng,
} from '@skyring/shared';

import { type Now, TickScheduler } from './scheduler.js';

import type { Connection } from './connection.js';
import type { GameEvent, MatchEndReason } from '@skyring/shared';

export interface MatchDeps {
  readonly now: Now;
  /** Called once the match has fully ended so the owner can drop references. */
  readonly onEnded: (match: Match) => void;
  /** Test-only prescribed initial state (TESTING §9, D011). */
  readonly createInitialState?: (config: GameConfig) => MatchState;
}

interface PlayerRuntime {
  readonly slot: PlayerSlot;
  readonly connection: Connection;
  /** Most recent valid input, reused when a tick has no fresh command. */
  lastInput: InputCommand | undefined;
  lastReceivedSeq: number;
  lastProcessedSeq: number;
}

/**
 * A single self-contained 1v1 match: two connections, one authoritative
 * {@link MatchState}, and a fixed-tick loop (IMPLEMENTATION §7.3). Progression
 * (`step`) is separated from scheduling so tests can run a whole match with
 * controlled time (TESTING §2).
 */
export class Match {
  readonly state: MatchState;
  private readonly players: Record<PlayerSlot, PlayerRuntime>;
  private readonly scheduler: TickScheduler;
  private readonly snapshotInterval: number;
  private readonly dt: number;
  private readonly rng: Rng;
  private ended = false;

  constructor(
    readonly id: string,
    readonly config: GameConfig,
    readonly seed: number,
    connectionA: Connection,
    connectionB: Connection,
    private readonly deps: MatchDeps,
  ) {
    this.state = (deps.createInitialState ?? createInitialMatchState)(config);
    this.players = {
      a: makePlayer('a', connectionA),
      b: makePlayer('b', connectionB),
    };
    this.snapshotInterval = config.SIM_HZ / config.SNAPSHOT_HZ;
    this.dt = 1 / config.SIM_HZ;
    this.rng = createRng(seed);
    this.scheduler = new TickScheduler(
      config.SIM_HZ,
      () => this.step(),
      deps.now,
    );
  }

  /** Announce the pairing and begin ticking (production entry point). */
  start(): void {
    for (const { slot, connection } of Object.values(this.players)) {
      connection.send({
        t: 'matchFound',
        matchId: this.id,
        yourSlot: slot,
        constants: this.config,
      });
    }
    this.broadcastSnapshot();
    this.scheduler.start();
  }

  /** Advance exactly one authoritative simulation tick. */
  step(): void {
    if (this.ended) {
      return;
    }

    const prevPhase = this.state.phase;
    const inputs = this.drainInputs();
    const events: GameEvent[] = [];
    stepMatch(this.state, inputs, {
      dt: this.dt,
      config: this.config,
      rng: this.rng,
      events,
    });

    if (events.length > 0) {
      this.broadcastEvents(events);
    }

    if (this.state.phase === MATCH_PHASE.Ended) {
      this.endByResult(prevPhase);
      return;
    }
    if (this.state.tick % this.snapshotInterval === 0) {
      this.broadcastSnapshot();
    }
  }

  /** The sim reached its natural conclusion (time-up or sudden death). */
  private endByResult(prevPhase: MatchState['phase']): void {
    const reason: MatchEndReason =
      prevPhase === MATCH_PHASE.SuddenDeath ? 'suddenDeath' : 'time';
    const winner = this.winningSlot();
    this.broadcastSnapshot(); // let both clients see the final frozen world
    this.finish((player) => ({
      reason,
      result:
        winner === null ? 'draw' : player.slot === winner ? 'win' : 'lose',
      notify: true,
    }));
  }

  private winningSlot(): PlayerSlot | null {
    const { a, b } = this.state.scores;
    if (a === b) {
      return null;
    }
    return a > b ? 'a' : 'b';
  }

  /**
   * Take the latest intent per player (reusing the last known when a tick has
   * none) and record it as processed for input acknowledgement.
   */
  private drainInputs(): MatchInputs {
    const resolve = (player: PlayerRuntime): InputCommand => {
      if (player.lastInput === undefined) {
        return NEUTRAL_INPUT; // no intent yet; do not move the ack backward
      }
      player.lastProcessedSeq = player.lastInput.seq;
      return player.lastInput;
    };
    return { a: resolve(this.players.a), b: resolve(this.players.b) };
  }

  receiveInput(connection: Connection, input: InputCommand): void {
    const player = this.playerFor(connection);
    if (player === undefined || input.seq <= player.lastReceivedSeq) {
      return; // stale/duplicate or not a participant
    }
    player.lastReceivedSeq = input.seq;
    player.lastInput = clampInputCommand(input);
  }

  /** A participant's socket closed or they voluntarily left (GAME.md §9). */
  handleDisconnect(connection: Connection): void {
    if (this.ended || this.playerFor(connection) === undefined) {
      return;
    }
    const survivor = this.opponentOf(connection);
    const duringPlay =
      this.state.phase === MATCH_PHASE.Playing ||
      this.state.phase === MATCH_PHASE.SuddenDeath;

    this.finish((player) => ({
      reason: 'opponentLeft',
      result: player === survivor && duringPlay ? 'win' : 'draw',
      notify: player === survivor,
    }));
  }

  /** Halt without notifying clients (server shutdown). */
  stop(): void {
    this.ended = true;
    this.scheduler.stop();
  }

  private finish(
    outcome: (player: PlayerRuntime) => {
      reason: MatchEndReason;
      result: MatchResult;
      notify: boolean;
    },
  ): void {
    this.ended = true;
    this.state.phase = MATCH_PHASE.Ended;
    this.scheduler.stop();

    for (const player of Object.values(this.players)) {
      const { reason, result, notify } = outcome(player);
      if (notify) {
        player.connection.send({
          t: 'matchEnd',
          result,
          reason,
          scores: this.scores(),
        });
      }
    }

    this.deps.onEnded(this);
  }

  private broadcastEvents(events: GameEvent[]): void {
    const serverTime = this.deps.now();
    for (const player of Object.values(this.players)) {
      player.connection.send({
        t: 'event',
        tick: this.state.tick,
        serverTime,
        events,
      });
    }
  }

  private broadcastSnapshot(): void {
    const serverTime = this.deps.now();
    for (const player of Object.values(this.players)) {
      player.connection.send({
        t: 'snapshot',
        tick: this.state.tick,
        serverTime,
        ackSeq: player.lastProcessedSeq,
        state: this.state,
      });
    }
  }

  private scores(): PlayerScores {
    return { a: this.state.scores.a, b: this.state.scores.b };
  }

  private playerFor(connection: Connection): PlayerRuntime | undefined {
    return Object.values(this.players).find(
      (player) => player.connection === connection,
    );
  }

  private opponentOf(connection: Connection): PlayerRuntime {
    return this.players[this.players.a.connection === connection ? 'b' : 'a'];
  }
}

function makePlayer(slot: PlayerSlot, connection: Connection): PlayerRuntime {
  return {
    slot,
    connection,
    lastInput: undefined,
    lastReceivedSeq: -1,
    lastProcessedSeq: -1,
  };
}
