# SkyRing Release Performance Budgets

These are regression ceilings for the representative automated environments, not claims
about every device or host. `pnpm test:performance` reports the current values on each
run; the production browser journey reports frame cadence from headless Chromium with
software WebGL.

| Surface               | Scenario                                                     | Release ceiling | Rationale                                                                                                                      |
| --------------------- | ------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Server simulation     | p95 time to advance 32 concurrent matches for one 60 Hz tick | 16.67 ms        | One expected single-instance frame; leaves no claim of capacity beyond 32 active matches                                       |
| Snapshot payload      | JSON bytes with the configured maximum 64 projectiles        | 16 KiB          | Keeps 30 Hz per-recipient traffic bounded under maximum projectile state                                                       |
| Client frame cadence  | p95 across 100 post-warmup frames at 960×540                 | 50 ms           | Detects severe software-WebGL regressions without pretending CI is a gaming device; 1440×900 remains a layout/readability lane |
| Aircraft assets       | Combined binary glTF source weight                           | 2 MiB           | Enforced by `tests/assets/assets.test.ts`                                                                                      |
| Prediction correction | Maximum raw local error across the release network matrix    | 250 world units | Safety ceiling; smoothing/snap policy still converges rendered state below 0.001 units                                         |

The initial Milestone 7 baseline and exact command results are recorded in `PROGRESS.md`.
A real deployment must still monitor host CPU/memory and player-observed frame comfort;
these local ceilings are release regression evidence, not operational telemetry.
