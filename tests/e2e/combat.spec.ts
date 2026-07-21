import { expect, test } from '@playwright/test';

import {
  expectBrowserEvidenceClean,
  openBrowserPair,
} from './browser-evidence.js';

test('two players exchange deterministic bonks with ammo, tracers, and stumble feedback', async ({
  browser,
}) => {
  const room = `COMBAT${Date.now() % 100000}`;
  const pair = await openBrowserPair(browser, room);
  const [pageA, pageB] = pair.pages;
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
      async () => pageA.evaluate(() => window.__skyringState?.localAmmo ?? 20),
      { timeout: 3000 },
    )
    .toBeLessThan(20);
  const spentAmmo = await pageA.evaluate(
    () => window.__skyringState?.localAmmo ?? Number.POSITIVE_INFINITY,
  );

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
  expectBrowserEvidenceClean(pair.evidence);
  await pair.close();
});
