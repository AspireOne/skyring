# SkyRing Agent Instructions

- Commit after each milestone / after each significant chunk of changes, given the repository is in a fully correct and self contained state.

## Authority and required reading

Read these files before changing architecture or gameplay:

1. `GAME.md` defines what the game is and how it should feel.
2. `IMPLEMENTATION.md` defines the technical architecture and milestone order.
3. `DECISIONS.md` records resolved design and implementation choices.
4. `TESTING.md` defines the evidence required for each milestone.
5. `PROGRESS.md` is the durable handoff and verification log.

If implementation reality requires a gameplay change, update `GAME.md` and
`DECISIONS.md` before implementing it. If an architectural choice changes, update
`IMPLEMENTATION.md` and `DECISIONS.md`. Tests must change with the governing behavior,
never silently redefine it.

## Delivery workflow

- Follow the milestones in `IMPLEMENTATION.md` §16 in order. Complete and verify one
  vertical slice before deepening the next.
- Update `PROGRESS.md` whenever a milestone, decision, limitation, or verification lane
  changes. It must be possible for a fresh agent to resume from that file.
- Build tests with each feature according to `TESTING.md`; do not defer the test suite to
  a final pass.
- Keep the authoritative simulation pure, fixed-step, seeded, and shared. Clients send
  intent only and never choose authoritative state or match configuration.
- Preserve package boundaries: shared imports no browser/Node APIs; client and server do
  not import one another; cross-boundary contracts live in shared.
- Keep every gameplay/netcode tunable in the immutable shared game config. Avoid magic
  numbers in subsystem code.
- Prefer the smallest maintainable implementation that satisfies the current milestone.
  Do not prebuild deferred features from `GAME.md` §12.

## Verification

- During implementation, run focused tests and affected typechecking.
- Before marking a milestone complete, run `pnpm verify` plus its required integration
  and browser scenarios from `TESTING.md` §13.
- Before shipping, run `pnpm verify:full`, the soak/network lanes, a production smoke
  test, and the human playtest protocol.
- Treat flaky tests, browser console errors, leaked handles, and undocumented Knip/lint
  suppressions as defects.
- Record exact commands and results in `PROGRESS.md`.

## Code and repository conventions

- Use strict TypeScript and make invalid states difficult to represent.
- Favor explicit data flow, small cohesive modules, and existing shared primitives over
  clever or speculative abstractions.
- Inspect nearby code and repository guidance before adding new patterns.
- Use Conventional Commits when committing. Every commit has a title and body. Stage
  only changes belonging to that commit because unrelated user changes may be present.
- Do not rewrite, discard, or clean unrelated worktree changes.
