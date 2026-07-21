import {
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';

export interface BrowserEvidence {
  readonly errors: string[];
  readonly failedRequests: string[];
}

export interface BrowserPair {
  readonly contexts: [BrowserContext, BrowserContext];
  readonly pages: [Page, Page];
  readonly evidence: readonly BrowserEvidence[];
  readonly close: () => Promise<void>;
}

export function trackBrowserEvidence(page: Page): BrowserEvidence {
  const evidence: BrowserEvidence = { errors: [], failedRequests: [] };

  page.on('console', (message) => {
    if (message.type() === 'error') evidence.errors.push(message.text());
  });
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  page.on('requestfailed', (request) => {
    evidence.failedRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) evidence.failedRequests.push(response.url());
  });

  return evidence;
}

export async function openBrowserPair(
  browser: Browser,
  room: string,
  contextOptions?: readonly [BrowserContextOptions, BrowserContextOptions],
): Promise<BrowserPair> {
  const contexts: [BrowserContext, BrowserContext] = await Promise.all([
    browser.newContext(contextOptions?.[0]),
    browser.newContext(contextOptions?.[1]),
  ]);
  const pages: [Page, Page] = await Promise.all([
    contexts[0].newPage(),
    contexts[1].newPage(),
  ]);
  const evidence = pages.map((page) => trackBrowserEvidence(page));
  await Promise.all(pages.map((page) => page.goto(`/?room=${room}`)));

  return {
    contexts,
    pages,
    evidence,
    close: async () => {
      await Promise.all(contexts.map((context) => context.close()));
    },
  };
}

export function expectBrowserEvidenceClean(
  evidence: readonly BrowserEvidence[],
): void {
  for (const record of evidence) {
    expect(record.errors).toEqual([]);
    expect(record.failedRequests).toEqual([]);
  }
}
