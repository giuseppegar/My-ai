-- My ai v0.1 — applicare su un progetto Supabase DEDICATO, mai con reset di database esistenti.
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
set local search_path = public, extensions;

create table public.myai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 150),
  category text not null check (category in ('scrivere','cucinare','capire','desideri')),
  searchable boolean not null default true,
  created_at timestamptz not null default now(),
  unique(id, user_id)
);
create table public.myai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user','assistant')),
  category text not null default 'capire' check (category in ('scrivere','cucinare','capire','desideri')),
  content text not null check (length(content) between 1 and 30000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.myai_conversations(id,user_id) on delete cascade
);
create table public.myai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 150),
  category text not null check (category in ('scrivere','cucinare','capire','desideri')),
  kind text not null check (kind in ('content','preference','idea','discovery')),
  content text not null check (length(content) between 1 and 20000),
  origin text not null default 'Inserito da te',
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.myai_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid,
  scope text not null check (scope in ('chat','memory')),
  title text not null check (length(title) between 1 and 150),
  category text not null check (category in ('scrivere','cucinare','capire','desideri')),
  filename text not null,
  mime text not null,
  path text not null unique,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  status text not null default 'processing' check (status in ('processing','ready','no_text','error')),
  error text,
  page_count integer,
  created_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key (conversation_id,user_id) references public.myai_conversations(id,user_id),
  check (scope <> 'chat' or conversation_id is not null),
  check (split_part(path,'/',1) = user_id::text)
);
create table public.myai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null,
  page integer check (page > 0),
  content text not null check (length(content) <= 6000),
  embedding extensions.vector(1024),
  foreign key (document_id,user_id) references public.myai_documents(id,user_id) on delete cascade
);
create table public.myai_wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 150),
  motivation text not null default '', outcome text not null default '',
  timeframe text not null default '', resources text not null default '',
  constraints text not null default '', unknowns text not null default '',
  next_action text not null default '', obstacles text not null default '', decisions text not null default '',
  milestones jsonb not null default '[]' check (jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 30),
  status text not null default 'active' check (status in ('active','paused','abandoned')),
  image_document_id uuid,
  created_at timestamptz not null default now(),
  foreign key (image_document_id,user_id) references public.myai_documents(id,user_id)
);
create table public.myai_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'
);
create table public.myai_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  category text not null check (category in ('scrivere','cucinare','capire','desideri')),
  request text not null check (length(request) between 1 and 12000),
  status text not null default 'ready' check (status in ('ready','running','waiting','completed','stopped','failed')),
  version integer not null default 1,
  plan jsonb not null default '["Coordinatore"]',
  cursor integer not null default 0,
  steps jsonb not null default '[]',
  result jsonb,
  interventions jsonb not null default '[]',
  refs jsonb not null default '[]',
  cycles integer not null default 1 check (cycles between 0 and 2),
  budget numeric not null default 0.2 check (budget between 0.02 and 1),
  reserved_cost numeric not null default 0 check (reserved_cost >= 0),
  duration_seconds integer not null default 240 check (duration_seconds between 30 and 600),
  elapsed_ms integer not null default 0,
  lease uuid, lease_until timestamptz,
  error text,
  created_at timestamptz not null default now(),
  foreign key (conversation_id,user_id) references public.myai_conversations(id,user_id) on delete cascade
);
create table public.myai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  calls integer not null default 0,
  primary key(user_id,day)
);

-- Tutti i join figli usano anche user_id: un utente non può collegarsi a righe altrui.
do $$ declare t text; begin
  foreach t in array array['myai_conversations','myai_messages','myai_memories','myai_documents','myai_document_chunks','myai_wishes','myai_settings','myai_agent_sessions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_only on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
    execute format('create index on public.%I (user_id)',t);
  end loop;
end $$;
alter table public.myai_daily_usage enable row level security;
revoke all on public.myai_daily_usage from anon, authenticated;
grant select on public.myai_daily_usage to authenticated;
create policy usage_owner on public.myai_daily_usage for select to authenticated using (auth.uid() = user_id);

create index myai_memory_text on public.myai_memories using gin(to_tsvector('italian',title || ' ' || content));
create index myai_chunks_text on public.myai_document_chunks using gin(to_tsvector('italian',content));
create index myai_messages_conversation on public.myai_messages(conversation_id,created_at);
create index myai_chunks_document on public.myai_document_chunks(document_id);
create index myai_memory_vector on public.myai_memories using hnsw(embedding extensions.vector_cosine_ops);
create index myai_chunks_vector on public.myai_document_chunks using hnsw(embedding extensions.vector_cosine_ops);

create function public.myai_touch_memory() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger myai_memory_updated before update on public.myai_memories for each row execute function public.myai_touch_memory();
-- Conservativo: anche risposte derivate da allegati chat-only non entrano nella ricerca globale.
create function public.myai_private_chat() returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.scope = 'chat' then update myai_conversations set searchable=false where id=new.conversation_id and user_id=auth.uid(); end if;
  return new;
end $$;
create trigger myai_document_scope after insert or update on public.myai_documents for each row execute function public.myai_private_chat();

-- Nessuna bozza viene salvata. SECURITY INVOKER mantiene RLS anche nelle ricerche vettoriali.
create function public.myai_search(q text, expanded text default '', query_embedding extensions.vector(1024) default null, category_filter text default null, source_filter text default null, take_count integer default 12)
returns table(id uuid, source text, title text, category text, excerpt text, page integer, conversation_id uuid, score double precision)
language sql stable security invoker set search_path = public, extensions as $$
  with candidates as (
    select m.id,'memory'::text as source,m.title,m.category,m.content,null::integer as page,null::uuid as conversation_id,m.embedding
      from myai_memories m where m.user_id=auth.uid()
    union all
    select m.id,'message',c.title,m.category,m.content,null,c.id,null::extensions.vector
      from myai_messages m join myai_conversations c on c.id=m.conversation_id and c.user_id=m.user_id
      where m.user_id=auth.uid() and c.searchable
    union all
    select d.id,'document',d.title,d.category,coalesce(ch.content,d.filename),ch.page,d.conversation_id,ch.embedding
      from myai_documents d left join myai_document_chunks ch on ch.document_id=d.id and ch.user_id=d.user_id
      where d.user_id=auth.uid() and d.scope='memory' and d.status in ('ready','no_text')
    union all
    select w.id,'wish',w.title,'desideri',concat_ws(' ',w.motivation,w.outcome,w.next_action,w.decisions),null,null,null::extensions.vector
      from myai_wishes w where w.user_id=auth.uid()
  ), ranked as (
    select c.*,
      (ts_rank_cd(to_tsvector('italian',c.title || ' ' || c.content),websearch_to_tsquery('italian',left(q,500))) * 2
       + case when length(expanded)>0 and to_tsvector('simple',c.title || ' ' || c.content) @@ to_tsquery('simple',expanded) then 0.45 else 0 end
       + extensions.similarity(c.title,left(q,500)) * 0.3
       + case when c.embedding is not null and query_embedding is not null and (c.embedding <=> query_embedding) < 0.65 then (1-(c.embedding <=> query_embedding)) * 0.8 else 0 end)::double precision as rank
    from candidates c where (category_filter is null or c.category=category_filter) and (source_filter is null or c.source=source_filter)
  ), dedup as (
    select distinct on (source,id) * from ranked where rank > 0.12 and length(trim(q))>=2 order by source,id,rank desc
  ) select id,source,title,category,left(content,380),page,conversation_id,rank from dedup order by rank desc limit greatest(1,least(take_count,60));
$$;
grant usage on schema extensions to authenticated;
revoke all on function public.myai_search(text,text,extensions.vector,text,text,integer) from public,anon;
grant execute on function public.myai_search(text,text,extensions.vector,text,text,integer) to authenticated;

create function public.myai_activity() returns jsonb language sql stable security invoker set search_path=public as $$
with activity as (
  select m.category,m.id,c.title,m.created_at from myai_messages m join myai_conversations c on c.id=m.conversation_id and c.user_id=m.user_id where m.user_id=auth.uid() and m.role='user'
), recurring as (
  select category from activity where created_at>=now()-interval '30 days' group by category having count(distinct (created_at at time zone 'UTC')::date)>=2
), novel as (
  select category from activity group by category having min(created_at)>=now()-interval '30 days'
)
select jsonb_build_object(
 'values',jsonb_build_array((select count(*) from recurring),(select count(*) from myai_memories where user_id=auth.uid() and kind='idea' and created_at>=now()-interval '30 days'),(select count(*) from novel),(select count(*) from myai_memories where user_id=auth.uid() and kind='discovery' and created_at>=now()-interval '30 days')),
 'related',jsonb_build_array(
   coalesce((select jsonb_agg(x) from (select id,title,'message' as source from activity where category in (select category from recurring) and created_at>=now()-interval '30 days' order by created_at desc limit 20)x),'[]'::jsonb),
   coalesce((select jsonb_agg(x) from (select id,title,'memory' as source from myai_memories where user_id=auth.uid() and kind='idea' and created_at>=now()-interval '30 days' order by created_at desc limit 20)x),'[]'::jsonb),
   coalesce((select jsonb_agg(x) from (select id,title,'message' as source from activity where category in (select category from novel) order by created_at desc limit 20)x),'[]'::jsonb),
   coalesce((select jsonb_agg(x) from (select id,title,'memory' as source from myai_memories where user_id=auth.uid() and kind='discovery' and created_at>=now()-interval '30 days' order by created_at desc limit 20)x),'[]'::jsonb)
  )
);
$$;
revoke all on function public.myai_activity() from public,anon;
grant execute on function public.myai_activity() to authenticated;

-- Contatore atomico: nessuna race tra repliche e nessuna scrittura diretta dal client.
create function public.myai_consume_call(max_calls integer default 50) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; uid uuid := auth.uid(); begin
  if uid is null then return false; end if;
  insert into myai_daily_usage(user_id,day,calls) values(uid,current_date,1)
    on conflict(user_id,day) do update set calls=myai_daily_usage.calls+1 where myai_daily_usage.calls < greatest(1,least(max_calls,100)) returning calls into n;
  return n is not null;
end $$;
revoke all on function public.myai_consume_call(integer) from public,anon;
grant execute on function public.myai_consume_call(integer) to authenticated;

-- Lease persistente: un solo passo per volta; stop/intervento revocano la lease.
create function public.myai_claim_agent(session_id uuid, expected_version integer, reservation numeric, reserve_ms integer)
returns setof public.myai_agent_sessions language plpgsql security invoker set search_path=public as $$
begin
  if reservation <= 0 or reserve_ms < 1 or reserve_ms > 90000 then return; end if;
  return query update myai_agent_sessions set status='running',lease=gen_random_uuid(),lease_until=now()+make_interval(secs=>reserve_ms::double precision/1000+10),reserved_cost=reserved_cost+reservation,elapsed_ms=elapsed_ms+reserve_ms
    where id=session_id and user_id=auth.uid() and version=expected_version
      and (status='ready' or (status='running' and lease_until<now()))
      and cursor<jsonb_array_length(plan) and reserved_cost+reservation<=budget and elapsed_ms+reserve_ms<=duration_seconds*1000
    returning *;
end $$;
revoke all on function public.myai_claim_agent(uuid,integer,numeric,integer) from public,anon;
grant execute on function public.myai_claim_agent(uuid,integer,numeric,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('myai-private','myai-private',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do nothing;
create policy myai_files_select on storage.objects for select to authenticated using (bucket_id='myai-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy myai_files_insert on storage.objects for insert to authenticated with check (bucket_id='myai-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy myai_files_delete on storage.objects for delete to authenticated using (bucket_id='myai-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- No UPDATE/overwrite: percorsi casuali immutabili. URL firmati solo dal server dopo autorizzazione RLS.
commit;
