-- ============================================================
-- Missing location searches view (replaces location_search_not_found)
-- Groups failed searches by query + state for catalog gap research.
-- ============================================================

drop view if exists public.location_search_not_found;

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
