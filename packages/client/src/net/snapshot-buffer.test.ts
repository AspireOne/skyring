import {
  createInitialMatchState,
  DEFAULT_GAME_CONFIG,
  type MatchState,
  type SnapshotMessage,
  type Vec3,
} from '@skyring/shared';
import { describe, expect, it } from 'vitest';

import { SnapshotBuffer } from './snapshot-buffer.js';

function snapshotAt(
  tick: number,
  serverTime: number,
  posA: Vec3,
  posB: Vec3 = [0, 0, 0],
): SnapshotMessage {
  const state: MatchState = createInitialMatchState(DEFAULT_GAME_CONFIG);
  state.tick = tick;
  state.planes.a.pos = posA;
  state.planes.b.pos = posB;
  return { t: 'snapshot', tick, serverTime, ackSeq: -1, state };
}

describe('SnapshotBuffer', () => {
  it('returns undefined when empty', () => {
    expect(new SnapshotBuffer().sample(0)).toBeUndefined();
  });

  it('lerps position between two bracketing snapshots', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshotAt(0, 1000, [0, 0, 0]));
    buffer.push(snapshotAt(1, 1100, [10, 0, 0]));

    const view = buffer.sample(1050);
    expect(view?.a.pos[0]).toBeCloseTo(5, 5);
  });

  it('holds the earliest snapshot when render time precedes the buffer', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshotAt(0, 1000, [3, 0, 0]));
    buffer.push(snapshotAt(1, 1100, [10, 0, 0]));
    expect(buffer.sample(500)?.a.pos[0]).toBe(3);
  });

  it('holds the latest snapshot on underrun', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshotAt(0, 1000, [3, 0, 0]));
    buffer.push(snapshotAt(1, 1100, [10, 0, 0]));
    expect(buffer.sample(5000)?.a.pos[0]).toBe(10);
  });

  it('ignores duplicate and out-of-order snapshots', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshotAt(5, 1000, [0, 0, 0]));
    buffer.push(snapshotAt(5, 1000, [99, 0, 0])); // duplicate tick
    buffer.push(snapshotAt(3, 900, [99, 0, 0])); // older tick
    expect(buffer.size).toBe(1);
    expect(buffer.latest?.state.planes.a.pos[0]).toBe(0);
  });

  it('prunes old snapshots beyond the retention window', () => {
    const buffer = new SnapshotBuffer();
    for (let i = 0; i < 100; i += 1) {
      buffer.push(snapshotAt(i, 1000 + i * 33, [i, 0, 0]));
    }
    // Window is ~1200ms → ~36 snapshots at 33ms spacing, far fewer than 100.
    expect(buffer.size).toBeLessThan(60);
    expect(buffer.latest?.tick).toBe(99);
  });
});
