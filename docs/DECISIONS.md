# SkyRing Decision Record

This file records choices that are settled for the initial implementation. It prevents
later agents from repeatedly reopening foundational questions without new evidence.
When a decision changes, preserve the old entry, mark it superseded, add the replacement,
and update the governing design or implementation document first.

---

## D001 — Server-authoritative shared simulation

**Status:** accepted

Clients send input intent only. The server owns match configuration, state, collisions,
scores, phases, and outcomes. Shared pure simulation code runs on the server and is
reused for limited client prediction.

## D002 — Hand-rolled WebSocket transport for v1

**Status:** accepted

Use `ws` over TCP with JSON messages and a narrow protocol boundary. Do not introduce
Colyseus, Socket.IO, WebRTC, or WebTransport unless profiling or implementation evidence
shows the v1 choice is untenable.

## D003 — Visible projectiles, not hitscan

**Status:** accepted

The gun fires short-lived authoritative projectiles. Collision uses swept movement (or
an equivalently proven method) so a projectile cannot tunnel through a plane at supported
speeds.

## D004 — No gravity in v1

**Status:** accepted

Flight is thrust, steering, momentum, and recovery inside the dome. The ground and
horizon provide orientation; gravity is not part of the initial control burden.

## D005 — Controlled flight speed is separate from total velocity

**Status:** accepted

`flightSpeed` is the throttle-controlled scalar clamped to the configured normal flight
range. `vel` is total world velocity and is not hard-clamped to that range after a hit.
Each flight tick eases `vel` toward `nose * flightSpeed`; hit/recoil impulses therefore
create temporary sideways or over-speed motion that decays naturally. A high emergency
velocity ceiling may guard numerical stability, but it must not erase ordinary bonks.

## D006 — Stumble motion is authoritative state

**Status:** accepted

A plane snapshot includes stumble ticks remaining and tumble angular velocity. The hit
chooses this angular velocity through the match's seeded RNG. This makes snapshots,
prediction, reconciliation, and replay reproducible.

## D007 — Gameplay timing uses integer simulation ticks

**Status:** accepted

Countdown, regulation, ring dwell/warning, fire cooldown, projectile lifetime, and
stumble duration are stored as integer ticks. UI seconds are derived values. Configured
seconds are converted once when effective match configuration is created.

The authoritative playing-tick order is movement/fire/collision/ring update, scoring,
then regulation-clock decrement. The final regulation tick can score. If it ends tied,
the match enters sudden death, relocates/shrinks the ring, and cannot award sudden-death
score until the following tick. The first later tick with a scoring claimant awards that
tick and ends the match.

## D008 — Planes bounce; projectiles do not bank off boundaries

**Status:** accepted

Plane-to-plane contacts use symmetric springy sphere collision with separation and
restitution. Plane-ground and plane-dome contacts also bounce. Projectiles expire when
they reach the ground or dome in v1. This keeps the gun readable while preserving plane
caroms and the game's "everything you fly is springy" promise.

## D009 — The capture zone is a spherical volume

**Status:** accepted

Scoring measures plane-center distance from the zone center in 3D. Rendering must show
the volume clearly—for example, translucent fill plus strong circular bands—rather than
displaying a thin hoop that implies a different boundary.

## D010 — Live disconnect awards the survivor

**Status:** accepted

A disconnect during Playing or SuddenDeath ends the match and awards the remaining
player. A disconnect during Countdown is a no-contest. Reconnection remains out of scope
for v1.

## D011 — Automated scenarios never weaken production authority

**Status:** accepted

Tests may supply validated config overrides, seeds, controlled time, and prescribed
initial server state through test-only fixtures. Clients receive no authoritative state
mutation backdoor, and test scenario endpoints/hooks are absent from production.

## D012 — Collision resolution ends in the playable boundary intersection

**Status:** accepted

Each active tick resolves ordinary ground/dome contacts before plane-to-plane contact,
then stabilizes both planes against the arena once more because symmetric contact
separation can push one across a boundary. Dome and ground projection must finish in
their exact geometric intersection, including the circular ground rim. This preserves
the springy collision ruling while guaranteeing every authoritative tick ends with
legal plane positions; it was adopted after the release soak reproduced a millimeter-
scale boundary escape.

## D013 — Deployment uses direct platform primitives

**Status:** accepted

Build the Vite client as static files for the hosting platform to serve, and run the
compiled Node server directly as one long-lived process. SkyRing does not own Docker,
Compose, or a static-server configuration unless a concrete deployment target later
requires them. The application retains explicit build/start commands, health checks,
full production-artifact verification, and the single-instance server constraint without
maintaining an additional packaging layer.
