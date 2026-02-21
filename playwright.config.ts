import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    headless: process.env.HEADED !== '1',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      slowMo: process.env.HEADED === '1' ? 200 : 0,
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: BASE_URL.includes('localhost')
    ? {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
        timeout: 30_000,
      }
    : undefined,
});
