# SkyRing Implementation Progress

This is the durable handoff for long-running implementation work. Update it when a
milestone, verification result, decision, known issue, or next action changes.

## Current position

- **Active milestone:** Milestone 6 acceptance — implementation and all locally
  executable evidence are complete; the required human full-match session remains open.
- **Milestone 5 is complete and verified.** Milestone 6 now has production models/audio,
  effects, responsive HUD, lifecycle/ring browser journeys, asset checks, and consolidated
  traceability.
- **Governing decisions:** `DECISIONS.md` D001–D011.

## Milestones

- [x] 1. Monorepo skeleton and verification toolchain
- [x] 2. Connect, handshake, clock sync, and matchmaking
- [x] 3. Authoritative flight, boundaries, and remote interpolation
- [x] 4. Ring, scoring, HUD, and match lifecycle
- [x] 5. Gun, knockback, stumble, prediction, and reconciliation
- [ ] 6. Models, effects, audio, readability, and tuning (human acceptance pending)
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

Milestone 6 automated gates passed on 2026-07-21 with Node 24.15.0 and pnpm 11.15.1:

- `pnpm verify` — passed: typecheck, ESLint, Knip, 154 unit tests, 2 asset tests,
  2 requirement-matrix tests, and production client/server build.
- `pnpm test:integration` — passed (18 tests).
- `pnpm test:network` — passed (1 deterministic adversity test).
- `pnpm test:e2e` — passed (7 Chromium journeys): solo production smoke, two-browser
  flight, deterministic combat, compact/desktop layout, regulation win, tie → sudden
  death → first score, and ring warning → teleport. All new M6 journeys assert clean
  browser consoles and network requests.
- `pnpm format:check` — passed. `pnpm knip` is clean with the test-only E2E server entry
  documented explicitly.

### What Milestone 6 added

- **content:** two normalized, visually distinct CC BY 3.0 aircraft from Poly Pizza and
  three CC0 Kenney cues, with distributable attribution in
  `packages/client/public/assets/CREDITS.md` and binary/weight/license validation.
- **presentation:** brighter arena lighting, aircraft identity colors, fire/hit/bounce/
  stumble/teleport bursts, predicted tracers, and Web Audio playback that fetches/decodes
  each clip once while supporting bounded overlapping one-shots.
- **readability:** semantic live status/meter/result HUD elements, compact 360×640 layout,
  desktop layout evidence, and an accessible arena label. Initial visual review found the
  arena too dark; the palette/lighting was raised before accepting the automated lane.
- **deterministic browser scenarios:** a separately compiled test-only server entry uses
  the existing server-owned initial-state seam keyed by isolated room prefixes. Production
  construction does not provide this hook. This closes the inherited win/tie journey gap.
- **traceability:** `tests/REQUIREMENTS.md` consolidates rule, architecture, and human-only
  acceptance IDs; a validator prevents automated rows from losing executable test paths.
  Added exact teleport-occupancy and boundary-ricochet-into-ring regressions.
- **feel record:** `PLAYTEST.md` records the presentation review, defects/tuning decisions,
  and the exact human protocol. Defaults remain unchanged because automation cannot supply
  evidence about humor, comfort, or the four-minute rhythm.

Milestone 5 verified on 2026-07-21 with Node 24.15.0 and pnpm 11.15.1:

- `pnpm verify` — passed: typecheck, ESLint, Knip, 150 unit tests, production build.
- `pnpm test:integration` — passed (18 tests), including authoritative mutual combat over
  real WebSockets with input acknowledgement, ammo use, hit impulses, and stumble.
- `pnpm test:network` — passed (1 deterministic latency/jitter/25-tick-stall matrix):
  prediction stayed finite/responsive, buffers remained bounded, and final ack converged.
- `pnpm test:e2e` — passed (3 Chromium journeys): solo connect/queue, two-browser flight,
  and deterministic two-browser combat demonstrating predicted tracers, authoritative
  hit/stumble feedback, ammo spend, and regeneration without browser console errors.

### What Milestone 5 added

- **shared sim:** `sim/bullet.ts` owns projectile spawn/travel/expiry and atomic firing
  consequences (ammo, cooldown, recoil). `stepPlane` owns weapon upkeep. Swept
  projectile→opponent collision applies seeded authoritative impulse/stumble, consumes
  once, and gathers hits before consequences so simultaneous mutual hits are symmetric.
  Match-owned monotonic bullet ids plus `MAX_BULLETS` keep projectile state unique/bounded.
- **client netcode:** `net/local-prediction.ts` predicts only the local plane and its own
  recoil/tracers through shared sim helpers. It retains a bounded unacked input ring,
  rebuilds from each recipient-specific `ackSeq` snapshot, replays the remainder in order,
  eases corrections below `PREDICTION_SNAP_DISTANCE`, and snaps large corrections.
  Remote planes/projectiles remain authoritative and interpolated.
- **presentation:** authoritative ammo HUD/energy bar, visible per-player tracers, predicted
  muzzle bursts, hit/bounce bursts, and read-only combat diagnostics for browser evidence.
- **verification:** projectile/fire/collision/scoring-tick examples; full reconciliation and
  smoothing suite; real-WebSocket mutual combat; explicit `test:network` fault lane; and a
  two-context Playwright combat journey isolated by room code.

### Milestone 4 verification (prior)

Milestone 4 passed 128 unit, 17 integration, and 2 Playwright tests on 2026-07-21.

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
`GAME-9-DISCONNECT` (integration), `GAME-5-MUTUAL-HIT` (unit + integration),
`GAME-9-KNOCKED-INTO-RING`, `GAME-9-SHOOT-WHILE-STUMBLING`, `GAME-9-OUT-OF-AMMO`, and
`IMPL-4.4-RECONCILIATION`. IDs are currently expressed as test-name prefixes; a
consolidated traceability matrix file is still TODO (clear in Milestone 6).

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

### Historical Milestone 2 notes / deviations

- The initial `Match.step()` loop only advanced `tick` and broadcast snapshots; the full
  authoritative flight/ring/gun/lifecycle composition landed across Milestones 3–5.
- Client clock-sync cadence constants are local to `net-client.ts` (they never cross the
  wire or affect authority), rather than in the shared match config.
- `SPAWN_SEPARATION` (250) was added to `constants.ts` so spawn geometry is a tunable,
  not a magic number.

## Known issues / limitations

- **Human acceptance is still required.** `PLAYTEST.md` deliberately distinguishes the
  completed automated/visual inspection from the human-only M6 judgments. A person must
  play a full default four-minute match before Milestone 6 can be marked complete.
- **Shipping has external gates.** Milestone 7 still needs a chosen deployment target and
  credentials plus a two-person real-internet 1v1. These cannot be truthfully replaced by
  local automation; local deploy, soak, network, performance, and production-smoke work
  can proceed meanwhile.

## Next action

Checkpoint the complete M6 implementation, then build all locally executable Milestone 7
release evidence (deployment artifacts, soak/network matrix, performance budgets, and
production smoke). Record a real human full-match session and real-internet 1v1 before
marking M6/M7 complete or calling the game shipped.

---

## Agent handoff — starting Milestone 6

Milestones 1–5 are complete and verified. The next vertical slice is content/juice and
readability, not new authority: keep all model geometry/audio/effects presentation-only.
Use permissively licensed glTF planes with `public/assets/CREDITS.md` and automated asset
validation; add event-driven sound/teleport/stumble feedback; make the HUD robust at the
supported viewport matrix; and tune only through `shared/constants.ts`.

Two inherited acceptance gaps must close in M6: dedicated browser win/tie→sudden-death
journeys via a short deterministic test server, and a consolidated traceability matrix.
Finish with asset/license checks, browser console/network cleanliness, responsive layout
checks, and a recorded structured playtest. Then commit M6 green before starting ship work.

### Historical Milestone 5 implementation plan (completed)

The plan below was the source handoff for Milestone 5 and is retained as implementation
history. Its items are complete; the current state and verification counts are above.

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
