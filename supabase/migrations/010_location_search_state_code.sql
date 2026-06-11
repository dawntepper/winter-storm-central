-- ============================================================
-- Unify location_search_events state column to state_code
-- Production may have state_context from an earlier schema; 005
-- defines state_code. App inserts and admin queries use state_code.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'state_context'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'state_code'
  ) then
    alter table public.location_search_events
      rename column state_context to state_code;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'state_code'
  ) then
    alter table public.location_search_events
      add column state_code text;
  end if;
end $$;

-- Recreate view (007) so it picks up the unified column
drop view if exists public.missing_location_searches;

create or replace view public.missing_location_searches as
select
  query,
  state_code as state_context,
  count(*) as search_count,
  max(created_at) as last_searched
from public.location_search_events
where success = false
group by query, state_code
order by search_count desc;

grant select on public.missing_location_searches to anon, authenticated;
