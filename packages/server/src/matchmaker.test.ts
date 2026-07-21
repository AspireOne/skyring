import { DEFAULT_GAME_CONFIG } from '@skyring/shared';
import { describe, expect, it } from 'vitest';

import { Matchmaker } from './matchmaker.js';
import {
  makeFakeLink,
  type FakeLink,
} from '../../../tests/support/fake-socket.js';

function makeMatchmaker(): Matchmaker {
  return new Matchmaker(DEFAULT_GAME_CONFIG, {
    now: () => 0,
    nextSeed: () => 1,
  });
}

function sawMatchFound(link: FakeLink): boolean {
  return link.socket.outbound.some((message) => message.t === 'matchFound');
}

describe('Matchmaker — quick queue', () => {
  it('pairs the first two quick-queue connections', () => {
    const mm = makeMatchmaker();
    const a = makeFakeLink();
    const b = makeFakeLink();

    mm.enqueueQuick(a.connection);
    expect(mm.waitingCount).toBe(1);
    expect(a.socket.outbound.at(-1)).toMatchObject({
      t: 'queued',
      mode: 'quick',
    });

    mm.enqueueQuick(b.connection);
    expect(mm.activeMatchCount).toBe(1);
    expect(mm.waitingCount).toBe(0);
    expect(sawMatchFound(a)).toBe(true);
    expect(sawMatchFound(b)).toBe(true);
  });

  it('ignores a duplicate quick queue from the same waiting connection', () => {
    const mm = makeMatchmaker();
    const a = makeFakeLink();
    mm.enqueueQuick(a.connection);
    mm.enqueueQuick(a.connection);
    expect(mm.waitingCount).toBe(1);
    expect(mm.activeMatchCount).toBe(0);
  });
});

describe('Matchmaker — room codes', () => {
  it('pairs two connections naming the same room and isolates other rooms', () => {
    const mm = makeMatchmaker();
    const a = makeFakeLink();
    const b = makeFakeLink();
    const other = makeFakeLink();

    mm.enqueueRoom(a.connection, 'ROOM1');
    mm.enqueueRoom(other.connection, 'ROOM2');
    expect(mm.activeMatchCount).toBe(0);

    mm.enqueueRoom(b.connection, 'ROOM1');
    expect(mm.activeMatchCount).toBe(1);
    expect(sawMatchFound(a)).toBe(true);
    expect(sawMatchFound(b)).toBe(true);
    expect(sawMatchFound(other)).toBe(false);
    expect(mm.waitingCount).toBe(1); // ROOM2 still waiting
  });
});

describe('Matchmaker — teardown', () => {
  it('removes a waiting connection from its room on disconnect', () => {
    const mm = makeMatchmaker();
    const a = makeFakeLink();
    mm.enqueueRoom(a.connection, 'ROOM1');
    expect(mm.waitingCount).toBe(1);
    mm.handleDisconnect(a.connection);
    expect(mm.waitingCount).toBe(0);
  });

  it('ends a live match and clears state when a participant disconnects', () => {
    const mm = makeMatchmaker();
    const a = makeFakeLink();
    const b = makeFakeLink();
    mm.enqueueQuick(a.connection);
    mm.enqueueQuick(b.connection);
    expect(mm.activeMatchCount).toBe(1);

    mm.handleDisconnect(a.connection);
    expect(mm.activeMatchCount).toBe(0);
  });

  it('stop() halts and clears all matches', () => {
    const mm = makeMatchmaker();
    const a = makeFakeLink();
    const b = makeFakeLink();
    mm.enqueueQuick(a.connection);
    mm.enqueueQuick(b.connection);
    mm.stop();
    expect(mm.activeMatchCount).toBe(0);
    expect(mm.waitingCount).toBe(0);
  });
});
