import { expect, test } from '@playwright/test';

test('production client renders WebGL, connects, and enters matchmaking', async ({
  page,
  request,
}) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  const loadedAssets = new Set<string>();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(request.url()));
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/assets/')) loadedAssets.add(path);
    if (response.status() >= 400) failedRequests.push(response.url());
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
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
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
