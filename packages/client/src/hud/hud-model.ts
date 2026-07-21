import {
  MATCH_PHASE,
  type GameConfig,
  type MatchState,
  type PlayerSlot,
  type Vec3,
} from '@skyring/shared';

export type RingStatus = 'idle' | 'mine' | 'theirs' | 'contested';

export interface HudModel {
  myScore: number;
  theirScore: number;
  timeLabel: string;
  phaseLabel: string;
  ringStatus: RingStatus;
  warning: boolean;
  nextCenter: Vec3 | null;
  suddenDeath: boolean;
  countdown: number | null;
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
    myScore: Math.floor(state.scores[localSlot]),
    theirScore: Math.floor(state.scores[other]),
    timeLabel: timeLabel(state, config),
    phaseLabel: state.phase,
    ringStatus: ringStatus(state, localSlot),
    warning: state.ring.warning,
    nextCenter: state.ring.nextCenter,
    suddenDeath,
    countdown,
  };
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
