# SkyRing Playtest and Feel Evidence

This is the durable record for the human-only acceptance questions in
`tests/REQUIREMENTS.md`. Automated evidence remains in the test suite; this file does not
present automation or an AI inspection as human opinion.

## Pre-human presentation review — 2026-07-21

- **Revision:** `2407a76` (resulting presentation/content commit)
- **Participants:** implementation agent operating production-built Chromium journeys;
  no human playtester
- **Configuration:** production defaults for ordinary flight/combat; shortened,
  server-owned lifecycle/ring timing for deterministic browser journeys
- **Network:** local WebSocket; the synthetic latency/jitter/stall lane was rerun
  separately
- **Viewports:** 360×640 and 1440×900

### Evidence and decisions

| Question                                                  | Observation                                                                                                                                                                                                                          | Decision                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Can both aircraft and the scoring space be distinguished? | Both licensed glTF aircraft loaded in every browser journey; cyan/coral identity accents and the translucent, banded spherical ring remained visible at both viewport sizes.                                                         | Keep the distinct models and color pairing.                                                                                     |
| Are HUD essentials readable without clipping?             | Score, timer, ring state, warning, ammo, and result stayed within both supported viewports with no page overflow. Meter/status/alert semantics expose dynamic state.                                                                 | Keep the compact breakpoint and full-width compact ammo meter.                                                                  |
| Does event feedback remain bounded and technically clean? | Fire, hit, bounce, stumble, and teleport effects expire; audio uses one decoded buffer per clip with one-shot Web Audio nodes. Seven concurrent production browser journeys completed without console or failed-request evidence.    | Keep the short effects; the initial HTML-audio voice pool was replaced after Chromium exposed redundant/aborted media requests. |
| Is the arena readable from the chase camera?              | Initial visual inspection found the night palette too dark against both aircraft. Raising the sky/ground and ambient, hemisphere, and directional light levels made silhouettes and ring bands readable without changing simulation. | Retain the brighter arcade palette.                                                                                             |
| Should gameplay constants change before human play?       | Exact-tick tests and browser journeys support correctness, but shortened automation cannot establish the four-minute rhythm, humor, comfort, or whether hit recovery feels fair.                                                     | Keep `DEFAULT_GAME_CONFIG` unchanged until a real session supplies subjective evidence.                                         |

### What this review cannot accept

The following requirements remain explicitly human-only: playful tone, 3D volume
comprehension from natural play, meaningful bonk opportunity, approachable flight feel,
full-match comfort, and the four-minute rhythm. They must be judged by people playing a
complete match; no automated pass is treated as proof of fun.

## Required human session

Run two production clients through one complete four-minute match, including at least
one clean knock-out, one ring relocation race, a recovery from stumble, and—if the score
ties—a sudden-death finish. Repeat under realistic internet latency before shipping.

Record one row per session:

| Date/revision | Participants | Network/config                                          | Confusion or discomfort | Fun/rhythm observations | Tuning decision               |
| ------------- | ------------ | ------------------------------------------------------- | ----------------------- | ----------------------- | ----------------------------- |
| _Pending_     | _Pending_    | Production defaults; real internet required before ship | _Pending_               | _Pending_               | Do not tune without evidence. |

Ask each participant, without coaching:

1. What causes scoring, and which player is scoring now?
2. Where will the ring move, and did its visible boundary match the scoring boundary?
3. Did controls, ammo, hits, stumble, and recovery behave as expected?
4. Were camera motion, flashes, HUD, and audio comfortable for the full match?
5. Where did the match drag, feel oppressive, or produce a memorable/funny moment?

Any gameplay change discovered here updates `GAME.md` first; any technical contract change
updates `ARCHITECTURE.md`. Tuning goes through `shared/constants.ts` and reruns the affected
automated lanes.
