import { expect, test } from '@playwright/test';

import {
  expectBrowserEvidenceClean,
  trackBrowserEvidence,
} from './browser-evidence.js';

test('production client renders WebGL, connects, and enters matchmaking', async ({
  page,
  request,
}) => {
  const evidence = trackBrowserEvidence(page);
  const loadedAssets = new Set<string>();
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/assets/')) loadedAssets.add(path);
  });

  const healthResponse = await request.get('http://127.0.0.1:4174/health');
  expect(healthResponse.ok()).toBe(true);
  await expect(healthResponse.json()).resolves.toMatchObject({
    status: 'ok',
    service: 'skyring-server',
  });

  // Use an isolated room so this solo client never pairs with a parallel test.
  await page.goto(`/?room=SOLO${Date.now() % 100000}`);
  const app = page.locator('#app');
  const canvas = page.locator('[data-testid="scene-canvas"]');

  await expect(app).toHaveAttribute('data-render-status', 'ready');
  await expect(app).toHaveAttribute('data-sim-hz', '60');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-models-ready', 'true');

  // A single client queues and waits for an opponent — proving the full
  // handshake → welcome → queue path over a real socket.
  await expect(app).toHaveAttribute('data-net-phase', 'queued');
  await expect(page.locator('[data-testid="net-status"]')).toContainText(
    'Waiting for an opponent',
  );
  expectBrowserEvidenceClean([evidence]);
  for (const asset of [
    '/assets/models/aeroplane.glb',
    '/assets/models/airco-dh2.glb',
    '/assets/audio/fire.ogg',
    '/assets/audio/hit.ogg',
    '/assets/audio/teleport.ogg',
  ]) {
    expect(loadedAssets.has(asset), `${asset} was not requested`).toBe(true);
  }
});
