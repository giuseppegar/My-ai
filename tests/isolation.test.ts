import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFile, readdir } from 'node:fs/promises';
import { expandQuery } from '@/lib/search';

// PostgreSQL reale in WASM. Auth/Storage sono fixture minime, non un'istanza Supabase live.
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ca = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cb = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let pg: PGlite;
async function asUser(id: string) { await pg.exec('reset role'); await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await pg.exec('set role authenticated'); }
const embedding = JSON.stringify([1, ...Array(1023).fill(0)]);
async function find(q: string, embed: string | null = null) { return (await pg.query<{ id: string; source: string; title: string }>('select * from myai_search($1,$2,$3::extensions.vector,null,null,60)', [q, expandQuery(q), embed])).rows; }

beforeAll(async () => {
  pg = new PGlite({ extensions: { vector, pg_trgm } });
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,anon;
    insert into auth.users(id) values('${A}'),('${B}');
  `);
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) await pg.exec(await readFile(new URL(file, migrations), 'utf8'));
  await pg.exec('grant usage on schema extensions to authenticated');
  for (const [user,conv,label] of [[A,ca,'A'],[B,cb,'B']]) {
    await asUser(user);
    await pg.query("insert into myai_conversations(id,title,category) values($1,$2,'cucinare')",[conv,`Conversazione ${label}`]);
    await pg.query("insert into myai_memories(title,category,kind,content,embedding) values($1,'cucinare','content',$2,$3)",[`Risotto privato ${label}`,`Ricetta ai funghi esclusiva ${label}`,embedding]);
    await pg.query("insert into myai_messages(conversation_id,role,content) values($1,'user',$2)",[conv,`Messaggio risotto ${label}`]);
    await pg.query("insert into storage.objects(bucket_id,name) values('myai-private',$1)",[`${user}/file.txt`]);
  }
});
afterAll(async () => { await pg?.close(); });

describe.sequential('RLS e ricerca su due account', () => {
  it('A non può leggere o modificare le righe di B; anon non legge nulla', async () => {
    await asUser(A);
    expect((await pg.query('select * from myai_memories where user_id=$1',[B])).rows).toEqual([]);
    expect((await pg.query("update myai_memories set title='Rubato' where user_id=$1 returning id",[B])).rows).toEqual([]);
    expect((await pg.query('delete from myai_memories where user_id=$1 returning id',[B])).rows).toEqual([]);
    await pg.exec('reset role; set role anon');
    await expect(pg.query('select * from myai_memories')).rejects.toThrow();
  });
  it('non permette user_id contraffatti e foreign key incrociate', async () => {
    await asUser(A);
    await expect(pg.query("insert into myai_memories(user_id,title,category,kind,content) values($1,'No','capire','content','No')",[B])).rejects.toThrow();
    await expect(pg.query("insert into myai_messages(conversation_id,role,content) values($1,'user','No')",[cb])).rejects.toThrow();
    await expect(pg.query('update myai_conversations set user_id=$1 where id=$2',[B,ca])).rejects.toThrow();
  });
  it('isola anche ricerca lessicale e vettoriale', async () => {
    await asUser(A);
    const lexical = await find('ricetta riso');
    expect(lexical.some(r => r.title === 'Risotto privato A')).toBe(true);
    expect(lexical.some(r => r.title.includes('privato B'))).toBe(false);
    const semantic = await find('concetto completamente diverso',embedding);
    expect(semantic.some(r => r.title === 'Risotto privato A')).toBe(true);
    expect(semantic.some(r => r.title === 'Risotto privato B')).toBe(false);
    await asUser(B);
    expect((await find('riso')).some(r => r.title === 'Risotto privato A')).toBe(false);
  });
  it('separa i file sullo storage, non solo nell’interfaccia', async () => {
    await asUser(A);
    const files = (await pg.query<{name:string}>('select name from storage.objects')).rows;
    expect(files.map(f => f.name)).toEqual([`${A}/file.txt`]);
    await expect(pg.query("insert into storage.objects(bucket_id,name) values('myai-private',$1)",[`${B}/attacco.txt`])).rejects.toThrow();
    expect((await pg.query('delete from storage.objects where name=$1 returning id',[`${B}/file.txt`])).rows).toEqual([]);
    expect((await pg.query("update storage.objects set name=$1 returning id",[`${A}/sovrascritto.txt`])).rows).toEqual([]);
  });
  it('modifica ed eliminazione si riflettono subito nella ricerca; nuovi accessi conservano i ricordi', async () => {
    await asUser(A);
    const inserted = await pg.query<{id:string}>("insert into myai_memories(title,category,kind,content) values('Zafferanounico','cucinare','content','Zafferanounico') returning id");
    const id = inserted.rows[0].id;
    await asUser(B); await asUser(A);
    expect((await find('Zafferanounico')).map(r => r.id)).toContain(id);
    await pg.query("update myai_memories set title='Montagna',content='Sentiero',embedding=null where id=$1",[id]);
    expect((await find('Zafferanounico')).map(r => r.id)).not.toContain(id);
    expect((await find('Montagna')).map(r => r.id)).toContain(id);
    await pg.query('delete from myai_memories where id=$1',[id]);
    expect((await find('Montagna')).map(r => r.id)).not.toContain(id);
  });
  it('allegati chat-only ed eventuali risposte derivate restano fuori dalla ricerca globale', async () => {
    await asUser(A);
    const d = await pg.query<{id:string}>("insert into myai_documents(conversation_id,scope,title,category,filename,mime,path,size_bytes) values($1,'chat','Segretoallegato','cucinare','segreto.txt','text/plain',$2,20) returning id",[ca,`${A}/segreto.txt`]);
    const doc = d.rows[0].id;
    await pg.query('insert into myai_document_chunks(document_id,page,content,embedding) values($1,1,$2,$3)',[doc,'Segretoallegato e riso',embedding]);
    expect((await find('Segretoallegato')).map(r => r.id)).not.toContain(doc);
    expect((await find('Messaggio risotto A')).filter(r => r.source === 'message')).toEqual([]);
    await pg.query("update myai_documents set scope='memory',status='ready' where id=$1",[doc]);
    expect((await find('Segretoallegato')).map(r => r.id)).toContain(doc);
    await asUser(B);
    expect((await find('Segretoallegato',embedding)).map(r => r.id)).not.toContain(doc);
    await expect(pg.query('insert into myai_document_chunks(document_id,content) values($1,$2)',[doc,'Attacco'])).rejects.toThrow();
    await asUser(A);
    await pg.query('delete from myai_documents where id=$1',[doc]);
    expect((await pg.query('select * from myai_document_chunks where document_id=$1',[doc])).rows).toEqual([]);
    expect((await find('Segretoallegato')).map(r => r.id)).not.toContain(doc);
  });
  it('indicatori basati su ricordi effettivi, cancellabili e isolati', async () => {
    await asUser(A);
    const before = (await pg.query<{myai_activity:{values:number[]}}>('select myai_activity()')).rows[0].myai_activity.values[1];
    const row = (await pg.query<{id:string}>("insert into myai_memories(title,category,kind,content) values('Idea mia','capire','idea','Un’idea confermata') returning id")).rows[0];
    const after = (await pg.query<{myai_activity:{values:number[]}}>('select myai_activity()')).rows[0].myai_activity.values[1];
    expect(after).toBe(before+1);
    await asUser(B);
    expect((await pg.query<{myai_activity:{values:number[]}}>('select myai_activity()')).rows[0].myai_activity.values[1]).toBe(0);
    await asUser(A); await pg.query('delete from myai_memories where id=$1',[row.id]);
    expect((await pg.query<{myai_activity:{values:number[]}}>('select myai_activity()')).rows[0].myai_activity.values[1]).toBe(before);
  });
});
describe.sequential('salvataggio automatico e video durabili', () => {
  let conv: string;
  let question: string;
  it('conserva subito la richiesta e aggiorna un solo ricordo con la risposta, senza preferenze dedotte', async () => {
    await asUser(A);
    conv = (await pg.query<{id:string}>("insert into myai_conversations(title,category) values('Autosave','scrivere') returning id")).rows[0].id;
    question = (await pg.query<{id:string}>("insert into myai_messages(conversation_id,role,category,content) values($1,'user','scrivere','Mi piace questo tono: scrivi una mail') returning id",[conv])).rows[0].id;
    let memory = (await pg.query<{content:string;kind:string;category:string}>('select * from myai_memories where id=$1',[question])).rows[0];
    expect(memory.kind).toBe('content');
    expect(memory.category).toBe('scrivere');
    expect(memory.content).toContain('Mi piace questo tono');
    await pg.query("insert into myai_messages(conversation_id,role,category,reply_to_id,content) values($1,'assistant','scrivere',$2,'Ecco la mail completa')",[conv,question]);
    memory = (await pg.query<{content:string;kind:string;category:string}>('select * from myai_memories where id=$1',[question])).rows[0];
    expect(memory.content).toContain('Ecco la mail completa');
    expect((await pg.query('select * from myai_memories where auto_conversation_id=$1',[conv])).rows).toHaveLength(1);
    await pg.query("update myai_messages set content='Mail aggiornata' where reply_to_id=$1",[question]);
    expect((await pg.query<{content:string}>('select content from myai_memories where id=$1',[question])).rows[0].content).not.toContain('Ecco la mail completa');
    await asUser(B);
    expect((await pg.query('select * from myai_memories where id=$1',[question])).rows).toEqual([]);
    await expect(pg.query("insert into myai_messages(conversation_id,role,reply_to_id,content) values($1,'assistant',$2,'Tentativo incrociato')",[cb,question])).rejects.toThrow();
  });
  it('un allegato chat-only revoca anche le copie automatiche e non ricatalogare le risposte private', async () => {
    await asUser(A);
    await pg.query("insert into myai_documents(conversation_id,scope,title,category,filename,mime,path,size_bytes) values($1,'chat','Privato','scrivere','privato.txt','text/plain',$2,20)",[conv,`${A}/autosave-private.txt`]);
    expect((await pg.query('select * from myai_memories where auto_conversation_id=$1',[conv])).rows).toEqual([]);
    await pg.query("insert into myai_messages(conversation_id,role,content) values($1,'user','Nuova domanda riservata')",[conv]);
    await pg.query("update myai_messages set content='Risposta privata aggiornata' where reply_to_id=$1",[question]);
    expect((await pg.query('select * from myai_memories where auto_conversation_id=$1',[conv])).rows).toEqual([]);
    expect((await find('Risposta privata aggiornata')).filter(r => ['message','memory'].includes(r.source))).toEqual([]);
  });
  it('non ricrea un ricordo cancellato quando arriva la risposta; gli altri ricordi restano dopo la cancellazione chat', async () => {
    await asUser(A);
    const c = (await pg.query<{id:string}>("insert into myai_conversations(title,category) values('Cancellabile','capire') returning id")).rows[0].id;
    const q = (await pg.query<{id:string}>("insert into myai_messages(conversation_id,role,content) values($1,'user','Richiesta cancellabile') returning id",[c])).rows[0].id;
    await pg.query('delete from myai_memories where id=$1',[q]);
    await pg.query("insert into myai_messages(conversation_id,role,reply_to_id,content) values($1,'assistant',$2,'Risposta tardiva')",[c,q]);
    expect((await pg.query('select * from myai_memories where id=$1',[q])).rows).toEqual([]);
    const kept = (await pg.query<{id:string}>("insert into myai_messages(conversation_id,role,content) values($1,'user','Questo ricordo resta') returning id",[c])).rows[0].id;
    await pg.query('delete from myai_conversations where id=$1',[c]);
    expect((await pg.query<{auto_conversation_id:null}>('select * from myai_memories where id=$1',[kept])).rows[0].auto_conversation_id).toBeNull();
  });
  it('la sintesi degli agenti aggiorna la richiesta senza duplicarla a ogni versione', async () => {
    await asUser(A);
    const q = (await pg.query<{id:string}>("insert into myai_messages(conversation_id,role,content) values($1,'user','Un approfondimento') returning id",[ca])).rows[0].id;
    const s = (await pg.query<{id:string}>("insert into myai_agent_sessions(conversation_id,request_message_id,category,request) values($1,$2,'capire','Un approfondimento') returning id",[ca,q])).rows[0].id;
    await pg.query(`update myai_agent_sessions set status='completed',result='{"proposal":"Proposta finale","choice":"Scegli tu"}' where id=$1`,[s]);
    await pg.query(`update myai_agent_sessions set result='{"proposal":"Proposta rivista","choice":"Scegli tu"}' where id=$1`,[s]);
    expect((await pg.query('select * from myai_messages where reply_to_id=$1',[q])).rows).toHaveLength(1);
    expect((await pg.query<{content:string}>('select content from myai_messages where reply_to_id=$1',[q])).rows[0].content).toContain('Proposta rivista');
  });
  it('scope dei media generati: memoria nelle chat normali, chat-only nelle riservate', async () => {
    await asUser(A);
    for (const [c,expected] of [[conv,'chat'],[cb,'memory']]) {
      if (c === cb) await asUser(B);
      const uid = c === cb ? B : A;
      const row = (await pg.query<{scope:string}>("insert into myai_documents(conversation_id,scope,title,category,filename,mime,path,size_bytes,origin,status) values($1,'memory','Video','capire','video.mp4','video/mp4',$2,20000000,'generated','ready') returning scope",[c,`${uid}/scope-video.mp4`])).rows[0];
      expect(row.scope).toBe(expected);
    }
    await expect(pg.query("insert into myai_documents(scope,title,category,filename,mime,path,size_bytes) values('memory','Troppo','capire','file.pdf','application/pdf',$1,20000000)",[`${B}/too-big.pdf`])).rejects.toThrow();
  });
  it('avvio idempotente: una quota, una richiesta; lease polling esclusiva e isolamento B', async () => {
    await asUser(B);
    const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const lease = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const start = () => pg.query<{id:string}>('select * from myai_start_video($1,$2,$3,$4,$5,4,$6,$7,$8,1)',[id,cb,'Un panorama','capire','google/veo-3.1-lite','720p','16:9',lease]);
    expect((await start()).rows).toHaveLength(1);
    expect((await start()).rows).toHaveLength(1);
    expect((await pg.query('select * from myai_messages where id=$1',[id])).rows).toHaveLength(1);
    expect((await pg.query<{videos:number}>('select videos from myai_daily_usage where user_id=$1 and day=current_date',[B])).rows[0].videos).toBe(1);
    await expect(pg.query('select * from myai_start_video(gen_random_uuid(),$1,$2,$3,$4,4,$5,$6,$7,1)',[cb,'Un altro video','capire','google/veo-3.1-lite','720p','16:9',lease])).rejects.toThrow('video_daily_limit');
    expect((await pg.query('select * from myai_video_jobs')).rows).toHaveLength(1);
    await pg.query("update myai_video_jobs set status='pending' where id=$1",[id]);
    expect((await pg.query('select * from myai_claim_video($1)',[id])).rows).toHaveLength(1);
    expect((await pg.query('select * from myai_claim_video($1)',[id])).rows).toEqual([]);
    await asUser(A);
    expect((await pg.query('select * from myai_video_jobs where id=$1',[id])).rows).toEqual([]);
    expect((await pg.query('select * from myai_claim_video($1)',[id])).rows).toEqual([]);
    await expect(pg.query("insert into myai_video_jobs(id,conversation_id,prompt,category,model,duration,resolution,aspect_ratio) values(gen_random_uuid(),$1,'No','capire','x',4,'720p','16:9')",[cb])).rejects.toThrow();
    await asUser(B);
    await pg.query("insert into myai_documents(id,conversation_id,scope,title,category,filename,mime,path,size_bytes,origin,status) values($1,$2,'memory','Un panorama','capire','video.mp4','video/mp4',$3,1000,'generated','ready')",[id,cb,`${B}/${id}.mp4`]);
    await pg.query("update myai_video_jobs set status='completed',document_id=$1 where id=$1",[id]);
    await pg.query("update myai_video_jobs set status='completed' where id=$1",[id]);
    expect((await pg.query('select * from myai_messages where reply_to_id=$1',[id])).rows).toHaveLength(1);
    expect((await pg.query<{content:string}>('select content from myai_memories where id=$1',[id])).rows[0].content).toContain('Video generato e salvato');
    await pg.query('delete from myai_documents where id=$1',[id]);
    expect((await pg.query<{document_id:null}>('select document_id from myai_video_jobs where id=$1',[id])).rows[0].document_id).toBeNull();
    await expect(pg.query('delete from myai_daily_usage')).rejects.toThrow();
  });
});

describe.sequential('lease, stop e budget agenti persistenti', () => {
  let session: string;
  it('un solo worker può acquisire il passo e non può acquisire sessioni altrui', async () => {
    await asUser(A);
    session = (await pg.query<{id:string}>("insert into myai_agent_sessions(conversation_id,category,request) values($1,'cucinare','Organizza un menu') returning id",[ca])).rows[0].id;
    const first = await pg.query('select * from myai_claim_agent($1,1,0.03,10000)',[session]);
    expect(first.rows).toHaveLength(1);
    expect((await pg.query('select * from myai_claim_agent($1,1,0.03,10000)',[session])).rows).toEqual([]);
    await asUser(B);
    expect((await pg.query('select * from myai_claim_agent($1,1,0.03,10000)',[session])).rows).toEqual([]);
  });
  it('un vincolo invalida output e lease di una versione precedente', async () => {
    await asUser(A);
    const old = (await pg.query<{lease:string}>('select lease from myai_agent_sessions where id=$1',[session])).rows[0].lease;
    await pg.query("update myai_agent_sessions set version=2,status='ready',lease=null,lease_until=null,interventions='[{\"text\":\"Senza glutine\"}]',cursor=0,plan='[\"Coordinatore\"]' where id=$1",[session]);
    expect((await pg.query("update myai_agent_sessions set status='completed',result='{}' where id=$1 and version=1 and lease=$2 returning id",[session,old])).rows).toEqual([]);
    expect((await pg.query('select * from myai_claim_agent($1,1,0.03,10000)',[session])).rows).toEqual([]);
    expect((await pg.query('select * from myai_claim_agent($1,2,0.03,10000)',[session])).rows).toHaveLength(1);
  });
  it('dopo stop non viene avviato nuovo lavoro; budget applicato prima della chiamata', async () => {
    await asUser(A);
    await pg.query("update myai_agent_sessions set status='stopped',lease=null where id=$1",[session]);
    expect((await pg.query('select * from myai_claim_agent($1,2,0.03,10000)',[session])).rows).toEqual([]);
    await pg.query("update myai_agent_sessions set status='ready' where id=$1",[session]);
    expect((await pg.query('select * from myai_claim_agent($1,2,0.9,10000)',[session])).rows).toEqual([]);
  });
  it('quota giornaliera atomica non resettabile dal client', async () => {
    await asUser(A);
    expect((await pg.query<{myai_consume_call:boolean}>('select myai_consume_call(1)')).rows[0].myai_consume_call).toBe(true);
    expect((await pg.query<{myai_consume_call:boolean}>('select myai_consume_call(1)')).rows[0].myai_consume_call).toBe(false);
    await expect(pg.query('delete from myai_daily_usage')).rejects.toThrow();
    await asUser(B);
    expect((await pg.query<{myai_consume_call:boolean}>('select myai_consume_call(1)')).rows[0].myai_consume_call).toBe(true);
  });
});
