import { expect, test, type Page } from '@playwright/test';
import type { Bootstrap, Conversation, Document, SearchResult } from '../../src/lib/domain';

test.use({ storageState: 'tests/e2e/.auth/user.json' });

async function call<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await page.evaluate(async ({ path, method, data }) => {
    const res = await fetch(`/api/${path}`, {
      method,
      ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    });
    return { ok: res.ok, data: await res.json() };
  }, { path, method, data });
  expect(response.ok, `API di collaudo ${method} ${path}`).toBe(true);
  return response.data as T;
}

async function cleanup(page: Page, id: string) {
  const data = await call<Bootstrap>(page, 'bootstrap');
  for (const doc of data.documents.filter(d => d.conversation_id === id)) await call(page, `documents/${doc.id}`, 'DELETE');
  for (const memory of data.memories.filter(m => m.auto_conversation_id === id)) await call(page, `memories/${memory.id}`, 'DELETE');
  await call(page, `conversations/${id}`, 'DELETE');
}

async function documents(page: Page) {
  await page.locator('.desktop-nav:visible, .mobile-nav:visible').getByRole('button', { name: 'Documenti', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible();
  const data = await call<Bootstrap>(page, 'bootstrap');
  test.skip(!data.user, 'Richiede un account TEST_USER attivato.');
});

test('file di testo: creazione, modifica manuale, download privato e ricerca aggiornati', async ({ page, browser }) => {
  const marker = `artefattocollaudo${Date.now()}`;
  const conv = await call<Conversation>(page, 'conversations', 'POST', { title: `E2E ${marker}`, category: 'scrivere' });
  try {
    const doc = await call<Document>(page, 'artifacts', 'POST', {
      conversation_id: conv.id, category: 'scrivere', title: marker, filename: 'collaudo.md', content: '# Documento sintetico\nPrima versione.',
    });
    expect(doc).toMatchObject({ status: 'ready', mime: 'text/plain', origin: 'generated', scope: 'memory' });
    // Nuovo contesto senza cookie: verifica che il file privato non sia raggiungibile da anonimo.
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] }, ignoreHTTPSErrors: process.env.E2E_LOCAL_HTTPS === '1' });
    try {
      const response = await guest.request.get(new URL(`/api/documents/${doc.id}/file`, page.url()).href);
      expect(response.status()).toBe(401);
    } finally { await guest.close(); }

    await page.reload();
    await documents(page);
    const card = page.locator('.document-card').filter({ has: page.getByRole('heading', { name: marker, exact: true }) });
    await card.getByRole('button', { name: 'Modifica testo', exact: true }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByLabel('Contenuto del file')).toHaveValue('# Documento sintetico\nPrima versione.');
    const content = `# Documento aggiornato\n${marker} seconda versione.`;
    await modal.getByLabel('Titolo del documento').fill(`${marker} aggiornato`);
    await modal.getByLabel('Contenuto del file').fill(content);
    await modal.getByRole('button', { name: 'Salva modifiche al file' }).click();
    await expect(modal).toBeHidden();

    const download = await page.evaluate(async id => {
      const res = await fetch(`/api/documents/${id}/file?download=1`);
      return { status: res.status, disposition: res.headers.get('content-disposition'), cache: res.headers.get('cache-control'), body: await res.text() };
    }, doc.id);
    expect(download.status).toBe(200);
    expect(download.disposition).toContain('attachment');
    expect(download.cache).toContain('no-store');
    expect(download.body).toBe(content);
    const boot = await call<Bootstrap>(page, 'bootstrap');
    const updated = boot.documents.find(d => d.id === doc.id)!;
    expect(updated).toMatchObject({ title: `${marker} aggiornato`, status: 'ready' });
    expect(updated.path).not.toBe(doc.path);
    const result = await call<{ results: SearchResult[] }>(page, 'search', 'POST', { query: marker, source: 'document' });
    expect(result.results.some(r => r.id === doc.id)).toBe(true);
    await page.reload();
    await documents(page);
    await page.locator('.document-card').filter({ hasText: `${marker} aggiornato` }).getByRole('button', { name: 'Modifica testo', exact: true }).click();
    await expect(page.getByLabel('Contenuto del file')).toHaveValue(content);
    await page.getByRole('dialog').getByRole('button', { name: 'Annulla', exact: true }).click();
  } finally { await cleanup(page, conv.id); }
});

test('file di testo: la chat riservata conserva upload Markdown e artefatti fuori dalla ricerca globale', async ({ page }) => {
  const marker = `artefattoprivato${Date.now()}`;
  const conv = await call<Conversation>(page, 'conversations', 'POST', { title: `E2E ${marker}`, category: 'scrivere' });
  try {
    const uploaded = await page.evaluate(async ({ id, marker }) => {
      const form = new FormData();
      form.set('conversation_id', id); form.set('scope', 'chat'); form.set('category', 'scrivere');
      form.set('file', new File([`# ${marker}`], 'collaudo-riservato.md', { type: 'text/markdown' }));
      const res = await fetch('/api/documents', { method: 'POST', body: form });
      return { status: res.status, document: await res.json() as Document };
    }, { id: conv.id, marker });
    expect(uploaded.status).toBe(201);
    expect(uploaded.document).toMatchObject({ status: 'ready', scope: 'chat', mime: 'text/plain' });
    const doc = await call<Document>(page, 'artifacts', 'POST', {
      conversation_id: conv.id, category: 'scrivere', title: marker, content: `# ${marker}\nContenuto sintetico riservato.`,
    });
    expect(doc.scope).toBe('chat');
    const updated = await call<Document>(page, `artifacts/${doc.id}`, 'PATCH', { content: `${marker} modificato` });
    expect(updated).toMatchObject({ scope: 'chat', status: 'ready' });
    const result = await call<{ results: SearchResult[] }>(page, 'search', 'POST', { query: marker, source: 'document' });
    expect(result.results).toHaveLength(0);
  } finally { await cleanup(page, conv.id); }
});

test('file di testo: generazione e revisione AI simulate, anteprima prima del salvataggio', async ({ page }) => {
  test.skip(process.env.E2E_STUB_AI !== '1', 'Solo AI simulata: nessuna generazione a pagamento.');
  const boot = await call<Bootstrap>(page, 'bootstrap');
  expect(boot.capabilities).toMatchObject({ ai: true, model: 'e2e-local-stub' });
  let conversationId: string | undefined;
  try {
    await page.locator('.tools-toggle').click();
    await page.locator('.artifact-button').click();
    await page.locator('#chat-input').fill(`Crea un documento sintetico di collaudo ${Date.now()}`);
    const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/conversations' && r.request().method() === 'POST');
    await page.locator('#chat-input').press('Enter');
    conversationId = (await (await pending).json()).id;
    const card = page.locator('.artifact-card');
    await expect(card).toHaveCount(1);
    const data = await call<Bootstrap>(page, 'bootstrap');
    const doc = data.documents.find(d => d.conversation_id === conversationId)!;
    expect(doc).toMatchObject({ status: 'ready', origin: 'generated', mime: 'text/plain' });
    const original = await page.evaluate(async id => (await fetch(`/api/documents/${id}/file`)).text(), doc.id);
    await card.getByRole('button', { name: 'Modifica testo', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByPlaceholder('Cosa vorresti cambiare?', { exact: false }).fill('Aggiungi una conclusione sintetica di collaudo.');
    await modal.getByRole('button', { name: 'Chiedi all’AI', exact: true }).click();
    await expect(modal.locator('.notice')).toContainText('Verifica il testo sopra prima di salvare.');
    const afterAi = await page.evaluate(async id => (await fetch(`/api/documents/${id}/file`)).text(), doc.id);
    expect(afterAi).toBe(original);
    await modal.getByLabel('Contenuto del file').fill(`${original}\nRevisione confermata nel collaudo.`);
    await modal.getByRole('button', { name: 'Salva modifiche al file' }).click();
    await expect(modal).toBeHidden();
    const saved = await page.evaluate(async id => (await fetch(`/api/documents/${id}/file`)).text(), doc.id);
    expect(saved).toContain('Revisione confermata nel collaudo.');
  } finally { if (conversationId) await cleanup(page, conversationId); }
});
