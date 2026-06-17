-- Admin-dismissed invalid/misspelled missing location searches (expansion opportunities).
create table if not exists public.dismissed_missing_searches (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  state_code text not null default '',
  dismissed_at timestamptz not null default now(),
  unique (query, state_code)
);

create index if not exists dismissed_missing_searches_dismissed_at_idx
  on public.dismissed_missing_searches (dismissed_at desc);

alter table public.dismissed_missing_searches enable row level security;

comment on table public.dismissed_missing_searches is
  'Admin-dismissed missing location search rows; excluded from expansion opportunities.';

-- Bounded admin RPCs: optional p_until for previous-period trend comparisons.
create or replace function public.admin_returning_visitor_stats(
  p_since timestamptz default null,
  p_until timestamptz default null
)
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
  where (p_since is null or created_at >= p_since)
    and (p_until is null or created_at < p_until);
$$;

create or replace function public.admin_location_search_stats(
  p_since timestamptz default null,
  p_until timestamptz default null
)
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
  where (p_since is null or created_at >= p_since)
    and (p_until is null or created_at < p_until);
$$;

create or replace function public.admin_radar_engagement_stats(
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select *
    from public.radar_events
    where (p_since is null or created_at >= p_since)
      and (p_until is null or created_at < p_until)
  ),
  opens as (
    select count(*)::bigint as total
    from filtered
    where event_type = 'radar_opened'
  ),
  by_state as (
    select coalesce(state_code, 'unknown') as state_code,
           count(*)::bigint as open_count
    from filtered
    where event_type = 'radar_opened'
    group by coalesce(state_code, 'unknown')
    order by open_count desc
    limit 20
  ),
  by_type as (
    select coalesce(radar_type, 'unknown') as radar_type,
           count(*)::bigint as event_count
    from filtered
    where event_type in ('radar_opened', 'radar_type_changed')
      and radar_type is not null
    group by coalesce(radar_type, 'unknown')
    order by event_count desc
    limit 10
  ),
  by_location as (
    select coalesce(state_code, 'unknown') as state_code,
           count(*)::bigint as view_count
    from filtered
    where event_type = 'radar_location_changed'
      and state_code is not null
    group by coalesce(state_code, 'unknown')
    order by view_count desc
    limit 20
  )
  select json_build_object(
    'totalOpens', (select total from opens),
    'opensByState', coalesce((select json_agg(row_to_json(by_state)) from by_state), '[]'::json),
    'topRadarTypes', coalesce((select json_agg(row_to_json(by_type)) from by_type), '[]'::json),
    'topLocations', coalesce((select json_agg(row_to_json(by_location)) from by_location), '[]'::json)
  );
$$;
