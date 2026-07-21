import { type GameConfig, secondsToTicks } from '../constants.js';
import {
  MATCH_PHASE,
  type InputCommand,
  type MatchState,
  type PlayerSlot,
} from '../types.js';
import { stepBullets, tryFireBullet } from './bullet.js';
import {
  resolveBulletHits,
  resolvePlaneBoundaries,
  resolvePlanePlane,
} from './collision.js';
import { stepPlane } from './plane.js';
import { relocateForSuddenDeath, resolveScoring, stepRing } from './ring.js';

import type { GameEvent } from '../messages.js';
import type { Rng } from '../rng.js';

export interface StepContext {
  readonly dt: number;
  readonly config: GameConfig;
  readonly rng: Rng;
  /** Discrete feedback/lifecycle events produced this tick (IMPLEMENTATION §4.6). */
  readonly events: GameEvent[];
}

export type MatchInputs = Record<PlayerSlot, InputCommand>;

/**
 * Advances the whole authoritative world by one fixed tick (IMPLEMENTATION
 * §5.3, DECISIONS D007). Per-tick order while playing: movement/upkeep → fire
 * → projectiles → collisions → ring → scoring → regulation clock. Countdown
 * freezes the planes; Ended is terminal. Mutates `state` in place.
 */
export function stepMatch(
  state: MatchState,
  inputs: MatchInputs,
  ctx: StepContext,
): void {
  state.tick += 1;

  switch (state.phase) {
    case MATCH_PHASE.Countdown:
      stepCountdown(state, ctx);
      break;
    case MATCH_PHASE.Playing:
    case MATCH_PHASE.SuddenDeath:
      stepActivePlay(state, inputs, ctx);
      break;
    case MATCH_PHASE.Waiting:
    case MATCH_PHASE.Ended:
      break;
  }
}

function stepCountdown(state: MatchState, ctx: StepContext): void {
  state.phaseTicksRemaining -= 1;
  if (state.phaseTicksRemaining <= 0) {
    state.phase = MATCH_PHASE.Playing;
    state.phaseTicksRemaining = secondsToTicks(
      ctx.config.MATCH_DURATION,
      ctx.config.SIM_HZ,
    );
    ctx.events.push({ kind: 'phaseChange', phase: MATCH_PHASE.Playing });
  }
}

function stepActivePlay(
  state: MatchState,
  inputs: MatchInputs,
  ctx: StepContext,
): void {
  stepPlane(state.planes.a, inputs.a, ctx.dt, ctx.config);
  stepPlane(state.planes.b, inputs.b, ctx.dt, ctx.config);

  handleFireIntent(state, 'a', inputs.a, ctx.config, ctx.events);
  handleFireIntent(state, 'b', inputs.b, ctx.config, ctx.events);
  stepBullets(state.bullets, ctx.dt, ctx.config);
  resolveBulletHits(state, ctx.config, ctx.rng, ctx.events);

  resolvePlaneBoundaries('a', state.planes.a, ctx.config, ctx.events);
  resolvePlaneBoundaries('b', state.planes.b, ctx.config, ctx.events);
  resolvePlanePlane(state.planes.a, state.planes.b, ctx.config, ctx.events);
  // Contact separation can push a plane across the ground/dome rim. Finish
  // every authoritative tick in the legal boundary intersection (D012).
  resolvePlaneBoundaries('a', state.planes.a, ctx.config, ctx.events);
  resolvePlaneBoundaries('b', state.planes.b, ctx.config, ctx.events);

  stepRing(state, ctx.config, ctx.rng, ctx.events);
  const scorer = resolveScoring(state, ctx.config, ctx.dt);

  if (state.phase === MATCH_PHASE.Playing) {
    state.phaseTicksRemaining -= 1;
    if (state.phaseTicksRemaining <= 0) {
      endRegulation(state, ctx);
    }
  } else if (scorer !== null) {
    // Sudden death: the first tick with a scorer ends the match (D007).
    endMatch(state, ctx);
  }
}

function handleFireIntent(
  state: MatchState,
  slot: PlayerSlot,
  input: InputCommand,
  config: GameConfig,
  events: GameEvent[],
): void {
  if (!input.fire || state.bullets.length >= config.MAX_BULLETS) {
    return;
  }
  const bullet = tryFireBullet(
    state.planes[slot],
    slot,
    state.nextBulletId,
    config,
  );
  if (bullet !== null) {
    state.nextBulletId += 1;
    state.bullets.push(bullet);
    events.push({ kind: 'fire', slot, pos: [...bullet.previousPos] });
  }
}

function endRegulation(state: MatchState, ctx: StepContext): void {
  if (state.scores.a === state.scores.b) {
    state.phase = MATCH_PHASE.SuddenDeath;
    relocateForSuddenDeath(state, ctx.config, ctx.rng, ctx.events);
    ctx.events.push({ kind: 'phaseChange', phase: MATCH_PHASE.SuddenDeath });
  } else {
    endMatch(state, ctx);
  }
}

function endMatch(state: MatchState, ctx: StepContext): void {
  state.phase = MATCH_PHASE.Ended;
  state.phaseTicksRemaining = 0;
  ctx.events.push({ kind: 'phaseChange', phase: MATCH_PHASE.Ended });
}
