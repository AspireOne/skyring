# ✅ SkyRing — Verification Strategy

> **Purpose:** define how SkyRing earns confidence at every layer, from a pure
> simulation rule to a complete two-browser match.
>
> **Companion docs:** [`GAME.md`](./GAME.md) defines intended game behavior and
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) defines the technical invariants. This document
> defines verification. It does not override those sources: when behavior changes,
> update the governing document first and then update the affected tests.

---

## 1. Confidence Model

SkyRing needs several kinds of evidence. No single test layer is sufficient:

1. **Static correctness** catches invalid types, broken package boundaries, dead code,
   and production-build failures.
2. **Simulation tests** prove the rules at exact fixed-tick boundaries.
3. **Property and invariant tests** explore combinations no hand-written suite will
   enumerate.
4. **Protocol and server integration tests** prove authority, matchmaking, lifecycle,
   validation, and teardown over real WebSockets.
5. **Client logic tests** prove prediction, reconciliation, interpolation, clock sync,
   input mapping, and HUD projections independently of WebGL.
6. **Browser end-to-end tests** prove that two real clients can play through the actual
   built application.
7. **Network-adversity and soak tests** expose timing, buffering, cleanup, and long-run
   failures.
8. **Human playtests** judge feel, readability, comfort, and fun—qualities an assertion
   cannot establish.

Line coverage is diagnostic, not the definition of correctness. The meaningful target
is that every rule, edge case, and lifecycle transition in `GAME.md` has traceable test
evidence at the lowest practical layer, with a smaller number of tests proving that the
layers work together.

---

## 2. Testability Is an Architectural Requirement

Production code MUST provide these seams without weakening server authority:

- The simulation receives only state, inputs, a fixed `dt`, configuration, and an
  injected seeded RNG. It MUST NOT read wall-clock time or perform I/O.
- `DEFAULT_GAME_CONFIG` is the one production source of tunables. Match construction
  MAY accept a validated partial override for automated tests and explicit development
  scenarios. The effective configuration is immutable for the life of a match and is
  sent to both clients.
- Match progression is separated from scheduling. A `MatchRunner.step()`-style API
  advances exactly one tick; the production scheduler decides when to call it. Tests
  can therefore execute a four-minute match immediately.
- Server time and scheduling are injected behind a narrow interface. Lifecycle tests
  use controlled time rather than sleeping.
- Seed, effective config, initial state, and per-player input history are enough to
  replay an authoritative simulation failure.
- Client networking, interpolation, prediction, rendering, HUD, and input remain
  separated as described in `ARCHITECTURE.md`. WebGL is not required to test netcode
  or game-state projection.
- Browser scenarios use an explicitly enabled test build/server fixture. Any diagnostic
  hook is read-only on the client; authoritative scenario setup lives on the test server
  and MUST NOT be available in production.

Tests SHOULD use scenario builders such as `makePlaneState()`, `makeMatchState()`, and
`runTicks()` so each case changes only the state relevant to its assertion. Builders
belong in test support code, not the production API.

Avoid giant snapshots of the complete world state. Assert rules, transitions, events,
and invariants directly; use numeric tolerances only where the behavior is genuinely
continuous.

---

## 3. Requirements Traceability

Maintain a matrix in the test suite that maps stable requirement IDs to executable
tests. IDs use the governing document and section, followed by a short behavior name:

| Requirement ID              | Expected evidence                                          |
| --------------------------- | ---------------------------------------------------------- |
| `GAME-4-SOLO-SCORING`       | shared simulation example test                             |
| `GAME-4.1-CENTER-TIE`       | boundary examples at, below, and above the tie epsilon     |
| `GAME-5-MUTUAL-HIT`         | collision-order regression test plus integration scenario  |
| `GAME-9-KNOCKED-INTO-RING`  | exact-tick shared simulation test                          |
| `GAME-8-SUDDEN-DEATH`       | phase-machine unit test plus browser flow                  |
| `GAME-9-DISCONNECT`         | real-WebSocket integration test plus browser result screen |
| `IMPL-4.4-RECONCILIATION`   | client prediction/replay tests                             |
| `IMPL-7.4-INPUT-VALIDATION` | protocol and server adversarial tests                      |

One test can satisfy multiple requirements, and one requirement can need evidence at
multiple layers. When a rule changes, its requirement ID makes the affected tests easy
to locate. New `GAME.md` edge cases MUST gain matrix entries before their behavior is
considered verified.

---

## 4. Tools and Test Layout

### 4.1 Tools

- **Vitest**: unit, property/invariant, client logic, and Node integration tests. Use
  fake timers only around scheduling code; the simulation itself advances through
  explicit ticks.
- **Playwright**: Chromium end-to-end tests with two isolated browser contexts. Firefox
  and WebKit are compatibility lanes after the core Chromium flow is stable.
- **V8 coverage through Vitest**: identifies unexercised rule branches. Coverage MUST
  not be inflated with tests that merely execute code without checking behavior.
- **Seeded scenario runner**: in-repository RNG and builders reproduce failures without
  another property-testing dependency.
- **Network fault harness**: a transport wrapper or local proxy that can add latency,
  jitter, pauses, and disconnects without changing simulation behavior.

### 4.2 Layout

```text
packages/
  shared/src/**/*.test.ts           # pure rule tests beside their modules
  client/src/**/*.test.ts           # net/input/HUD logic, no WebGL requirement
  server/src/**/*.test.ts           # matchmaker, validation, lifecycle
tests/
  support/                           # builders, seeded inputs, server/browser fixtures
  integration/                       # real server + ws clients
  e2e/                               # Playwright two-player journeys
  soak/                              # long/random simulations and bot clients
```

Regression tests SHOULD live at the lowest layer that reproduces the defect. A browser
test is appropriate only when browser integration is material to the failure.

---

## 5. Static Verification

Every change runs:

- TypeScript project-reference typechecking across all packages.
- ESLint, including client/server/shared dependency-boundary rules.
- Knip, with intentional public API exceptions documented rather than silently ignored.
- Production client and server builds.
- Asset validation: referenced models/audio exist, glTF/GLB files load, and sourced
  assets have an entry in `public/assets/CREDITS.md`.

Formatting remains an automatic workflow concern rather than a semantic test gate.

---

## 6. Shared Simulation Verification

The shared simulation is the highest-value and fastest suite. Tests map directly to
`GAME.md`, including all of §9.

### 6.1 Flight and state

- Neutral, minimum, and maximum throttle behavior.
- Pitch, roll, yaw, nose-axis convention, and quaternion normalization.
- Momentum, velocity alignment, externally injected shove momentum, and recovery curve.
- Fixed-step equivalence for supported entry points.
- Stumble ignores controls, prevents firing, tumbles reproducibly, and restores control
  on the defined tick.
- Recoil changes the shooter without being mistaken for client-authored state.

### 6.2 Gun and collision

- Fire eligibility, cooldown boundaries, ammo cost, maximum, and regeneration.
- Projectile spawn transform, travel, lifetime, ownership, and expiry.
- Swept collision or another proven approach prevents tunneling at maximum relative
  speed.
- Hit impulse follows projectile travel, applies once, consumes the projectile, and
  emits the expected feedback event.
- Simultaneous mutual hits affect both planes regardless of processing order.
- Ground and dome contacts reflect velocity, apply restitution, and leave the plane in
  a valid playable position.
- Any plane-to-plane or projectile-boundary ruling adopted in `GAME.md` receives
  explicit symmetry and order-independence tests.

### 6.3 Ring and scoring

- Neither, either, and both planes inside the capture volume.
- The closer player scores when both are inside.
- Distances below, exactly at, and above `RING_CENTER_TIE_EPS`.
- Crossing the boundary stops or begins scoring on that authoritative tick, including
  knock-in, knock-out, and wall-ricochet cases.
- Warning begins once, reveals one next location to both players, and does not change it
  during the warning.
- Teleport occurs once, clears the previous occupancy, and selects a valid reachable
  center with the required separation.
- Seeded target selection terminates even when ordinary rejection samples are invalid.

### 6.4 Match lifecycle

- Waiting and countdown do not accept gameplay input or accrue score.
- Regulation lasts the intended number of simulation ticks.
- The final regulation tick has one documented scoring/clock ordering.
- Different scores end with the correct winner; an equal score enters sudden death.
- Sudden death relocates and resizes the ring exactly once.
- The first scoring tick ends sudden death; an exact center tie does not.
- Ended state is terminal and cannot continue scoring, firing, or ticking gameplay.

### 6.5 Always-on invariants

Randomized and soak simulations assert after every tick:

- All numeric state is finite; rotations are valid and normalized within tolerance.
- Ammo, cooldowns, lifetimes, and phase timers stay within documented ranges.
- Scores never decrease and no more than one player scores per tick.
- Ring centers and planes remain in valid world bounds after collision resolution.
- IDs are unique, consumed projectiles do not return, and events are not emitted twice.
- Identical initial state, seed, config, and inputs produce identical authoritative
  results on the same runtime.

Each randomized failure MUST report the seed and smallest available tick/input trace.

---

## 7. Protocol and Server Integration

Protocol tests cover round-trips for every message and reject unknown tags, invalid
versions, malformed JSON, non-finite numbers, wrong primitive types, and oversized or
abusive payload patterns.

Integration tests start the real HTTP/WebSocket server on an ephemeral port and use
real `ws` clients to verify:

- Health check, handshake, welcome, version rejection, ping/pong, and clock fields.
- Quick queue and room-code pairing, including simultaneous joins, cancellation,
  duplicate queue attempts, a third room participant, and empty-room cleanup.
- Slot assignment, countdown, input acknowledgement, snapshots, events, and match end.
- Inputs are clamped; stale/duplicate sequences are dropped; missing input reuses only
  the last valid intent; one client can never submit state or another player's input.
- Snapshot/event cadence remains bounded when a client is slow.
- Multiple matches have no shared mutable state.
- Disconnect and voluntary leave behavior in every phase.
- Every timer, socket, listener, room, and match is released after teardown.

The integration suite advances controlled server time; it MUST NOT wait four real
minutes for regulation to end.

---

## 8. Client Logic Verification

Keep these modules testable without creating a WebGL renderer:

- **Prediction:** local input applies immediately and is retained until acknowledged.
- **Reconciliation:** acknowledged commands are discarded once; remaining commands
  replay in sequence from the authoritative plane state.
- **Corrections:** small errors smooth according to policy; large or safety-critical
  corrections snap; neither path corrupts authoritative state.
- **Interpolation:** positions lerp and orientations slerp between bracketing snapshots;
  duplicates, late snapshots, underrun, and short stalls follow a documented policy.
- **Clock sync:** offset selection and RTT calculations work with controlled samples and
  never move displayed match time backward unexpectedly.
- **Buffers:** input, snapshot, event-deduplication, and projectile buffers are bounded.
- **Input:** keyboard state maps to clamped commands, blur releases held input,
  and stumbling/server phase prevents prohibited intent.
- **HUD projection:** scores, timer, ammo, warning, contested/scoring state, sudden death,
  and results derive from authoritative state.
- **Client state machine:** only server messages/snapshots advance authoritative phases;
  invalid or late messages do not resurrect an ended match.

---

## 9. Browser End-to-End Verification

Playwright launches the production-built client and a real server. Each player uses a
separate browser context so storage, connection, input, and lifecycle are independent.

The implemented journeys are:

1. A production-built client renders WebGL, loads every required asset, connects, and
   enters an isolated room queue.
2. Two room-code clients receive opposite slots, enter play, and prove local steering.
3. A deterministic combat pair demonstrates projectiles, ammo spend/regeneration, hits,
   and stumble feedback.
4. Short authoritative scenarios cover regulation results, tie-to-sudden-death, and live
   disconnect results.
5. A deterministic ring scenario covers warning and teleport feedback.
6. Compact and desktop contexts keep the essential HUD and controls within the viewport.

Tests wait on state/UI conditions, never arbitrary delays. The test server uses a known
seed and validated config overrides to keep journeys short. It may start prescribed
authoritative scenarios, but clients never receive a mutation backdoor.

Functional journeys retain Playwright trace, screenshot, and video evidence on failure.
Every journey asserts captured browser/page errors and failed required requests; assertion
output identifies any captured failure. Performance runs omit heavy artifacts so their
measurements remain representative.

Pixel snapshots are reserved for stable HUD/layout surfaces. WebGL screenshots are
diagnostic because GPU/driver differences make exact whole-scene comparisons brittle.

---

## 10. Network Adversity, Soak, and Performance

Before shipping a change to networking or simulation timing, exercise a
matrix including normal local conditions, representative internet latency, jitter,
short stalls, snapshot pauses, and abrupt disconnects. Validate behavior rather than a
specific packet schedule:

- Local control remains responsive through prediction.
- Remote motion remains understandable and converges after a stall.
- Acknowledgement and replay do not duplicate or lose retained inputs.
- Queues and buffers stay bounded under backpressure.
- Clients recover to authoritative truth without `NaN`, permanent drift, or phase
  disagreement.

Soak runners play many seeded bot matches faster than real time at the simulation layer
and repeated real-socket matches at the integration layer. They check invariants,
completion, process memory trend, active handles, listener counts, and room/match maps.

Performance budgets are recorded after the first playable vertical slice, then enforced
against regressions. At minimum measure server tick duration under expected concurrent
v1 matches, snapshot payload size/rate, client frame time on the agreed baseline device,
initial asset weight, and reconciliation error under the network matrix. Do not invent
hard budgets before there is a representative build to measure.

---

## 11. Human Playtest Protocol

Automation answers "is it correct?" Human playtests answer "does it communicate and
feel right?" Each major playable change has a short structured session:

- Can a new player steer, find the ring, understand scoring, and fire without coaching?
- Does a clean hit create a meaningful scoring opportunity without removing agency?
- Is recovery readable and skillful rather than arbitrary?
- Does the visible capture volume match the actual scoring boundary from common camera
  angles?
- Are own/opponent scoring, contest, warning, next location, ammo, timer, and result
  readable at a glance?
- Are camera motion, tumble, flashes, and audio comfortable over a full match?
- Does the game remain enjoyable at realistic latency?
- Does the four-minute rhythm contain dead time, oppressive camping, or dominant spam?

Record config, build revision, participants, network conditions, observed confusion,
and tuning decisions. A tuning change goes through the same automated verification as a
code change. If the intended rule changes, update `GAME.md` before changing its tests.

---

## 12. Commands and Verification Lanes

Root scripts expose these stable entry points:

```text
pnpm test                 # fast Vitest suite in run mode
pnpm test:watch           # local Vitest watch mode
pnpm test:coverage        # diagnostic/enforced critical-module coverage
pnpm test:integration     # real server + ws clients
pnpm test:e2e             # production build + Playwright Chromium
pnpm test:network         # deterministic latency/jitter/stall prediction matrix
pnpm test:performance     # authoritative server/snapshot budgets
pnpm test:performance:browser # isolated software-WebGL frame budget
pnpm test:soak            # explicit long/random suite; not a precommit task
pnpm test:smoke           # compiled production entry over HTTP + real ws
pnpm verify               # typecheck + lint + knip + test + build
pnpm verify:full          # every automated release lane above
```

Lanes:

- **During implementation:** focused affected tests and typecheck.
- **Before completing a significant slice:** `verify` plus its affected integration and
  browser scenarios.
- **Before shipping:** `verify:full`, network matrix, soak suite, production smoke test,
  and the human playtest protocol.
- **Precommit:** keep fast; do not run browsers or soak tests.

Tests MUST be independent, parallel-safe where practical, and free of order dependence.
Flaky tests are defects: fix or quarantine them with an owner/reason immediately; never
normalize blind reruns as success.

---

## 13. Definition of Verified

SkyRing is ready to ship when:

- Every in-scope `GAME.md` rule and edge case is present in the traceability matrix and
  backed by an appropriate automated test or an explicitly human-only acceptance item.
- Typecheck, lint, Knip, unit, integration, browser, and production-build gates pass.
- Seeded randomized and soak runs complete without invariant, leak, or lifecycle failure.
- The supported network matrix converges correctly and keeps buffers bounded.
- Two production-built browser clients complete regulation, sudden death, and disconnect
  journeys without console or server errors.
- Required assets load, licenses are recorded, and critical HUD information remains
  readable at supported viewports.
- A real-internet playtest confirms the core flight/bonk/ring rhythm is understandable,
  responsive, and fun enough to ship.

This is evidence of high confidence, not a claim that software can be proven free of all
bugs. Any escaped defect gets a reproducible regression test at the lowest useful layer
before its fix is considered complete.
