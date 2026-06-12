-- ============================================================
-- Drop legacy match_type on location_search_events
-- Migration 006 added resolved_type and backfilled from match_type.
-- App and admin API now use resolved_type only.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'match_type'
  ) then
    alter table public.location_search_events drop column match_type;
  end if;
end $$;
