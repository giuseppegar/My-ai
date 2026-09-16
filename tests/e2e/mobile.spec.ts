import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
const stateFile = 'tests/e2e/.auth/user.json';
test.use({ storageState: stateFile });
const skipUnlessAuth = (name: string, fn: (fixtures: { page: import('@playwright/test').Page }) => void | Promise<void>) => test(name, async ({ page }) => {
  test.skip(!existsSync(stateFile), 'Credenziali TEST_USER non configurate o accesso non riuscito.');
  await fn({ page });
});

skipUnlessAuth('chat e ricerca restano usabili da mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible({ timeout: 20000 });
  const nav = page.locator('.mobile-nav');
  await expect(nav).toBeVisible();
  for (const label of ['Spazio', 'Memoria', 'Cronologia', 'Documenti', 'Desideri']) await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(page.locator('.gauges-grid .gauge')).toHaveCount(4);
  await page.locator('#chat-input').fill('riso');
  await expect(page.locator('.composer .search-panel')).toBeVisible({ timeout: 7000 });
  await page.locator('#chat-input').fill('');
  await nav.getByRole('button', { name: 'Memoria', exact: true }).click();
  await expect(page.getByRole('heading', { name: /cose da tenere vicine/i })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'tests/e2e/artifacts/mobile-home.png', fullPage: false });
});

skipUnlessAuth('navigazione da tastiera fino ai controlli principali', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible({ timeout: 20000 });
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  expect(focused).toBeTruthy();
  await page.locator('#chat-input').focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  const composerFocus = await page.evaluate(() => !!document.activeElement?.closest('.composer'));
  expect(composerFocus).toBe(true);
});
