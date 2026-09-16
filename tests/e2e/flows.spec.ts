import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
const stateFile = 'tests/e2e/.auth/user.json';
test.use({ storageState: stateFile });
const skipUnlessAuth = (name: string, fn: (fixtures: { page: import('@playwright/test').Page; request: import('@playwright/test').APIRequestContext }) => void | Promise<void>) => test(name, async ({ page, request }) => {
  test.skip(!existsSync(stateFile), 'Credenziali TEST_USER non configurate o accesso non riuscito.');
  await fn({ page, request });
});

skipUnlessAuth('digitare nella barra non avvia una risposta AI', async ({ page, request }) => {
  const caps = await (await request.get('/api/bootstrap')).json();
  test.skip(!caps.capabilities?.configured, 'Supabase non configurato.');
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible({ timeout: 20000 });
  await page.locator('#chat-input').fill('ricetta riso');
  await page.locator('#chat-input').press('ArrowDown');
  await page.locator('#chat-input').press('Escape');
  await expect(page.locator('.composer .search-panel')).toBeHidden({ timeout: 5000 });
  const before = await page.locator('.message').count();
  await page.waitForTimeout(1800);
  expect(await page.locator('.message').count()).toBe(before);
  expect(await page.locator('.message.assistant').count()).toBe(0);
  const hint = await page.locator('.composer-bottom').innerText();
  expect(hint).toContain('bozza');
  if (await page.locator('.keyboard-hint').isVisible()) expect(hint).toContain('Invio');
  await page.locator('#chat-input').fill('una frase\ncon un a capo');
  expect(await page.locator('#chat-input').inputValue()).toContain('\n');
});

skipUnlessAuth('Invio invia davvero la richiesta', async ({ page, request }) => {
  const caps = await (await request.get('/api/bootstrap')).json();
  test.skip(!caps.capabilities?.configured, 'Supabase non configurato.');
  test.skip(caps.capabilities.ai && process.env.E2E_STUB_AI !== '1' && process.env.TEST_CHAT_AI !== '1', 'Usa il runner AI simulato oppure opt-in TEST_CHAT_AI=1 per una chiamata a pagamento.');
  if (process.env.E2E_STUB_AI === '1') expect(caps.capabilities.model).toBe('e2e-local-stub');
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible({ timeout: 20000 });
  const probe = `Un cenno, un saluto. ${Date.now()}`;
  let conversationId: string | undefined;
  try {
    const pending = caps.capabilities.ai ? page.waitForResponse(r => new URL(r.url()).pathname === '/api/conversations' && r.request().method() === 'POST') : null;
    await page.locator('#chat-input').fill(probe);
    await page.locator('#chat-input').press('Enter');
    if (pending) {
      conversationId = (await (await pending).json()).id;
      await expect(page.locator('.message.user')).toContainText(probe, { timeout: 30000 });
      await expect(page.locator('.message.assistant')).toBeVisible({ timeout: 30000 });
    } else {
      await expect(page.locator('.composer-error, [role=alert]').first()).toBeVisible({ timeout: 20000 });
      expect(await page.locator('.message').count()).toBe(0);
    }
  } finally {
    if (conversationId) await page.evaluate(async id => {
      const bootstrap = await (await fetch('/api/bootstrap')).json();
      for (const memory of bootstrap.memories.filter((m: { auto_conversation_id?: string }) => m.auto_conversation_id === id)) {
        const result = await fetch(`/api/memories/${memory.id}`, { method: 'DELETE' });
        if (!result.ok) throw new Error('Pulizia ricordo di collaudo non riuscita.');
      }
      if (!(await fetch(`/api/conversations/${id}`, { method: 'DELETE' })).ok) throw new Error('Pulizia chat di collaudo non riuscita.');
    }, conversationId);
  }
});

skipUnlessAuth('le isole si aprono in raccolta con elenco accessibile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Vista elenco' }).click();
  await expect(page.getByRole('heading', { name: /cose da tenere vicine/i })).toBeVisible();
  await page.getByRole('button', { name: 'Il mio spazio' }).first().click();
  await page.getByRole('button', { name: /Apri l’isola Cucinare/i }).click();
  await expect(page.getByRole('heading', { name: 'Cucinare' }).first()).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Il mio spazio' }).first().click();
  await page.getByRole('button', { name: /Apri l’isola Desideri/i }).click();
  await expect(page.getByRole('heading', { name: /Desideri/i }).first()).toBeVisible();
  await page.screenshot({ path: 'tests/e2e/artifacts/desideri.png', fullPage: true });
});

skipUnlessAuth('indicatori con criterio esplicito e senza punteggi arbitrari', async ({ page }) => {
  await page.goto('/');
  const gauge = page.getByRole('button', { name: /Passioni/ });
  await expect(gauge).toBeVisible({ timeout: 20000 });
  await gauge.click();
  const dialog = page.locator('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('da dove viene la lancetta');
  await expect(dialog).toContainText('Nessun punteggio generato dall’AI');
  await dialog.getByRole('button', { name: 'Chiudi finestra' }).click();
});
