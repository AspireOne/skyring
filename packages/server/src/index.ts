import { readHost, readPort } from './env.js';
import { createSkyRingServer } from './server.js';

const server = createSkyRingServer();
const address = await server.start(
  readPort(process.env.PORT),
  readHost(process.env.HOST),
);

process.stdout.write(`SkyRing server listening at ${address.httpUrl}\n`);

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await server.stop();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown().then(
      () => process.exit(0),
      (error: unknown) => {
        process.stderr.write(`Server shutdown failed: ${String(error)}\n`);
        process.exit(1);
      },
    );
  });
}
