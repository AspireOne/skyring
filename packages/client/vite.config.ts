import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5192,
  },
  build: {
    // Three.js establishes a naturally larger baseline before game assets are split.
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      '@skyring/shared': fileURLToPath(
        new URL('../shared/src/index.ts', import.meta.url),
      ),
    },
  },
});
