import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Document } from '../../src/lib/domain';
import { textPdf } from '../fixtures/documents';

test.use({ storageState: 'tests/e2e/.auth/user.json' });
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`);
async function call(page: Page, path: string, method = 'GET', data?: unknown) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(`/api/${path}`, { method, ...(data !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
    return { status: response.status, data: await response.json() };
  }, { path, method, data });
}
async function upload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, scope: 'chat' | 'memory' = 'chat') {
  await page.locator('input[type=file]').setInputFiles(file);
  if (scope === 'memory') await page.getByLabel(`Conservazione di ${file.name}`, { exact: true }).selectOption('memory');
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/documents' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Carica allegati senza chiedere all’AI' }).click();
  const response = await pending;
  expect(response.status()).toBe(201);
  const doc: Document = await response.json();
  await expect(page.getByRole('region', { name: 'Esiti lettura allegati' })).toContainText(file.name);
  await expect(page.locator('.send-button')).not.toContainText('Elaborazione');
  return doc;
}

test('PDF lungo, DOCX e TXT: caricamento, testo, ricerca, originali e reindicizzazione', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible();
  const documents: Document[] = [];
  let aiCalls = 0;
  page.on('request', r => { if (/\/api\/(chat|agents)(\/|$)/.test(r.url()) && r.method() === 'POST') aiCalls++; });
  try {
    const pdf = textPdf(Array.from({ length: 206 }, (_, i) => i === 205 ? 'Il codice del collaudo e TULIPANO99.' : `Pagina ${i + 1}: contenuto introduttivo della prova.`));
    documents.push(await upload(page, { name: 'collaudo-206-pagine.pdf', mimeType: 'application/pdf', buffer: pdf }));
    documents.push(await upload(page, { name: 'collaudo.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: fixture('sample.docx') }, 'memory'));
    documents.push(await upload(page, { name: 'collaudo.txt', mimeType: 'text/plain', buffer: Buffer.from('ORCHIDEA42: una curiosità per la città.') }, 'memory'));
    expect(documents.every(d => d.status === 'ready')).toBe(true);
    expect(documents[0].page_count).toBe(206);
    expect(aiCalls).toBe(0);
    const content = await call(page, `content/document/${documents[0].id}?page=206`);
    expect(content.data.text).toContain('TULIPANO99');
    const found = await call(page, 'search', 'POST', { query: 'ORCHIDEA42', source: 'document' });
    expect(found.data.results.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([documents[1].id, documents[2].id]));
    const privateSearch = await call(page, 'search', 'POST', { query: 'TULIPANO99', source: 'document' });
    expect(privateSearch.data.results.map((r: { id: string }) => r.id)).not.toContain(documents[0].id);
    const link = await call(page, `documents/${documents[0].id}`);
    expect(link.data.url).toBe(`/api/documents/${documents[0].id}/file`);
    const bytes = await page.evaluate(async path => {
      const response = await fetch(path);
      const buffer = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, cache: response.headers.get('Cache-Control'), data: Array.from(buffer) };
    }, link.data.url);
    expect(bytes.status).toBe(200);
    expect(bytes.cache).toContain('no-store');
    expect(Buffer.from(bytes.data)).toEqual(pdf);
    expect((await call(page, `documents/${documents[0].id}/reprocess`, 'POST', {})).data.status).toBe('ready');
    expect((await call(page, `conversations/${documents[0].conversation_id}`)).data).toEqual([]);
  } finally {
    for (const doc of documents) await call(page, `documents/${doc.id}`, 'DELETE');
    if (documents[0]?.conversation_id) await call(page, `conversations/${documents[0].conversation_id}`, 'DELETE');
  }
});

test('foto nei quattro formati e PDF scansionato: anteprime e stato OCR veritieri', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible();
  const boot = await call(page, 'bootstrap');
  const ocr = boot.data.capabilities.ocr;
  const documents: Document[] = [];
  try {
    for (const [extension, mime] of [['png', 'image/png'], ['jpg', 'image/jpeg'], ['gif', 'image/gif'], ['webp', 'image/webp'], ['pdf', 'application/pdf']]) {
      const buffer = fixture(extension === 'pdf' ? 'scan.pdf' : `photo.${extension}`);
      const doc = await upload(page, { name: `collaudo-scansione.${extension}`, mimeType: mime, buffer });
      documents.push(doc);
      expect(doc.status).toBe(ocr ? 'ready' : 'no_text');
      const content = await call(page, `content/document/${doc.id}`);
      if (ocr) expect(content.data.text).toContain('ORCHIDEA42');
      else expect(content.data.error).toContain('OCR locale non attivo');
      if (extension !== 'pdf') {
        const preview = await page.evaluate(async id => {
          const response = await fetch(`/api/documents/${id}/preview`);
          const image = new Image();
          const url = URL.createObjectURL(await response.blob());
          try { image.src = url; await image.decode(); return { status: response.status, width: image.naturalWidth, cache: response.headers.get('Cache-Control') }; }
          finally { URL.revokeObjectURL(url); }
        }, doc.id);
        expect(preview.status).toBe(200);
        expect(preview.width).toBe(1200);
        expect(preview.cache).toContain('private');
      }
    }
    expect((await call(page, `conversations/${documents[0].conversation_id}`)).data).toEqual([]);
  } finally {
    for (const doc of documents) await call(page, `documents/${doc.id}`, 'DELETE');
    if (documents[0]?.conversation_id) await call(page, `conversations/${documents[0].conversation_id}`, 'DELETE');
  }
});

test('un PDF danneggiato resta recuperabile e l’errore non viene nascosto da un successo generico', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible();
  const doc = await upload(page, { name: 'danneggiato.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\ninvalid') });
  try {
    expect(doc.status).toBe('error');
    const report = page.getByRole('region', { name: 'Esiti lettura allegati' });
    await expect(report).toContainText('Originale conservato, testo non disponibile');
    await expect(report).toContainText('File illeggibile o danneggiato');
    const outsider = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const response = await outsider.request.get(new URL(`/api/documents/${doc.id}/file`, page.url()).href);
      expect(response.status()).toBe(401);
    } finally { await outsider.close(); }
  } finally {
    await call(page, `documents/${doc.id}`, 'DELETE');
    await call(page, `conversations/${doc.conversation_id}`, 'DELETE');
  }
});
