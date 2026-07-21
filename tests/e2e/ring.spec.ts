import { expect, test } from '@playwright/test';

import {
  expectBrowserEvidenceClean,
  openBrowserPair,
} from './browser-evidence.js';

test('ring warning reveals the move and authoritative teleport feedback arrives', async ({
  browser,
}) => {
  const room = `RING${Date.now() % 100000}`;
  const pair = await openBrowserPair(browser, room);

  await expect
    .poll(
      async () =>
        pair.pages[0].evaluate(
          () => window.__skyringState?.ringWarning ?? false,
        ),
      { timeout: 4000 },
    )
    .toBe(true);
  await expect(
    pair.pages[0].locator('[data-testid="hud-warning"]'),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        pair.pages[0].evaluate(
          () => (window.__skyringState?.eventCounts.ringTeleport ?? 0) > 0,
        ),
      { timeout: 5000 },
    )
    .toBe(true);
  await expect(
    pair.pages[0].locator('[data-testid="hud-warning"]'),
  ).toBeHidden();

  expectBrowserEvidenceClean(pair.evidence);
  await pair.close();
});
