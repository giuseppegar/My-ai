import { expect, test, type Page } from '@playwright/test';
import type { Bootstrap, Conversation, Document, Memory, Message, SearchResult } from '../../src/lib/domain';

test.use({ storageState: 'tests/e2e/.auth/user.json' });
async function call<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await page.evaluate(async ({ path,method,data }) => {
    const res = await fetch(`/api/${path}`, { method, ...(data === undefined ? {} : { headers:{ 'Content-Type':'application/json' },body:JSON.stringify(data) }) });
    return { ok:res.ok, data:await res.json() };
  }, { path,method,data });
  expect(response.ok, `API di collaudo ${method} ${path}`).toBe(true);
  return response.data as T;
}
async function cleanup(page: Page, id: string) {
  const data = await call<Bootstrap>(page,'bootstrap');
  for (const doc of data.documents.filter(d => d.conversation_id === id)) await call(page,`documents/${doc.id}`,'DELETE');
  for (const memory of data.memories.filter(m => m.auto_conversation_id === id)) await call(page,`memories/${memory.id}`,'DELETE');
  await call(page,`conversations/${id}`,'DELETE');
}
test.beforeEach(async ({ page }) => {
  test.skip(process.env.E2E_STUB_AI !== '1', 'Solo runner locale con AI simulata: nessuna chiamata reale a pagamento.');
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible();
  const data = await call<Bootstrap>(page,'bootstrap');
  expect(data.user).not.toBeNull();
  expect(data.capabilities).toMatchObject({ ai:true,model:'e2e-local-stub',videos:false,images:false,web:false });
});

test('database reale: richiesta e risposta nello stesso ricordo, categoria e modifiche persistenti', async ({ page }) => {
  const title = `E2E ricetta ${Date.now()}`;
  const conv = await call<Conversation>(page,'conversations','POST',{ title,category:'cucinare' });
  try {
    const { message } = await call<{message:Message}>(page,'chat','POST',{ conversation_id:conv.id,content:title,category:'cucinare' });
    expect(message.content).toContain('Risposta simulata di collaudo');
    let boot = await call<Bootstrap>(page,'bootstrap');
    const saved = boot.memories.filter(m => m.auto_conversation_id === conv.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id:message.reply_to_id,category:'cucinare',kind:'content' });
    expect(saved[0].content).toContain(title);
    expect(saved[0].content).toContain(message.content);
    const edited = await call<Memory>(page,`memories/${saved[0].id}`,'PATCH',{ ...saved[0],content:'Ricordo corretto manualmente',category:'capire' });
    expect(edited.category).toBe('capire');
    await page.reload(); await expect(page.locator('#chat-input')).toBeVisible();
    boot = await call<Bootstrap>(page,'bootstrap');
    expect(boot.memories.find(m => m.id === saved[0].id)).toMatchObject({ category:'capire',content:'Ricordo corretto manualmente' });
    await call(page,`memories/${saved[0].id}`,'DELETE');
    expect((await call<Bootstrap>(page,'bootstrap')).memories.some(m => m.id === saved[0].id)).toBe(false);
    expect(await call<Message[]>(page,`conversations/${conv.id}`)).toHaveLength(2);
  } finally { await cleanup(page,conv.id); }
});

test('database reale: allegato chat-only revoca le copie automatiche e impedisce nuove copie globali', async ({ page }) => {
  const marker = `privatocollaudo${Date.now()}`;
  const conv = await call<Conversation>(page,'conversations','POST',{ title:`E2E privacy ${marker}`,category:'capire' });
  try {
    await call(page,'chat','POST',{ conversation_id:conv.id,content:marker,category:'capire' });
    expect((await call<Bootstrap>(page,'bootstrap')).memories.filter(m => m.auto_conversation_id === conv.id)).toHaveLength(1);
    const upload = await page.evaluate(async id => {
      const form = new FormData(); form.set('conversation_id',id); form.set('category','capire'); form.set('scope','chat');
      form.set('file',new File(['Documento sintetico privato di collaudo.'],'E2E-riservato.txt',{ type:'text/plain' }));
      const response = await fetch('/api/documents',{ method:'POST',body:form });
      return { status:response.status,document:await response.json() as Document };
    },conv.id);
    expect(upload.status).toBe(201); expect(upload.document.scope).toBe('chat');
    await call(page,'chat','POST',{ conversation_id:conv.id,content:`Seconda richiesta ${marker}`,category:'capire' });
    const boot = await call<Bootstrap>(page,'bootstrap');
    expect(boot.conversations.find(c => c.id === conv.id)?.searchable).toBe(false);
    expect(boot.memories.filter(m => m.auto_conversation_id === conv.id)).toHaveLength(0);
    for (const source of ['memory','message']) expect((await call<{results:SearchResult[]}>(page,'search','POST',{ query:marker,source })).results).toHaveLength(0);
    expect(await call<Message[]>(page,`conversations/${conv.id}`)).toHaveLength(4);
  } finally { await cleanup(page,conv.id); }
});
