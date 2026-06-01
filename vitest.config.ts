import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./packages/shared/src/test-setup.ts'],
    include: [
      'packages/shared/src/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.claude/**',
    ],
  },
});
