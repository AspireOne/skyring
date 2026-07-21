import { expect, test } from '@playwright/test';

import {
  expectBrowserEvidenceClean,
  openBrowserPair,
} from './browser-evidence.js';

test('essential HUD stays readable at compact and desktop viewports', async ({
  browser,
}) => {
  const room = `LAYOUT${Date.now() % 100000}`;
  const pair = await openBrowserPair(browser, room, [
    { viewport: { width: 360, height: 640 } },
    { viewport: { width: 1440, height: 900 } },
  ]);

  for (const page of pair.pages) {
    await expect(page.locator('#app')).toHaveAttribute(
      'data-match-phase',
      'playing',
      { timeout: 5000 },
    );
    await expect(page.locator('[data-testid="hud-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="hud-ammo"]')).toBeVisible();
    await expect(page.locator('[data-testid="scene-canvas"]')).toHaveAttribute(
      'data-models-ready',
      'true',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    for (const testId of ['hud', 'hud-timer', 'hud-ammo']) {
      const box = await page.locator(`[data-testid="${testId}"]`).boundingBox();
      expect(box).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        page.viewportSize()?.width ?? 0,
      );
    }
  }

  expectBrowserEvidenceClean(pair.evidence);
  await pair.close();
});
