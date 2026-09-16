-- API video asincrona OpenRouter: job durabili, quota separata, file MP4 privati.
begin;
alter table public.myai_documents drop constraint myai_documents_size_bytes_check;
alter table public.myai_documents add constraint myai_documents_size_bytes_check
  check(size_bytes between 1 and case when mime='video/mp4' and origin='generated' then 52428800 else 10485760 end);
update storage.buckets set file_size_limit=52428800,allowed_mime_types=array_append(allowed_mime_types,'video/mp4')
  where id='myai-private' and not ('video/mp4'=any(allowed_mime_types));
alter table public.myai_daily_usage add column videos integer not null default 0;
create function public.myai_consume_video(max_calls integer default 2) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; uid uuid := auth.uid(); begin
  if uid is null then return false; end if;
  insert into myai_daily_usage(user_id,day,calls,videos) values(uid,current_date,0,1)
    on conflict(user_id,day) do update set videos=myai_daily_usage.videos+1 where myai_daily_usage.videos < greatest(1,least(max_calls,10)) returning videos into n;
  return n is not null;
end $$;
revoke all on function public.myai_consume_video(integer) from public,anon;
grant execute on function public.myai_consume_video(integer) to authenticated;

create table public.myai_video_jobs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  prompt text not null check(length(prompt) between 1 and 2000),
  category text not null check(category in ('scrivere','cucinare','capire','desideri')),
  model text not null,
  duration integer not null check(duration between 1 and 15),
  resolution text not null,
  aspect_ratio text not null,
  status text not null default 'submitting' check(status in ('submitting','pending','in_progress','completed','failed','uncertain')),
  provider_id text,
  provider_signature text,
  document_id uuid,
  cost numeric check(cost>=0),
  error text,
  lease uuid,
  poll_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key(conversation_id,user_id) references public.myai_conversations(id,user_id) on delete cascade,
  foreign key(document_id,user_id) references public.myai_documents(id,user_id) on delete set null (document_id)
);
alter table public.myai_video_jobs enable row level security;
create policy owner_only on public.myai_video_jobs for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
revoke all on public.myai_video_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.myai_video_jobs to authenticated;
create index myai_video_user on public.myai_video_jobs(user_id,created_at);

-- Solo l'inserimento vincente ottiene la lease di invio e consuma credito/quota.
-- Un retry HTTP con lo stesso job_id restituisce il job, NON invia un altro POST al provider.
create function public.myai_start_video(job_id uuid, conversation uuid, request_prompt text, request_category text,
  request_model text, seconds integer, pixels text, ratio text, submit_lease uuid, max_calls integer default 2)
returns setof public.myai_video_jobs language plpgsql security invoker set search_path=public as $$
begin
  insert into myai_video_jobs(id,conversation_id,prompt,category,model,duration,resolution,aspect_ratio,lease)
    values(job_id,conversation,request_prompt,request_category,request_model,seconds,pixels,ratio,submit_lease)
    on conflict(id) do nothing;
  if found then
    if not myai_consume_video(max_calls) then raise exception 'video_daily_limit'; end if;
    insert into myai_messages(id,conversation_id,role,category,content)
      values(job_id,conversation,'user',request_category,E'[Genera video]\n'||request_prompt);
  end if;
  return query select * from myai_video_jobs where id=job_id and user_id=auth.uid();
end $$;
revoke all on function public.myai_start_video(uuid,uuid,text,text,text,integer,text,text,uuid,integer) from public,anon;
grant execute on function public.myai_start_video(uuid,uuid,text,text,text,integer,text,text,uuid,integer) to authenticated;

create function public.myai_claim_video(job_id uuid) returns setof public.myai_video_jobs
language sql security invoker set search_path=public as $$
  update myai_video_jobs set lease=gen_random_uuid(),poll_after=now()+interval '120 seconds'
    where id=job_id and user_id=auth.uid() and status in ('pending','in_progress') and poll_after<=now()
    returning *;
$$;
revoke all on function public.myai_claim_video(uuid) from public,anon;
grant execute on function public.myai_claim_video(uuid) to authenticated;

create function public.myai_save_video_result() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status='completed' and old.status<>'completed' and new.document_id is not null then
    insert into myai_messages(user_id,conversation_id,category,role,reply_to_id,content)
      values(new.user_id,new.conversation_id,new.category,'assistant',new.id,
        'Video generato e salvato nell’archivio privato. Puoi riprodurlo dalla chat o da Documenti.')
      on conflict(reply_to_id) do nothing;
  end if;
  return new;
end $$;
create trigger myai_video_result_saved after update of status on public.myai_video_jobs
  for each row execute function public.myai_save_video_result();
commit;
