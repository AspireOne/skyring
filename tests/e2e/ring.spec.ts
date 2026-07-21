import { expect, test, type Page } from '@playwright/test';

import { trackBrowserEvidence } from './browser-evidence.js';

test('ring warning reveals the move and authoritative teleport feedback arrives', async ({
  browser,
}) => {
  const room = `RING${Date.now() % 100000}`;
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = (await Promise.all(
    contexts.map((context) => context.newPage()),
  )) as [Page, Page];
  const evidence = pages.map((page) => trackBrowserEvidence(page));
  await Promise.all(pages.map((page) => page.goto(`/?room=${room}`)));

  await expect
    .poll(
      async () =>
        pages[0].evaluate(() => window.__skyringState?.ringWarning ?? false),
      { timeout: 4000 },
    )
    .toBe(true);
  await expect(pages[0].locator('[data-testid="hud-warning"]')).toBeVisible();
  await expect
    .poll(
      async () =>
        pages[0].evaluate(
          () => (window.__skyringState?.eventCounts.ringTeleport ?? 0) > 0,
        ),
      { timeout: 5000 },
    )
    .toBe(true);
  await expect(pages[0].locator('[data-testid="hud-warning"]')).toBeHidden();

  for (const record of evidence) {
    expect(record.errors).toEqual([]);
    expect(record.failedRequests).toEqual([]);
  }

  await Promise.all(contexts.map((context) => context.close()));
});
