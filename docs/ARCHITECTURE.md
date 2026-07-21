# SkyRing Architecture

This document records the current technical invariants of SkyRing. `GAME.md` owns game
behavior and feel; this document owns package boundaries, authority, simulation order,
and networking. Historical implementation plans and superseded choices belong in Git.

## 1. System shape

SkyRing is a pnpm workspace with three packages:

- `@skyring/shared` contains portable state, protocol, configuration, seeded randomness,
  and the pure fixed-step simulation. It may depend on Three.js math, but never browser or
  Node APIs.
- `@skyring/client` contains input, networking, local prediction, interpolation, HUD,
  audio, and Three.js rendering. It depends on shared and never imports server code.
- `@skyring/server` contains the HTTP/WebSocket boundary, matchmaking, match ownership,
  scheduling, and environment parsing. It depends on shared and never imports client code.

Cross-boundary contracts live in shared. Clients send intent only; they never select
match configuration or submit authoritative state.

## 2. Authority and configuration

The server owns match construction, accepted inputs, simulation state, collisions,
scores, phases, and results. `DEFAULT_GAME_CONFIG` in `shared/constants.ts` is the
production source of gameplay and netcode tunables. A server-created match receives one
validated immutable effective config and sends it to both players in `matchFound`.

Tests and explicit development scenarios may inject validated config, time, seeds, and
initial state through server-owned construction seams. Production never exposes a client
state-mutation hook.

## 3. Simulation

### 3.1 Core rules

The authoritative simulation is fixed-step, seeded, deterministic on one runtime, and
free of I/O and wall-clock reads. State is plain JSON-serializable data and simulation
helpers mutate it in place consistently. Time enters as `dt`; randomness enters through
the injected seeded RNG. Units are meters, seconds, and radians in a right-handed Y-up
world. A plane's nose is local `-Z`.

Flight keeps throttle-controlled `flightSpeed` separate from total world velocity.
Velocity gradually aligns toward the nose, preserving temporary recoil and hit impulses.
There is no gravity. Stumble rotation and duration are authoritative; stumbling suppresses
control and firing. Projectiles are visible, use swept collision, and expire rather than
ricocheting. Planes bounce off one another, the ground, and the dome.

The playable arena is the intersection of the upper dome and ground half-space. Collision
resolution must finish with both planes inside that intersection, including after
plane-to-plane separation. The capture zone is a true sphere.

### 3.2 Authoritative tick order

During active play, `stepMatch` advances one tick in this order:

1. Advance both planes: controls, stumble, velocity alignment, integration, cooldowns,
   and ammo regeneration.
2. Accept legal fire intents, spawning projectiles and applying ammo, cooldown, and recoil
   atomically.
3. Advance projectiles while retaining their prior positions for swept collision.
4. Resolve projectile hits, ordinary arena contacts, plane-to-plane contact, and final
   arena stabilization.
5. Advance ring warning/teleport state.
6. Resolve spherical occupancy and tug-of-war scoring.
7. Advance regulation or sudden-death lifecycle state.

The final regulation tick may score before the clock transition. A tied regulation match
relocates and shrinks the ring, then begins sudden-death scoring on the following tick.
The first later scoring claimant receives that tick and ends the match.

### 3.3 Scheduling and replay

The server scheduler uses a drift-corrected fixed clock with bounded catch-up. Match
progression remains separate: one runner call advances exactly one simulation tick. The
client prediction loop uses the effective `SIM_HZ` and must also account for elapsed fixed
steps with bounded catch-up rather than silently dropping delayed callbacks.

Seed, effective config, initial state, and accepted per-player input history must be
enough to replay an authoritative simulation failure.

## 4. Networking

SkyRing uses versioned JSON messages over raw WebSockets. The shared protocol decoder
rejects malformed or non-finite data; the server clamps input axes and accepts only
monotonically increasing input sequences. WebSocket/TCP head-of-line blocking is accepted
for the two-player initial release.

The server broadcasts full snapshots at `SNAPSHOT_HZ`. Each recipient's snapshot carries
their own `ackSeq`. Discrete event batches drive feedback only; their state consequences
already exist in snapshots.

### 4.1 Local prediction and reconciliation

The client predicts only its local plane, including legal firing, recoil, and local
tracers. It retains a bounded sequence of unacknowledged inputs. On a snapshot it restores
the authoritative local plane, discards inputs through `ackSeq`, replays the remainder in
order, and smooths small visual corrections while snapping large ones. Opponent state,
ring state, scores, and match phases remain authoritative and are not predicted.

### 4.2 Remote interpolation and time

Remote planes and projectiles render from a bounded snapshot buffer at estimated server
time minus `INTERP_DELAY_MS`. Position interpolates linearly and orientation spherically;
buffer underrun holds the latest known state. NTP-style ping samples estimate the server
clock using the lowest-RTT observation.

## 5. Server and client ownership

The server owns one in-memory `Match` per pair and exactly one waiting/active ownership
path per connection. Quick queue and room-code pairing both produce exactly two slots.
Disconnect during live play awards the survivor; countdown disconnect is a no-contest.
Reconnection is out of scope. Match, queue, scheduler, listener, and socket ownership must
be released on teardown.

The client networking layer is the only client code that touches the wire. The renderer
and HUD consume projected network state and own no gameplay rules. Rendering must use the
effective match configuration and clearly expose the spherical ring, its warning, and the
next destination. Effects and audio react to bounded event/state transitions and never
become sources of truth.

## 6. Runtime and verification

Development runs the Vite client and watched Node server directly through `pnpm dev`.
Production publishes the Vite output as static files and runs the compiled Node server as
one long-lived process. TLS, static serving, and process management belong to the hosting
platform; horizontal server scaling and scale-to-zero are not supported while matches
remain in process memory. See `DEPLOYMENT.md`.

`TESTING.md` defines the required evidence. Pure simulation tests sit beside shared
modules; real-WebSocket integration, network, performance, soak, production smoke, and
Playwright journeys live under `tests/`. `tests/REQUIREMENTS.md` maps game and architecture
requirements to executable evidence.

## 7. Deferred scope

More than two players, multiple rings, obstacles, power-ups, progression, reconnection,
binary transport, and horizontal match routing remain deferred. Add them only with a
concrete product need and an updated `GAME.md`/architecture contract.
