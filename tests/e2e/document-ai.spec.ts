import { expect, test } from '@playwright/test';
import { textPdf } from '../fixtures/documents';
test.use({ storageState: 'tests/e2e/.auth/user.json' });

test('AI reale: legge il passaggio a pagina 206 di un PDF allegato', async ({ page }) => {
  test.skip(process.env.TEST_DOCUMENT_AI !== '1', 'Opt-in: consuma una chiamata AI su una fixture sintetica.');
  test.setTimeout(120000);
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible();
  const pdf = textPdf(Array.from({ length: 206 }, (_, i) => i === 205 ? 'Il codice del collaudo e TULIPANO99.' : `Pagina ${i + 1}: contenuto introduttivo per il collaudo.`));
  await page.locator('input[type=file]').setInputFiles({ name: 'lettura-AI-206-pagine.pdf', mimeType: 'application/pdf', buffer: pdf });
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/documents' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Carica allegati senza chiedere all’AI' }).click();
  const response = await pending;
  const doc = await response.json();
  try {
    expect(doc.status).toBe('ready');
    await expect(page.locator('.send-button')).not.toContainText('Elaborazione');
    await page.locator('#chat-input').fill('Nel documento allegato, qual è il codice riportato a pagina 206? Rispondi soltanto con il codice.');
    await page.getByRole('button', { name: 'Chiedi all’AI', exact: true }).click();
    await expect(page.locator('.message.assistant').last()).toContainText('TULIPANO99', { timeout: 90000 });
  } finally {
    if (doc.id) await page.evaluate(async id => { await fetch(`/api/documents/${id}`, { method: 'DELETE' }); }, doc.id);
    if (doc.conversation_id) await page.evaluate(async id => { await fetch(`/api/conversations/${id}`, { method: 'DELETE' }); }, doc.conversation_id);
  }
});
