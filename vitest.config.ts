import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./packages/shared/src/test-setup.ts'],
    include: [
      'packages/shared/src/**/*.test.ts',
      'apps/mobile/src/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.claude/**',
    ],
  },
  resolve: {
    // Mirrors apps/mobile/tsconfig.json "paths". Without these, any test that
    // imports a mobile service fails to resolve — Metro applies these aliases
    // at runtime, but vitest/Vite does not infer them from tsconfig.
    // '@theme' (bare) must be listed before '@theme/' so the exact-match barrel
    // import isn't swallowed by the directory alias.
    alias: [
      { find: /^@shared\//,        replacement: path.resolve(__dirname, 'packages/shared/src') + '/' },
      { find: /^@features\//,      replacement: path.resolve(__dirname, 'apps/mobile/src/features') + '/' },
      { find: /^@navigation\//,    replacement: path.resolve(__dirname, 'apps/mobile/src/navigation') + '/' },
      { find: /^@mobile\/shared\//, replacement: path.resolve(__dirname, 'apps/mobile/src/shared') + '/' },
      { find: /^@theme$/,          replacement: path.resolve(__dirname, 'apps/mobile/src/theme/index.ts') },
      { find: /^@theme\//,         replacement: path.resolve(__dirname, 'apps/mobile/src/theme') + '/' },
    ],
  },
});
