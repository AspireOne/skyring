import { defineConfig, devices } from '@playwright/test';

// Playwright forces colored child output; retaining NO_COLOR makes Node warn on every
// spawned web server/worker in environments that set both variables.
delete process.env.NO_COLOR;

const clientUrl = 'http://127.0.0.1:4173';
const serverUrl = 'http://127.0.0.1:4174';
const measuringPerformance = process.env.SKYRING_PERFORMANCE === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Each test owns one or two WebGL contexts; cap concurrency to avoid starving
  // browser animation/network tasks on modest CI runners.
  workers: measuringPerformance ? 1 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: clientUrl,
    trace: measuringPerformance ? 'off' : 'retain-on-failure',
    screenshot: measuringPerformance ? 'off' : 'only-on-failure',
    video: measuringPerformance ? 'off' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'pnpm --filter @skyring/client preview --host 127.0.0.1 --port 4173',
      url: clientUrl,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @skyring/server start:e2e',
      url: `${serverUrl}/health`,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: '4174',
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
