-- ============================================================
-- Align county_alert_views + location_search_events with production
-- Production uses source_page (not source) and visitor_id / user_id.
-- ============================================================

-- county_alert_views: source → source_page
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'county_alert_views'
      and column_name = 'source'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'county_alert_views'
      and column_name = 'source_page'
  ) then
    alter table public.county_alert_views
      rename column source to source_page;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'county_alert_views'
      and column_name = 'visitor_id'
  ) then
    alter table public.county_alert_views
      add column visitor_id text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'county_alert_views'
      and column_name = 'user_id'
  ) then
    alter table public.county_alert_views
      add column user_id uuid references auth.users(id) on delete set null;
  end if;
end $$;

-- location_search_events: user_id when signed in
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_search_events'
      and column_name = 'user_id'
  ) then
    alter table public.location_search_events
      add column user_id uuid references auth.users(id) on delete set null;
  end if;
end $$;
