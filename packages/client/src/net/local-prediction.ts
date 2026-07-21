import {
  MATCH_PHASE,
  stepBullets,
  stepPlane,
  tryFireBullet,
  type BulletState,
  type GameConfig,
  type InputCommand,
  type MatchState,
  type PlaneState,
  type PlayerSlot,
  type Vec3,
} from '@skyring/shared';

import type { RenderBullet, RenderPlane } from './snapshot-buffer.js';

export interface LocalPredictionView extends RenderPlane {
  bullets: RenderBullet[];
}

/**
 * Predicts only the local plane and its own projectiles (ARCHITECTURE §4.1).
 * Authoritative snapshots replace the base state; acknowledged inputs are
 * discarded, and the remaining commands replay in sequence. The simulation
 * helpers are shared with the server, so weapon upkeep/recoil cannot diverge
 * into a second client-only implementation.
 */
export class LocalPrediction {
  private plane: PlaneState | undefined;
  private bullets: BulletState[] = [];
  private readonly pending: InputCommand[] = [];
  private visualOffset: Vec3 = [0, 0, 0];
  private nextPredictedBulletId = -1;

  constructor(
    private readonly slot: PlayerSlot,
    private readonly config: GameConfig,
  ) {}

  /** Retain and immediately apply one local intent. */
  predict(input: InputCommand, phase: MatchState['phase'] | undefined): void {
    if (this.pending.length >= this.config.PREDICTION_MAX_INPUTS) {
      this.pending.shift();
    }
    this.pending.push(cloneInput(input));

    if (this.plane && isActive(phase)) {
      this.step(input);
    }
  }

  /** Replace with server truth, discard acked commands, and replay the rest. */
  reconcile(state: MatchState, ackSeq: number): void {
    const oldVisual = this.plane
      ? add(this.plane.pos, this.visualOffset)
      : undefined;
    const oldPredicted = this.plane?.pos;

    this.dropAcknowledged(ackSeq);
    this.plane = clonePlane(state.planes[this.slot]);
    this.bullets = state.bullets
      .filter(({ owner }) => owner === this.slot)
      .map((bullet) => cloneBullet(bullet));

    if (isActive(state.phase)) {
      for (const input of this.pending) {
        this.step(input);
      }
    }

    if (!oldVisual || !oldPredicted || !this.plane) {
      this.visualOffset = [0, 0, 0];
      return;
    }

    const correctionDistance = distance(oldPredicted, this.plane.pos);
    this.visualOffset =
      correctionDistance < this.config.PREDICTION_SNAP_DISTANCE
        ? subtract(oldVisual, this.plane.pos)
        : [0, 0, 0];
  }

  /** Renderable prediction with small positional corrections eased to truth. */
  sample(elapsedSeconds: number): LocalPredictionView | undefined {
    if (!this.plane) {
      return undefined;
    }

    const pos = add(this.plane.pos, this.visualOffset);
    if (elapsedSeconds > 0) {
      const decay = Math.exp(
        -elapsedSeconds / this.config.PREDICTION_SMOOTH_TIME,
      );
      this.visualOffset = scale(this.visualOffset, decay);
    }

    return {
      pos,
      rot: [...this.plane.rot],
      bullets: this.bullets.map(({ id, owner, pos: bulletPos }) => ({
        id,
        owner,
        pos: [...bulletPos],
      })),
    };
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get predictedPlane(): PlaneState | undefined {
    return this.plane ? clonePlane(this.plane) : undefined;
  }

  private dropAcknowledged(ackSeq: number): void {
    let count = 0;
    while ((this.pending[count]?.seq ?? Number.POSITIVE_INFINITY) <= ackSeq) {
      count += 1;
    }
    if (count > 0) {
      this.pending.splice(0, count);
    }
  }

  private step(input: InputCommand): void {
    if (!this.plane) {
      return;
    }
    const dt = 1 / this.config.SIM_HZ;
    stepPlane(this.plane, input, dt, this.config);
    if (input.fire && this.bullets.length < this.config.MAX_BULLETS) {
      const bullet = tryFireBullet(
        this.plane,
        this.slot,
        this.nextPredictedBulletId,
        this.config,
      );
      if (bullet) {
        this.nextPredictedBulletId -= 1;
        this.bullets.push(bullet);
      }
    }
    stepBullets(this.bullets, dt, this.config);
  }
}

function isActive(phase: MatchState['phase'] | undefined): boolean {
  return phase === MATCH_PHASE.Playing || phase === MATCH_PHASE.SuddenDeath;
}

function cloneInput(input: InputCommand): InputCommand {
  return { ...input };
}

function clonePlane(plane: PlaneState): PlaneState {
  return {
    ...plane,
    pos: [...plane.pos],
    vel: [...plane.vel],
    rot: [...plane.rot],
    stumbleAngularVelocity: [...plane.stumbleAngularVelocity],
  };
}

function cloneBullet(bullet: BulletState): BulletState {
  return {
    ...bullet,
    previousPos: [...bullet.previousPos],
    pos: [...bullet.pos],
    vel: [...bullet.vel],
  };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(value: Vec3, amount: number): Vec3 {
  return [value[0] * amount, value[1] * amount, value[2] * amount];
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
