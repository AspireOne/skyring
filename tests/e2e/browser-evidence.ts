import type { Page } from '@playwright/test';

export interface BrowserEvidence {
  readonly errors: string[];
  readonly failedRequests: string[];
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
