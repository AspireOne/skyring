import { expect, test, type Browser, type Page } from '@playwright/test';

import {
  trackBrowserEvidence,
  type BrowserEvidence,
} from './browser-evidence.js';

interface Pair {
  readonly pages: [Page, Page];
  readonly evidence: readonly BrowserEvidence[];
  readonly close: () => Promise<void>;
}

test('short regulation produces one winner and one loser', async ({
  browser,
}) => {
  const pair = await openPair(browser, `WIN${Date.now() % 100000}`);
  const results = pair.pages.map((page) =>
    page.locator('[data-testid="hud-result"]'),
  );

  await Promise.all(results.map((result) => expect(result).toBeVisible()));
  const labels = await Promise.all(
    results.map((result) => result.textContent()),
  );
  expect(labels.sort()).toEqual(['YOU LOSE', 'YOU WIN']);
  await Promise.all(
    pair.pages.map((page) =>
      expect(page.locator('#app')).toHaveAttribute('data-net-phase', 'ended'),
    ),
  );
  expectClean(pair.evidence);
  await pair.close();
});

test('a regulation tie visibly enters sudden death and ends on its first score', async ({
  browser,
}) => {
  const pair = await openPair(browser, `TIE${Date.now() % 100000}`);

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
    results.map((result) => result.textContent()),
  );
  expect(labels.sort()).toEqual(['YOU LOSE', 'YOU WIN']);
  expectClean(pair.evidence);
  await pair.close();
});

async function openPair(browser: Browser, room: string): Promise<Pair> {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = (await Promise.all(
    contexts.map((context) => context.newPage()),
  )) as [Page, Page];
  const evidence = pages.map((page) => trackBrowserEvidence(page));
  await Promise.all(pages.map((page) => page.goto(`/?room=${room}`)));
  return {
    pages,
    evidence,
    close: async () => {
      await Promise.all(contexts.map((context) => context.close()));
    },
  };
}

function expectClean(evidence: readonly BrowserEvidence[]): void {
  for (const record of evidence) {
    expect(record.errors).toEqual([]);
    expect(record.failedRequests).toEqual([]);
  }
}
