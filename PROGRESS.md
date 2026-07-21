# SkyRing Implementation Progress

This is the durable handoff for long-running implementation work. Update it when a
milestone, verification result, decision, known issue, or next action changes.

## Current position

- **Active milestone:** Milestone 2 — connect, handshake, clock sync, and matchmaking.
- **Current objective:** replace the foundation-only WebSocket host with the versioned
  protocol, connection lifecycle, quick queue, and room-code pairing.
- **Governing decisions:** `DECISIONS.md` D001–D011.

## Milestones

- [x] 1. Monorepo skeleton and verification toolchain
- [ ] 2. Connect, handshake, clock sync, and matchmaking
- [ ] 3. Authoritative flight, boundaries, and remote interpolation
- [ ] 4. Ring, scoring, HUD, and match lifecycle
- [ ] 5. Gun, knockback, stumble, prediction, and reconciliation
- [ ] 6. Models, effects, audio, readability, and tuning
- [ ] 7. Deployment, soak, production smoke, and real-internet playtest

## Foundation checklist

- [x] Record foundational mechanics and architecture decisions.
- [x] Persist repository-specific agent instructions.
- [x] Migrate the Vite scaffold to `packages/client` without breaking rendering.
- [x] Create `packages/shared` with immutable validated configuration and contracts.
- [x] Create `packages/server` with a start/stop seam, health check, and WebSocket host.
- [x] Configure Vitest, real-WebSocket integration tests, and Playwright smoke tests.
- [x] Establish root verification scripts and package-boundary linting.
- [x] Add a CI workflow matching the local verification lanes.
- [x] Confirm headless Chromium/WebGL works in this environment.
- [x] Run and record the complete foundation verification lane.

## Latest verification

Foundation verified on 2026-07-21 with Node 24.15.0 and pnpm 11.15.1:

- `pnpm verify` — passed: project-reference and test TypeScript checks, ESLint, Knip,
  unit tests, and the production client/server/shared build.
- `pnpm test:integration` — passed against a real ephemeral HTTP/WebSocket server.
- `pnpm test:e2e` — passed in Playwright Chromium: production client WebGL frame,
  shared config import, and server health.
- `pnpm test:coverage` — passed with 20 tests; current measured foundation coverage is
  85.86% statements, 85.93% branches, and 94.44% functions.
- `pnpm format:check` — passed.

## Known issues / limitations

- Gameplay simulation, protocol handshake, matchmaking, and client networking are not
  part of the foundation milestone; they begin in Milestone 2.
- Production assets are intentionally deferred until the renderer has a stable transform
  boundary in Milestone 6.

## Next action

Implement the shared protocol tags/types/validation and version handshake, then extend
the real-WebSocket integration suite before adding matchmaking.
