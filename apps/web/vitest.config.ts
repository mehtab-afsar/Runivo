import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', '../../packages/shared/src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches:   60,
        functions:  70,
        lines:      70,
        statements: 70,
      },
      exclude: [
        'src/shared/ui/**',
        'src/**/*.test.*',
        'src/test/**',
        '**/*.d.ts',
      ],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared/services': path.resolve(__dirname, '../../packages/shared/src/services'),
      '@shared/hooks': path.resolve(__dirname, '../../packages/shared/src/hooks'),
      '@shared/types': path.resolve(__dirname, '../../packages/shared/src/types'),
      '@shared/lib': path.resolve(__dirname, '../../packages/shared/src/lib'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
});
