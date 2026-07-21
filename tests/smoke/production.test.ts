import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import { TestClient } from '../support/test-client.js';

let child: ChildProcessWithoutNullStreams | undefined;

afterEach(async () => {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await waitForExit(child);
  }
  child = undefined;
});

describe('compiled production server artifact', () => {
  it('boots, serves health, pairs real clients, and shuts down cleanly', async () => {
    const started = await startProductionServer();
    child = started.process;

    const response = await fetch(`${started.httpUrl}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'skyring-server',
      simHz: 60,
    });

    const one = await TestClient.connect(started.wsUrl);
    const two = await TestClient.connect(started.wsUrl);
    try {
      await Promise.all([one.handshake(), two.handshake()]);
      one.send({ t: 'queue', mode: 'room', room: 'PRODSMOKE' });
      two.send({ t: 'queue', mode: 'room', room: 'PRODSMOKE' });

      const [foundOne, foundTwo] = await Promise.all([
        one.next('matchFound'),
        two.next('matchFound'),
      ]);
      expect(new Set([foundOne.yourSlot, foundTwo.yourSlot])).toEqual(
        new Set(['a', 'b']),
      );
      await Promise.all([one.next('snapshot'), two.next('snapshot')]);
    } finally {
      await Promise.all([one.close(), two.close()]);
    }

    child.kill('SIGTERM');
    const exit = await waitForExit(child);
    expect(exit.code).toBe(0);
    expect(exit.signal).toBeNull();
    expect(started.stderr).toHaveLength(0);
    child = undefined;
  });
});

interface StartedProcess {
  readonly process: ChildProcessWithoutNullStreams;
  readonly httpUrl: string;
  readonly wsUrl: string;
  readonly stderr: string[];
}

async function startProductionServer(): Promise<StartedProcess> {
  const server = spawn(process.execPath, ['packages/server/dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
    stdio: 'pipe',
  });
  const stderr: string[] = [];
  let stdout = '';
  server.stderr.on('data', (data: Buffer) => stderr.push(data.toString()));

  const port = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Production server did not announce readiness.')),
      5000,
    );
    server.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(stdout);
      if (!match?.[1]) return;
      clearTimeout(timeout);
      resolve(Number(match[1]));
    });
    server.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Production server exited before readiness: ${String(code ?? signal)}`,
        ),
      );
    });
  });

  return {
    process: server,
    httpUrl: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}`,
    stderr,
  };
}

function waitForExit(
  process: ChildProcessWithoutNullStreams,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  if (process.exitCode !== null) {
    return Promise.resolve({
      code: process.exitCode,
      signal: process.signalCode,
    });
  }
  return new Promise((resolve) => {
    process.once('exit', (code, signal) => resolve({ code, signal }));
  });
}
