# SkyRing Deployment and Release Runbook

SkyRing ships as two immutable artifacts: a static client and one long-lived,
stateful Node server. The v1 server must run as exactly one instance because matchmaking
and live matches are intentionally held in process memory.

## Runtime contract

- **Server:** Node 24, `HOST=0.0.0.0`, platform-provided `PORT`, public `GET /health`, and
  WebSocket upgrade support on the same listener. Terminate TLS at the platform/load
  balancer and preserve WebSocket connections for at least the four-minute match plus
  queue/countdown time.
- **Client:** static files built with `VITE_SERVER_URL=wss://<public-server-host>`. This is
  a build-time value, so changing the server origin requires rebuilding the client.
- **Topology:** one server instance only. Do not enable horizontal autoscaling, edge/
  serverless execution, or scale-to-zero while players may be connected.

## OCI images

Build locally from the repository root:

```sh
docker build -f Dockerfile.server -t skyring-server:release .
docker build \
  -f Dockerfile.client \
  --build-arg VITE_SERVER_URL=wss://game-server.example.com \
  -t skyring-client:release \
  .
```

Both images run as unprivileged processes on port 8080 and contain health checks. The
server build deploys only its production dependency graph and compiled workspace output;
the client runtime contains only Nginx and the Vite artifact.

`pnpm test:containers` reproducibly builds both images, validates the Compose definition,
runs each image as its declared unprivileged user, and checks its published health
response. For an interactive local production-topology check, `docker compose up --build`
serves the client at `http://localhost:4173` and the authoritative server at
`ws://localhost:8080`. Open two private browser contexts with the same `?room=CODE` query
to pair them deterministically.

## Platform deployment

1. Publish both images to the chosen registry using an immutable revision tag.
2. Deploy the server first as one long-lived instance; set `HOST=0.0.0.0`, accept the
   platform `PORT`, enable TLS/WebSocket upgrades, and wait for `/health` to pass.
3. Build/deploy the client with the server's public `wss://` URL.
4. Run `pnpm verify:release` locally against the exact revision, then perform the release
   evidence in `RELEASE.md` against the public URLs.
5. Roll back both artifacts to their prior immutable tags if health, browser console,
   matchmaking, or the two-player journey fails. Existing in-memory matches do not
   survive a server rollout, so announce/perform releases with no active players.

## Required production evidence

Do not call a revision shipped until all items in `RELEASE.md` have real values: public
client/server URLs, immutable image revisions, passing health and WebSocket smoke,
two production browsers completing a match, and a two-person real-internet playtest.
Local container and automated results are necessary but do not substitute for those
external checks.
