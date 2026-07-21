# SkyRing

A 1v1 online aerial king-of-the-hill game built with Three.js, TypeScript, Node,
and WebSockets. Players score by controlling a moving capture volume and use
projectile knockback—never damage—to bonk one another out of position.

The game is under active development. Read these documents before contributing:

- [`GAME.md`](./docs/GAME.md) — gameplay and feel.
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — current technical invariants.
- [`TESTING.md`](./docs/TESTING.md) — verification strategy.
- [`DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — production runtime contract.
- [`AGENTS.md`](./AGENTS.md) — repository workflow for implementation agents.

## Requirements

- Node 24 or newer.
- pnpm 11 or newer.

## Development

```sh
pnpm install
pnpm dev          # client and server together
pnpm dev:client   # client only
pnpm dev:server   # server only
```

The Vite client and Node server run together. The server exposes `GET /health` and
hosts the WebSocket endpoint. Open the game at <http://localhost:5192>.

## Verification

```sh
pnpm verify             # typecheck, lint, Knip, unit tests, production build
pnpm test:integration   # real HTTP/WebSocket server tests
pnpm test:e2e           # production build plus Playwright Chromium smoke
pnpm test:network       # latency/jitter/stall prediction matrix
pnpm test:performance   # server/snapshot release budgets
pnpm test:soak          # seeded full matches plus repeated real sockets
pnpm test:smoke         # compiled production server entrypoint
pnpm verify:full        # every automated release gate above
```

Use `pnpm test:watch` while developing and `pnpm test:coverage` for diagnostic
coverage. Soak, browser, and production-smoke tests are intentionally kept out of
precommit.

## Production

[`DEPLOYMENT.md`](./docs/DEPLOYMENT.md) defines the static-client/stateful-server topology,
direct build/start commands, TLS/WebSocket requirements, and rollback procedure.
Local automation cannot replace the public deployment and real-internet human gates in
[`PLAYTEST.md`](./docs/PLAYTEST.md).

The pre-commit hook typechecks the workspace, reports project-wide Knip findings,
lints staged source files, and formats supported staged files. TypeScript and ESLint
errors block the commit; warnings do not.
