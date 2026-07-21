# SkyRing Deployment and Release Runbook

SkyRing deploys as a static Vite client and one long-lived, stateful Node server. The
hosting platform serves the client files and manages TLS, domains, process restarts, and
WebSocket forwarding; the repository owns only the application build and runtime.

## Development

Install dependencies and run both applications from the repository root:

```sh
pnpm install
pnpm dev
```

Use `pnpm dev:client` and `pnpm dev:server` when separate terminals are preferable.
The development client is available at <http://localhost:5192> by default.

## Production contract

- **Client:** build with `VITE_SERVER_URL=wss://<public-server-host>` and publish
  `packages/client/dist` as a static site. The server URL is embedded at build time, so
  changing it requires rebuilding the client.
- **Server:** use Node 24, set `HOST=0.0.0.0` and the platform-provided `PORT`, and run the
  compiled entry with `pnpm start:server`. The same listener provides public `GET /health`
  and WebSocket upgrades.
- **Topology:** run exactly one server instance. Matchmaking and live matches stay in
  process memory, so do not enable horizontal autoscaling, serverless/edge execution, or
  scale-to-zero while players may be connected.
- **Network:** terminate TLS at the platform and preserve WebSocket connections for at
  least the four-minute match plus queue and countdown time.

## Direct deployment

Configure two applications from the same repository checkout in Coolify or an equivalent
platform.

### Server application

```sh
pnpm install --frozen-lockfile
pnpm build:server
pnpm start:server
```

Set `HOST=0.0.0.0`; let the platform provide `PORT`. Deploy the server first, enable
WebSocket upgrades, and wait for its public `/health` endpoint to return 200 through TLS.

### Client static site

```sh
pnpm install --frozen-lockfile
VITE_SERVER_URL=wss://game-server.example.com pnpm build:client
```

Publish `packages/client/dist`. The platform must serve `index.html` for unknown paths so
the client remains compatible with browser navigation, and should apply immutable caching
to fingerprinted files under `assets/`.

## Release and rollback

Run `pnpm verify:full` against the exact revision and record the revision, public URLs,
operator, and rollback revision in the release or hosting system. Deploy during a window
with no active matches because a server restart ends all in-memory matches. Roll back both
applications if health, asset loading, browser console, matchmaking, or the two-player
journey fails.

Local automation does not replace the public two-browser journey or the two-person
real-internet playtest.
