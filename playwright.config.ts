import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5170',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'VITE_E2E_TEST_MODE=true npm run dev',
    url: 'http://localhost:5170',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
