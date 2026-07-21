import { describe, expect, it } from 'vitest';

import { readHost, readPort } from './env.js';

describe('server environment', () => {
  it('provides safe local defaults', () => {
    expect(readPort(undefined)).toBe(8080);
    expect(readHost(undefined)).toBe('127.0.0.1');
  });

  it('accepts explicit bind settings', () => {
    expect(readPort('0')).toBe(0);
    expect(readPort('4174')).toBe(4174);
    expect(readHost('0.0.0.0')).toBe('0.0.0.0');
  });

  it.each(['-1', '65536', '3.5', 'not-a-port'])(
    'rejects invalid port %s',
    (value) => {
      expect(() => readPort(value)).toThrow(RangeError);
    },
  );
});
