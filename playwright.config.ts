import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  globalSetup: require.resolve('./tests/global-setup'),
  globalTeardown: require.resolve('./tests/global-teardown'),
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/media-live.spec.ts', '**/media-tokenizer-down.spec.ts'],
    },
    {
      name: 'live',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/media-live.spec.ts',
      timeout: 60000,
    },
    {
      name: 'offline',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/media-tokenizer-down.spec.ts',
      timeout: 60000,
    },
  ],
});


