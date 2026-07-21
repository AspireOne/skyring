import { expect, test } from '@playwright/test';

import {
  expectBrowserEvidenceClean,
  openBrowserPair,
} from './browser-evidence.js';

test('short regulation produces one winner and one loser', async ({
  browser,
}) => {
  const pair = await openBrowserPair(browser, `WIN${Date.now() % 100000}`);
  const results = pair.pages.map((page) =>
    page.locator('[data-testid="hud-result"]'),
  );

  await Promise.all(results.map((result) => expect(result).toBeVisible()));
  const labels = await Promise.all(
    pair.pages.map((page) =>
      page.locator('[data-testid="hud-result-title"]').textContent(),
    ),
  );
  expect(labels.sort()).toEqual(['YOU LOSE', 'YOU WIN']);
  const scores = await Promise.all(
    pair.pages.map((page) =>
      page.locator('[data-testid="hud-result-score"]').textContent(),
    ),
  );
  expect(scores.sort()).toEqual(['1.00 – 5.00', '5.00 – 1.00']);
  await Promise.all(
    pair.pages.map((page) =>
      expect(page.locator('#app')).toHaveAttribute('data-net-phase', 'ended'),
    ),
  );
  expectBrowserEvidenceClean(pair.evidence);
  await pair.close();
});

test('a regulation tie visibly enters sudden death and ends on its first score', async ({
  browser,
}) => {
  const pair = await openBrowserPair(browser, `TIE${Date.now() % 100000}`);

  await Promise.all(
    pair.pages.map((page) =>
      expect(page.locator('#app')).toHaveAttribute(
        'data-match-phase',
        'suddenDeath',
        { timeout: 5000 },
      ),
    ),
  );
  await expect(pair.pages[0].locator('[data-testid="hud-timer"]')).toHaveText(
    'SUDDEN DEATH',
  );

  const results = pair.pages.map((page) =>
    page.locator('[data-testid="hud-result"]'),
  );
  await Promise.all(
    results.map((result) => expect(result).toBeVisible({ timeout: 8000 })),
  );
  const labels = await Promise.all(
    pair.pages.map((page) =>
      page.locator('[data-testid="hud-result-title"]').textContent(),
    ),
  );
  expect(labels.sort()).toEqual(['YOU LOSE', 'YOU WIN']);
  const scores = await Promise.all(
    pair.pages.map((page) =>
      page.locator('[data-testid="hud-result-score"]').textContent(),
    ),
  );
  expect(scores.sort()).toEqual(['3.00 – 3.02', '3.02 – 3.00']);
  expectBrowserEvidenceClean(pair.evidence);
  await pair.close();
});

test('a live browser disconnect awards the remaining player', async ({
  browser,
}) => {
  const pair = await openBrowserPair(browser, `LEAVE${Date.now() % 100000}`);
  await Promise.all(
    pair.pages.map((page) =>
      expect(page.locator('#app')).toHaveAttribute(
        'data-match-phase',
        'playing',
        { timeout: 5000 },
      ),
    ),
  );

  await pair.contexts[1].close();
  await expect(
    pair.pages[0].locator('[data-testid="hud-result-title"]'),
  ).toHaveText('YOU WIN');
  await expect(pair.pages[0].locator('#app')).toHaveAttribute(
    'data-net-phase',
    'ended',
  );
  expectBrowserEvidenceClean([pair.evidence[0]!]);
  await pair.contexts[0].close();
});
