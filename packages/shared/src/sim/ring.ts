import { type GameConfig, secondsToTicks } from '../constants.js';
import { type MatchState, type PlayerSlot, type Vec3 } from '../types.js';

import type { GameEvent } from '../messages.js';
import type { Rng } from '../rng.js';

const MAX_PICK_TRIES = 64;

/**
 * Ring dwell → warning → teleport (GAME.md §4). The ring holds still, then a
 * few seconds before it moves it enters `warning` and reveals `nextCenter`
 * exactly once; at zero it teleports there. Mutates in place and emits a
 * `ringTeleport` event on the move.
 */
export function stepRing(
  state: MatchState,
  config: GameConfig,
  rng: Rng,
  events: GameEvent[],
): void {
  const ring = state.ring;
  const warningTicks = secondsToTicks(config.RING_WARNING, config.SIM_HZ);

  ring.teleportTicksRemaining -= 1;

  if (!ring.warning && ring.teleportTicksRemaining <= warningTicks) {
    ring.warning = true;
    ring.nextCenter = pickRingCenter(ring.center, ring.radius, config, rng);
  }

  if (ring.teleportTicksRemaining <= 0) {
    ring.center =
      ring.nextCenter ?? pickRingCenter(ring.center, ring.radius, config, rng);
    ring.teleportTicksRemaining = secondsToTicks(
      config.RING_DWELL,
      config.SIM_HZ,
    );
    ring.warning = false;
    ring.nextCenter = null;
    events.push({
      kind: 'ringTeleport',
      center: [...ring.center],
      radius: ring.radius,
    });
  }
}

/**
 * Tug-of-war scoring (GAME.md §4, §4.1). Solo occupant scores; if both are
 * inside, whoever hugs the center scores unless they are within the tie
 * epsilon (then nobody). Accrues `RING_POINTS_PER_SEC * dt` to at most one
 * player and sets each plane's `inRing`/`scoring` flags. Returns the scorer.
 */
export function resolveScoring(
  state: MatchState,
  config: GameConfig,
  dt: number,
): PlayerSlot | null {
  const { a, b } = state.planes;
  const center = state.ring.center;
  const dA = distance(a.pos, center);
  const dB = distance(b.pos, center);
  const inA = dA < state.ring.radius;
  const inB = dB < state.ring.radius;
  a.inRing = inA;
  b.inRing = inB;

  let scorer: PlayerSlot | null = null;
  if (inA && inB) {
    if (Math.abs(dA - dB) > config.RING_CENTER_TIE_EPS) {
      scorer = dA < dB ? 'a' : 'b';
    }
  } else if (inA) {
    scorer = 'a';
  } else if (inB) {
    scorer = 'b';
  }

  a.scoring = scorer === 'a';
  b.scoring = scorer === 'b';
  if (scorer !== null) {
    state.scores[scorer] += config.RING_POINTS_PER_SEC * dt;
  }
  return scorer;
}

/** Relocate + shrink the ring for sudden death (GAME.md §8). */
export function relocateForSuddenDeath(
  state: MatchState,
  config: GameConfig,
  rng: Rng,
  events: GameEvent[],
): void {
  const ring = state.ring;
  ring.radius = config.SUDDEN_DEATH_RING_RADIUS;
  ring.center = pickRingCenter(ring.center, ring.radius, config, rng);
  ring.teleportTicksRemaining = secondsToTicks(
    config.RING_DWELL,
    config.SIM_HZ,
  );
  ring.warning = false;
  ring.nextCenter = null;
  events.push({
    kind: 'ringTeleport',
    center: [...ring.center],
    radius: ring.radius,
  });
}

/**
 * Choose a new ring center whose whole sphere fits inside the dome and above
 * the ground, ideally at least `RING_MIN_TELEPORT_DIST` from the current
 * center. Rejection-samples with a bounded budget and always terminates: if no
 * sample clears the distance rule, it returns the farthest valid-in-dome
 * candidate seen (GAME.md §4, TESTING §6.3).
 */
export function pickRingCenter(
  current: Vec3,
  radius: number,
  config: GameConfig,
  rng: Rng,
): Vec3 {
  const maxCenterDist = config.DOME_RADIUS - radius;
  const minY = config.GROUND_Y + radius;
  let best: Vec3 = current;
  let bestDist = -1;

  for (let i = 0; i < MAX_PICK_TRIES; i += 1) {
    const x = rng.range(-maxCenterDist, maxCenterDist);
    const y = rng.range(minY, maxCenterDist);
    const z = rng.range(-maxCenterDist, maxCenterDist);
    if (Math.hypot(x, y, z) > maxCenterDist) {
      continue; // outside the dome
    }
    const candidate: Vec3 = [x, y, z];
    const moved = distance(candidate, current);
    if (moved >= config.RING_MIN_TELEPORT_DIST) {
      return candidate;
    }
    if (moved > bestDist) {
      bestDist = moved;
      best = candidate;
    }
  }
  return best;
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
