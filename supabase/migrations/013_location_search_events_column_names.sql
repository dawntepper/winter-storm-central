-- ============================================================
-- Align location_search_events column names with production
-- Production uses source_page + resolved_* ids; older migrations
-- used page_context, city_id, county_id, zip_code.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'page_context'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'source_page'
  ) then
    alter table public.location_search_events
      rename column page_context to source_page;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'city_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'resolved_city_id'
  ) then
    alter table public.location_search_events
      rename column city_id to resolved_city_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'county_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'resolved_county_id'
  ) then
    alter table public.location_search_events
      rename column county_id to resolved_county_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'zip_code'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'resolved_zip'
  ) then
    alter table public.location_search_events
      rename column zip_code to resolved_zip;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'visitor_id'
  ) then
    alter table public.location_search_events
      add column visitor_id text;
  end if;
end $$;
