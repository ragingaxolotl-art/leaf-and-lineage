-- Dedicated beetle-lab project only. No accounts, chat, personal names or notes.
create table if not exists public.pattern_sumo_rooms (
 code text primary key check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
 host_secret_hash text not null,
 guest_secret_hash text,
 host_beetle jsonb not null check (octet_length(host_beetle::text) < 32000),
 guest_beetle jsonb check (octet_length(guest_beetle::text) < 32000),
 match_seed bigint,
 match_number integer not null default 0,
 started_at timestamptz,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '2 hours')
);
create index if not exists pattern_sumo_rooms_expiry on public.pattern_sumo_rooms(expires_at);
create table if not exists public.pattern_sumo_limits (
 bucket text primary key,
 hits integer not null default 1,
 expires_at timestamptz not null
);
create index if not exists pattern_sumo_limits_expiry on public.pattern_sumo_limits(expires_at);
alter table public.pattern_sumo_rooms enable row level security;
alter table public.pattern_sumo_limits enable row level security;
revoke all on public.pattern_sumo_rooms, public.pattern_sumo_limits from public, anon, authenticated;
grant select,insert,update,delete on public.pattern_sumo_rooms, public.pattern_sumo_limits to service_role;

create or replace function public.pattern_sumo_rate(p_bucket text,p_limit integer)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare n integer;
begin
 delete from public.pattern_sumo_limits where expires_at < now();
 delete from public.pattern_sumo_rooms where expires_at < now();
 insert into public.pattern_sumo_limits(bucket,hits,expires_at) values(p_bucket,1,now()+interval '3 minutes')
 on conflict(bucket) do update set hits=public.pattern_sumo_limits.hits+1 returning hits into n;
 return n<=p_limit;
end $$;
revoke all on function public.pattern_sumo_rate(text,integer) from public,anon,authenticated;
grant execute on function public.pattern_sumo_rate(text,integer) to service_role;

create or replace function public.pattern_sumo_exchange(p_action text,p_code text,p_token_hash text,p_beetle jsonb default null,p_seed bigint default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare room public.pattern_sumo_rooms%rowtype;
begin
 if p_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid room request'; end if;
 if p_action='create' then
  if (select count(*) from public.pattern_sumo_rooms where expires_at>now())>=5000 then raise exception 'The room service is busy'; end if;
  insert into public.pattern_sumo_rooms(code,host_secret_hash,host_beetle) values(p_code,p_token_hash,p_beetle) returning * into room;
 else
  select * into room from public.pattern_sumo_rooms where code=p_code and expires_at>now() for update;
  if not found then raise exception 'This code is unavailable or expired'; end if;
  if p_action='join' then
   if room.guest_secret_hash is not null and room.guest_secret_hash<>p_token_hash then raise exception 'This room already has two beetles'; end if;
   if room.host_secret_hash=p_token_hash then raise exception 'Use another device to join'; end if;
   update public.pattern_sumo_rooms set guest_secret_hash=p_token_hash,guest_beetle=p_beetle where code=p_code returning * into room;
  else
   if room.host_secret_hash<>p_token_hash and coalesce(room.guest_secret_hash,'')<>p_token_hash then raise exception 'This code is unavailable or expired'; end if;
   if p_action='start' then
    if room.host_secret_hash<>p_token_hash then raise exception 'Only the table host can start a shared match'; end if;
    if room.guest_beetle is null then raise exception 'Wait for a second beetle'; end if;
    if p_seed is null or p_seed<0 or p_seed>4294967295 then raise exception 'Invalid match seed'; end if;
    if room.match_number>=50 then raise exception 'Create a new room for more matches'; end if;
    update public.pattern_sumo_rooms set match_seed=p_seed,match_number=match_number+1,started_at=now()+interval '3 seconds' where code=p_code returning * into room;
   elsif p_action='close' then
    if room.host_secret_hash<>p_token_hash then raise exception 'Only the host can close this room'; end if;
    delete from public.pattern_sumo_rooms where code=p_code;
    return jsonb_build_object('closed',true);
   elsif p_action<>'read' then raise exception 'Unknown room action';
   end if;
  end if;
 end if;
 return jsonb_build_object('code',room.code,'expiresAt',room.expires_at,'host',room.host_beetle,'guest',room.guest_beetle,'seed',room.match_seed,'matchNumber',room.match_number,'startedAt',room.started_at,'serverNow',now());
end $$;
revoke all on function public.pattern_sumo_exchange(text,text,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.pattern_sumo_exchange(text,text,text,jsonb,bigint) to service_role;
