begin;
-- Immagini generate: distinguono i file caricati da quelli prodotti dal servizio immagini.
alter table public.myai_documents add column if not exists origin text not null default 'upload' check (origin in ('upload','generated'));
-- Contatore giornaliero separato dalle chiamate AI, atomico come myai_consume_call.
alter table public.myai_daily_usage add column if not exists images integer not null default 0;
create function public.myai_consume_image(max_calls integer default 5) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; uid uuid := auth.uid(); begin
  if uid is null then return false; end if;
  insert into myai_daily_usage(user_id,day,calls,images) values(uid,current_date,0,1)
    on conflict(user_id,day) do update set images=myai_daily_usage.images+1 where myai_daily_usage.images < greatest(1,least(max_calls,20)) returning images into n;
  return n is not null;
end $$;
revoke all on function public.myai_consume_image(integer) from public,anon;
grant execute on function public.myai_consume_image(integer) to authenticated;
commit;
