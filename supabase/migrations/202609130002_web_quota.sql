begin;
-- Contatore giornaliero separato per le ricerche web, atomico come gli altri.
alter table public.myai_daily_usage add column if not exists web integer not null default 0;
create function public.myai_consume_web(max_calls integer default 10) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; uid uuid := auth.uid(); begin
  if uid is null then return false; end if;
  insert into myai_daily_usage(user_id,day,calls,web) values(uid,current_date,0,1)
    on conflict(user_id,day) do update set web=myai_daily_usage.web+1 where myai_daily_usage.web < greatest(1,least(max_calls,50)) returning web into n;
  return n is not null;
end $$;
revoke all on function public.myai_consume_web(integer) from public,anon;
grant execute on function public.myai_consume_web(integer) to authenticated;
commit;
