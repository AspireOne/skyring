import {
  type ClientMessage,
  type QueueMode,
  type ServerMessage,
} from './messages.js';

import type { InputCommand } from './types.js';

/**
 * Single seam between in-memory messages and the wire (IMPLEMENTATION §5.4).
 * JSON today; swapping to a binary encoder means touching only this file.
 *
 * The server trusts *nothing* from a client, so {@link parseClientMessage}
 * fully validates structure and finiteness at the boundary (IMPLEMENTATION
 * §7.4, TESTING §7). The client is more trusting of the server it chose to
 * connect to, but still guards against malformed frames.
 */
export const PROTOCOL_VERSION = 1;

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const QUEUE_MODES: readonly QueueMode[] = ['quick', 'room'];

function isQueueMode(value: unknown): value is QueueMode {
  return typeof value === 'string' && QUEUE_MODES.includes(value as QueueMode);
}

/** Room codes: short, printable, case-insensitive identifiers. */
export function normalizeRoomCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const code = value.trim().toUpperCase();
  if (code.length < 1 || code.length > 16 || !/^[A-Z0-9-]+$/.test(code)) {
    return undefined;
  }

  return code;
}

function parseInputCommand(value: unknown): InputCommand | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { seq, tick, throttle, pitch, roll, yaw, fire } = value;
  if (
    !isFiniteNumber(seq) ||
    !isFiniteNumber(tick) ||
    !isFiniteNumber(throttle) ||
    !isFiniteNumber(pitch) ||
    !isFiniteNumber(roll) ||
    !isFiniteNumber(yaw) ||
    typeof fire !== 'boolean'
  ) {
    return undefined;
  }

  return { seq, tick, throttle, pitch, roll, yaw, fire };
}

/**
 * Parse and validate a raw frame sent by a client. Returns `undefined` for any
 * malformed, unknown, or non-finite payload; the caller ignores those.
 */
export function parseClientMessage(raw: string): ClientMessage | undefined {
  const value = parseJson(raw);
  if (!isRecord(value)) {
    return undefined;
  }

  switch (value.t) {
    case 'hello':
      return isFiniteNumber(value.version)
        ? { t: 'hello', version: value.version }
        : undefined;

    case 'queue': {
      if (!isQueueMode(value.mode)) {
        return undefined;
      }
      if (value.mode === 'room') {
        const room = normalizeRoomCode(value.room);
        return room === undefined
          ? undefined
          : { t: 'queue', mode: 'room', room };
      }
      return { t: 'queue', mode: 'quick' };
    }

    case 'input': {
      const input = parseInputCommand(value.input);
      return input === undefined ? undefined : { t: 'input', input };
    }

    case 'ping':
      return isFiniteNumber(value.clientTime)
        ? { t: 'ping', clientTime: value.clientTime }
        : undefined;

    case 'leave':
      return { t: 'leave' };

    default:
      return undefined;
  }
}

function clampAxis(value: number): number {
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

/**
 * Clamp a validated input's control axes into `[-1, 1]` (IMPLEMENTATION §7.4).
 * Parsing already guaranteed finiteness; this bounds magnitude so a client can
 * never request super-normal control authority.
 */
export function clampInputCommand(input: InputCommand): InputCommand {
  return {
    seq: input.seq,
    tick: input.tick,
    throttle: clampAxis(input.throttle),
    pitch: clampAxis(input.pitch),
    roll: clampAxis(input.roll),
    yaw: clampAxis(input.yaw),
    fire: input.fire,
  };
}

/**
 * Parse a raw frame sent by the server. The client validates the tag is known
 * and the frame is an object; deeper trust is acceptable since the server is
 * authoritative and chosen by the client.
 */
export function parseServerMessage(raw: string): ServerMessage | undefined {
  const value = parseJson(raw);
  if (!isRecord(value) || typeof value.t !== 'string') {
    return undefined;
  }

  const known: readonly string[] = [
    'welcome',
    'pong',
    'queued',
    'matchFound',
    'snapshot',
    'event',
    'matchEnd',
    'rejected',
  ];

  return known.includes(value.t)
    ? (value as unknown as ServerMessage)
    : undefined;
}
