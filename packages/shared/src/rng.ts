/**
 * Deterministic, seedable RNG shared by server (authoritative) and tests.
 *
 * Uses the small, well-distributed `mulberry32` generator. The sim only ever
 * draws randomness through an injected `Rng`, so a match is fully reproducible
 * from its seed (ARCHITECTURE §3.1; TESTING §6.5).
 */
export interface Rng {
  /** Next float in [0, 1). */
  next: () => number;
  /** Float in [min, max). */
  range: (min: number, max: number) => number;
  /** Current internal state, so a match can be snapshotted/replayed. */
  getState: () => number;
}

const UINT32 = 0x1_00_00_00_00;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    getState: () => state,
  };
}
