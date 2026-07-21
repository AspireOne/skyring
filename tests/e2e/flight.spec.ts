import { expect, test, type Page } from '@playwright/test';

import {
  expectBrowserEvidenceClean,
  openBrowserPair,
} from './browser-evidence.js';

type Vec3 = [number, number, number];

async function localPos(page: Page): Promise<Vec3> {
  return page.evaluate(() => window.__skyringState?.localPos ?? [0, 0, 0]);
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('two players pair, fly, and steer their own planes', async ({
  browser,
}) => {
  const room = `DUO${Date.now() % 100000}`;
  const pair = await openBrowserPair(browser, room);
  const [pageA, pageB] = pair.pages;

  // Both clients pair into the same match on opposite slots.
  await expect(pageA.locator('#app')).toHaveAttribute(
    'data-net-phase',
    'matched',
  );
  await expect(pageB.locator('#app')).toHaveAttribute(
    'data-net-phase',
    'matched',
  );

  // The E2E server deliberately differs from the bundled defaults. Both the
  // input cadence diagnostic and rendered arena must use matchFound.constants.
  await Promise.all(
    [pageA, pageB].map(async (page) => {
      await expect(page.locator('#app')).toHaveAttribute('data-sim-hz', '30');
      const canvas = page.locator('[data-testid="scene-canvas"]');
      await expect(canvas).toHaveAttribute('data-dome-radius', '680');
      await expect(canvas).toHaveAttribute('data-ground-y', '10');
    }),
  );

  // Wait out the countdown until authoritative play begins.
  await expect(pageA.locator('#app')).toHaveAttribute(
    'data-match-phase',
    'playing',
    {
      timeout: 15_000,
    },
  );
  await expect(pageB.locator('#app')).toHaveAttribute(
    'data-match-phase',
    'playing',
    {
      timeout: 15_000,
    },
  );

  // The HUD renders from authoritative state: scoreboard + running clock.
  await expect(pageA.locator('[data-testid="hud-timer"]')).toBeVisible();
  await expect(pageA.locator('[data-testid="hud-my-score"]')).toHaveText(
    /^\d+\.\d{2}$/,
  );

  // Player A steers; their own plane's position must change over the wire.
  const before = await localPos(pageA);
  await pageA.locator('body').click();
  await pageA.keyboard.down('KeyW');
  await pageA.keyboard.down('ArrowRight');
  await pageA.waitForTimeout(1500);
  await pageA.keyboard.up('KeyW');
  await pageA.keyboard.up('ArrowRight');
  const after = await localPos(pageA);

  expect(distance(before, after)).toBeGreaterThan(20);
  expectBrowserEvidenceClean(pair.evidence);
  await pair.close();
});
