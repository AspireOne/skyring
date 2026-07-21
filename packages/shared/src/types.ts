export type Vec3 = [x: number, y: number, z: number];
export type Quat = [x: number, y: number, z: number, w: number];
export type PlayerSlot = 'a' | 'b';

export const MATCH_PHASE = Object.freeze({
  Waiting: 'waiting',
  Countdown: 'countdown',
  Playing: 'playing',
  SuddenDeath: 'suddenDeath',
  Ended: 'ended',
} as const);

export type MatchPhase = (typeof MATCH_PHASE)[keyof typeof MATCH_PHASE];

export interface PlaneState {
  pos: Vec3;
  vel: Vec3;
  rot: Quat;
  flightSpeed: number;
  ammo: number;
  stumbleTicksRemaining: number;
  stumbleAngularVelocity: Vec3;
  fireCooldownTicks: number;
  inRing: boolean;
  scoring: boolean;
}

export interface BulletState {
  id: number;
  owner: PlayerSlot;
  previousPos: Vec3;
  pos: Vec3;
  vel: Vec3;
  lifetimeTicksRemaining: number;
}

export interface RingState {
  center: Vec3;
  radius: number;
  teleportTicksRemaining: number;
  warning: boolean;
  nextCenter: Vec3 | null;
}

export interface PlayerScores {
  a: number;
  b: number;
}

export interface MatchState {
  phase: MatchPhase;
  phaseTicksRemaining: number;
  scores: PlayerScores;
  ring: RingState;
  planes: Record<PlayerSlot, PlaneState>;
  bullets: BulletState[];
  tick: number;
}

export interface InputCommand {
  seq: number;
  tick: number;
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
  fire: boolean;
}
