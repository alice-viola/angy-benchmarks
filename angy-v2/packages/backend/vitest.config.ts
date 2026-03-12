import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@nexusfleet/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
