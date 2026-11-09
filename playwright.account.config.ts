import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

if (existsSync('.env.test.local')) process.loadEnvFile('.env.test.local');
const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL || !new URL(databaseURL).pathname.endsWith('_test'))
  throw new Error(
    'Use TEST_DATABASE_URL de um banco isolado com nome terminado em _test.',
  );

export default defineConfig({
  testDir: './e2e',
  testMatch: 'account.spec.ts',
  workers: 1,
  timeout: 150_000,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    baseURL: 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --webpack --hostname 127.0.0.1 --port 3101',
    url: 'http://127.0.0.1:3101/login',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'development',
      DATABASE_URL: databaseURL,
      AUTH_URL: 'http://127.0.0.1:3101',
      AUTH_SECRET: 'e2e-local-secret-with-more-than-32-characters',
      RESEND_API_KEY: 'test-no-external-delivery',
      RESEND_FROM: 'test@example.test',
    },
  },
});
