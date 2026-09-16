import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/bootstrap', route => route.fulfill({ json: { capabilities: { configured: false, ai: false, embeddings: false, vision: false, ocr: false, accountDeletion: false, model: 'test' }, user: null } }));
});
test('cinque isole e chat prima degli indicatori: CTA visibili, contesto e chat libera funzionanti', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('.island-card')).toHaveCount(5);
  const gauges = await page.locator('.gauges-section').boundingBox();
  const islands = await page.locator('.archipelago-section').boundingBox();
  const chat = await page.locator('#chat-workspace').boundingBox();
  expect(chat!.y).toBeGreaterThan(islands!.y + islands!.height);
  expect(gauges!.y).toBeGreaterThan(chat!.y + chat!.height);
  for (const button of await page.locator('.island-context').all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(button).toHaveText(/Parliamone in chat/);
  }
  await page.screenshot({ path: `tests/e2e/artifacts/islands-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Parliamone in chat · Cucinare', exact: true }).click();
  await expect(page.locator('#chat-input')).toBeFocused();
  await expect(page.locator('.context-category')).toContainText('Cucinare');
  await page.locator('#chat-input').fill('Una bozza da conservare');
  await page.getByRole('button', { name: 'Parliamone in chat · Chat libera', exact: true }).click();
  await expect(page.locator('#chat-input')).toBeFocused();
  await expect(page.locator('.context-category')).toBeHidden();
  await expect(page.locator('#chat-input')).toHaveValue('Una bozza da conservare');
  await expect(page.locator('.chat-island-heading')).toContainText('Chat libera');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#chat-input').fill('');
});

test('anche la vista elenco include la chat libera e le cinque CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.island-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Impostazioni', exact: true }).click();
  await page.getByLabel('Vista delle isole').selectOption('list');
  await page.getByRole('button', { name: 'Salva impostazioni', exact: true }).click();
  await page.getByRole('button', { name: 'My ai, pagina iniziale' }).click();
  await expect(page.locator('.islands-list .island-card')).toHaveCount(5);
  await expect(page.locator('.islands-list .island-art')).toHaveCount(0);
  await page.getByRole('button', { name: 'Parliamone in chat · Desideri', exact: true }).click();
  await expect(page.locator('#chat-input')).toBeFocused();
  await expect(page.locator('.context-category')).toContainText('Desideri');
});
