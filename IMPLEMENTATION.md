# 🛠️ SkyRing — Implementation Directive

> **Audience:** the engineers and AI agents building SkyRing.
> **Companion docs:** [`GAME.md`](./GAME.md) is the **design** source of truth (what the game _is_ and _feels_ like), and [`TESTING.md`](./TESTING.md) defines the required verification evidence. This document is the **technical** source of truth (how it's built).
>
> **Precedence rule:** If this doc and `GAME.md` conflict on _design_ (a rule, a feeling, an edge case), `GAME.md` wins — fix this doc. If they conflict on _implementation_ (how something is built), this doc wins. If reality forces a design change, update `GAME.md` first, then follow it here.

---

## 0. How To Use This Document

- Read §1–§4 before writing any code — they set the non-negotiable architecture.
- §5–§12 are the detailed specs for each subsystem. Treat concrete numbers as **defaults to build against**, not sacred — every one lives in a single constants file (§5.1) and is meant to be tuned by playtesting.
- Read [`TESTING.md`](./TESTING.md) before designing subsystem boundaries. Testability is an architectural requirement, and every milestone ships with its verification evidence rather than adding tests afterward.
- §16 is the **build order**. Follow it. Do not build the full netcode stack on day one; earn it in milestones.
- Foundational choices are recorded in [`DECISIONS.md`](./DECISIONS.md). Do not reopen them without new implementation/playtest evidence; record any replacement decision before changing course.
- Keywords **MUST / SHOULD / MAY** carry their usual weight.

---

## 1. Architecture Philosophy

Five principles, in priority order. When a tradeoff appears, resolve it up this list.

1. **The server is the single authority.** Clients send _intent_ (input), never _state_. The server simulates the world and tells clients what happened. This is the whole reason online fair-play is tractable here — a client can never set its own score, position, or "I hit them." (`GAME.md` §10 is the design-level version of this.)
2. **One simulation, shared by both sides.** The physics/game-rules live in one place (`packages/shared`) and run **identically** on server (authoritatively) and client (predictively). Two divergent copies of the sim is the single worst thing we could do; the monorepo exists to prevent it.
3. **Continuous state, not events, is the source of truth.** Because nothing dies (`GAME.md` §2), everything reconciles as smoothly-interpolatable numbers (position, velocity, orientation, ammo, ring-occupancy). A hit is "add an impulse to a velocity," not "prove a kill at tick T." Lean into this — it's the design's gift to the netcode.
4. **One home for every tunable.** Match length, dwell time, impulse strength, tick rate — all in `shared/constants.ts`. Playtesting must never require hunting through logic.
5. **Simplicity first, earn complexity.** JSON before binary. Interpolation before prediction. A single server process before horizontal scaling. Ship a playable loop, then deepen it (§16).

---

## 2. Technology Choices

| Concern            | Choice                                                        | Why (and what was rejected)                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language           | **TypeScript** everywhere                                     | One language across client/server/shared lets us _share the simulation and types for free_. Non-negotiable given Principle 2.                                                                                                                                                                                                            |
| Client rendering   | **three.js** (already present)                                | Right tool for browser 3D; already scaffolded.                                                                                                                                                                                                                                                                                           |
| Client build/dev   | **Vite** (already present)                                    | Fast HMR, TS-native, already scaffolded.                                                                                                                                                                                                                                                                                                 |
| Server runtime     | **Node ≥24** (already the engine) + **`ws`**                  | `ws` is the minimal, battle-tested raw-WebSocket library. We want to own the tick loop, not have a framework own it.                                                                                                                                                                                                                     |
| Realtime transport | **WebSocket** (over TCP)                                      | See §4.1. **Rejected:** WebTransport/WebRTC (UDP-like, "more correct" for games, but browser + Node lib maturity and complexity aren't worth it for a 2-player game where prediction already hides latency). Noted as a future upgrade.                                                                                                  |
| Netcode framework  | **None — hand-rolled on `ws`**                                | **Rejected: Colyseus** (great rooms/state-sync, but imposes its own schema/state model and hides the tick timing we want to control) and **Socket.IO** (reconnection/fallback magic and overhead we don't need for fixed 1v1). Reconsider only if the room/sync implementation provides concrete evidence that this choice is untenable. |
| Server dev loop    | **`tsx watch`**                                               | Runs TS directly with fast reload; no separate build step in dev.                                                                                                                                                                                                                                                                        |
| Wire format        | **JSON** now; binary path left open                           | Debuggable, trivial, fine for 2 players. Swap the encoder in `protocol.ts` for msgpack/DataView **only if** profiling demands it.                                                                                                                                                                                                        |
| Vector math        | **three.js math classes** (`Vector3`, `Quaternion`) in shared | Reuse in the sim what the renderer already speaks — no gl-matrix↔THREE conversion at the render boundary. The server imports only the math subset of `three` (pure JS, runs fine in Node). **Rejected: gl-matrix** (lighter, but adds an impedance mismatch on the client).                                                              |
| Testing            | **Vitest + Playwright**                                       | Vitest covers shared, server, and non-WebGL client logic; Playwright runs two production-built browser clients against a real server. See §14 and `TESTING.md`.                                                                                                                                                                          |
| Message validation | **Hand-rolled type guards** (zod optional)                    | Validate at the protocol boundary. Keep it lean; reach for `zod` only if guards get unwieldy.                                                                                                                                                                                                                                            |
| Package manager    | **pnpm workspaces** (already present)                         | Already intended (repo has `pnpm-workspace.yaml`). Enables the shared package.                                                                                                                                                                                                                                                           |

---

## 3. Repository Structure

A pnpm monorepo. The original single-package scaffold was migrated into `packages/client` during the foundation milestone (§3.2).

```
plane-shooter/
├─ packages/
│  ├─ shared/                 # THE CROWN JEWEL — imported by client AND server
│  │  ├─ src/
│  │  │  ├─ constants.ts       # every tunable (§5.1)
│  │  │  ├─ types.ts           # state shapes + message shapes + enums (§5.2)
│  │  │  ├─ math.ts            # re-exports / helpers over three math classes
│  │  │  ├─ sim/
│  │  │  │  ├─ plane.ts         # stepPlane(): flight, alignment, stumble
│  │  │  │  ├─ bullet.ts        # stepBullets(), spawnBullet()
│  │  │  │  ├─ collision.ts     # bullet↔plane, plane↔plane/boundary (bounce)
│  │  │  │  ├─ ring.ts          # dwell/teleport, scoring resolution (tug-of-war)
│  │  │  │  └─ match.ts         # stepMatch(): orchestrates one authoritative tick
│  │  │  ├─ protocol.ts        # message tags, encode/decode, version
│  │  │  └─ index.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json          # name: @skyring/shared
│  ├─ client/                 # ← current src/ moves here
│  │  ├─ src/
│  │  │  ├─ main.ts             # entry: boots the client state machine
│  │  │  ├─ game/               # client-side orchestration + state machine (§8.1)
│  │  │  ├─ net/                # ws client, snapshot buffer, prediction, interp, clock sync (§8.2)
│  │  │  ├─ render/             # three scene, camera, models, ring visual, effects (§8.3)
│  │  │  ├─ hud/                # score, timer, ammo, ring-warning, results
│  │  │  └─ input/              # keyboard/gamepad → InputCommand
│  │  ├─ public/assets/models/  # glTF/GLB planes (§12)
│  │  ├─ index.html
│  │  ├─ vite.config.ts
│  │  ├─ tsconfig.json
│  │  └─ package.json          # name: @skyring/client
│  └─ server/
│     ├─ src/
│     │  ├─ index.ts            # http + ws bootstrap, env/config
│     │  ├─ connection.ts       # per-socket wrapper: id, input buffer, send helpers
│     │  ├─ matchmaker.ts       # quick-queue + room-code pairing (§7.2)
│     │  └─ match.ts            # Match: 2 players, fixed-tick loop, lifecycle (§7.3)
│     ├─ tsconfig.json
│     └─ package.json          # name: @skyring/server
├─ pnpm-workspace.yaml         # add `packages:` glob (see §3.2)
├─ tsconfig.base.json          # shared compiler options, referenced by each package
├─ package.json                # root: orchestration scripts + shared devDeps/tooling
├─ eslint.config.js .prettierrc … # hoisted to root, apply to all packages
├─ tests/                      # integration, e2e, soak, and shared test support
├─ AGENTS.md                    # durable implementation workflow for agents
├─ DECISIONS.md                 # accepted design/technical decisions
├─ GAME.md
├─ PROGRESS.md                  # resumable milestone and verification handoff
├─ TESTING.md
└─ IMPLEMENTATION.md
```

### 3.1 Package responsibilities & dependency rules

- `@skyring/shared` depends on **nothing** except the `three` math classes. It **MUST NOT** import anything browser-only (`window`, `document`, WebGL) or Node-only (`fs`, `net`). It runs in both. This is enforced by review and ideally an eslint boundary rule.
- `@skyring/client` depends on `@skyring/shared`, `three`, browser APIs.
- `@skyring/server` depends on `@skyring/shared`, `ws`, Node APIs.
- **Client and server MUST NOT import each other.** All cross-cutting concerns (types, constants, sim, protocol) go through `shared`.
- Workspace deps use `"@skyring/shared": "workspace:*"`. Dev runtime (Vite, tsx, vitest) consumes shared **TS source directly** — no pre-build step in dev. Typecheck uses TS project references (§13).

### 3.2 Migration from the current scaffold (one-time, mechanical)

1. Create `packages/client/`; move `src/`, `index.html`, and the Vite/client-specific config into it. The existing `src/main.ts` cube demo remains the browser smoke scene until Milestone 3 replaces it with the first flyable plane.
2. Extract shared compiler options from the root `tsconfig.json` into `tsconfig.base.json`; each package's `tsconfig.json` extends it. Client keeps `moduleResolution: "Bundler"`, `lib: [DOM…]`; server/shared use a Node-appropriate resolution and drop DOM libs.
3. Add the `packages:` glob to `pnpm-workspace.yaml` (it currently declares none):
   ```yaml
   packages:
     - packages/*
   ```
4. Hoist `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, husky, lint-staged, knip config to the root so all three packages share tooling. Update eslint `ignores`/globs for the new layout and per-package env (browser vs node).
5. Scaffold `packages/shared` and `packages/server` per the tree above.
6. Root `package.json` gains orchestration scripts (§13). Keep the strict TS settings already in place (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, etc.) — they carry over to every package.

---

## 4. Networking Model

### 4.1 Transport: WebSocket over TCP — the honest tradeoff

WebSocket gives us **reliable, ordered** delivery. The cost is **head-of-line blocking**: under packet loss, a delayed packet stalls everything behind it. The "correct" game transport is unreliable UDP (via WebTransport/WebRTC), where you drop a stale packet and move on.

**We accept TCP for v1** because: (a) it's a 1v1 game, not 64-player; (b) server authority + client prediction (§4.4) already hide the latency that matters most — your own plane; (c) `ws` + Node is dramatically simpler than WebTransport/WebRTC plumbing. WebTransport is the documented **future upgrade path**; the `protocol.ts` boundary and the snapshot/event split (§4.6) are designed so swapping transports later touches only the net layer.

### 4.2 Timebase & tick rates (defaults; see `constants.ts`)

| Parameter         | Default                 | Notes                                                                 |
| ----------------- | ----------------------- | --------------------------------------------------------------------- |
| `SIM_HZ`          | **60**                  | Fixed simulation step (`dt = 1/60`). Server & client predict at this. |
| `SNAPSHOT_HZ`     | **30**                  | Server → client broadcast rate. Halves bandwidth; interp covers gaps. |
| `INTERP_DELAY_MS` | **100**                 | Client renders remote entities this far in the past (≈3 snapshots).   |
| Input send rate   | `SIM_HZ`                | Client sends one input command per local sim tick (packets are tiny). |
| Time-sync pings   | 5 @ start, then 1 / 5 s | NTP-lite clock estimation (§4.5).                                     |

**Fixed timestep is mandatory** — it's what makes prediction/reconciliation reproducible. Both loops use an **accumulator** with a max-catch-up clamp (spiral-of-death protection): accumulate real elapsed time, consume it in whole `1/SIM_HZ` steps, clamp accumulated time to e.g. 5 steps.

### 4.3 The authoritative server loop

The server ticks on a **drift-corrected fixed clock** (compute next tick deadline, `setTimeout` to it, catch up if behind up to the clamp). Each tick:

1. Drain each player's input buffer; take the latest input command per player (record its `seq` as that player's `lastProcessedInputSeq`). Missing input → reuse last known.
2. Validate/clamp inputs (§7.4).
3. `stepMatch(state, {a: inputA, b: inputB}, {dt, config, rng})` — the shared sim advances the world by one step: flight, bullets, collisions/bounces, ring dwell/teleport, scoring accrual, phase transitions.
4. Collect discrete events produced this tick (hits, bounces, teleports, phase changes) into an outgoing event queue.
5. On snapshot cadence (`SNAPSHOT_HZ`): broadcast a `snapshot` to both clients (§4.6), each stamped with that client's `lastProcessedInputSeq`.

### 4.4 Client-side prediction (local plane only)

The local player's own plane predicts immediately so flight feels zero-latency:

- Each tick the client samples input, assigns a monotonically increasing `seq`, sends it, **and applies it locally** via the shared `stepPlane` (plus its own bullets/recoil/stumble). It keeps a ring buffer of unacked `{seq, input}`.
- On each `snapshot`: the client **snaps its local plane to the authoritative state**, discards inputs `≤ lastProcessedInputSeq`, then **re-simulates** the still-unacked inputs forward from that authoritative state. Result: the local plane tracks the server but responds instantly.
- **Only the local plane is predicted.** The ring's scoring verdict, the opponent, and score are _not_ input-latency-sensitive from your seat, so the client just displays the server's truth for them. This keeps the predicted surface tiny — one plane, its bullets, its stumble.
- **Error smoothing (SHOULD, Milestone 5):** if a correction is small, ease the visual toward the corrected state over a few frames instead of snapping, to avoid jitter. Large corrections (e.g. an unforeseen knockback) snap — that's the game telling you the truth.

Because reconciliation re-runs the client's own inputs on the client's own machine, **cross-machine float determinism is NOT required.** The server is always the authority; prediction only needs to be _close_ so corrections stay small. Do not waste effort chasing lockstep determinism.

### 4.5 Clock synchronization

On connect, the client sends `ping{clientTime}`; server replies `pong{clientTime, serverTime}`. Over ~5 samples the client estimates `serverTime ≈ localTime + offset` (pick the sample with lowest RTT, standard NTP-lite) and tracks RTT. Snapshots carry `serverTime`/`tick`; the client renders remote entities at `estimatedServerTime − INTERP_DELAY_MS` (§4.7).

### 4.6 Two logical channels: snapshots vs. events

Even though TCP makes everything reliable, keep them conceptually separate (clean, and survives a future move to unreliable transport):

- **Snapshots** — the full continuous world state, sent at `SNAPSHOT_HZ`. Idempotent/overwriting: a newer snapshot fully supersedes an older one.
- **Events** — discrete one-shots that drive _feedback_, not truth: `hit`, `bounce`, `ringTeleport`, `stumble`, `phaseChange`, `matchEnd`. Used for effects/juice and lifecycle. State consequences of an event (e.g. the shove) are already reflected in the next snapshot; events exist so the client can _react_ (play the sound, spawn the spark) at the right instant.

### 4.7 Remote entity interpolation

The opponent plane is rendered **in the past** for smoothness: buffer incoming snapshots; to render at time `T = estimatedServerTime − INTERP_DELAY_MS`, find the two snapshots bracketing `T` and `lerp` position / `slerp` orientation between them. If the buffer runs dry (stall), hold last or briefly extrapolate along velocity, then resync. Bullets are short-lived and fast — render them predictively on `fire` and let the server's authoritative bullets/`hit` events correct; divergence is invisible at their lifetime.

---

## 5. The Shared Package (spec)

### 5.1 `constants.ts` — every tunable, one file

Group and export as a frozen `DEFAULT_GAME_CONFIG` object with a corresponding `GameConfig` type. **Starter defaults** (units: distance ≈ meters, time = seconds, angles = radians; world is **Y-up**, matching three.js):

```ts
// Netcode
SIM_HZ = 60;
SNAPSHOT_HZ = 30;
INTERP_DELAY_MS = 100;

// Arena (dome sitting on the ground)
DOME_RADIUS = 700;
GROUND_Y = 0;
BOUNDARY_RESTITUTION = 0.8;
SPAWN_ALTITUDE = 150;

// Plane flight
MIN_SPEED = 40;
MAX_SPEED = 140;
THROTTLE_ACCEL = 60;
PITCH_RATE = 1.6;
ROLL_RATE = 2.6;
YAW_RATE = 0.8;
VELOCITY_ALIGN = 3.0; // 1/s: how fast velocity re-aligns to the nose
GRAVITY = 0; // arcade sky; no gravity by default
PLANE_COLLISION_RADIUS = 12;
PLANE_COLLISION_RESTITUTION = 0.9;

// Gun / knockback  (GAME.md §5)
BULLET_SPEED = 400;
BULLET_LIFETIME = 1.2;
FIRE_COOLDOWN = 0.12;
AMMO_MAX = 20;
AMMO_REGEN_PER_SEC = 4;
AMMO_PER_SHOT = 1;
PLANE_HIT_RADIUS = 12;
HIT_IMPULSE = 220; // shove along bullet travel dir
RECOIL_IMPULSE = 25; // backward shove on the shooter
STUMBLE_DURATION = 0.6;
STUMBLE_SPIN = 4.0; // rad/s tumble during stumble

// Ring (GAME.md §4)
RING_RADIUS = 90;
RING_DWELL = 22;
RING_WARNING = 4;
RING_POINTS_PER_SEC = 1;
RING_CENTER_TIE_EPS = 8; // tug-of-war dead-zone
RING_MIN_TELEPORT_DIST = 300;

// Match (GAME.md §3, §8)
MATCH_DURATION = 240;
COUNTDOWN = 3;
SUDDEN_DEATH_RING_RADIUS = 70;
```

Every number above is a **default to be tuned**. Logic files import from here; no magic numbers elsewhere.

The effective config is passed into match/simulation construction and remains immutable for that match. Production uses `DEFAULT_GAME_CONFIG`; automated tests and explicit development scenarios MAY supply validated partial overrides so full lifecycle and browser journeys run quickly. The server sends the resulting effective config in `matchFound`, as already required by §10. A client never chooses or overrides match config.

### 5.2 `types.ts` — state, messages, enums

State shapes are **plain, JSON-serializable numeric structs** (positions/quaternions as arrays or flat fields), so snapshots serialize trivially. The sim converts to `Vector3`/`Quaternion` internally for math, then writes plain numbers back. Sketch:

```ts
type Vec3 = [number, number, number];
type Quat = [number, number, number, number]; // x,y,z,w

interface PlaneState {
  pos: Vec3;
  vel: Vec3; // total world velocity, including temporary impulses
  rot: Quat;
  flightSpeed: number; // throttle-controlled target, MIN_SPEED..MAX_SPEED
  ammo: number;
  stumbleTicksRemaining: number; // >0 ⇒ no control, tumbling
  stumbleAngularVelocity: Vec3;
  fireCooldownTicks: number;
  inRing: boolean; // derived, but sent for HUD/clarity
  scoring: boolean; // is THIS plane currently earning points
}

interface BulletState {
  id: number;
  owner: 'a' | 'b';
  previousPos: Vec3; // swept collision start for this tick
  pos: Vec3;
  vel: Vec3;
  lifetimeTicksRemaining: number;
}

interface RingState {
  center: Vec3;
  radius: number;
  teleportTicksRemaining: number;
  warning: boolean; // telegraph window
  nextCenter: Vec3 | null; // revealed when warning starts (GAME.md §4)
}

enum MatchPhase {
  Waiting,
  Countdown,
  Playing,
  SuddenDeath,
  Ended,
}

interface MatchState {
  phase: MatchPhase;
  phaseTicksRemaining: number; // countdown/regulation; UI derives seconds
  scores: { a: number; b: number };
  ring: RingState;
  planes: { a: PlaneState; b: PlaneState };
  bullets: BulletState[];
  tick: number;
}

interface InputCommand {
  seq: number;
  tick: number;
  throttle: number; // -1..1
  pitch: number; // -1..1
  roll: number; // -1..1
  yaw: number; // -1..1
  fire: boolean;
}
```

Message shapes and tags live here too (catalog in §10).

### 5.3 `sim/` — the pure, deterministic-on-a-machine core

Hard rules:

- **Pure functions.** `stepX(state, inputs, {dt, config, rng}) → newState` (or mutate a passed-in state object consistently — pick one convention, apply everywhere; mutation-in-place is fine and faster, as long as it's the same on both sides). **No I/O, no randomness except through the injected seeded RNG, no `Date.now()`, no wall-clock.** Time enters only as `dt` and accumulated sim time.
- **Seeded RNG for anything random** (ring teleport target, stumble spin direction). The server owns the seed and includes ring teleport results in snapshots/events, so the client never needs to reproduce them — but keeping RNG injectable keeps the sim testable and pure.
- **Configuration is explicit.** Simulation entry points receive the immutable effective `GameConfig`; they do not reach into environment variables or mutable globals. This keeps tuning centralized while making exact scenarios reproducible.
- **Decomposed so the client can predict a single plane.** `stepPlane(plane, input, {dt, config})` must be callable in isolation (client prediction needs exactly this + the caller's bullets/stumble). `stepMatch` composes the per-entity steppers plus the global ring/scoring resolution.

`stepMatch` per-tick order (authoritative):

1. `stepPlane` for each plane (throttle changes and clamps `flightSpeed`; apply control torque unless stumbling; ease total `vel` toward `nose * flightSpeed` by `VELOCITY_ALIGN` without erasing external impulses; integrate position; decrement stumble/cooldown ticks; regen ammo).
2. Handle `fire` intents: if `ammo ≥ AMMO_PER_SHOT` and `fireCooldownTicks ≤ 0` and not stumbling → spawn bullet at muzzle along nose, apply `RECOIL_IMPULSE` to shooter, spend ammo, set cooldown ticks.
3. `stepBullets` (retain previous position, integrate, expire at lifetime or arena boundary).
4. `collision`: swept bullet↔opponent → apply `HIT_IMPULSE` along bullet direction to victim `vel`, assign authoritative stumble ticks/angular velocity, consume bullet, emit `hit`. Plane↔plane → separate symmetrically and reflect relative velocity using `PLANE_COLLISION_RESTITUTION`. Plane↔boundary (dome sphere + ground plane) → reflect velocity about surface normal × `BOUNDARY_RESTITUTION`, nudge inside, emit `bounce`.
5. `ring`: decrement `teleportTicksRemaining`; enter `warning` at the configured warning-tick threshold and pick+reveal `nextCenter`; at 0, teleport (respect `RING_MIN_TELEPORT_DIST`, keep the entire scoring sphere inside the playable dome/above ground), emit `ringTeleport`.
6. **Scoring resolution (GAME.md §4, §4.1)** — the tug-of-war rule:
   - Compute `inRing` for each plane (distance to `ring.center` < `radius`).
   - If exactly one inside → that plane scores `RING_POINTS_PER_SEC * dt`.
   - If both inside → compare distance-to-center; the closer plane scores; if `|dA − dB| ≤ RING_CENTER_TIE_EPS` → nobody scores this step.
   - If none inside → nobody scores.
   - Set each plane's `scoring` flag accordingly (drives HUD/ring color).
7. **Match phase** (§11): after scoring, decrement regulation ticks in `Playing`; at 0, → `Ended` (winner) or relocate/shrink the ring and enter `SuddenDeath` (tie). Sudden-death scoring begins on the following tick; its first scoring claimant receives that tick and then the match ends.

### 5.4 `protocol.ts`

Central `encode(msg): string` / `decode(raw): Message`, message-tag constants, and a `PROTOCOL_VERSION`. Client sends its version in `hello`; server rejects mismatches with a clear close reason. This is the single seam to swap JSON→binary later.

---

## 6. Simulation & Physics Detail (to prevent divergent implementations)

- **Coordinate system:** Y-up, right-handed (three.js default). Nose = plane's local `-Z` (three's forward) or `+Z` — **pick one in `math.ts` and document it**; every muzzle/thrust/align calc uses that constant.
- **Flight is thrust + momentum, no gravity** (`GRAVITY=0`) — keeps it "pinball in the sky" (`GAME.md` §2, §6). `flightSpeed` always stays within `[MIN_SPEED, MAX_SPEED]`; total velocity may temporarily exceed or oppose it after an impulse, so you cannot stop on command but a bonk remains meaningful (`DECISIONS.md` D004–D005).
- **The align mechanic is the soul of the feel:** total velocity continuously eases toward `nose * flightSpeed` at rate `VELOCITY_ALIGN`. A knockback injects an external impulse into `vel`; the plane then _drifts sideways and recovers_ as alignment reasserts. Do not hard-clamp ordinary post-hit total velocity to `MAX_SPEED`; only an intentionally generous safety ceiling may prevent numerical runaway.
- **Stumble:** while `stumbleTicksRemaining > 0`, ignore control input and integrate the authoritative `stumbleAngularVelocity`; controls return when it reaches 0. A stumbling plane cannot fire (`GAME.md` §9, `DECISIONS.md` D006).
- **Gun = projectiles, not hitscan:** visible tracer bullets make recoil, limited ammo, and dodging tangible. Use swept collision at supported relative speeds. Projectiles expire on ground/dome contact rather than ricocheting (`DECISIONS.md` D003, D008).
- **Plane collisions and boundaries** (`GAME.md` §6): planes bounce symmetrically off one another. The dome is the upper half of a sphere of `DOME_RADIUS` centered at the ground origin, with playable space also constrained by `y >= GROUND_Y`. Plane contacts reflect velocity with configured restitution and positional separation; they never clamp or teleport a plane as ordinary behavior.
- **Ring is a sphere** of `RING_RADIUS`; "inside" = plane-center distance < radius. Teleport targets keep the whole sphere inside the playable upper dome, above the ground, and ≥ `RING_MIN_TELEPORT_DIST` from the current center. Rendering must communicate the spherical boundary (`DECISIONS.md` D009).

---

## 7. Server Architecture

### 7.1 Bootstrap (`index.ts`)

HTTP server (health check; in prod optionally serves the built client) + `ws` server sharing the port. Config via env: `PORT`, `NODE_ENV`, `TICK_HZ` override, etc. In prod, terminate TLS (wss) at the platform/proxy.

### 7.2 Matchmaking (`matchmaker.ts`)

Contained 1v1 (`GAME.md` §3). Two entry modes:

- **Quick queue:** first two waiting sockets are paired into a `Match`.
- **Room code:** `queue{mode:'room', room:'ABC'}` (or `?room=ABC` on the client URL) — two sockets naming the same room pair up. **Invaluable for dev/testing with a specific person**, cheap to build. (Beyond this, matchmaking is out of scope — `GAME.md` §12.)

On pairing: assign slots `a`/`b`, create the `Match`, send `matchFound`, begin `Countdown`.

### 7.3 The `Match` (`match.ts`)

Owns two connections, one `MatchState`, and its fixed-tick loop (§4.3). Responsibilities: run the loop, apply the shared sim, broadcast snapshots, emit events, drive the phase machine (§11), and tear itself down at `Ended` or on disconnect. Each match is fully self-contained (`GAME.md` "each game is contained") — no shared mutable global state between matches.

Separate progression from scheduling: the match runner exposes a way to advance exactly one fixed tick, while the production scheduler owns drift correction and calls it at `SIM_HZ`. Tests use the same runner with controlled time, so a complete match can execute immediately and scheduler behavior can be verified independently. Seed + effective config + initial state + accepted input history MUST be sufficient to replay an authoritative simulation failure.

### 7.4 Input validation (server-authoritative safety)

Every inbound `input` is **clamped** (`throttle/pitch/roll/yaw` to `[-1,1]`, `fire` to bool), and `seq` must be monotonic (drop stale/dupes). Malformed messages → ignore (and rate-limit/disconnect abusive senders). Because the server never trusts client _state_, the attack surface is small — validate inputs and you're largely done for v1 (no elaborate anti-cheat).

### 7.5 Disconnection (`GAME.md` §9)

A 1v1 can't continue against a frozen ghost. On socket close during a live match: end the match and emit `matchEnd{reason:'opponentLeft'}` to the survivor. If disconnect happens during `Playing`/`SuddenDeath`, **award the win to the remaining player**; during `Countdown`, end as a no-contest. No reconnection in v1 (`GAME.md` §9, `DECISIONS.md` D010).

---

## 8. Client Architecture

### 8.1 State machine (`game/`)

`Connecting → InQueue/Waiting → MatchFound → Countdown → Playing → (SuddenDeath) → Ended`. The client **mirrors** server phases (server is authority); it never advances phase on its own, only reacts to `phaseChange`/`matchEnd`/snapshots. The client render+predict loop runs during `Playing`/`SuddenDeath`.

### 8.2 Net layer (`net/`)

Owns the `ws` connection, `protocol` encode/decode, the input sender (§4.4), the snapshot buffer + interpolation (§4.7), prediction/reconciliation (§4.4), and clock sync (§4.5). This is the only place that touches the wire. Exposes a clean "current interpolated/predicted world" to `render/` and `hud/`.

### 8.3 Render + HUD + input

- **`render/`:** three.js scene, a **chase camera** behind the local plane, glTF plane models (§12), the ring as a glowing volume whose material/color reflects its scoring state (mine / theirs / contested / warning — `GAME.md` §11), the dome/ground for spatial reference, and **effects** (muzzle flash, tracers, hit spark, stumble tumble, bounce flash) driven by `event`s. Reads state from `net/`; owns _zero_ game logic.
- **`hud/`:** always-on score + match timer (`GAME.md` §3), ammo/energy meter, ring-relocation warning + next-location ping, and the end-of-match result screen.
- **`input/`:** keyboard (and optional gamepad) → `InputCommand`. Sampled every frame, aggregated into the fixed prediction tick.

---

## 9. (reserved — merged into §6)

---

## 10. Wire Protocol — message catalog

JSON, tagged by `t`. Shapes are the contract; keep them in `shared/types.ts` + `protocol.ts`.

**Client → Server**

| `t`     | Payload                              | Purpose                   |
| ------- | ------------------------------------ | ------------------------- |
| `hello` | `{ version }`                        | Handshake; version check. |
| `queue` | `{ mode: 'quick' \| 'room', room? }` | Enter matchmaking.        |
| `input` | `InputCommand`                       | Per-tick intent (§5.2).   |
| `ping`  | `{ clientTime }`                     | Clock sync.               |
| `leave` | `{}`                                 | Voluntary exit.           |

**Server → Client**

| `t`          | Payload                                                                            | Purpose                                    |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `welcome`    | `{ yourConnId, serverTime, version }`                                              | Post-handshake ack.                        |
| `pong`       | `{ clientTime, serverTime }`                                                       | Clock sync reply.                          |
| `matchFound` | `{ matchId, yourSlot: 'a'\|'b', constants }`                                       | Paired; sends the tunables in effect.      |
| `snapshot`   | `{ tick, serverTime, state: MatchState, ackSeq }`                                  | Continuous world state + input ack (§4.6). |
| `event`      | `{ kind: 'fire'\|'hit'\|'bounce'\|'ringTeleport'\|'stumble'\|'phaseChange', ... }` | Discrete feedback/lifecycle.               |
| `matchEnd`   | `{ result: 'win'\|'lose'\|'draw', scores, reason }`                                | Terminal.                                  |

`snapshot.ackSeq` is the recipient's `lastProcessedInputSeq` (drives reconciliation). Sending the full `constants` on `matchFound` means a tuning change ships without client redeploys and guarantees both sides agree.

---

## 11. Match Lifecycle (state machine, server-driven)

```
Waiting ──(2 players)──▶ Countdown(COUNTDOWN s) ──▶ Playing(MATCH_DURATION s)
                                                        │
                                   time=0 & scores differ│──▶ Ended(winner)
                                   time=0 & scores equal  └──▶ SuddenDeath ──(first point)──▶ Ended(winner)
   any phase, a socket drops ───────────────────────────────▶ Ended(reason: opponentLeft)   [§7.5]
```

- **Countdown:** planes spawned at opposite sides (`SPAWN_ALTITUDE`), controls locked, 3-2-1 shown; ring placed at center.
- **Playing:** full sim; clock counts down; scores accrue via §5.3 step 6.
- **SuddenDeath** (`GAME.md` §8): ring relocates and shrinks to `SUDDEN_DEATH_RING_RADIUS`; **first point ends it instantly.**
- **Ended:** freeze/handoff to results screen; server tears the match down after a short linger.

---

## 12. Assets & Content Pipeline

- **Models:** real aircraft in **glTF/GLB** (`GAME.md` §11), loaded via three's `GLTFLoader`, served from `packages/client/public/assets/models/`. Two visually distinct planes so players never confuse themselves with the opponent.
- **Sourcing & licensing:** free/permissively-licensed sources (e.g. Poly Pizza, Kenney, Sketchfab CC assets). **Record each model's license** in a `packages/client/public/assets/CREDITS.md`. Prefer low-poly (arcade tone, small download).
- **Build order:** **placeholder primitives first** (the existing cube / simple darts) so netcode and gameplay land without waiting on art; swap in glTF during the juice pass (Milestone 6). Renderer code MUST treat the model as a swappable visual over the authoritative transform — never derive gameplay from model geometry.
- **Optimization:** compress/`draco` if models are heavy; keep total initial payload lean.

---

## 13. Tooling, Build & Dev Workflow

- **Root scripts** orchestrate the packages:
  - `dev` — run client (Vite) + server (`tsx watch`) together (via `concurrently` or `npm-run-all`). Two terminals is an acceptable fallback.
  - `build` — typecheck all + Vite build client + compile/bundle server.
  - `typecheck` — `tsc -b` across **TS project references** (each package `composite: true`, referencing `shared`). This gives fast, correct cross-package types without a dev build step.
  - `test` / `test:watch` / `test:coverage` — Vitest fast suite and its local/coverage variants ([`TESTING.md`](./TESTING.md) §12).
  - `test:integration` — real server plus real `ws` clients.
  - `test:e2e` — production-built client/server journeys in Playwright.
  - `test:soak` — explicit seeded long/random runs; never part of precommit.
  - `verify` / `verify:full` — stable fast and complete verification entry points.
  - `lint` / `format` / `knip` — extend the existing configs to all packages.
- **Dev runtime consumes shared TS source directly** (Vite + tsx resolve `@skyring/shared` to its `src`). No compile-shared-then-run loop in development.
- **Keep the strict scaffold settings** (already present): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. They apply to every package via `tsconfig.base.json`.
- **husky + lint-staged + knip** stay in the precommit path, scoped across the monorepo.

---

## 14. Testing & Verification

[`TESTING.md`](./TESTING.md) is the normative verification plan. Its required layers are:

- Vitest examples plus seeded property/invariant tests for the pure shared simulation.
- Protocol boundary tests and real-server/real-`ws` integration tests.
- Client prediction, reconciliation, interpolation, clock, input, HUD, and state-machine tests without requiring WebGL.
- Playwright journeys using two isolated browser contexts against the production-built client and a real server.
- Network-adversity, soak, asset/license, production smoke, and structured human playtest gates.

Every `GAME.md` rule and edge case receives a stable requirement ID mapped to executable evidence. Tests are delivered with their milestone. Manual playtesting remains required for feel and readability, but it is never the only whole-game verification.

The standard root commands, evidence retained on browser failures, milestone matrix, and final definition of verified are specified in `TESTING.md` §§12–14.

---

## 15. Deployment

- **Client:** static Vite build → any static host/CDN. Point it at the server's `wss://` URL via build-time env.
- **Server:** a **long-lived stateful Node process** — deploy to a host that keeps a process alive (**Fly.io / Railway / a small VPS**), **not** serverless/edge functions (a match lives in RAM in one process). TLS/`wss` in prod. Config via env (§7.1).
- **Single instance is correct for v1.** A match must stay on the process that owns it; horizontal scaling would need a matchmaking/routing layer (sticky sessions or a match directory) — **explicitly deferred** (`GAME.md` §12). Note it, don't build it.

---

## 16. Build Order (milestones — follow this sequence)

Each milestone ends at something runnable/testable. Do not skip ahead into netcode depth.

1. **Monorepo skeleton.** Execute §3.2 migration. `shared`/`client`/`server` compile, lint, and the client still renders _something_ (the cube is fine). Root `dev` runs both. Establish the static gates, Vitest runner, and client render smoke test.
2. **Connect & echo.** Client opens ws; `hello`/`welcome`; quick-queue + room-code pairing; two clients land in a `Match`; server ticks and broadcasts a trivial snapshot; client logs it. Clock sync working. Add protocol, real-WebSocket matchmaking/lifecycle, and teardown integration tests.
3. **Flight, authoritative + interpolated.** Implement `stepPlane` + arena boundaries in `shared`. Server simulates both planes from real input; client renders **local plane from server snapshots** (no prediction yet — accept input lag) and the **remote plane interpolated**. Add flight/boundary invariants, interpolation tests, and a two-browser flight smoke journey. _Playable proof of the whole pipe._
4. **Ring & scoring.** Ring dwell/teleport/warning + tug-of-war scoring in `shared`; HUD score + timer; full match lifecycle incl. countdown, time-up winner, and sudden death. Complete the ring/scoring/lifecycle requirement matrix and browser win/tie journeys. _Now it's a game you can win or lose._
5. **Gun, knockback & prediction.** Projectiles, ammo/regen, recoil, hit→impulse+stumble (`GAME.md` §5). Add **client-side prediction + reconciliation** for the local plane (§4.4) so flight feels instant; error smoothing. Add projectile/collision invariants, complete reconciliation tests, a network-adversity lane, and a deterministic two-browser combat scenario. _The signature mechanic + the feel._
6. **Juice & content.** Real glTF planes (§12), ring state visuals, effects for hits/bounces/stumbles/teleports, sound. Add asset/license validation, browser console/network cleanliness, HUD/layout checks, and structured playtests. Tune every constant against `GAME.md` §13's north star.
7. **Ship.** Deploy per §15; pass full verification, network matrix, soak, and production smoke; playtest 1v1 over the real internet; iterate on `constants.ts` and rerun affected verification.

The detailed evidence required at each milestone is in [`TESTING.md`](./TESTING.md) §13. A milestone is not complete until its behavior and integration gates pass.

---

## 17. Decisions & Deferred Scope

The former implementation flags are accepted for v1 and recorded with rationale in [`DECISIONS.md`](./DECISIONS.md): hand-rolled `ws`/TCP transport, visible projectiles, no gravity, impulse-preserving velocity alignment, authoritative stumble motion, integer tick timing, plane collision/projectile boundary behavior, spherical capture volume, and disconnect outcomes.

Reopen one only when implementation measurements or playtests provide new evidence. Record the superseding decision before changing code or governing documents.

Deferred by design (`GAME.md` §12): >2 players, multiple rings, obstacles, power-ups, progression, horizontal server scaling, reconnection.

---

## 18. Conventions Quick-Reference

- **Units:** meters, seconds, radians. **World:** Y-up, right-handed. Document nose-axis once in `math.ts`.
- **No magic numbers** outside `constants.ts`.
- **Effective match config is immutable and explicit; only the server selects it.**
- **Shared imports nothing environment-specific.** Client/server never import each other.
- **Server authoritative; client predicts only its own plane.**
- **Tests ship with each milestone; browser automation complements rather than replaces human playtesting.**
- **`GAME.md` = design truth, `IMPLEMENTATION.md` = technical truth**; design conflicts defer to `GAME.md`.
