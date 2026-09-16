-- Salvataggio per richiesta, atomico con i messaggi. Nessun backfill delle chat esistenti.
begin;
alter table public.myai_messages add constraint myai_message_identity unique(id,conversation_id,user_id);
alter table public.myai_messages add column reply_to_id uuid unique;
alter table public.myai_messages add constraint myai_reply_owner foreign key(reply_to_id,conversation_id,user_id)
  references public.myai_messages(id,conversation_id,user_id) on delete set null (reply_to_id);
alter table public.myai_messages add constraint myai_reply_role check(reply_to_id is null or role='assistant');
alter table public.myai_memories add column auto_conversation_id uuid;
alter table public.myai_memories add column auto_update boolean not null default false;
alter table public.myai_memories add constraint myai_auto_memory_owner foreign key(auto_conversation_id,user_id)
  references public.myai_conversations(id,user_id) on delete set null (auto_conversation_id);
create index myai_auto_memory_conversation on public.myai_memories(auto_conversation_id);
alter table public.myai_memories drop constraint myai_memories_content_check;
alter table public.myai_memories add constraint myai_memories_content_check check(length(content) between 1 and 65000);

create function public.myai_auto_memory() returns trigger language plpgsql security invoker set search_path=public as $$
declare visible boolean; question text;
begin
  -- Serializza con il passaggio a chat riservata: nessuna copia derivata può sfuggire al filtro.
  select searchable into visible from myai_conversations where id=new.conversation_id and user_id=new.user_id for update;
  if not coalesce(visible,false) then return new; end if;
  if new.role='user' then
    insert into myai_memories(id,user_id,title,category,kind,content,origin,auto_conversation_id,auto_update)
      values(new.id,new.user_id,left(regexp_replace(new.content,E'^\\[[^]]+\\]\\n',''),150),new.category,'content',
        E'Richiesta:\n'||new.content,'Salvataggio automatico · richiesta inviata',new.conversation_id,true)
      on conflict(id) do nothing;
  elsif new.reply_to_id is not null then
    select content into question from myai_messages where id=new.reply_to_id and user_id=new.user_id and role='user';
    if question is not null then
      -- UPDATE, non upsert: un ricordo eliminato volutamente non ricompare al completamento.
      update myai_memories set content=E'Richiesta:\n'||question||E'\n\nRisposta:\n'||new.content,embedding=null
        where id=new.reply_to_id and user_id=new.user_id and auto_conversation_id=new.conversation_id and auto_update;
    end if;
  end if;
  return new;
end $$;
create trigger myai_message_auto_memory after insert or update of content on public.myai_messages
  for each row execute function public.myai_auto_memory();

create function public.myai_revoke_auto_memories() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if not new.searchable then delete from myai_memories where auto_conversation_id=new.id and user_id=new.user_id; end if;
  return new;
end $$;
create trigger myai_conversation_private_memories after update of searchable on public.myai_conversations
  for each row execute function public.myai_revoke_auto_memories();

-- Il media generato riceve solo il prompt, mai allegati o cronologia. Rispetta comunque le chat riservate.
create function public.myai_generated_scope() returns trigger language plpgsql security invoker set search_path=public as $$
declare visible boolean;
begin
  if new.origin='generated' and new.conversation_id is not null then
    select searchable into visible from myai_conversations where id=new.conversation_id and user_id=new.user_id for update;
    new.scope := case when coalesce(visible,false) then 'memory' else 'chat' end;
  end if;
  return new;
end $$;
create trigger myai_generated_document_scope before insert on public.myai_documents
  for each row execute function public.myai_generated_scope();

alter table public.myai_agent_sessions add column request_message_id uuid;
alter table public.myai_agent_sessions add constraint myai_agent_request_owner foreign key(request_message_id,conversation_id,user_id)
  references public.myai_messages(id,conversation_id,user_id) on delete set null (request_message_id);
create function public.myai_save_agent_result() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status='completed' and new.request_message_id is not null and length(new.result->>'proposal')>0 then
    insert into myai_messages(user_id,conversation_id,category,role,reply_to_id,content)
      values(new.user_id,new.conversation_id,new.category,'assistant',new.request_message_id,
        (new.result->>'proposal')||E'\n\n'||coalesce(new.result->>'choice',''))
      on conflict(reply_to_id) do update set content=excluded.content;
  end if;
  return new;
end $$;
create trigger myai_agent_result_saved after update of status,result on public.myai_agent_sessions
  for each row execute function public.myai_save_agent_result();
commit;
