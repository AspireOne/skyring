import { spawn } from 'node:child_process';

const tag = process.env.SKYRING_IMAGE_TAG ?? 'verify';
if (!/^[a-z0-9_.-]+$/i.test(tag)) {
  throw new Error(
    'SKYRING_IMAGE_TAG may contain only letters, digits, dot, dash, and underscore.',
  );
}

const nonce = `${process.pid}-${Date.now()}`;
const serverImage = `skyring-server:${tag}`;
const clientImage = `skyring-client:${tag}`;
const serverContainer = `skyring-server-${nonce}`;
const clientContainer = `skyring-client-${nonce}`;
const started: string[] = [];

try {
  await runDocker(['build', '-f', 'Dockerfile.server', '-t', serverImage, '.']);
  await runDocker([
    'build',
    '-f',
    'Dockerfile.client',
    '--build-arg',
    'VITE_SERVER_URL=wss://server.example.invalid',
    '-t',
    clientImage,
    '.',
  ]);
  await runDocker(['compose', 'config', '--quiet']);

  await startContainer(serverContainer, serverImage);
  await startContainer(clientContainer, clientImage);
  await verifyContainer(serverContainer, 'node', 'skyring-server');
  await verifyContainer(clientContainer, 'nginx', 'skyring-client');

  const sizes = await captureDocker([
    'image',
    'inspect',
    serverImage,
    clientImage,
    '--format',
    '{{index .RepoTags 0}}={{.Size}}',
  ]);
  process.stdout.write(`[containers] healthy unprivileged images\n${sizes}`);
} finally {
  if (started.length > 0) {
    await captureDocker(['stop', ...started]).catch((error: unknown) => {
      process.stderr.write(`Container cleanup failed: ${String(error)}\n`);
    });
  }
}

async function startContainer(name: string, image: string): Promise<void> {
  await captureDocker([
    'run',
    '--rm',
    '-d',
    '--name',
    name,
    '-p',
    '127.0.0.1::8080',
    image,
  ]);
  started.push(name);
}

async function verifyContainer(
  name: string,
  expectedUser: string,
  expectedService: string,
): Promise<void> {
  const user = (
    await captureDocker(['inspect', '--format', '{{.Config.User}}', name])
  ).trim();
  if (user !== expectedUser) {
    throw new Error(
      `${name} runs as ${user || 'root'}, expected ${expectedUser}.`,
    );
  }

  const published = (await captureDocker(['port', name, '8080/tcp'])).trim();
  const port = /:(\d+)$/.exec(published)?.[1];
  if (!port)
    throw new Error(`Could not resolve the published port for ${name}.`);

  const deadline = Date.now() + 15_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      const body = (await response.json()) as { service?: unknown };
      if (response.ok && body.service === expectedService) return;
      lastError = new Error(`Unexpected health response: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${name} never became healthy: ${String(lastError)}`);
}

function runDocker(arguments_: readonly string[]): Promise<void> {
  return spawnDocker(arguments_, false).then(() => undefined);
}

function captureDocker(arguments_: readonly string[]): Promise<string> {
  return spawnDocker(arguments_, true);
}

function spawnDocker(
  arguments_: readonly string[],
  capture: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', arguments_, {
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `docker ${arguments_.join(' ')} failed (${String(code ?? signal)}): ${stderr}`,
          ),
        );
      }
    });
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
