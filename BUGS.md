# SkyRing Functional Bugs

This file records confirmed functional defects in the game runtime. It excludes
deployment, release, CI/CD, container, and test-infrastructure concerns. Severities use:

- **critical:** catastrophic or unacceptable failure; must be fixed before merge.
- **high:** serious defect in an important or realistic flow; normally must be fixed.
- **medium:** real but limited or recoverable defect; may be acceptable to ship.
- **low:** minor correctness defect with small practical impact; optional fix.

## B001 — Displayed scores can contradict the match result

- **Status:** pending detailed verification
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
- **Suggested fix:** use a score presentation that preserves meaningful fractional
  differences, and show the formatted final score on the result overlay. Keep the
  authoritative continuous scoring and D007 sudden-death ordering unchanged.

## B002 — The client does not consistently apply the authoritative match config

- **Status:** pending detailed verification
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
- **Suggested fix:** initialize or reconfigure config-dependent rendering and input
  systems from `matchFound.constants`. Do not retain gameplay or arena timing from the
  client's bundled defaults once the effective config arrives.

## B003 — Client prediction drops elapsed fixed steps when its timer is delayed

- **Status:** pending detailed verification
- **Severity:** medium
- **Location:** `packages/client/src/game/game-controller.ts` (`startInput`).
- **What's wrong:** prediction and input sending are driven by a plain `setInterval`.
  There is no elapsed-time accumulator or bounded catch-up loop, so delayed callbacks
  advance one simulation step regardless of how many fixed steps elapsed.
- **Why it matters:** the authoritative server continues ticking and reuses the last
  input while the client falls behind. Reconciliation recovers correctness, but the
  local plane can visibly lurch after ordinary browser scheduling stalls, undermining
  the prediction path whose purpose is responsive local flight.
- **Suggested fix:** drive client prediction through a drift-corrected fixed-step
  accumulator using the authoritative `SIM_HZ`, with the documented bounded catch-up
  policy.

## B004 — Projectile collision is not swept against plane movement

- **Status:** pending detailed verification
- **Severity:** medium
- **Location:** `packages/shared/src/sim/match.ts` (`stepActivePlay`) and
  `packages/shared/src/sim/collision.ts` (`segmentHitsSphere`).
- **What's wrong:** planes move before projectile collision, but collision tests the
  projectile segment only against the plane's final center. The plane's movement over
  the same tick is absent from the sweep.
- **Why it matters:** a moving plane can be missed even though its sphere intersected the
  shot earlier in the tick, or hit based on a final position it had not reached when the
  shot passed. Grazing errors are possible at normal speed and grow after knockback.
- **Suggested fix:** test projectile-to-plane collision in relative motion over the
  tick, retaining or capturing the plane's pre-step position so both trajectories are
  represented.

## B005 — A projectile's final segment is discarded before hit resolution

- **Status:** pending detailed verification
- **Severity:** medium
- **Location:** `packages/shared/src/sim/bullet.ts` (`stepBullets`) and
  `packages/shared/src/sim/match.ts` (`stepActivePlay`).
- **What's wrong:** bullets that reach zero lifetime or finish a step at/past the ground
  or dome are removed inside `stepBullets`, before `resolveBulletHits` examines their
  final swept segment.
- **Why it matters:** a projectile can cross a plane and then the arena boundary, or
  cross a plane during its final lifetime step, yet register no hit. This is especially
  relevant when fighting an opponent against a boundary.
- **Suggested fix:** preserve final projectile segments through collision resolution,
  resolve the earliest valid contact, and expire only surviving projectiles afterward.

## B006 — The ring-relocation warning does not reliably reveal the destination

- **Status:** pending detailed verification
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
- **Suggested fix:** add a screen-space direction/distance indicator for `nextCenter`
  and play a one-shot warning cue when `warning` changes from false to true.

## B007 — A countdown disconnect is presented as a draw instead of a no-contest

- **Status:** pending detailed verification
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
- **Suggested fix:** represent no-contest explicitly in the match-end contract and render
  a distinct cancellation result.
