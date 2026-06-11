-- ============================================================
-- Admin analytics views (read via service role in Netlify fn)
-- ============================================================
-- missing_location_searches already defined in 007; not recreated here.
-- These views support the /admin/analysis dashboard.

-- Daily returning-visitor rollup
create or replace view public.returning_visitor_summary as
select
  date_trunc('day', created_at)::date as day,
  count(*)::bigint as total_sessions,
  count(distinct visitor_id)::bigint as unique_visitors,
  count(*) filter (where not is_returning)::bigint as new_visitors,
  count(*) filter (where is_returning)::bigint as returning_visitors,
  round(
    100.0 * count(*) filter (where is_returning) / nullif(count(*), 0),
    1
  ) as returning_pct
from public.visitor_sessions
group by date_trunc('day', created_at)::date
order by day desc;

-- Daily location-search rollup
create or replace view public.location_search_summary as
select
  date_trunc('day', created_at)::date as day,
  count(*)::bigint as total_searches,
  count(*) filter (where success)::bigint as successful_searches,
  count(*) filter (where not success)::bigint as failed_searches,
  round(
    100.0 * count(*) filter (where success) / nullif(count(*), 0),
    1
  ) as success_rate
from public.location_search_events
group by date_trunc('day', created_at)::date
order by day desc;

-- Top counties by alert-page views (all time; API applies date filter on base table)
create or replace view public.top_county_alert_views as
select
  c.name as county_name,
  c.state_code,
  cav.county_id,
  count(*)::bigint as view_count,
  max(cav.alert_count) as max_alert_count,
  max(cav.created_at) as last_viewed
from public.county_alert_views cav
join public.counties c on c.id = cav.county_id
group by c.name, c.state_code, cav.county_id
order by view_count desc;

-- Most saved locations across signed-in users
create or replace view public.saved_locations_summary as
select
  l.id as location_id,
  l.name as location_name,
  l.state,
  count(ul.id)::bigint as save_count,
  count(distinct ul.user_id)::bigint as unique_users,
  max(ul.created_at) as last_saved
from public.user_locations ul
join public.locations l on l.id = ul.location_id
group by l.id, l.name, l.state
order by save_count desc;

-- RPC helpers for date-filtered admin aggregations (called via service role)
create or replace function public.admin_returning_visitor_stats(p_since timestamptz default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_sessions', count(*)::bigint,
    'unique_visitors', count(distinct visitor_id)::bigint,
    'new_visitors', count(*) filter (where not is_returning)::bigint,
    'returning_visitors', count(*) filter (where is_returning)::bigint,
    'returning_pct', round(
      100.0 * count(*) filter (where is_returning) / nullif(count(*), 0),
      1
    )
  )
  from public.visitor_sessions
  where p_since is null or created_at >= p_since;
$$;

create or replace function public.admin_location_search_stats(p_since timestamptz default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_searches', count(*)::bigint,
    'successful_searches', count(*) filter (where success)::bigint,
    'failed_searches', count(*) filter (where not success)::bigint,
    'success_rate', round(
      100.0 * count(*) filter (where success) / nullif(count(*), 0),
      1
    )
  )
  from public.location_search_events
  where p_since is null or created_at >= p_since;
$$;

create or replace function public.admin_saved_location_stats(p_since timestamptz default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_saved', count(*)::bigint,
    'signed_in_users', count(distinct user_id)::bigint
  )
  from public.user_locations
  where p_since is null or created_at >= p_since;
$$;
