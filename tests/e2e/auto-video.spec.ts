import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { demoData } from '../../src/lib/demo';
import type { Bootstrap, Message, VideoJob } from '../../src/lib/domain';

async function fixture(page: Page, options = { aiFailure: false, videoEnabled: true }) {
  const data: Bootstrap = structuredClone(demoData);
  Object.assign(data, { user: { id: '11111111-1111-4111-8111-111111111111', email: 'test@example.invalid' }, memories: [], conversations: [], documents: [], videoJobs: [] });
  Object.assign(data.capabilities, { configured: true, ai: true, videos: options.videoEnabled });
  data.preferences.reduced_motion = true;
  const messages: Message[] = [];
  const writes: string[] = [];
  let completeVideo = false;
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace('/api/','');
    if (request.method() === 'POST') writes.push(path);
    if (path === 'bootstrap') return route.fulfill({ json:data });
    if (path === 'search') return route.fulfill({ json:{ results:[],mode:'lexical' } });
    if (path === 'conversations') {
      const body = request.postDataJSON();
      const conv = { id:randomUUID(),...body,searchable:true,created_at:new Date().toISOString() };
      data.conversations.push(conv); return route.fulfill({ json:conv });
    }
    if (path.startsWith('conversations/')) return route.fulfill({ json:messages });
    if (path === 'chat') {
      const body = request.postDataJSON(); const id = randomUUID(); const now = new Date().toISOString();
      messages.push({ id,conversation_id:body.conversation_id,role:'user',content:body.content,created_at:now });
      const memory = { id,title:body.content,category:body.category,kind:'content' as const,content:`Richiesta:\n${body.content}`,origin:'Salvataggio automatico',created_at:now,updated_at:now,auto_conversation_id:body.conversation_id };
      data.memories.push(memory);
      if (options.aiFailure) return route.fulfill({ status:502,json:{ error:'Provider non disponibile: richiesta conservata.' } });
      const answer: Message = { id:randomUUID(),conversation_id:body.conversation_id,role:'assistant',reply_to_id:id,content:'Risposta di collaudo, non generata da un provider.',created_at:now };
      messages.push(answer); memory.content += `\n\nRisposta:\n${answer.content}`;
      return route.fulfill({ json:{ message:answer } });
    }
    if (path === 'videos') {
      const body = request.postDataJSON(); expect(body.confirmed).toBe(true); expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
      const job: VideoJob = { id:body.request_id,conversation_id:body.conversation_id,prompt:body.prompt,category:body.category,model:data.capabilities.videoModel,duration:4,resolution:'720p',aspect_ratio:'16:9',status:'pending',document_id:null,cost:null,error:null,created_at:new Date().toISOString() };
      data.videoJobs.push(job); return route.fulfill({ status:202,json:job });
    }
    if (/^videos\/.+\/refresh$/.test(path)) {
      const job = data.videoJobs[0];
      if (completeVideo && job.status !== 'completed') {
        Object.assign(job,{ status:'completed',document_id:job.id,cost:0.12 });
        data.documents.push({ id:job.id,title:job.prompt,category:job.category,filename:'video-generato.mp4',mime:'video/mp4',scope:'memory',conversation_id:job.conversation_id,path:`user/${job.id}.mp4`,status:'ready',error:null,page_count:null,origin:'generated',created_at:job.created_at });
      }
      return route.fulfill({ json:job });
    }
    // Tutte le altre API sono bloccate: questo collaudo non raggiunge servizi reali.
    return route.fulfill({ status:501,json:{ error:`API non simulata: ${path}` } });
  });
  return { data,writes,complete:() => { completeVideo = true; } };
}
async function navigate(page: Page, name: string) {
  await page.locator('.desktop-nav:visible, .mobile-nav:visible').getByRole('button',{ name,exact:true }).click();
}
async function videoTool(page: Page) { await page.locator('.tools-toggle').click(); await page.locator('.video-button').click(); }

test('indicatori in fondo; salvataggio per richiesta senza pulsanti extra o doppioni', async ({ page }) => {
  const f = await fixture(page);
  await page.goto('/'); await expect(page.locator('#chat-input')).toBeVisible();
  expect(await page.evaluate(() => {
    const chat = document.querySelector('#chat-workspace')!.getBoundingClientRect();
    const gauges = document.querySelector('.gauges-section')!.getBoundingClientRect();
    const footer = document.querySelector('.site-footer')!.getBoundingClientRect();
    return gauges.top >= chat.bottom && footer.top >= gauges.bottom;
  })).toBe(true);
  await page.locator('#chat-input').fill('Una ricetta con il riso');
  await expect(page.locator('.search-panel')).toBeVisible();
  expect(f.data.memories).toHaveLength(0); // Digitare non salva né genera.
  await page.locator('#chat-input').press('Escape'); await page.locator('#chat-input').press('Enter');
  await expect(page.getByRole('button',{ name:'Salvato in Cucinare · Modifica' })).toBeVisible();
  expect(f.data.memories).toHaveLength(1); expect(f.data.memories[0].category).toBe('cucinare');
  expect(f.writes.filter(p => p.startsWith('memories'))).toEqual([]);
  await page.reload(); await expect(page.locator('#chat-input')).toBeVisible();
  await navigate(page,'Memoria');
  await expect(page.getByRole('heading',{ name:'Una ricetta con il riso',exact:true })).toBeVisible();
  expect(f.data.memories).toHaveLength(1);
});

test('errore AI: richiesta visibile e conservata, nessuna risposta o successo finto', async ({ page }) => {
  const f = await fixture(page,{ aiFailure:true,videoEnabled:true });
  await page.goto('/'); await page.locator('#chat-input').fill('Spiegami un concetto'); await page.locator('#chat-input').press('Enter');
  await expect(page.locator('.composer-error')).toContainText('richiesta conservata');
  await expect(page.locator('.message.user')).toHaveCount(1); await expect(page.locator('.message.assistant')).toHaveCount(0);
  expect(f.data.memories).toHaveLength(1);
  await navigate(page,'Memoria'); await expect(page.getByRole('heading',{ name:'Spiegami un concetto',exact:true })).toBeVisible();
});

test('video: conferma credito, annullamento senza chiamate, job recuperato dopo reload e archivio', async ({ page }) => {
  const f = await fixture(page);
  await page.goto('/'); await expect(page.locator('#chat-input')).toBeVisible();
  await videoTool(page); await page.locator('#chat-input').fill('Un faro al tramonto'); await page.locator('#chat-input').press('Enter');
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('consuma credito OpenRouter');
  expect(f.writes.filter(p => p === 'videos')).toHaveLength(0);
  await modal.getByRole('button',{ name:'Annulla',exact:true }).click(); expect(f.data.videoJobs).toHaveLength(0);
  await page.locator('#chat-input').press('Enter'); await modal.getByRole('button',{ name:'Conferma e genera video' }).click();
  await expect(page.locator('.video-jobs')).toContainText('In coda');
  expect(f.writes.filter(p => p === 'videos')).toHaveLength(1);
  f.complete(); await page.reload(); await expect(page.locator('#chat-input')).toBeVisible();
  await navigate(page,'Documenti');
  await expect(page.locator('.video-jobs')).toContainText('Generato e archiviato');
  await expect(page.locator('.video-jobs video')).toHaveAttribute('src',`/api/documents/${f.data.videoJobs[0].id}/file`);
  await expect(page.locator('.video-jobs video')).toHaveAttribute('preload','none');
  expect(f.writes.filter(p => p === 'videos')).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('video non configurato: stato onesto e nessuna richiesta al provider', async ({ page }) => {
  const f = await fixture(page,{ aiFailure:false,videoEnabled:false });
  await page.goto('/'); await expect(page.locator('#chat-input')).toBeVisible(); await videoTool(page);
  await page.locator('#chat-input').fill('Un video'); await page.locator('#chat-input').press('Enter');
  await expect(page.locator('.composer-error')).toContainText('VIDEO_ENABLED');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(f.writes.filter(p => p === 'videos')).toHaveLength(0);
});
