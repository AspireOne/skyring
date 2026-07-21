export {
  createGameConfig,
  DEFAULT_GAME_CONFIG,
  secondsToTicks,
  type GameConfig,
} from './constants.js';
export {
  MATCH_PHASE,
  type BulletState,
  type InputCommand,
  type MatchPhase,
  type MatchState,
  type PlaneState,
  type PlayerScores,
  type PlayerSlot,
  type Quat,
  type RingState,
  type Vec3,
} from './types.js';
export {
  LOCAL_NOSE,
  WORLD_UP,
  fromQuaternion,
  fromVector3,
  noseDirection,
  orientationFacing,
  toQuaternion,
  toVector3,
} from './math.js';
export { createRng, type Rng } from './rng.js';
export {
  clampInputCommand,
  encode,
  normalizeRoomCode,
  parseClientMessage,
  parseServerMessage,
  PROTOCOL_VERSION,
} from './protocol.js';
export type {
  BounceEvent,
  BounceSurface,
  ClientMessage,
  ClientMessageTag,
  EventMessage,
  FireEvent,
  GameEvent,
  GameEventKind,
  HelloMessage,
  HitEvent,
  InputMessage,
  LeaveMessage,
  MatchEndMessage,
  MatchEndReason,
  MatchFoundMessage,
  MatchResult,
  PhaseChangeEvent,
  PingMessage,
  PongMessage,
  QueueMessage,
  QueueMode,
  QueuedMessage,
  RejectedMessage,
  RingTeleportEvent,
  ServerMessage,
  ServerMessageTag,
  SnapshotMessage,
  StumbleEvent,
  WelcomeMessage,
} from './messages.js';
export { createInitialMatchState } from './sim/state.js';
export { stepPlane } from './sim/plane.js';
export { spawnBullet, stepBullets, tryFireBullet } from './sim/bullet.js';
export {
  resolveBulletHits,
  resolvePlaneBoundaries,
  resolvePlanePlane,
} from './sim/collision.js';
export { stepMatch, type MatchInputs, type StepContext } from './sim/match.js';
export { NEUTRAL_INPUT } from './sim/input.js';
export {
  pickRingCenter,
  relocateForSuddenDeath,
  resolveScoring,
  stepRing,
} from './sim/ring.js';
