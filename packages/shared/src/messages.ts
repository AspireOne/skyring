import type { GameConfig } from './constants.js';
import type {
  InputCommand,
  MatchPhase,
  MatchState,
  PlayerScores,
  PlayerSlot,
  Vec3,
} from './types.js';

/**
 * Wire message shapes (ARCHITECTURE §4). Every message carries a string tag
 * `t`. State consequences reconcile through {@link SnapshotMessage}; discrete
 * {@link EventMessage}s exist only so the client can *react* (juice, sound,
 * lifecycle) at the right instant (ARCHITECTURE §4).
 */

export type QueueMode = 'quick' | 'room';

// ── Client → Server ────────────────────────────────────────────────────────

export interface HelloMessage {
  t: 'hello';
  version: number;
}

export interface QueueMessage {
  t: 'queue';
  mode: QueueMode;
  room?: string;
}

export interface InputMessage {
  t: 'input';
  input: InputCommand;
}

export interface PingMessage {
  t: 'ping';
  clientTime: number;
}

export interface LeaveMessage {
  t: 'leave';
}

export type ClientMessage =
  HelloMessage | QueueMessage | InputMessage | PingMessage | LeaveMessage;

export type ClientMessageTag = ClientMessage['t'];

// ── Server → Client ────────────────────────────────────────────────────────

export interface WelcomeMessage {
  t: 'welcome';
  yourConnId: string;
  serverTime: number;
  version: number;
}

export interface PongMessage {
  t: 'pong';
  clientTime: number;
  serverTime: number;
}

export interface QueuedMessage {
  t: 'queued';
  mode: QueueMode;
  room?: string;
}

export interface MatchFoundMessage {
  t: 'matchFound';
  matchId: string;
  yourSlot: PlayerSlot;
  constants: GameConfig;
}

export interface SnapshotMessage {
  t: 'snapshot';
  tick: number;
  serverTime: number;
  ackSeq: number;
  state: MatchState;
}

export type MatchEndReason = 'time' | 'suddenDeath' | 'opponentLeft';
export type MatchResult = 'win' | 'lose' | 'draw';

export interface MatchEndMessage {
  t: 'matchEnd';
  result: MatchResult;
  scores: PlayerScores;
  reason: MatchEndReason;
}

export interface RejectedMessage {
  t: 'rejected';
  reason: string;
}

export type ServerMessage =
  | WelcomeMessage
  | PongMessage
  | QueuedMessage
  | MatchFoundMessage
  | SnapshotMessage
  | EventMessage
  | MatchEndMessage
  | RejectedMessage;

export type ServerMessageTag = ServerMessage['t'];

// ── Discrete gameplay events (feedback only, never authoritative truth) ──────

export interface HitEvent {
  kind: 'hit';
  shooter: PlayerSlot;
  victim: PlayerSlot;
  pos: Vec3;
  dir: Vec3;
}

export interface FireEvent {
  kind: 'fire';
  slot: PlayerSlot;
  pos: Vec3;
}

export type BounceSurface = 'dome' | 'ground' | 'plane';

export interface BounceEvent {
  kind: 'bounce';
  slot: PlayerSlot;
  surface: BounceSurface;
  pos: Vec3;
}

export interface RingTeleportEvent {
  kind: 'ringTeleport';
  center: Vec3;
  radius: number;
}

export interface StumbleEvent {
  kind: 'stumble';
  slot: PlayerSlot;
}

export interface PhaseChangeEvent {
  kind: 'phaseChange';
  phase: MatchPhase;
}

export type GameEvent =
  | FireEvent
  | HitEvent
  | BounceEvent
  | RingTeleportEvent
  | StumbleEvent
  | PhaseChangeEvent;

export type GameEventKind = GameEvent['kind'];

export interface EventMessage {
  t: 'event';
  tick: number;
  serverTime: number;
  events: GameEvent[];
}
