-- Preserve old SUMO2 rooms; never match clients running different battle physics.
alter table public.pattern_sumo_rooms add column if not exists physics_version text not null default 'SUMO2';
create or replace function public.pattern_sumo_exchange_versioned(p_action text,p_code text,p_token_hash text,p_beetle jsonb default null,p_seed bigint default null,p_model text default 'SUMO2')
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result jsonb; model text;
begin
 if p_model not in ('SUMO2','SUMO3','SUMO4') then raise exception 'Invalid battle model'; end if;
 if p_action<>'create' then
  select physics_version into model from public.pattern_sumo_rooms where code=p_code and expires_at>now() for update;
  if found and model<>p_model then raise exception 'These screens use different battle rules. Open the latest lab on both screens and create a new code'; end if;
 end if;
 result=public.pattern_sumo_exchange(p_action,p_code,p_token_hash,p_beetle,p_seed);
 if p_action='create' then
  update public.pattern_sumo_rooms set physics_version=p_model where code=p_code;
  model=p_model;
 end if;
 return result||jsonb_build_object('physicsVersion',model);
end $$;
revoke all on function public.pattern_sumo_exchange_versioned(text,text,text,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.pattern_sumo_exchange_versioned(text,text,text,jsonb,bigint,text) to service_role;
