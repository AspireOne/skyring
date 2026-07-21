import { DEFAULT_GAME_CONFIG, MATCH_PHASE } from '@skyring/shared';
import { describe, expect, it, vi } from 'vitest';

import { Match } from './match.js';
import {
  makeFakeLink,
  type FakeLink,
} from '../../../tests/support/fake-socket.js';

import type { ServerMessage } from '@skyring/shared';

function outboundOf(link: FakeLink, tag: ServerMessage['t']): ServerMessage[] {
  return link.socket.outbound.filter((message) => message.t === tag);
}

function makeMatch(): {
  match: Match;
  a: FakeLink;
  b: FakeLink;
  onEnded: ReturnType<typeof vi.fn>;
} {
  const a = makeFakeLink();
  const b = makeFakeLink();
  const onEnded = vi.fn();
  const match = new Match(
    'm1',
    DEFAULT_GAME_CONFIG,
    1,
    a.connection,
    b.connection,
    {},
    {
      now: () => 0,
      onEnded,
    },
  );
  return { match, a, b, onEnded };
}

describe('Match', () => {
  it('announces the pairing with opposite slots and the effective config', () => {
    const { match, a, b } = makeMatch();
    match.start();
    match.stop();

    const foundA = outboundOf(a, 'matchFound')[0];
    const foundB = outboundOf(b, 'matchFound')[0];
    expect(foundA).toMatchObject({
      t: 'matchFound',
      yourSlot: 'a',
      matchId: 'm1',
    });
    expect(foundB).toMatchObject({ yourSlot: 'b' });
    expect(foundA).toMatchObject({ constants: DEFAULT_GAME_CONFIG });
  });

  it('broadcasts snapshots at SNAPSHOT_HZ cadence', () => {
    const { match, a } = makeMatch();
    match.start(); // initial snapshot at tick 0
    const interval =
      DEFAULT_GAME_CONFIG.SIM_HZ / DEFAULT_GAME_CONFIG.SNAPSHOT_HZ;
    for (let i = 0; i < interval * 3; i += 1) {
      match.step();
    }
    match.stop();

    const snapshots = outboundOf(a, 'snapshot');
    // tick 0 + ticks {interval, 2*interval, 3*interval}
    expect(snapshots).toHaveLength(4);
    expect(snapshots.at(-1)).toMatchObject({ tick: interval * 3 });
  });

  it('acknowledges the latest processed input and drops stale sequences', () => {
    const { match, a } = makeMatch();
    match.start();

    match.receiveInput(a.connection, {
      seq: 5,
      tick: 1,
      throttle: 0,
      pitch: 0,
      roll: 0,
      yaw: 0,
      fire: false,
    });
    // Stale sequence must be ignored.
    match.receiveInput(a.connection, {
      seq: 3,
      tick: 2,
      throttle: 1,
      pitch: 0,
      roll: 0,
      yaw: 0,
      fire: false,
    });
    const interval =
      DEFAULT_GAME_CONFIG.SIM_HZ / DEFAULT_GAME_CONFIG.SNAPSHOT_HZ;
    for (let i = 0; i < interval; i += 1) {
      match.step();
    }

    expect(outboundOf(a, 'snapshot').at(-1)).toMatchObject({ ackSeq: 5 });
  });

  it('awards the survivor on a disconnect during play', () => {
    const { match, a, b, onEnded } = makeMatch();
    match.start();
    match.state.phase = MATCH_PHASE.Playing;

    match.handleDisconnect(a.connection);

    expect(match.state.phase).toBe(MATCH_PHASE.Ended);
    expect(outboundOf(b, 'matchEnd')[0]).toMatchObject({
      result: 'win',
      reason: 'opponentLeft',
    });
    // The leaver is not notified.
    expect(outboundOf(a, 'matchEnd')).toHaveLength(0);
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it('treats a countdown disconnect as a no-contest draw', () => {
    const { match, a, b } = makeMatch();
    match.start();
    // still in Countdown
    match.handleDisconnect(a.connection);
    expect(outboundOf(b, 'matchEnd')[0]).toMatchObject({
      result: 'draw',
      reason: 'opponentLeft',
    });
  });

  it('ignores steps once ended', () => {
    const { match, a } = makeMatch();
    match.start();
    match.state.phase = MATCH_PHASE.Playing;
    match.handleDisconnect(a.connection);
    const before = match.state.tick;
    match.step();
    expect(match.state.tick).toBe(before);
  });
});
