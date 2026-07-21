# SkyRing Implementation Progress

This is the durable handoff for long-running implementation work. Update it when a
milestone, verification result, decision, known issue, or next action changes.

## Current position

- **Active milestone:** Milestone 3 — authoritative flight, boundaries, and remote
  interpolation.
- **Current objective:** implement `stepPlane` + arena boundaries in `shared`; server
  simulates both planes from real input; client renders the local plane from snapshots
  (no prediction yet) and the remote plane interpolated.
- **Governing decisions:** `DECISIONS.md` D001–D011.

## Milestones

- [x] 1. Monorepo skeleton and verification toolchain
- [x] 2. Connect, handshake, clock sync, and matchmaking
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

Milestone 2 verified on 2026-07-21 with Node 24.15.0 and pnpm 11.15.1:

- `pnpm verify` — passed: typecheck (project refs + tests), ESLint, Knip, 73 unit tests,
  production build.
- `pnpm test:integration` — passed (12 tests): real ephemeral HTTP/WebSocket server
  covering handshake/welcome, version rejection, ping/pong, quick-queue and room-code
  pairing with isolation, snapshot streaming, and disconnect teardown/cleanup.
- `pnpm test:e2e` — passed in Playwright Chromium: production client renders WebGL,
  connects to the real server, and reaches the `queued` matchmaking state with no
  console errors.

### What Milestone 2 added

- **shared:** `protocol.ts` (versioned JSON codec + boundary validation + input
  clamping), `messages.ts` (full C→S / S→C catalog and gameplay-event union), `rng.ts`
  (seeded mulberry32), `math.ts` (Y-up conventions; nose = local **-Z**), and
  `sim/state.ts` (`createInitialMatchState`). Added `SPAWN_SEPARATION` tunable.
- **server:** `Connection` (transport + boundary parse), `TickScheduler`
  (drift-corrected fixed clock with catch-up clamp), `Match` (per-match tick loop,
  input buffering + ack, snapshot cadence, disconnect lifecycle), `Matchmaker` (quick
  queue + room codes), and a rewired `server.ts` with hello/ping routing and test seams
  (`config`/`now`/`nextSeed` injection, `stats()`).
- **client:** `net/clock-sync.ts` (NTP-lite), `net/net-client.ts` (socket lifecycle,
  handshake, queueing, clock sync, snapshot capture — fully injectable for tests),
  `config.ts` (server URL + room from query), and a `main.ts` that connects and shows
  matchmaking status while keeping the cube smoke scene.

### Notes / deviations

- The `Match.step()` loop currently only advances `tick` and broadcasts snapshots; the
  authoritative `stepMatch` (flight/ring/gun/lifecycle) lands across Milestones 3–5. The
  input buffer and `ackSeq` plumbing already exist so those milestones slot in cleanly.
- Client clock-sync cadence constants are local to `net-client.ts` (they never cross the
  wire or affect authority), rather than in the shared match config.
- `SPAWN_SEPARATION` (250) was added to `constants.ts` so spawn geometry is a tunable,
  not a magic number.

## Known issues / limitations

- No authoritative physics yet: planes sit at their spawn transforms and the ring/score
  do not change. Flight begins in Milestone 3.
- No client-side prediction yet (deferred to Milestone 5); Milestone 3 renders the local
  plane straight from snapshots and accepts input lag by design.
- Production assets are intentionally deferred until the renderer has a stable transform
  boundary in Milestone 6.

## Next action

Milestone 3: implement `sim/plane.ts` (`stepPlane`: throttle, control torque, velocity
alignment, integration) and `sim/collision.ts` boundaries (dome + ground bounce), compose
them in a `stepMatch` invoked by `Match.step()`, feed real client input into the sim, and
build the client render loop (chase camera, local plane from snapshots, remote plane
interpolated). Add flight/boundary invariant tests, interpolation tests, and a two-browser
flight smoke journey.
