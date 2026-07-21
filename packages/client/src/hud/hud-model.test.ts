import {
  createInitialMatchState,
  DEFAULT_GAME_CONFIG,
  MATCH_PHASE,
  type MatchState,
} from '@skyring/shared';
import { describe, expect, it } from 'vitest';

import { formatClock, projectHud, ringStatus } from './hud-model.js';

const config = DEFAULT_GAME_CONFIG;

function playing(): MatchState {
  const state = createInitialMatchState(config);
  state.phase = MATCH_PHASE.Playing;
  state.phaseTicksRemaining = 90 * config.SIM_HZ; // 1:30
  return state;
}

describe('formatClock', () => {
  it('formats remaining ticks as m:ss', () => {
    expect(formatClock(90 * 60, 60)).toBe('1:30');
    expect(formatClock(5 * 60, 60)).toBe('0:05');
    expect(formatClock(0, 60)).toBe('0:00');
    expect(formatClock(-10, 60)).toBe('0:00');
  });
});

describe('ringStatus', () => {
  it('reflects who is scoring or a contest', () => {
    const state = playing();
    state.planes.a.scoring = true;
    expect(ringStatus(state, 'a')).toBe('mine');
    expect(ringStatus(state, 'b')).toBe('theirs');

    state.planes.a.scoring = false;
    state.planes.a.inRing = true;
    state.planes.b.inRing = true;
    expect(ringStatus(state, 'a')).toBe('contested');

    state.planes.a.inRing = false;
    state.planes.b.inRing = false;
    expect(ringStatus(state, 'a')).toBe('idle');
  });
});

describe('projectHud', () => {
  it('projects scores from the local perspective and the match clock', () => {
    const state = playing();
    state.scores = { a: 4.8, b: 2.1 };
    const model = projectHud(state, 'a', config);
    expect(model.myScore).toBe(4);
    expect(model.theirScore).toBe(2);
    expect(model.timeLabel).toBe('1:30');
    expect(model.suddenDeath).toBe(false);
    expect(model.countdown).toBeNull();
    expect(model.ammo).toBe(config.AMMO_MAX);
    expect(model.ammoFraction).toBe(1);
  });

  it('projects local ammo as a clamped energy fraction', () => {
    const state = playing();
    state.planes.b.ammo = config.AMMO_MAX / 4;
    const model = projectHud(state, 'b', config);
    expect(model.ammo).toBe(config.AMMO_MAX / 4);
    expect(model.ammoMax).toBe(config.AMMO_MAX);
    expect(model.ammoFraction).toBe(0.25);
  });

  it('mirrors scores for the other slot', () => {
    const state = playing();
    state.scores = { a: 4, b: 9 };
    expect(projectHud(state, 'b', config).myScore).toBe(9);
    expect(projectHud(state, 'b', config).theirScore).toBe(4);
  });

  it('surfaces countdown seconds and sudden death', () => {
    const countdownState = createInitialMatchState(config);
    countdownState.phaseTicksRemaining = 3 * config.SIM_HZ;
    expect(projectHud(countdownState, 'a', config).countdown).toBe(3);

    const sd = playing();
    sd.phase = MATCH_PHASE.SuddenDeath;
    const model = projectHud(sd, 'a', config);
    expect(model.suddenDeath).toBe(true);
    expect(model.timeLabel).toBe('SUDDEN DEATH');
  });

  it('exposes the ring warning and revealed next center', () => {
    const state = playing();
    state.ring.warning = true;
    state.ring.nextCenter = [10, 20, 30];
    const model = projectHud(state, 'a', config);
    expect(model.warning).toBe(true);
    expect(model.nextCenter).toEqual([10, 20, 30]);
  });
});
