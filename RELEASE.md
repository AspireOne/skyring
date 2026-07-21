# SkyRing Release Evidence

## Candidate

- **Revision:** _pending final Milestone 7 commit_
- **Date/owner:** _pending_
- **Client image/URL:** _pending deployment target and credentials_
- **Server image/URL:** _pending deployment target and credentials_
- **Rollback revisions:** _pending_

## Automated gates

- [x] `pnpm verify:release` passed on 2026-07-21: 157 unit, 2 asset, 2 requirement,
      18 integration, 5 network, 2 performance, 1 browser-performance, 2 soak,
      1 production-smoke, and 8 functional browser tests.
- [x] `pnpm test:containers` built the pinned server/client OCI images, ran them as
      unprivileged users, and verified their health payloads and Compose definition.
- [x] Network, performance, soak, container-size, and regression details are recorded in
      `PROGRESS.md`, `NETWORK.md`, and `PERFORMANCE.md`.

## External gates

- [ ] Server and client images published with immutable revision tags.
- [ ] Public server `/health` returns 200 through TLS.
- [ ] Public client loads all assets with no console/network errors.
- [ ] Two isolated production browsers pair and complete regulation/result handling.
- [ ] Two people complete the `PLAYTEST.md` protocol over the real internet.
- [ ] Any resulting tuning change is documented and all affected gates are rerun.
- [ ] Rollback target and operator are confirmed.

These boxes intentionally remain unchecked until observed against the real deployment.
