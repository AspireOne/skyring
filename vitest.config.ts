import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@skyring/shared': fileURLToPath(
        new URL('./packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    exclude: ['**/dist/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['packages/{shared,server}/src/**/*.ts'],
      exclude: ['**/*.test.ts', 'packages/server/src/index.ts'],
    },
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
