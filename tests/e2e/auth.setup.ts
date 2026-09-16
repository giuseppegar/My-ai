import { mkdirSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
const stateFile = 'tests/e2e/.auth/user.json';
setup('accesso con un account di test attivato', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) { setup.skip(true, 'Credenziali TEST_USER non configurate: prove e2e saltate.'); return; }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /arcipelago|cominciare|esplorazioni|mondo|idee meritano/i })).toBeVisible({ timeout: 20000 });
  const welcome = page.getByRole('button', { name: 'Entra nel tuo arcipelago' });
  const header = page.getByRole('button', { name: /Accedi|Il tuo account/i }).first();
  const welcomeVisible = await welcome.isVisible().catch(() => false);
  await (welcomeVisible ? welcome : header).click();
  const modal = page.locator('dialog');
  await expect(modal).toBeVisible();
  if (await modal.getByText('Colleghiamo prima Supabase').isVisible().catch(() => false)) { setup.skip(true, 'Supabase non configurato su questa istanza.'); return; }
  const signInButton = modal.getByRole('button', { name: /^Accedi$/ });
  if (await signInButton.isVisible()) {
    await modal.getByLabel('Email').fill(email);
    await modal.getByLabel('Password').fill(password);
    await signInButton.click();
    await expect(modal).toBeHidden({ timeout: 20000 });
  } else {
    await modal.getByRole('button', { name: 'Hai già un account? Accedi' }).click();
    await modal.getByLabel('Email').fill(email);
    await modal.getByLabel('Password').fill(password);
    await modal.getByRole('button', { name: /^Accedi$/ }).click();
    await expect(modal).toBeHidden({ timeout: 20000 });
  }
  await expect(page.getByText('Anteprima dimostrativa')).toBeHidden({ timeout: 15000 });
  mkdirSync('tests/e2e/.auth', { recursive: true });
  await page.context().storageState({ path: stateFile });
});
