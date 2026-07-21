import { expect, test } from '@playwright/test';

import { trackBrowserEvidence } from './browser-evidence.js';

test('@performance software-WebGL client keeps its baseline frame cadence', async ({
  page,
}) => {
  const evidence = trackBrowserEvidence(page);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto(`/?room=PERF${Date.now() % 100000}`);
  await expect(page.locator('[data-testid="scene-canvas"]')).toHaveAttribute(
    'data-models-ready',
    'true',
  );

  const durations = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = [];
        let previous = performance.now();
        const sample = (now: number): void => {
          samples.push(now - previous);
          previous = now;
          if (samples.length >= 120) resolve(samples.slice(20));
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  durations.sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? Infinity;
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? Infinity;
  const p99 = durations[Math.floor(durations.length * 0.99)] ?? Infinity;
  process.stdout.write(
    `[performance] browser frame p50=${p50.toFixed(3)}ms, p95=${p95.toFixed(3)}ms, p99=${p99.toFixed(3)}ms\n`,
  );
  expect(p95).toBeLessThan(50);
  expect(evidence.errors).toEqual([]);
  expect(evidence.failedRequests).toEqual([]);
});
