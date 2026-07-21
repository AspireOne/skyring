import {
  MATCH_PHASE,
  type GameConfig,
  type MatchEndMessage,
  type MatchResult,
  type MatchState,
  type PlayerSlot,
  type Vec3,
} from '@skyring/shared';

export type RingStatus = 'idle' | 'mine' | 'theirs' | 'contested';

export interface HudModel {
  myScore: string;
  theirScore: string;
  timeLabel: string;
  phaseLabel: string;
  ringStatus: RingStatus;
  warning: boolean;
  nextCenter: Vec3 | null;
  suddenDeath: boolean;
  countdown: number | null;
  ammo: number;
  ammoMax: number;
  ammoFraction: number;
}

export interface MatchResultModel {
  outcome: MatchResult;
  label: string;
  myScore: string;
  theirScore: string;
}

/**
 * Pure projection of authoritative state into everything the HUD and ring
 * visual display (TESTING §8). No DOM, no interpolation — scores/timer/contest
 * all derive from the latest snapshot's truth.
 */
export function projectHud(
  state: MatchState,
  localSlot: PlayerSlot,
  config: GameConfig,
): HudModel {
  const other: PlayerSlot = localSlot === 'a' ? 'b' : 'a';
  const suddenDeath = state.phase === MATCH_PHASE.SuddenDeath;
  const countdown =
    state.phase === MATCH_PHASE.Countdown
      ? Math.ceil(state.phaseTicksRemaining / config.SIM_HZ)
      : null;

  return {
    myScore: formatScore(state.scores[localSlot], config),
    theirScore: formatScore(state.scores[other], config),
    timeLabel: timeLabel(state, config),
    phaseLabel: state.phase,
    ringStatus: ringStatus(state, localSlot),
    warning: state.ring.warning,
    nextCenter: state.ring.nextCenter,
    suddenDeath,
    countdown,
    ammo: state.planes[localSlot].ammo,
    ammoMax: config.AMMO_MAX,
    ammoFraction: Math.max(
      0,
      Math.min(1, state.planes[localSlot].ammo / config.AMMO_MAX),
    ),
  };
}

/**
 * Projects the authoritative final scores into the recipient's perspective.
 * The result message is used rather than the last snapshot so the overlay is
 * correct even when delivery ordering or rendering skips the final frame.
 */
export function projectMatchResult(
  message: MatchEndMessage,
  localSlot: PlayerSlot,
  config: GameConfig,
): MatchResultModel {
  const other: PlayerSlot = localSlot === 'a' ? 'b' : 'a';
  return {
    outcome: message.result,
    label: RESULT_LABEL[message.result],
    myScore: formatScore(message.scores[localSlot], config),
    theirScore: formatScore(message.scores[other], config),
  };
}

/**
 * Uses enough decimal places to expose one configured scoring tick. Scores
 * therefore cannot appear tied when the authoritative result has a one-tick
 * lead, including the first scoring tick of sudden death.
 */
export function formatScore(score: number, config: GameConfig): string {
  const pointsPerTick = config.RING_POINTS_PER_SEC / config.SIM_HZ;
  const fractionDigits = Math.max(0, Math.ceil(-Math.log10(pointsPerTick)));
  return score.toFixed(fractionDigits);
}

export function ringStatus(
  state: MatchState,
  localSlot: PlayerSlot,
): RingStatus {
  const other: PlayerSlot = localSlot === 'a' ? 'b' : 'a';
  const me = state.planes[localSlot];
  const them = state.planes[other];
  if (me.scoring) return 'mine';
  if (them.scoring) return 'theirs';
  if (me.inRing && them.inRing) return 'contested';
  return 'idle';
}

function timeLabel(state: MatchState, config: GameConfig): string {
  if (state.phase === MATCH_PHASE.SuddenDeath) {
    return 'SUDDEN DEATH';
  }
  if (state.phase !== MATCH_PHASE.Playing) {
    return '';
  }
  return formatClock(state.phaseTicksRemaining, config.SIM_HZ);
}

export function formatClock(ticksRemaining: number, simHz: number): string {
  const seconds = Math.max(0, Math.ceil(ticksRemaining / simHz));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

const RESULT_LABEL: Record<MatchResult, string> = {
  win: 'YOU WIN',
  lose: 'YOU LOSE',
  draw: 'DRAW',
};
