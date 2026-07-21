import { describe, expect, it } from 'vitest';

import {
  clampInputCommand,
  encode,
  normalizeRoomCode,
  parseClientMessage,
  parseServerMessage,
  PROTOCOL_VERSION,
} from './protocol.js';

import type { ClientMessage } from './messages.js';
import type { InputCommand } from './types.js';

const sampleInput: InputCommand = {
  seq: 7,
  tick: 42,
  throttle: 0.5,
  pitch: -0.25,
  roll: 1,
  yaw: 0,
  fire: true,
};

describe('parseClientMessage — round trips', () => {
  const cases: ClientMessage[] = [
    { t: 'hello', version: PROTOCOL_VERSION },
    { t: 'queue', mode: 'quick' },
    { t: 'queue', mode: 'room', room: 'ABC-1' },
    { t: 'input', input: sampleInput },
    { t: 'ping', clientTime: 1234.5 },
    { t: 'leave' },
  ];

  for (const message of cases) {
    it(`round-trips ${message.t}`, () => {
      expect(parseClientMessage(encode(message))).toEqual(message);
    });
  }
});

describe('parseClientMessage — rejection', () => {
  it('rejects malformed JSON', () => {
    expect(parseClientMessage('{not json')).toBeUndefined();
  });

  it('rejects non-object frames', () => {
    expect(parseClientMessage('42')).toBeUndefined();
    expect(parseClientMessage('null')).toBeUndefined();
    expect(parseClientMessage('[1,2,3]')).toBeUndefined();
  });

  it('rejects unknown tags', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'wat' }))).toBeUndefined();
    expect(parseClientMessage(JSON.stringify({}))).toBeUndefined();
  });

  it('rejects a hello with a non-finite version', () => {
    expect(
      parseClientMessage(JSON.stringify({ t: 'hello', version: 'x' })),
    ).toBeUndefined();
    expect(
      parseClientMessage(JSON.stringify({ t: 'hello', version: Infinity })),
    ).toBeUndefined();
  });

  it('rejects a queue with an invalid mode or missing room', () => {
    expect(
      parseClientMessage(JSON.stringify({ t: 'queue', mode: 'solo' })),
    ).toBeUndefined();
    expect(
      parseClientMessage(JSON.stringify({ t: 'queue', mode: 'room' })),
    ).toBeUndefined();
    expect(
      parseClientMessage(
        JSON.stringify({ t: 'queue', mode: 'room', room: '!!' }),
      ),
    ).toBeUndefined();
  });

  it('rejects an input with non-finite or wrong-typed fields', () => {
    for (const bad of [
      { ...sampleInput, throttle: Number.NaN },
      { ...sampleInput, seq: '1' },
      { ...sampleInput, fire: 'yes' },
    ]) {
      expect(
        parseClientMessage(JSON.stringify({ t: 'input', input: bad })),
      ).toBeUndefined();
    }
  });

  it('rejects a ping with a non-finite clientTime', () => {
    expect(
      parseClientMessage(JSON.stringify({ t: 'ping', clientTime: 'now' })),
    ).toBeUndefined();
  });
});

describe('normalizeRoomCode', () => {
  it('uppercases and trims valid codes', () => {
    expect(normalizeRoomCode('  abc-1 ')).toBe('ABC-1');
  });

  it('rejects empty, oversized, or illegal codes', () => {
    expect(normalizeRoomCode('')).toBeUndefined();
    expect(normalizeRoomCode('x'.repeat(17))).toBeUndefined();
    expect(normalizeRoomCode('a b')).toBeUndefined();
    expect(normalizeRoomCode(42)).toBeUndefined();
  });
});

describe('clampInputCommand', () => {
  it('bounds control axes into [-1, 1] without touching seq/tick/fire', () => {
    const clamped = clampInputCommand({
      seq: 3,
      tick: 9,
      throttle: 5,
      pitch: -9,
      roll: 0.4,
      yaw: -0.2,
      fire: true,
    });
    expect(clamped).toEqual({
      seq: 3,
      tick: 9,
      throttle: 1,
      pitch: -1,
      roll: 0.4,
      yaw: -0.2,
      fire: true,
    });
  });
});

describe('parseServerMessage', () => {
  it('accepts known tags and rejects unknown/malformed frames', () => {
    expect(
      parseServerMessage(
        JSON.stringify({ t: 'pong', clientTime: 1, serverTime: 2 }),
      ),
    ).toMatchObject({ t: 'pong' });
    expect(parseServerMessage(JSON.stringify({ t: 'nope' }))).toBeUndefined();
    expect(parseServerMessage('garbage')).toBeUndefined();
  });
});
