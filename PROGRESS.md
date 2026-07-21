# SkyRing Implementation Progress

This is the durable handoff for long-running implementation work. Update it when a
milestone, verification result, decision, known issue, or next action changes.

## Current position

- **Active milestone:** Milestone 5 — gun, knockback, stumble, prediction, reconciliation.
- **Milestone 4 is complete and verified** (ring, scoring, HUD, full lifecycle). One M4
  polish item is intentionally deferred to a browser pass: a _dedicated_ win/tie result
  browser journey (see Known issues). Win/tie/sudden-death are fully covered at the unit
  and real-WebSocket integration layers today.
- **Governing decisions:** `DECISIONS.md` D001–D011.

## Milestones

- [x] 1. Monorepo skeleton and verification toolchain
- [x] 2. Connect, handshake, clock sync, and matchmaking
- [x] 3. Authoritative flight, boundaries, and remote interpolation
- [x] 4. Ring, scoring, HUD, and match lifecycle
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

Milestone 4 verified on 2026-07-21 with Node 24.15.0 and pnpm 11.15.1:

- `pnpm verify` — passed: typecheck, ESLint, Knip, 128 unit tests, production build.
- `pnpm test:integration` — passed (17 tests): matchmaking + flight, plus lifecycle over
  the wire — regulation win/lose at time-up, tie → sudden-death phase, and sudden-death
  ends on the first point — all via the test-only prescribed-scenario hook.
- `pnpm test:e2e` — passed (2 journeys): solo connect/queue, and the two-browser flight
  journey now also asserting the HUD (timer + score) renders from authoritative state.

### What Milestone 4 added

- **shared sim:** `sim/ring.ts` — `stepRing` (dwell → warning reveals `nextCenter` once →
  teleport, seeded target selection that fits the dome/ground and terminates),
  `resolveScoring` (tug-of-war: solo scorer; both-inside closer-to-center wins; tie
  epsilon → nobody; sets `inRing`/`scoring`; accrues `RING_POINTS_PER_SEC*dt`),
  `relocateForSuddenDeath`. `stepMatch` now runs ring+scoring after collisions and drives
  the regulation clock → time-up winner / tie → sudden death → first-point win (D007).
- **server:** `Match` detects the sim reaching `Ended`, broadcasts a final snapshot, and
  sends `matchEnd` with the correct per-slot result and reason (`time`/`suddenDeath`),
  inferring the reason from the pre-step phase. Added a **test-only** `createInitialState`
  injection (threaded server → matchmaker → match; absent in production — D011/TESTING §9).
- **client:** `hud/hud-model.ts` (pure projection: scores, m:ss clock, ring status,
  warning, countdown, sudden death), `hud/hud.ts` (scoreboard, ring pill, warning banner,
  result overlay — all `data-testid`'d), ring visual in `render/renderer.ts` (scaled
  translucent sphere + wireframe bands + next-location marker, tinted by contest state),
  and game-controller wiring (HUD + ring update each frame from the latest snapshot;
  result screen on `matchEnd`).

### Requirement IDs covered by tests so far

`GAME-4-SOLO-SCORING`, `GAME-4-NEITHER`, `GAME-4.1-CLOSER`, `GAME-4.1-CENTER-TIE` (below/
at/above epsilon), `GAME-9-KNOCK-OUT`, ring dwell/warning/teleport, `pickRingCenter`
termination, `GAME-3` regulation win/lose (unit + integration), `GAME-8-SUDDEN-DEATH`
(enter on tie + first-point end + dead-center-tie-does-not-end; unit + integration),
`GAME-9-DISCONNECT` (integration). IDs are currently expressed as test-name prefixes; a
consolidated traceability matrix file is still TODO (see Known issues).

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

- **No gun/knockback/stumble-from-hits yet (Milestone 5).** `stepPlane` already integrates
  authoritative stumble state and `PlaneState` carries `ammo`/`fireCooldownTicks`, so the
  gun slots into the existing per-tick order and snapshot shape cleanly.
- **No client-side prediction yet (deferred to Milestone 5).** The local plane renders
  from interpolated authoritative snapshots and lags input by ~`INTERP_DELAY_MS` + latency
  by design. `NetClient` already assigns monotonic input `seq` and the server acks via
  `snapshot.ackSeq`, so prediction/reconciliation has the plumbing it needs.
- **Dedicated win/tie _browser_ journey is TODO** (TESTING §9 journey 5). Win/tie/
  sudden-death are covered deterministically at the unit and real-WebSocket integration
  layers; a browser version needs a short-match server (e.g. env-configurable
  `MATCH_DURATION`/`COUNTDOWN`, or reuse the `createInitialState` seam via a test-only
  server entry) to finish quickly.
- **Traceability matrix file is TODO.** Requirement IDs currently live as test-name
  prefixes (grep-able); TESTING §3 wants a consolidated matrix. Low effort, do during M6.
- HUD ammo meter not shown yet (ammo is static/full until M5).
- Production glTF assets deferred to Milestone 6; planes are placeholder dart primitives.

## Next action

Milestone 5 — gun, knockback, stumble, prediction, reconciliation. See the detailed
handoff at the bottom of this file (added for the agent transition).

---

## Agent handoff — starting Milestone 5

Milestones 1–4 are complete, verified, and committed. The repo is green:
`pnpm verify` (128 unit), `pnpm test:integration` (17), `pnpm test:e2e` (2). Work through
the remaining milestones (5, 6, 7) in order per `IMPLEMENTATION.md` §16 and `TESTING.md`
§13, committing per milestone with a passing verify + the milestone's integration/browser
gates. Keep this file updated as you go.

### Architecture you're inheriting (read these first)

- Shared sim is pure and mutates state in place. Per-tick order in
  `packages/shared/src/sim/match.ts` `stepMatch`: movement (`stepPlane`) → collision
  (`resolvePlaneBoundaries`, `resolvePlanePlane`) → ring (`stepRing`) → scoring
  (`resolveScoring`) → regulation clock. All randomness flows through the injected seeded
  `Rng`. `dt`, `config`, `rng`, and an `events: GameEvent[]` collector arrive via
  `StepContext`.
- `stepPlane(plane, input, dt, config)` is deliberately callable in isolation — that is
  exactly what client prediction needs. Nose = local **-Z** (`math.ts`). Stumble is
  authoritative state (`stumbleTicksRemaining` + `stumbleAngularVelocity`) and already
  integrated by `stepPlane`.
- Server: `Match` (fixed-tick loop separated from `TickScheduler`; `step()` advances one
  tick; broadcasts snapshots at `SNAPSHOT_HZ` and `event` batches; tracks per-player
  `lastProcessedSeq` → `snapshot.ackSeq`). `Matchmaker` (quick + room). `createSkyRingServer`
  options: `config`, `now`, `nextSeed`, `createInitialState` (all test seams; the last is
  test-only, absent in prod).
- Client: `NetClient` owns the wire (handshake, queue, clock sync, snapshot buffer,
  `sendInput` with monotonic seq, `renderView()`), `SnapshotBuffer` interpolates,
  `Renderer` draws arena+planes+ring with a chase camera, `Hud`/`hud-model.ts` project
  authoritative state, `GameController` runs the render loop + fixed-rate input loop.
- Tests: unit beside modules; `tests/support/` builders (`sim-builders.ts`,
  `test-client.ts`, `fake-socket.ts`); `tests/integration/` real-ws; `tests/e2e/`
  Playwright (two contexts, isolate with `?room=CODE` to avoid cross-pairing in parallel).

### Milestone 5 — concrete plan (gun, knockback, prediction)

Shared sim (all with example + invariant tests, mapped to requirement IDs):

1. `sim/bullet.ts` — `spawnBullet(plane, owner, config)` at the muzzle along the nose;
   `stepBullets(state, dt, config)` retains `previousPos`, integrates, decrements
   `lifetimeTicksRemaining`, and expires on lifetime OR ground/dome contact (D003, D008 —
   projectiles do NOT bounce). Give bullets unique ids (add an id counter to `MatchState`
   or derive from tick+owner; keep ids unique — TESTING §6.5). Cap `bullets.length` for
   safety.
2. Firing in `stepMatch` right after movement, before collision (per §5.3 step 2): if
   `ammo >= AMMO_PER_SHOT && fireCooldownTicks <= 0 && stumbleTicksRemaining === 0 &&
input.fire` → spawn bullet, apply `RECOIL_IMPULSE` to the shooter's `vel` (backward),
   spend ammo, set `fireCooldownTicks`. Regenerate ammo each tick toward `AMMO_MAX`
   (`AMMO_REGEN_PER_SEC`), and decrement `fireCooldownTicks`. Decide where ammo regen /
   cooldown live — cleanest is inside `stepPlane` (it already owns per-tick plane upkeep);
   a stumbling plane cannot fire (`GAME.md` §9).
3. `sim/collision.ts` — add swept bullet↔opponent-plane test using `previousPos→pos`
   segment vs sphere `PLANE_HIT_RADIUS` (no tunneling at max relative speed — TESTING
   §6.2). On hit: apply `HIT_IMPULSE` along the bullet's travel dir to the victim `vel`,
   set authoritative stumble ticks + `stumbleAngularVelocity` (choose the tumble via
   `ctx.rng` — D006), consume the bullet, emit `hit` + `stumble` events. Handle
   simultaneous mutual hits symmetrically/order-independently (`GAME.md` §9, TESTING §6.2).
   A bullet must not hit its owner.
4. Add bullets to interpolation/render: render tracers (predict on fire, correct from
   snapshots), muzzle flash, hit spark, and the stumble tumble is already in the transform.
   HUD: wire the ammo/energy meter (data is already in `PlaneState.ammo`).

Client prediction + reconciliation (`net/`, IMPLEMENTATION §4.4) — this is the milestone's
core: 5. Predict ONLY the local plane (+ its bullets/recoil/stumble). Each tick: sample input,
assign seq (already done), send, AND apply locally via `stepPlane` (+ local firing).
Keep a ring buffer of unacked `{seq, input}`. 6. On each snapshot: snap the local plane to authoritative state, drop inputs
`<= ackSeq`, and re-simulate the still-unacked inputs forward. Only the local plane is
predicted; opponent/ring/score stay server-truth (interpolated/displayed). 7. Error smoothing (SHOULD): ease small corrections over a few frames; snap large ones.
Keep this in a testable pure module (feed synthetic snapshots + input history; assert
discard-once and replay order — TESTING §8). Cross-machine float determinism is NOT
required (server is authority; prediction only needs to be close).

Tests/gates for M5: projectile/collision/knockback/stumble unit + invariant tests; a
reconciliation suite (pure, no WebGL); a network-adversity lane (latency/jitter/stall via
a transport wrapper — see TESTING §10); and a deterministic two-browser combat scenario
(use the `createInitialState` seam on a test server entry, or add one). Requirement IDs to
cover: `GAME-5-MUTUAL-HIT`, `GAME-9-KNOCKED-INTO-RING`, `GAME-9-SHOOT-WHILE-STUMBLING`,
`GAME-9-OUT-OF-AMMO`, `IMPL-4.4-RECONCILIATION`.

Then Milestone 6 (glTF planes + `public/assets/CREDITS.md`, effects/audio, readability,
tune every constant vs `GAME.md` §13) and Milestone 7 (deploy, soak, prod smoke,
real-internet playtest). Also clear the "Known issues" TODOs (win/tie browser journey,
traceability matrix file) by/ during M6.

### Conventions reminder

Conventional Commits (title + body), commit per milestone in a green state, stage only
your own changes. Address all lint/knip/type warnings before finishing (auto-fix import
order with `pnpm lint --fix`). Keep the authoritative sim pure/seeded/shared; clients send
intent only; every tunable stays in `shared/constants.ts`. When reality forces a design
change, update `GAME.md`/`DECISIONS.md` (design) or `IMPLEMENTATION.md`/`DECISIONS.md`
(technical) BEFORE the code, and keep tests in lockstep.
