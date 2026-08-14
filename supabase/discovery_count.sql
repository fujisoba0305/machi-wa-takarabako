alter table public.treasures
add column if not exists discovery_count integer not null default 0;

create or replace function public.increment_treasure_discovery(p_treasure_id bigint)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.treasures
  set discovery_count = discovery_count + 1
  where id = p_treasure_id
  returning discovery_count;
$$;

revoke all on function public.increment_treasure_discovery(bigint) from public;
grant execute on function public.increment_treasure_discovery(bigint) to anon, authenticated;
