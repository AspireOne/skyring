# SkyRing

A 1v1 online aerial king-of-the-hill game built with Three.js, TypeScript, Node,
and WebSockets. Players score by controlling a moving capture volume and use
projectile knockback—never damage—to bonk one another out of position.

The game is under active development. Read these documents before contributing:

- [`GAME.md`](./GAME.md) — gameplay and feel.
- [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) — architecture and milestone order.
- [`DECISIONS.md`](./DECISIONS.md) — settled foundational choices.
- [`TESTING.md`](./TESTING.md) — verification strategy.
- [`PROGRESS.md`](./PROGRESS.md) — current milestone and resumable handoff.
- [`AGENTS.md`](./AGENTS.md) — repository workflow for implementation agents.

## Requirements

- Node 24 or newer.
- pnpm 11 or newer.

## Development

```sh
pnpm install
pnpm dev
```

The Vite client and Node server run together. The server exposes `GET /health` and
hosts the WebSocket endpoint; gameplay protocol work begins in Milestone 2.

## Verification

```sh
pnpm verify             # typecheck, lint, Knip, unit tests, production build
pnpm test:integration   # real HTTP/WebSocket server tests
pnpm test:e2e           # production build plus Playwright Chromium smoke
pnpm verify:full        # all of the above
```

Use `pnpm test:watch` while developing and `pnpm test:coverage` for diagnostic
coverage. Soak tests are intentionally kept out of precommit and run explicitly with
`pnpm test:soak` once long-running scenarios exist.

The pre-commit hook typechecks the workspace, reports project-wide Knip findings,
lints staged source files, and formats supported staged files. TypeScript and ESLint
errors block the commit; warnings do not.
