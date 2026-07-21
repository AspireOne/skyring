import { Quaternion, Vector3 } from 'three';

import type {
  MatchPhase,
  PlayerScores,
  PlayerSlot,
  Quat,
  RingState,
  SnapshotMessage,
  Vec3,
} from '@skyring/shared';

/** Keep a little over a second of snapshots for interpolation + underrun cover. */
const MAX_BUFFER_MS = 1200;
const MIN_KEPT = 2;

export interface RenderPlane {
  pos: Vec3;
  rot: Quat;
}

export interface RenderBullet {
  id: number;
  owner: PlayerSlot;
  pos: Vec3;
}

export interface RenderView {
  a: RenderPlane;
  b: RenderPlane;
  bullets: RenderBullet[];
  phase: MatchPhase;
  ring: RingState;
  scores: PlayerScores;
  tick: number;
}

/**
 * Buffers authoritative snapshots and reconstructs a smooth world at a chosen
 * render time (ARCHITECTURE §4.2). Remote (and, pre-prediction, local)
 * entities are rendered slightly in the past: positions lerp and orientations
 * slerp between the two bracketing snapshots. On underrun it holds the newest
 * snapshot rather than guessing. Pure and WebGL-free, so it is unit-testable.
 */
export class SnapshotBuffer {
  private readonly snapshots: SnapshotMessage[] = [];

  push(snapshot: SnapshotMessage): void {
    const last = this.snapshots.at(-1);
    if (last && snapshot.tick <= last.tick) {
      return; // ignore duplicates and out-of-order stragglers
    }
    this.snapshots.push(snapshot);
    this.prune();
  }

  get latest(): SnapshotMessage | undefined {
    return this.snapshots.at(-1);
  }

  get size(): number {
    return this.snapshots.length;
  }

  /** Reconstruct the world at `renderTime` (in server-clock milliseconds). */
  sample(renderTime: number): RenderView | undefined {
    const count = this.snapshots.length;
    if (count === 0) {
      return undefined;
    }
    const first = this.snapshots[0];
    const last = this.snapshots.at(-1);
    if (!first || !last) {
      return undefined;
    }
    if (renderTime <= first.serverTime) {
      return viewFrom(first, first, 0);
    }
    if (renderTime >= last.serverTime) {
      return viewFrom(last, last, 0);
    }

    for (let i = 0; i < count - 1; i += 1) {
      const s0 = this.snapshots[i];
      const s1 = this.snapshots[i + 1];
      if (
        s0 &&
        s1 &&
        renderTime >= s0.serverTime &&
        renderTime < s1.serverTime
      ) {
        const span = s1.serverTime - s0.serverTime;
        const t = span > 0 ? (renderTime - s0.serverTime) / span : 0;
        return viewFrom(s0, s1, t);
      }
    }
    return viewFrom(last, last, 0);
  }

  private prune(): void {
    const newest = this.snapshots.at(-1);
    if (!newest) {
      return;
    }
    while (
      this.snapshots.length > MIN_KEPT &&
      newest.serverTime - (this.snapshots[0]?.serverTime ?? 0) > MAX_BUFFER_MS
    ) {
      this.snapshots.shift();
    }
  }
}

function viewFrom(
  s0: SnapshotMessage,
  s1: SnapshotMessage,
  t: number,
): RenderView {
  // Discrete state (phase/ring/scores) takes the later snapshot's truth.
  return {
    a: interpolatePlane(s0, s1, 'a', t),
    b: interpolatePlane(s0, s1, 'b', t),
    bullets: interpolateBullets(s0, s1, t),
    phase: s1.state.phase,
    ring: s1.state.ring,
    scores: s1.state.scores,
    tick: s1.tick,
  };
}

function interpolatePlane(
  s0: SnapshotMessage,
  s1: SnapshotMessage,
  slot: 'a' | 'b',
  t: number,
): RenderPlane {
  const p0 = s0.state.planes[slot];
  const p1 = s1.state.planes[slot];
  if (t <= 0) {
    return { pos: [...p0.pos], rot: [...p0.rot] };
  }
  const pos = _v0.set(...p0.pos).lerp(_v1.set(...p1.pos), t);
  const rot = _q0.set(...p0.rot).slerp(_q1.set(...p1.rot), t);
  return {
    pos: [pos.x, pos.y, pos.z],
    rot: [rot.x, rot.y, rot.z, rot.w],
  };
}

function interpolateBullets(
  s0: SnapshotMessage,
  s1: SnapshotMessage,
  t: number,
): RenderBullet[] {
  const previous = new Map(
    s0.state.bullets.map((bullet) => [bullet.id, bullet]),
  );
  return s1.state.bullets.map((bullet) => {
    const before = previous.get(bullet.id);
    if (!before || t <= 0) {
      return { id: bullet.id, owner: bullet.owner, pos: [...bullet.pos] };
    }
    const pos = _v0.set(...before.pos).lerp(_v1.set(...bullet.pos), t);
    return {
      id: bullet.id,
      owner: bullet.owner,
      pos: [pos.x, pos.y, pos.z],
    };
  });
}

const _v0 = new Vector3();
const _v1 = new Vector3();
const _q0 = new Quaternion();
const _q1 = new Quaternion();
