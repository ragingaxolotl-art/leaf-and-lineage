-- New copy rooms preserve both original beetles. Existing rows remain legacy swaps.
alter table public.pattern_trades add column if not exists exchange_mode text not null default 'swap' check(exchange_mode in ('copy','swap'));
create or replace function public.pattern_trade_exchange_v2(p_action text,p_code text,p_token_hash text,p_beetle jsonb default null,p_mode text default 'swap')
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare t public.pattern_trades%rowtype;
begin
 if p_mode not in ('copy','swap') then raise exception 'Invalid trade mode'; end if;
 if p_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid trade request'; end if;
 if p_action='create' then
  -- Completed receipts remain available for seven days, allowing a disconnected device to collect.
  delete from public.pattern_trades where (status='complete' and expires_at<now()) or (status<>'complete' and expires_at<now()-interval '7 days');
  select * into t from public.pattern_trades where code=p_code for update;
  if found then
   if t.exchange_mode<>p_mode then raise exception 'This trade uses different sharing rules. Refresh both screens and create a new sharing code'; end if;
   if t.host_hash<>p_token_hash then raise exception 'Trade code is taken' using errcode='23505'; end if;
  else
   if (select count(*) from public.pattern_trades where expires_at>now())>=5000 then raise exception 'The trade service is busy'; end if;
   insert into public.pattern_trades(code,host_hash,host_beetle,exchange_mode) values(p_code,p_token_hash,p_beetle,p_mode) returning * into t;
  end if;
 else
  select * into t from public.pattern_trades where code=p_code for update;
  if not found then raise exception 'This trade code is unavailable'; end if;
  if t.exchange_mode<>p_mode then raise exception 'This trade uses different sharing rules. Refresh both screens and create a new sharing code'; end if;
  if t.status='complete' and t.expires_at<now() then raise exception 'This trade receipt is expired'; end if;
  if p_action='join' then
   if t.expires_at<now() then raise exception 'This trade code is expired'; end if;
   if t.host_hash=p_token_hash then raise exception 'Use another screen for this trade'; end if;
   if t.guest_hash is not null and t.guest_hash<>p_token_hash then raise exception 'This trade already has a partner'; end if;
   if t.status='open' then
    update public.pattern_trades set guest_hash=p_token_hash,guest_beetle=p_beetle,status='offered' where code=p_code returning * into t;
   elsif t.guest_hash is distinct from p_token_hash then raise exception 'This trade is no longer open'; end if;
  else
   if t.host_hash<>p_token_hash and coalesce(t.guest_hash,'')<>p_token_hash then raise exception 'This trade code is unavailable'; end if;
   if p_action='accept' then
    if t.host_hash<>p_token_hash then raise exception 'Only the code creator can confirm the trade'; end if;
    if t.status='complete' then null;
    elsif t.expires_at<now() then raise exception 'This trade code is expired';
    elsif t.status<>'offered' then raise exception 'Wait for a trade partner';
    else update public.pattern_trades set status='complete',expires_at=now()+interval '7 days' where code=p_code returning * into t; end if;
   elsif p_action='cancel' then
    if t.status<>'complete' then update public.pattern_trades set status='cancelled' where code=p_code returning * into t; end if;
   elsif p_action<>'read' then raise exception 'Unknown trade action'; end if;
  end if;
 end if;
 if t.expires_at<now() and t.status<>'complete' then t.status='expired'; end if;
 return jsonb_build_object('mode',t.exchange_mode,'code',t.code,'status',t.status,'host',t.host_beetle,'guest',t.guest_beetle,'expiresAt',t.expires_at);
end $$;

revoke all on function public.pattern_trade_exchange_v2(text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.pattern_trade_exchange_v2(text,text,text,jsonb,text) to service_role;
-- Older clients can finish old swaps, but cannot accidentally join a copy room.
create or replace function public.pattern_trade_exchange(p_action text,p_code text,p_token_hash text,p_beetle jsonb default null)
returns jsonb language sql security invoker set search_path=pg_catalog,public as $$
 select public.pattern_trade_exchange_v2(p_action,p_code,p_token_hash,p_beetle,'swap');
$$;
revoke all on function public.pattern_trade_exchange(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.pattern_trade_exchange(text,text,text,jsonb) to service_role;
