import { expect, test } from '@playwright/test';

test('production client renders WebGL, connects, and enters matchmaking', async ({
  page,
  request,
}) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  const healthResponse = await request.get('http://127.0.0.1:4174/health');
  expect(healthResponse.ok()).toBe(true);
  await expect(healthResponse.json()).resolves.toMatchObject({
    status: 'ok',
    service: 'skyring-server',
  });

  await page.goto('/');
  const app = page.locator('#app');
  const canvas = page.locator('[data-testid="scene-canvas"]');

  await expect(app).toHaveAttribute('data-render-status', 'ready');
  await expect(app).toHaveAttribute('data-sim-hz', '60');
  await expect(canvas).toBeVisible();

  // A single client quick-queues and waits for an opponent — proving the full
  // handshake → welcome → queue path over a real socket.
  await expect(app).toHaveAttribute('data-net-phase', 'queued');
  await expect(page.locator('[data-testid="net-status"]')).toContainText(
    'Waiting for an opponent',
  );
  expect(browserErrors).toEqual([]);
});
