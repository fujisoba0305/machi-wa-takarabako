create or replace function public.get_treasure_rating_summaries()
returns table (treasure_id bigint, average_rating numeric, rating_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id as treasure_id,
    coalesce(round(avg(tr.rating)::numeric, 1), 0) as average_rating,
    count(tr.id) as rating_count
  from public.treasures t
  left join public.treasure_ratings tr on tr.treasure_id = t.id
  group by t.id;
$$;

revoke all on function public.get_treasure_rating_summaries() from public;
grant execute on function public.get_treasure_rating_summaries() to anon, authenticated;
