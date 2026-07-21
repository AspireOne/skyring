import type { InputCommand } from '../types.js';

/**
 * The do-nothing input: hold speed, no steering, no fire. Used as the
 * authoritative fallback when a tick has no fresh command from a player
 * (ARCHITECTURE §3.3) and as the client's per-frame sampling baseline.
 */
export const NEUTRAL_INPUT: Readonly<InputCommand> = Object.freeze({
  seq: 0,
  tick: 0,
  throttle: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  fire: false,
});
