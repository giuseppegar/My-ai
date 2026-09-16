import { expect, test } from '@playwright/test';
test('anteprima desktop: stato coerente con la configurazione', async ({ page, request }) => {
  const health = await (await request.get('/api/health')).json();
  expect(health.ok).toBe(true);
  const boot = await (await request.get('/api/bootstrap')).json();
  const configured = Boolean(boot.capabilities?.configured);
  await page.goto('/');
  if (configured) {
    // Supabase collegato: senza accesso si vede il benvenuto, non dati dimostrativi.
    await expect(page.getByText(/Anteprima dimostrativa/i)).toBeHidden({ timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Entra nel tuo arcipelago' })).toBeVisible();
    await expect(page.locator('.mobile-nav')).toBeHidden();
    await expect(page.locator('#chat-input')).toBeHidden();
    await page.getByRole('button', { name: 'Entra nel tuo arcipelago' }).click();
    const dialog = page.locator('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Email')).toBeVisible();
    await dialog.getByRole('button', { name: 'Chiudi finestra' }).click();
  } else {
    // Nessuna configurazione: anteprima dimostrativa esplicita e non persistente.
    await expect(page.getByText(/Anteprima dimostrativa/i)).toBeVisible();
    await expect(page.locator('.gauges-grid .gauge')).toHaveCount(4);
    for (const island of ['Scrivere meglio', 'Cucinare', 'Spiegami meglio', 'Desideri']) await expect(page.getByRole('heading', { name: island })).toBeVisible();
    await page.locator('#chat-input').fill('ricetta riso');
    await expect(page.locator('.composer .search-panel')).toContainText('Risotto ai funghi', { timeout: 7000 });
    await page.locator('.composer .search-panel .search-result').first().click();
    const dialog = page.locator('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('ESEMPIO DIMOSTRATIVO');
    await expect(dialog.getByRole('button', { name: 'Ripartiamo da qui' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Chiudi finestra' }).click();
    await page.locator('#chat-input').fill('');
    expect(await page.locator('.message').count()).toBe(0);
    await page.getByRole('button', { name: /Passioni/ }).click();
    await expect(page.locator('dialog')).toContainText('Dati dimostrativi');
    await page.locator('dialog').getByRole('button', { name: 'Chiudi finestra' }).click();
    await page.getByRole('button', { name: 'Come funziona My ai' }).click();
    await expect(page.locator('dialog')).toContainText('Cerca prima');
    await page.locator('dialog').getByRole('button', { name: 'Chiudi finestra' }).click();
  }
  await page.screenshot({ path: 'tests/e2e/artifacts/preview-home.png', fullPage: true });
});
