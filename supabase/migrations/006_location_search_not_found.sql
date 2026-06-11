-- ============================================================
-- Location search outcome columns + not-found research view
-- ============================================================

alter table public.location_search_events
  add column if not exists success boolean not null default true;

alter table public.location_search_events
  add column if not exists resolved_type text;

-- Backfill resolved_type from legacy match_type for existing rows
update public.location_search_events
set resolved_type = match_type
where resolved_type is null and match_type is not null;

create index if not exists location_search_events_not_found_idx
  on public.location_search_events (success, created_at desc)
  where success = false;

create or replace view public.location_search_not_found as
select
  query,
  count(*)::bigint as searches
from public.location_search_events
where success = false
group by query
order by searches desc;

grant select on public.location_search_not_found to anon, authenticated;
