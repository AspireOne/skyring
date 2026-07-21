import { type GameConfig, secondsToTicks } from '../constants.js';
import { orientationFacing } from '../math.js';
import {
  MATCH_PHASE,
  type MatchState,
  type PlaneState,
  type PlayerSlot,
  type Vec3,
} from '../types.js';

/**
 * Builds the authoritative starting world for a match (IMPLEMENTATION §11).
 * Planes spawn at opposite sides of the arena at `SPAWN_ALTITUDE`, facing the
 * arena center; the ring sits at center; the match opens in `Countdown`.
 *
 * Pure and deterministic: identical config yields identical initial state.
 */
export function createInitialMatchState(config: GameConfig): MatchState {
  const ringCenter: Vec3 = [0, config.SPAWN_ALTITUDE, 0];

  return {
    phase: MATCH_PHASE.Countdown,
    phaseTicksRemaining: secondsToTicks(config.COUNTDOWN, config.SIM_HZ),
    scores: { a: 0, b: 0 },
    ring: {
      center: ringCenter,
      radius: config.RING_RADIUS,
      teleportTicksRemaining: secondsToTicks(config.RING_DWELL, config.SIM_HZ),
      warning: false,
      nextCenter: null,
    },
    planes: {
      a: makePlane('a', config),
      b: makePlane('b', config),
    },
    bullets: [],
    tick: 0,
  };
}

function makePlane(slot: PlayerSlot, config: GameConfig): PlaneState {
  const x = slot === 'a' ? -config.SPAWN_SEPARATION : config.SPAWN_SEPARATION;
  const pos: Vec3 = [x, config.SPAWN_ALTITUDE, 0];
  // Face the arena center (opposite side), so the opening is a race/joust.
  const facing: Vec3 = [-x, 0, 0];

  return {
    pos,
    vel: [0, 0, 0],
    rot: orientationFacing(facing),
    flightSpeed: config.MIN_SPEED,
    ammo: config.AMMO_MAX,
    stumbleTicksRemaining: 0,
    stumbleAngularVelocity: [0, 0, 0],
    fireCooldownTicks: 0,
    inRing: false,
    scoring: false,
  };
}
