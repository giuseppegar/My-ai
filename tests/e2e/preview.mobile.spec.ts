import { expect, test } from '@playwright/test';
test('anteprima mobile: stato coerente con la configurazione', async ({ page, request }) => {
  const boot = await (await request.get('/api/bootstrap')).json();
  await page.goto('/');
  await expect(page.locator('.mobile-nav')).toBeVisible({ timeout: 20000 });
  if (boot.capabilities?.configured) {
    await expect(page.getByRole('button', { name: 'Entra nel tuo arcipelago' })).toBeVisible();
    await expect(page.locator('#chat-input')).toBeHidden();
  } else {
    await expect(page.locator('#chat-input')).toBeVisible();
    await expect(page.locator('.islands-grid')).toBeVisible();
  }
  await page.screenshot({ path: 'tests/e2e/artifacts/preview-mobile.png' });
});
