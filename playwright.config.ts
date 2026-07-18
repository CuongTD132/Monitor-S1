import { defineConfig } from '@playwright/test';
import { env, AUTH_STATE_PATH } from './src/config/env';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    headless: !env.isHeaded,
    viewport: env.isHeaded ? null : { width: 1920, height: 1080 },
    // Local mở Chromium full-screen; CI headless mô phỏng màn hình desktop 1920x1080.
    launchOptions: { args: ['--start-maximized', ...(env.isHeaded ? ['--start-fullscreen'] : [])] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { browserName: 'chromium', storageState: AUTH_STATE_PATH },
      dependencies: ['setup'],
    },
  ],
});
