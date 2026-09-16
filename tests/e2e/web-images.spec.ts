import { expect, test, type Page } from '@playwright/test';
import { demoData } from '../../src/lib/demo';

// These are UI guards, not paid provider tests. Exercise the unavailable state
// deterministically, including on HTTPS production and Safari without a session.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/bootstrap', route => route.fulfill({ json: { capabilities: demoData.capabilities } }));
});

async function chooseTool(page: Page, name: string) {
  await page.locator('.tools-toggle').click();
  await page.getByRole('group', { name: 'Strumenti della chat' }).getByRole('button', { name, exact: true }).click();
  await expect(page.locator('.tools-toggle')).toHaveAttribute('aria-expanded', 'false');
}
const countCalls = (page: Page) => {
  let calls = 0;
  page.on('request', r => { if (/\/api\/(chat|agents|images|videos)(\/|$)/.test(r.url()) && r.method() === 'POST') calls++; });
  return () => calls;
};

test('web, immagini e video non configurati: errori onesti, nessuna chiamata AI e nessun messaggio inventato', async ({ page }) => {
  const boot = demoData;
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible({ timeout: 20000 });
  const aiCalls = countCalls(page);
  const before = await page.locator('.message').count();

  if (!boot.capabilities?.web) {
    await chooseTool(page, 'Cerca nel web');
    await expect(page.locator('.web-button')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.tools-toggle')).toContainText('Web');
    await expect(page.locator('.web-hint')).toContainText('Ricerca non configurata');
    await page.locator('#chat-input').fill('Chi ha vinto il campionato del mondo 1990?');
    await page.locator('#chat-input').press('Enter');
    await expect(page.locator('.composer-error')).toContainText('ricerca web non è configurata');
    expect(await page.locator('.message').count()).toBe(before);
    await page.locator('#chat-input').fill('');
    await chooseTool(page, 'Cerca nel web');
  }
  if (!boot.capabilities?.images) {
    await chooseTool(page, 'Genera immagine');
    await expect(page.locator('.image-button')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.image-mode-hint')).toContainText('prompt');
    await expect(page.getByRole('button', { name: /Aggiungi documenti o immagini/ })).toBeHidden();
    await expect(page.locator('.web-button')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#chat-input').fill('Un faro al tramonto');
    await page.locator('#chat-input').press('Enter');
    await expect(page.locator('.composer-error')).toContainText('IMAGE_API_KEY');
    expect(await page.locator('.message').count()).toBe(before);
    await page.locator('#chat-input').fill('');
  }
  if (!boot.capabilities?.videos) {
    await chooseTool(page, 'Genera video');
    await expect(page.locator('.video-button')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.video-mode-hint')).toContainText('senza audio');
    await expect(page.getByRole('button', { name: /Aggiungi documenti o immagini/ })).toBeHidden();
    await page.locator('#chat-input').fill('Un faro al tramonto');
    await page.locator('#chat-input').press('Enter');
    await expect(page.locator('.composer-error')).toContainText('VIDEO_ENABLED');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.locator('.message').count()).toBe(before);
    await page.locator('#chat-input').fill('');
  }
  expect(aiCalls()).toBe(0);
});

test('si cambia strumento con un tocco, senza combinare modi o avviare richieste', async ({ page }) => {
  const aiCalls = countCalls(page);
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible({ timeout: 20000 });
  await chooseTool(page, 'Approfondisci');
  await expect(page.locator('.deep-button')).toHaveAttribute('aria-pressed', 'true');
  await chooseTool(page, 'Genera immagine');
  await expect(page.locator('.deep-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.image-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Aggiungi documenti o immagini/ })).toBeHidden();
  await chooseTool(page, 'Genera video');
  await expect(page.locator('.image-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.video-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.video-mode-hint')).toBeVisible();
  await chooseTool(page, 'Cerca nel web');
  await expect(page.locator('.video-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.image-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.web-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Aggiungi documenti o immagini/ })).toBeVisible();
  await chooseTool(page, 'Cerca nel web');
  await expect(page.locator('.composer-tools [aria-pressed=true]')).toHaveCount(0);
  await expect(page.locator('.tools-toggle')).toHaveText('Strumenti');
  expect(aiCalls()).toBe(0);
});
