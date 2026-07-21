import {
  createGameConfig,
  createRng,
  DEFAULT_GAME_CONFIG,
  stepMatch,
  type GameConfig,
  type GameEvent,
  type InputCommand,
  type MatchInputs,
  type MatchState,
  type PlaneState,
} from '@skyring/shared';

/**
 * Scenario builders for simulation tests (TESTING §2). Each changes only the
 * state relevant to a case, keeping assertions focused.
 */

export function makePlaneState(
  overrides: Partial<PlaneState> = {},
): PlaneState {
  return {
    pos: [0, DEFAULT_GAME_CONFIG.SPAWN_ALTITUDE, 0],
    vel: [0, 0, 0],
    rot: [0, 0, 0, 1],
    flightSpeed: DEFAULT_GAME_CONFIG.MIN_SPEED,
    ammo: DEFAULT_GAME_CONFIG.AMMO_MAX,
    stumbleTicksRemaining: 0,
    stumbleAngularVelocity: [0, 0, 0],
    fireCooldownTicks: 0,
    inRing: false,
    scoring: false,
    ...overrides,
  };
}

export function makeInput(overrides: Partial<InputCommand> = {}): InputCommand {
  return {
    seq: 1,
    tick: 0,
    throttle: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    fire: false,
    ...overrides,
  };
}

export function makeInputs(
  a: Partial<InputCommand> = {},
  b: Partial<InputCommand> = {},
): MatchInputs {
  return { a: makeInput(a), b: makeInput(b) };
}

/** Fast test config: short countdown/regulation so lifecycle tests stay quick. */
export function testConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return createGameConfig({
    COUNTDOWN: 1,
    MATCH_DURATION: 3,
    RING_DWELL: 2,
    RING_WARNING: 1,
    ...overrides,
  });
}

export interface RunResult {
  readonly events: GameEvent[];
}

/**
 * Steps a match `ticks` times, collecting every event. Optional per-tick input
 * providers default to neutral.
 */
export function runTicks(
  state: MatchState,
  ticks: number,
  config: GameConfig,
  seed = 1,
  inputForTick: (tick: number) => MatchInputs = () => makeInputs(),
): RunResult {
  const rng = createRng(seed);
  const events: GameEvent[] = [];
  const dt = 1 / config.SIM_HZ;
  for (let i = 0; i < ticks; i += 1) {
    stepMatch(state, inputForTick(state.tick), { dt, config, rng, events });
  }
  return { events };
}
