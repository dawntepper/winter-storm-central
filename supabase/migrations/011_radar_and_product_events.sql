-- ============================================================
-- Radar engagement + product funnel events
-- ============================================================

create table if not exists public.radar_events (
  id          uuid primary key default gen_random_uuid(),
  visitor_id  text not null,
  session_id  text not null,
  state_code  text,
  radar_type  text,
  event_type  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists radar_events_created_at_idx
  on public.radar_events (created_at desc);

create index if not exists radar_events_event_type_idx
  on public.radar_events (event_type);

create index if not exists radar_events_session_idx
  on public.radar_events (session_id);

create index if not exists radar_events_state_code_idx
  on public.radar_events (state_code)
  where state_code is not null;

create table if not exists public.product_events (
  id          uuid primary key default gen_random_uuid(),
  visitor_id  text not null,
  session_id  text not null,
  event_name  text not null,
  state_code  text,
  page_path   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists product_events_created_at_idx
  on public.product_events (created_at desc);

create index if not exists product_events_event_name_idx
  on public.product_events (event_name);

create index if not exists product_events_session_idx
  on public.product_events (session_id);

create index if not exists product_events_state_code_idx
  on public.product_events (state_code)
  where state_code is not null;

alter table public.radar_events enable row level security;
alter table public.product_events enable row level security;

drop policy if exists "radar_events_insert_public" on public.radar_events;
create policy "radar_events_insert_public"
  on public.radar_events for insert
  to anon, authenticated
  with check (true);

drop policy if exists "product_events_insert_public" on public.product_events;
create policy "product_events_insert_public"
  on public.product_events for insert
  to anon, authenticated
  with check (true);

-- Daily radar rollup (admin reads via service role)
create or replace view public.radar_engagement_summary as
select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where event_type = 'radar_opened')::bigint as radar_opens,
  count(*) filter (where event_type = 'radar_toggled')::bigint as radar_toggles,
  count(*) filter (where event_type = 'radar_type_changed')::bigint as type_changes,
  count(*) filter (where event_type = 'radar_location_changed')::bigint as location_changes
from public.radar_events
group by date_trunc('day', created_at)::date
order by day desc;

-- Radar engagement stats for admin API
create or replace function public.admin_radar_engagement_stats(p_since timestamptz default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select *
    from public.radar_events
    where p_since is null or created_at >= p_since
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

-- Sequential funnel: each step must occur after the prior step in the same session
create or replace function public.admin_product_funnel_stats(
  p_since timestamptz default null,
  p_steps text[] default array[
    'homepage_view',
    'state_alert_page_view',
    'location_change',
    'radar_view',
    'save_location'
  ]
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  step_count int;
  i int;
  prev_count bigint := 0;
  curr_count bigint := 0;
  first_count bigint := 0;
  step_stats jsonb := '[]'::jsonb;
begin
  step_count := coalesce(array_length(p_steps, 1), 0);
  if step_count = 0 then
    return json_build_object('steps', p_steps, 'stepStats', '[]'::json, 'overallCompletionPct', 0);
  end if;

  create temp table if not exists _funnel_sessions (session_id text primary key, last_ts timestamptz) on commit drop;
  truncate _funnel_sessions;

  for i in 1..step_count loop
    if i = 1 then
      insert into _funnel_sessions (session_id, last_ts)
      select session_id, min(created_at)
      from public.product_events
      where event_name = p_steps[1]
        and (p_since is null or created_at >= p_since)
      group by session_id;

      select count(*) into curr_count from _funnel_sessions;
      first_count := curr_count;
    else
      create temp table if not exists _funnel_next (session_id text primary key, last_ts timestamptz) on commit drop;
      truncate _funnel_next;

      insert into _funnel_next (session_id, last_ts)
      select pe.session_id, min(pe.created_at)
      from public.product_events pe
      join _funnel_sessions fs on fs.session_id = pe.session_id
      where pe.event_name = p_steps[i]
        and pe.created_at > fs.last_ts
        and (p_since is null or pe.created_at >= p_since)
      group by pe.session_id;

      truncate _funnel_sessions;
      insert into _funnel_sessions select * from _funnel_next;
      select count(*) into curr_count from _funnel_sessions;
    end if;

    step_stats := step_stats || jsonb_build_array(jsonb_build_object(
      'step', i,
      'eventName', p_steps[i],
      'sessions', curr_count,
      'completionPct', case when i = 1 then 100
        when prev_count > 0 then round(100.0 * curr_count / prev_count, 1) else 100 end,
      'dropoffPct', case when i = 1 then 0
        when prev_count > 0 then round(100.0 * (prev_count - curr_count) / prev_count, 1) else 0 end
    ));

    prev_count := curr_count;
  end loop;

  return json_build_object(
    'steps', to_json(p_steps),
    'stepStats', step_stats,
    'overallCompletionPct', case when first_count > 0
      then round(100.0 * curr_count / first_count, 1) else 0 end
  );
end;
$$;

-- Top journey paths (first N product events per session)
create or replace function public.admin_top_journey_paths(
  p_since timestamptz default null,
  p_limit int default 10
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with session_paths as (
    select
      session_id,
      string_agg(event_name, ' → ' order by created_at) as path
    from (
      select
        session_id,
        event_name,
        created_at,
        row_number() over (partition by session_id order by created_at) as rn
      from public.product_events
      where p_since is null or created_at >= p_since
    ) ranked
    where rn <= 6
    group by session_id
  ),
  path_counts as (
    select path, count(*)::bigint as session_count
    from session_paths
    group by path
    order by session_count desc
    limit greatest(p_limit, 1)
  )
  select coalesce(json_agg(row_to_json(path_counts)), '[]'::json)
  from path_counts;
$$;

revoke all on function public.admin_radar_engagement_stats(timestamptz) from public;
revoke all on function public.admin_product_funnel_stats(timestamptz, text[]) from public;
revoke all on function public.admin_top_journey_paths(timestamptz, int) from public;
