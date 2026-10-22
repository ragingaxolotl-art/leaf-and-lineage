-- One-for-one classroom trades. Capability tokens are hashed by the Edge Function.
create table if not exists public.pattern_trades (
 code text primary key check(code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
 host_hash text not null, guest_hash text,
 host_beetle jsonb not null check(octet_length(host_beetle::text)<32000),
 guest_beetle jsonb check(octet_length(guest_beetle::text)<32000),
 status text not null default 'open' check(status in ('open','offered','complete','cancelled')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '2 hours'
);
alter table public.pattern_trades enable row level security;
revoke all on public.pattern_trades from public,anon,authenticated;
grant select,insert,update,delete on public.pattern_trades to service_role;
create index if not exists pattern_trades_expiry on public.pattern_trades(expires_at);
create or replace function public.pattern_trade_exchange(p_action text,p_code text,p_token_hash text,p_beetle jsonb default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare t public.pattern_trades%rowtype;
begin
 if p_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid trade request'; end if;
 if p_action='create' then
  -- Completed receipts remain available for seven days, allowing a disconnected device to collect.
  delete from public.pattern_trades where (status='complete' and expires_at<now()) or (status<>'complete' and expires_at<now()-interval '7 days');
  select * into t from public.pattern_trades where code=p_code for update;
  if found then
   if t.host_hash<>p_token_hash then raise exception 'Trade code is taken' using errcode='23505'; end if;
  else
   if (select count(*) from public.pattern_trades where expires_at>now())>=5000 then raise exception 'The trade service is busy'; end if;
   insert into public.pattern_trades(code,host_hash,host_beetle) values(p_code,p_token_hash,p_beetle) returning * into t;
  end if;
 else
  select * into t from public.pattern_trades where code=p_code for update;
  if not found then raise exception 'This trade code is unavailable'; end if;
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
 return jsonb_build_object('code',t.code,'status',t.status,'host',t.host_beetle,'guest',t.guest_beetle,'expiresAt',t.expires_at);
end $$;
revoke all on function public.pattern_trade_exchange(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.pattern_trade_exchange(text,text,text,jsonb) to service_role;
