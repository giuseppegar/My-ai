-- My ai — Isole dinamiche ed emergenti (Inside Out)
-- Macro-isole, territori/distretti interni, stato di consolidamento notturno.
begin;

-- Rilassamento vincoli category per accogliere categorie ed identificativi dinamici
alter table public.myai_conversations drop constraint if exists myai_conversations_category_check;
alter table public.myai_conversations add constraint myai_conversations_category_check check (length(category) between 1 and 100);

alter table public.myai_messages drop constraint if exists myai_messages_category_check;
alter table public.myai_messages add constraint myai_messages_category_check check (length(category) between 1 and 100);

alter table public.myai_memories drop constraint if exists myai_memories_category_check;
alter table public.myai_memories add constraint myai_memories_category_check check (length(category) between 1 and 100);

alter table public.myai_documents drop constraint if exists myai_documents_category_check;
alter table public.myai_documents add constraint myai_documents_category_check check (length(category) between 1 and 100);

alter table public.myai_agent_sessions drop constraint if exists myai_agent_sessions_category_check;
alter table public.myai_agent_sessions add constraint myai_agent_sessions_category_check check (length(category) between 1 and 100);

create table public.myai_islands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  slug text not null check (length(slug) between 1 and 100),
  description text not null default '' check (length(description) <= 1000),
  color text not null default '#b67b69' check (length(color) between 3 and 30),
  icon text not null default 'Compass' check (length(icon) between 1 and 50),
  theme text not null default 'ancient' check (theme in ('ancient','botanical','observatory','workshop','coastal')),
  profile_summary text not null default '' check (length(profile_summary) <= 4000),
  weight int not null default 1 check (weight >= 0),
  image_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, user_id),
  unique(user_id, slug),
  foreign key (image_document_id, user_id) references public.myai_documents(id, user_id) on delete set null (image_document_id)
);

create table public.myai_island_districts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  island_id uuid not null,
  name text not null check (length(name) between 1 and 100),
  summary text not null default '' check (length(summary) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, user_id),
  foreign key (island_id, user_id) references public.myai_islands(id, user_id) on delete cascade
);

alter table public.myai_memories add column if not exists island_id uuid;
alter table public.myai_memories add column if not exists district_id uuid;
alter table public.myai_memories add column if not exists consolidated boolean not null default false;
alter table public.myai_memories add constraint myai_memory_island_fk foreign key (island_id, user_id) references public.myai_islands(id, user_id) on delete set null (island_id);
alter table public.myai_memories add constraint myai_memory_district_fk foreign key (district_id, user_id) references public.myai_island_districts(id, user_id) on delete set null (district_id);

alter table public.myai_conversations add column if not exists island_id uuid;
alter table public.myai_conversations add column if not exists district_id uuid;
alter table public.myai_conversations add column if not exists consolidated boolean not null default false;
alter table public.myai_conversations add constraint myai_conversation_island_fk foreign key (island_id, user_id) references public.myai_islands(id, user_id) on delete set null (island_id);
alter table public.myai_conversations add constraint myai_conversation_district_fk foreign key (district_id, user_id) references public.myai_island_districts(id, user_id) on delete set null (district_id);

alter table public.myai_documents add column if not exists island_id uuid;
alter table public.myai_documents add constraint myai_document_island_fk foreign key (island_id, user_id) references public.myai_islands(id, user_id) on delete set null (island_id);

alter table public.myai_islands enable row level security;
create policy myai_islands_owner on public.myai_islands for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.myai_island_districts enable row level security;
create policy myai_island_districts_owner on public.myai_island_districts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.myai_islands to authenticated;
grant select, insert, update, delete on public.myai_island_districts to authenticated;

create index if not exists myai_islands_user_idx on public.myai_islands(user_id);
create index if not exists myai_island_districts_island_idx on public.myai_island_districts(island_id);
create index if not exists myai_memories_island_idx on public.myai_memories(island_id);
create index if not exists myai_conversations_island_idx on public.myai_conversations(island_id);

commit;
