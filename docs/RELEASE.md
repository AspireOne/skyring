# SkyRing Release Evidence

## Candidate

- **Revision:** _pending_
- **Date/owner:** _pending_
- **Client URL:** _pending deployment target and credentials_
- **Server URL:** _pending deployment target and credentials_
- **Rollback revision:** _pending_

## Automated gates

- [x] `pnpm verify:full` passed on 2026-07-22: 157 unit, 2 asset, 2 requirement,
      18 integration, 5 network, 2 performance, 1 browser-performance, 2 soak,
      1 production-smoke, and 8 functional browser tests.
- [x] Network, performance, soak, and regression details are recorded in `PROGRESS.md`,
      `NETWORK.md`, and `PERFORMANCE.md`.

## External gates

- [ ] Public server `/health` returns 200 through TLS.
- [ ] Public client loads all assets with no console/network errors.
- [ ] Two isolated production browsers pair and complete regulation/result handling.
- [ ] Two people complete the `PLAYTEST.md` protocol over the real internet.
- [ ] Any resulting tuning change is documented and all affected gates are rerun.
- [ ] Rollback revision and operator are confirmed.

These boxes intentionally remain unchecked until observed against the real deployment.
