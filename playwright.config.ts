import { defineConfig } from '@playwright/test';

// E2E uses port 5171 so it never conflicts with the regular dev server (5170)
const E2E_PORT = 5171;

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx vite --port ${E2E_PORT}`,
    env: { VITE_E2E_TEST_MODE: 'true' },
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
