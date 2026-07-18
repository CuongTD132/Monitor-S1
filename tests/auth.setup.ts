import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LoginPage } from '../src/pages/LoginPage';
import { requireEnv, AUTH_STATE_PATH } from '../src/config/env';

setup('authenticate and refresh expired session', async ({ page }) => {
  const baseUrl = requireEnv('BASE_URL');
  const email = requireEnv('EMAIL');
  const password = requireEnv('PASSWORD');

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  await page.goto(baseUrl);
  if (/\/login(?:$|\?)/.test(page.url())) {
    await new LoginPage(page).login(email, password);
  }
  await page.waitForURL(/\/client\/(?:dashboard|topics)/);

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
