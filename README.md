# Plane Shooter

A browser-based 3D game built with Three.js, TypeScript, and Vite.

## Development

```sh
pnpm install
pnpm dev
```

Create a production build with `pnpm build`, then serve it locally with
`pnpm preview`.

## Code quality

Run the project checks individually with:

```sh
pnpm typecheck
pnpm lint
pnpm knip
pnpm format:check
```

The pre-commit hook type-checks the project, reports project-wide Knip findings
without blocking, lints staged source files, and formats and re-stages supported
staged files. TypeScript and ESLint errors block the commit; warnings do not.

TypeScript 7 provides the `tsc` binary through `@typescript/native`. The
`typescript` dependency exposes the TypeScript 6 compatibility API required by
typescript-eslint until TypeScript 7.1 introduces its new programmatic API.

---

## Coding principles

- Make sure cleanliness, clarity, explicitness, reliability, or just simpleness in code and functionality and design (arcihtectural etc.) is preferred over over-engineering or clever solutions.
- Split code into files and directories, ideally encapsulated by domain.
- Functionality and correctness should be enforced by the architecture/code itself. The architecture itself should make it, ideally, impossible for bugs or issues or error surfaces to arise.
