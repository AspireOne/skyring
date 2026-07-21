import { normalizeRoomCode, type QueueMode } from '@skyring/shared';

import type { QueueRequest } from './net/net-client.js';

/** Default server port when no explicit `VITE_SERVER_URL` is provided. */
const DEFAULT_SERVER_PORT = 8080;

/**
 * WebSocket URL of the authoritative server. Prefers the build-time
 * `VITE_SERVER_URL`; otherwise derives one from the page host so a static
 * deploy talks to a server on the same host.
 */
export function serverWsUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL;
  if (configured) {
    return configured;
  }
  const { protocol, hostname } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';
  return `${wsProtocol}://${hostname}:${DEFAULT_SERVER_PORT}`;
}

/** Reads the desired matchmaking mode from `?room=CODE` (else quick queue). */
export function queueRequestFromLocation(search: string): QueueRequest {
  const params = new URLSearchParams(search);
  const room = normalizeRoomCode(params.get('room'));
  if (room !== undefined) {
    return { mode: 'room', room };
  }
  const mode: QueueMode = 'quick';
  return { mode };
}
