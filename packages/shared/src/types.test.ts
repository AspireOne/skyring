import { describe, expect, it } from 'vitest';

import { MATCH_PHASE } from './types.js';

describe('match phase contract', () => {
  it('uses stable frozen wire-friendly values', () => {
    expect(MATCH_PHASE).toEqual({
      Waiting: 'waiting',
      Countdown: 'countdown',
      Playing: 'playing',
      SuddenDeath: 'suddenDeath',
      Ended: 'ended',
    });
    expect(Object.isFrozen(MATCH_PHASE)).toBe(true);
  });
});
