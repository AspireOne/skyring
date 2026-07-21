# SkyRing Functional Bugs

This file records confirmed functional defects in the game runtime. It excludes
deployment, release, CI/CD, container, and test-infrastructure concerns. The
confirmations below come from static code/data-flow traces against `GAME.md` and
`ARCHITECTURE.md`. Per the review constraint, no tests were run.

Severities use:

- **critical:** catastrophic or unacceptable failure; must be fixed before merge.
- **high:** serious defect in an important or realistic flow; normally must be fixed.
- **medium:** real but limited or recoverable defect; may be acceptable to ship.
- **low:** minor correctness defect with small practical impact; optional fix.

## B001 — Displayed scores can contradict the match result

- **Status:** fixed and verified
- **Severity:** medium
- **Location:** `packages/shared/src/sim/ring.ts` (`resolveScoring`),
  `packages/shared/src/sim/match.ts` (sudden-death termination),
  `packages/client/src/hud/hud-model.ts` (`projectHud`), and
  `packages/client/src/hud/hud.ts` (`showResult`).
- **What's wrong:** authoritative scores accrue fractionally, but the HUD floors both
  scores to integers. A player can therefore win while the scoreboard appears tied.
  Sudden death reliably exposes this with the defaults: its winning tick adds `1 / 60`
  point, which is invisible after flooring.
- **Why it matters:** the score is the explanation of who is winning. A result overlay
  that declares a winner over an apparently tied final score violates the game's
  readability goal and makes the outcome look arbitrary.
- **Verification:** `resolveScoring` adds `RING_POINTS_PER_SEC * dt`; with the defaults,
  one scoring tick adds `1 * (1 / 60) = 0.01666…`. Sudden death ends on that first
  scoring tick. `projectHud` then applies `Math.floor` to both scores, while `showResult`
  renders only `YOU WIN` / `YOU LOSE`. A sudden-death state of `10`–`10` therefore ends
  authoritatively at approximately `10.0167`–`10` but is displayed as `10`–`10`. The
  same contradiction occurs at regulation end whenever the lead is only fractional.
- **Suggested fix:** use a score presentation that preserves meaningful fractional
  differences down to the smallest configured scoring tick, and show the formatted
  final score on the result overlay. Keep the authoritative continuous scoring and
  sudden-death ordering unchanged.
- **Resolution:** the HUD now formats live and final authoritative scores with enough
  decimal places to expose one configured scoring tick. Match results are projected from
  `matchEnd.scores` into each player's perspective and render the final score beneath the
  outcome. Covered by HUD projection regressions and the regulation/sudden-death browser
  journeys. Verification passed with `pnpm verify` and
  `pnpm build:e2e && pnpm exec playwright test tests/e2e/lifecycle.spec.ts` (3/3).

## B002 — The client does not consistently apply the authoritative match config

- **Status:** fixed and verified
- **Severity:** medium
- **Location:** `packages/client/src/game/game-controller.ts` (constructor,
  `onNetUpdate`, and `startInput`) and `packages/client/src/render/renderer.ts`
  (constructor).
- **What's wrong:** `matchFound.constants` updates the HUD config and local prediction,
  but the renderer was already constructed with `DEFAULT_GAME_CONFIG`, and the input
  timer always uses `DEFAULT_GAME_CONFIG.SIM_HZ`.
- **Why it matters:** a server-selected arena or simulation tick-rate change leaves the
  client drawing old boundaries and driving prediction at the wrong wall-clock rate.
  This breaks the explicit guarantee that the effective config sent by the server keeps
  both sides aligned without requiring a matching client rebuild.
- **Verification:** `GameController` constructs `Renderer(DEFAULT_GAME_CONFIG)` before a
  connection exists. When `matchFound` arrives, `onNetUpdate` stores `net.constants` in
  `this.config`, but only passes the slot to the existing renderer. `startInput` also
  derives its interval from `DEFAULT_GAME_CONFIG.SIM_HZ`. In contrast,
  `LocalPrediction` is constructed from `message.constants`, so a server at 30 Hz makes
  prediction advance a 1/30-second shared step 60 times per client second, while a
  server at 120 Hz makes it advance only 60 times. Arena changes are likewise simulated
  authoritatively but rendered using the bundled default dome, ground, fog, and camera
  range. The `matchFound.constants` contract therefore does not align the whole client.
- **Suggested fix:** initialize or reconfigure config-dependent rendering and input
  systems from `matchFound.constants`. Do not retain gameplay or arena timing from the
  client's bundled defaults once the effective config arrives.
- **Resolution:** `GameController` now applies `matchFound.constants` once to the input
  cadence, diagnostics, HUD, prediction, and renderer. The renderer delegates its
  config-dependent arena shell to `ArenaView`, which safely rebuilds the camera range,
  fog, ground, grid, and dome while disposing replaced resources. The browser fixture
  deliberately differs from bundled defaults (`SIM_HZ=30`, `DOME_RADIUS=680`,
  `GROUND_Y=10`) and verifies both clients adopt those values. Verification passed with
  `pnpm verify` and `pnpm build:e2e && pnpm test:e2e:run` (8/8).

## B003 — Client prediction drops elapsed fixed steps when its timer is delayed

- **Status:** confirmed by browser-timer semantics and static runtime trace
- **Severity:** medium
- **Location:** `packages/client/src/game/game-controller.ts` (`startInput`).
- **What's wrong:** prediction and input sending are driven by a plain `setInterval`.
  There is no elapsed-time accumulator or bounded catch-up loop, so delayed callbacks
  advance one simulation step regardless of how many fixed steps elapsed.
- **Why it matters:** the authoritative server continues ticking and reuses the last
  input while the client falls behind. Reconciliation recovers correctness, but the
  local plane can visibly lurch after ordinary browser scheduling stalls, undermining
  the prediction path whose purpose is responsive local flight.
- **Verification:** each interval callback calls `sendInput` exactly once, and
  `LocalPrediction.predict` advances exactly one fixed step for that command. There is
  no use of elapsed time anywhere in this path. If a nominal 16.7 ms callback is delayed
  to 50 ms, the client advances one tick while the server can advance three. The server
  reuses its last valid input for the missing ticks, so its plane legitimately moves
  farther. The next snapshot can only correct that divergence; it cannot recover the
  omitted local prediction steps before the correction becomes visible. This is also a
  direct mismatch with `ARCHITECTURE.md` §3.3, which requires elapsed fixed-step
  accounting with bounded catch-up in both loops.
- **Suggested fix:** drive client prediction through a drift-corrected fixed-step
  accumulator using the authoritative `SIM_HZ`, with the documented bounded catch-up
  policy.

## B004 — Projectile collision is not swept against plane movement

- **Status:** confirmed by static geometry trace
- **Severity:** medium
- **Location:** `packages/shared/src/sim/match.ts` (`stepActivePlay`) and
  `packages/shared/src/sim/collision.ts` (`segmentHitsSphere`).
- **What's wrong:** planes move before projectile collision, but collision tests the
  projectile segment only against the plane's final center. The plane's movement over
  the same tick is absent from the sweep.
- **Why it matters:** a moving plane can be missed even though its sphere intersected the
  shot earlier in the tick, or hit based on a final position it had not reached when the
  shot passed. Grazing errors are possible at normal speed and grow after knockback.
- **Verification:** `stepActivePlay` integrates both planes first. `stepBullets` retains
  only each bullet's previous/current positions, and `segmentHitsSphere` measures that
  segment against `plane.pos`, which is already the final plane center. No previous plane
  position reaches the collision function. At the default 60 Hz, a bullet travels about
  6.67 units and a plane at normal maximum speed travels about 2.33 units per tick. Those
  movements are enough for the relative trajectories to pass within the 12-unit hit
  radius while the bullet segment remains more than 12 units from the final center. The
  inverse produces a false hit. Hit impulses increase the unrepresented plane movement,
  so this is not limited to unsupported or invalid state.
- **Suggested fix:** test projectile-to-plane collision in relative motion over the
  tick, retaining or capturing the plane's pre-step position so both trajectories are
  represented. Preserve the documented firing order by distinguishing bullets that
  already existed at tick start from bullets spawned after plane movement, or restructure
  integration so every participating trajectory has one explicitly shared time interval.

## B005 — A projectile's final segment is discarded before hit resolution

- **Status:** confirmed by static lifecycle/config trace
- **Severity:** medium
- **Location:** `packages/shared/src/sim/bullet.ts` (`stepBullets`) and
  `packages/shared/src/sim/match.ts` (`stepActivePlay`).
- **What's wrong:** bullets that reach zero lifetime or finish a step at/past the ground
  or dome are removed inside `stepBullets`, before `resolveBulletHits` examines their
  final swept segment.
- **Why it matters:** a projectile can cross a plane and then the arena boundary, or
  cross a plane during its final lifetime step, yet register no hit. This is especially
  relevant when fighting an opponent against a boundary.
- **Verification:** `stepBullets` decrements lifetime and compacts the array using
  endpoint lifetime/ground/dome checks. `resolveBulletHits` receives only that compacted
  array afterward, so discarded bullets' `previousPos -> pos` segments are unreachable.
  The failure does not require invalid configuration: for example, a validated effective
  config can use a one-tick projectile lifetime or a bullet displacement larger than the
  hit radius, in which case a projectile may cross a target during its only/final step
  and is always removed before collision. With the defaults, the vulnerable case is
  narrower because the 6.67-unit bullet step is smaller than the 12-unit hit radius, but
  it remains reachable for newly spawned or relative-moving contacts near the arena
  boundary. The original medium severity is retained because the gun is core gameplay,
  while the default exposure is limited and recoverable.
- **Suggested fix:** preserve final projectile segments through collision resolution,
  resolve the earliest valid target/boundary contact, and expire only surviving
  projectiles afterward. Merely postponing all expiry is insufficient because it could
  allow a target beyond the arena boundary to be hit.

## B006 — The ring-relocation warning does not reliably reveal the destination

- **Status:** confirmed by static presentation/data-flow trace
- **Severity:** medium
- **Location:** `packages/shared/src/sim/ring.ts` (`stepRing`),
  `packages/client/src/hud/hud-model.ts` (`projectHud`),
  `packages/client/src/hud/hud.ts` (`update`),
  `packages/client/src/render/renderer.ts` (`updateRing`), and
  `packages/client/src/render/sound.ts` (`handleEvents`).
- **What's wrong:** the HUD model receives `nextCenter`, but the HUD never renders it.
  The only destination cue is a world-space sphere that can be outside the chase
  camera's view. The warning transition also has no audio cue; audio plays when the ring
  teleports, after the strategic warning window has ended.
- **Why it matters:** a player can know relocation is imminent without knowing where to
  fly. That prevents the warning from consistently serving as the intended shared race
  to the next location.
- **Verification:** `stepRing` sets `warning` and `nextCenter` together, so the server
  state is correct. `projectHud` carries both values, but `Hud.update` uses only
  `warning`, rendering the generic text `Ring relocating!`; it never reads
  `nextCenter`. `Renderer.updateRing` places a marker at the destination in world space,
  but the chase camera has no free-look or off-screen indicator, so a destination behind
  the plane/camera is not visible without first turning away from the current course.
  `SoundEngine` handles `ringTeleport`, not the warning transition, and there is no
  warning event. This falls short of both `GAME.md` §4's visual-plus-audio warning and
  `ARCHITECTURE.md` §5's next-destination requirement.
- **Suggested fix:** add a screen-space direction/distance indicator for `nextCenter`
  and play a one-shot warning cue when `warning` changes from false to true, either via a
  dedicated authoritative event or deduplicated snapshot-state transition.

## B007 — A countdown disconnect is presented as a draw instead of a no-contest

- **Status:** confirmed by static lifecycle/protocol trace
- **Severity:** low
- **Location:** `packages/server/src/match.ts` (`handleDisconnect`),
  `packages/shared/src/messages.ts` (`MatchResult` / `MatchEndReason`), and
  `packages/client/src/hud/hud.ts` (`RESULT_LABEL`).
- **What's wrong:** a disconnect during countdown sends the survivor
  `result: 'draw'` with `reason: 'opponentLeft'`, and the client displays `DRAW`. The
  governing rule calls this a no-contest, not a played tie.
- **Why it matters:** the match is canceled before play begins, so the result text is
  semantically wrong. The impact is currently limited because there is no ranking or
  progression attached to the result.
- **Verification:** `handleDisconnect` defines live play as only `Playing` or
  `SuddenDeath`. In `Countdown`, it therefore selects `result: 'draw'` for the survivor
  and sends `reason: 'opponentLeft'`. `MatchResult` has no no-contest value, and
  `Hud.showResult` receives the result message and maps `draw` unconditionally to `DRAW`;
  it does not inspect the latest snapshot phase or even the supplied reason. The low
  severity remains appropriate because the match terminates correctly and no competitive
  record currently distinguishes the outcomes.
- **Suggested fix:** represent no-contest explicitly in the match-end contract and render
  a distinct cancellation result.
