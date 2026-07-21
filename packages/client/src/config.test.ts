import { describe, expect, it } from 'vitest';

import { queueRequestFromLocation } from './config.js';

describe('queueRequestFromLocation', () => {
  it('defaults to the quick queue with no room param', () => {
    expect(queueRequestFromLocation('')).toEqual({ mode: 'quick' });
    expect(queueRequestFromLocation('?foo=bar')).toEqual({ mode: 'quick' });
  });

  it('reads and normalizes a room code', () => {
    expect(queueRequestFromLocation('?room=alpha')).toEqual({
      mode: 'room',
      room: 'ALPHA',
    });
  });

  it('falls back to quick queue for an invalid room code', () => {
    expect(
      queueRequestFromLocation('?room=' + encodeURIComponent('a b')),
    ).toEqual({
      mode: 'quick',
    });
  });
});
