import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page, sink: string[]): void {
  page.on('console', (message) => {
    if (message.type() === 'error') sink.push(message.text());
  });
  page.on('pageerror', (error) => sink.push(error.message));
}

test('two players exchange deterministic bonks with ammo, tracers, and stumble feedback', async ({
  browser,
}) => {
  const room = `COMBAT${Date.now() % 100000}`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const errors: string[] = [];
  trackErrors(pageA, errors);
  trackErrors(pageB, errors);

  await Promise.all([
    pageA.goto(`/?room=${room}`),
    pageB.goto(`/?room=${room}`),
  ]);
  await Promise.all(
    [pageA, pageB].map((page) =>
      expect(page.locator('#app')).toHaveAttribute(
        'data-match-phase',
        'playing',
        { timeout: 15_000 },
      ),
    ),
  );

  await expect(pageA.locator('[data-testid="hud-ammo"]')).toBeVisible();
  await Promise.all([
    pageA.keyboard.down('Space'),
    pageB.keyboard.down('Space'),
  ]);

  await expect
    .poll(
      async () =>
        pageA.evaluate(() => (window.__skyringState?.bulletCount ?? 0) > 0),
      { timeout: 3000 },
    )
    .toBe(true);

  await expect
    .poll(
      async () =>
        pageA.evaluate(() => (window.__skyringState?.eventCounts.hit ?? 0) > 0),
      { timeout: 8000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        pageB.evaluate(
          () => (window.__skyringState?.eventCounts.stumble ?? 0) > 0,
        ),
      { timeout: 8000 },
    )
    .toBe(true);

  const spentAmmo = await pageA.evaluate(
    () => window.__skyringState?.localAmmo ?? Number.POSITIVE_INFINITY,
  );
  expect(spentAmmo).toBeLessThan(20);
  await Promise.all([pageA.keyboard.up('Space'), pageB.keyboard.up('Space')]);

  await expect
    .poll(
      async () => pageA.evaluate(() => window.__skyringState?.localAmmo ?? 0),
      { timeout: 5000 },
    )
    .toBeGreaterThan(spentAmmo);
  await expect(pageA.locator('[data-testid="hud-ammo"]')).toContainText(
    'BONK ENERGY',
  );
  expect(errors).toEqual([]);

  await Promise.all([contextA.close(), contextB.close()]);
});
