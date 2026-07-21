# SkyRing Implementation Progress

This is the durable handoff for long-running implementation work. Update it when a
milestone, verification result, decision, known issue, or next action changes.

## Current position

- **Active milestone:** Milestone 4 — ring, scoring, HUD, and match lifecycle.
- **Current objective:** ring dwell/teleport/warning + tug-of-war scoring in `shared`;
  HUD score + timer; full lifecycle incl. countdown, time-up winner, and sudden death.
- **Governing decisions:** `DECISIONS.md` D001–D011.

## Milestones

- [x] 1. Monorepo skeleton and verification toolchain
- [x] 2. Connect, handshake, clock sync, and matchmaking
- [x] 3. Authoritative flight, boundaries, and remote interpolation
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

Milestone 3 verified on 2026-07-21 with Node 24.15.0 and pnpm 11.15.1:

- `pnpm verify` — passed: typecheck, ESLint, Knip, 106 unit tests, production build.
- `pnpm test:integration` — passed (14 tests): matchmaking suite plus authoritative
  flight over the wire (countdown → playing transition, both planes moving, phaseChange
  event delivery, both clients agreeing on phase).
- `pnpm test:e2e` — passed (2 journeys): the solo connect/queue smoke, and a two-browser
  flight journey where both clients pair into one match, reach `playing`, and steering
  moves the local plane — with no console errors.

### What Milestone 3 added

- **shared sim:** `sim/plane.ts` (`stepPlane`: throttle → flightSpeed, body-frame control
  torque, world-frame stumble tumble, velocity alignment toward nose*speed, integration),
  `sim/collision.ts` (dome/ground/plane-plane springy bounce with restitution + separation
  and `bounce` events), `sim/match.ts` (`stepMatch` composing per-tick order + countdown→
  playing transition), and `sim/input.ts` (`NEUTRAL_INPUT`).
- **server:** `Match.step()` now runs `stepMatch` with a seeded RNG, drains real inputs
  (reusing last-known, correct ackSeq), and broadcasts `event` batches.
- **client:** `net/snapshot-buffer.ts` (interpolation/hold-latest at render time),
  `input/keyboard.ts` (pure key→axes mapping + DOM attach/blur), `render/renderer.ts`
  (arena: ground/grid/dome, placeholder dart planes, damped chase camera),
  `game/game-controller.ts` (render loop + fixed-rate input loop, status + read-only
  `window.__skyringState` diagnostic), and a thin `main.ts`. `NetClient` gained
  snapshot buffering, `sendInput`, and `renderView`.

### Controls (M3 defaults, tune in M6)

W/S throttle · ↑/↓ pitch · ←/→ roll · A/D yaw · Space fire.

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

- Ring never teleports and no scoring happens yet; regulation clock does not end the
  match (planes fly indefinitely once Playing). All of this lands in Milestone 4.
- No client-side prediction yet (deferred to Milestone 5); the local plane renders from
  interpolated authoritative snapshots and lags input by ~INTERP_DELAY + latency, by
  design for Milestone 3.
- No gun/knockback/stumble-from-hits yet (Milestone 5). `stepPlane` already integrates
  authoritative stumble state, so hits slot in cleanly.
- Production assets are intentionally deferred until the renderer has a stable transform
  boundary in Milestone 6.

## Next action

Milestone 4: implement `sim/ring.ts` (dwell → warning reveals `nextCenter` once →
teleport respecting `RING_MIN_TELEPORT_DIST` and dome/ground fit, via seeded RNG) and the
tug-of-war scoring resolution (solo scorer; both-inside closer-to-center wins; tie epsilon
→ nobody), wire them into `stepMatch` after collisions, and add the regulation-clock
decrement with time-up winner + sudden-death (relocate/shrink ring, first point wins).
Build the HUD (scores, timer, ammo placeholder, ring warning + contest state, results
screen) and the ring visual. Add the full scoring/ring/lifecycle requirement matrix and
win/tie browser journeys.
