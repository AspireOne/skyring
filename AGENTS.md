# SkyRing Agent Instructions

- Commit after each significant chunk of changes, given the repository is in a fully
  correct and self-contained state.

## Authority and required reading

Read these files before changing architecture or gameplay:

1. `docs/GAME.md` defines what the game is and how it should feel.
2. `docs/ARCHITECTURE.md` defines the current technical invariants and package boundaries.
3. `docs/TESTING.md` defines the required verification evidence.

If implementation reality requires a gameplay change, update `docs/GAME.md` before
implementing it. If an architectural contract changes, update `docs/ARCHITECTURE.md`.
Tests must change with the governing behavior, never silently redefine it.

## Delivery workflow

- Complete and verify one cohesive vertical slice before deepening the next.
- Build tests with each feature according to `docs/TESTING.md`; do not defer the test suite
  to a final pass.
- Keep the authoritative simulation pure, fixed-step, seeded, and shared. Clients send
  intent only and never choose authoritative state or match configuration.
- Preserve package boundaries: shared imports no browser/Node APIs; client and server do
  not import one another; cross-boundary contracts live in shared.
- Keep every gameplay/netcode tunable in the immutable shared game config. Avoid magic
  numbers in subsystem code.
- Prefer the smallest maintainable implementation that satisfies the current behavior.
  Do not prebuild deferred features from `docs/GAME.md` §12.

## Verification

- During implementation, run focused tests and affected typechecking.
- Before completing a significant slice, run `pnpm verify` plus its affected integration
  and browser scenarios.
- Before shipping, run `pnpm verify:full`, the soak/network lanes, a production smoke
  test, and the human playtest protocol.
- Treat flaky tests, browser console errors, leaked handles, and undocumented Knip/lint
  suppressions as defects.
- Report exact commands and results with the completed change.

## Code and repository conventions

- Use strict TypeScript and make invalid states difficult to represent.
- Favor explicit data flow, small cohesive modules, and existing shared primitives over
  clever or speculative abstractions.
- Inspect nearby code and repository guidance before adding new patterns.
- Use Conventional Commits when committing. Every commit has a title and body. Stage
  only changes belonging to that commit because unrelated user changes may be present.
- Do not rewrite, discard, or clean unrelated worktree changes.
