-- ============================================================
-- City demand tracking + user-generated city auto-creation
-- ============================================================
-- Apply after 014_county_alert_views_and_user_ids.sql
--
-- Promotion threshold (static page candidacy): see CITY_PROMOTION_THRESHOLD
-- in src/services/locationCatalogService.js (default 25 combined searches+saves).

-- Extend cities with catalog vs user-generated provenance
alter table public.cities
  add column if not exists source text not null default 'catalog'
    check (source in ('catalog', 'user_generated'));

update public.cities
set source = 'catalog'
where source is null or source = '';

create index if not exists cities_source_idx on public.cities (source);

-- Demand signals from searches, saves, and alert signups
create table if not exists public.city_demand (
  id                  uuid primary key default gen_random_uuid(),
  city_name           text not null,
  state_code          text not null,
  source              text not null default 'search',
  search_count        integer not null default 0,
  save_count          integer not null default 0,
  first_requested_at  timestamptz not null default now(),
  last_requested_at   timestamptz not null default now(),
  constraint city_demand_unique unique (city_name, state_code)
);

create index if not exists city_demand_last_requested_idx
  on public.city_demand (last_requested_at desc);

create index if not exists city_demand_total_idx
  on public.city_demand ((search_count + save_count) desc);

-- Upsert demand row (anon/authenticated via RPC — no direct table SELECT for anon)
create or replace function public.record_city_demand(
  p_city_name text,
  p_state_code text,
  p_event_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_city_name);
  v_state text := upper(trim(p_state_code));
  v_source text := lower(trim(coalesce(p_event_source, 'search')));
begin
  if v_name = '' or v_state !~ '^[A-Z]{2}$' then
    return;
  end if;

  if v_source not in ('search', 'save', 'alert_request') then
    v_source := 'search';
  end if;

  insert into public.city_demand (city_name, state_code, source, search_count, save_count)
  values (
    v_name,
    v_state,
    v_source,
    case when v_source in ('search', 'alert_request') then 1 else 0 end,
    case when v_source = 'save' then 1 else 0 end
  )
  on conflict (city_name, state_code) do update set
    source = excluded.source,
    search_count = city_demand.search_count
      + case when v_source in ('search', 'alert_request') then 1 else 0 end,
    save_count = city_demand.save_count
      + case when v_source = 'save' then 1 else 0 end,
    last_requested_at = now();
end;
$$;

-- Insert user-generated city when geocode resolves but catalog lacks the row
create or replace function public.ensure_user_generated_city(
  p_name text,
  p_state_code text,
  p_lat numeric,
  p_lon numeric,
  p_state_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_name);
  v_state text := upper(trim(p_state_code));
  v_slug text;
  v_existing uuid;
begin
  if v_name = '' or v_state !~ '^[A-Z]{2}$' then
    return null;
  end if;
  if p_lat is null or p_lon is null then
    return null;
  end if;

  v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || lower(v_state);
  v_slug := trim(both '-' from v_slug);

  select id into v_existing from public.cities where slug = v_slug;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.cities (
    slug, name, state_code, state_name, lat, lon, source, has_static_page
  )
  values (
    v_slug, v_name, v_state, p_state_name, p_lat, p_lon, 'user_generated', false
  )
  on conflict (slug) do update set updated_at = now()
  returning id into v_existing;

  return v_existing;
end;
$$;

-- Admin read: top demand cities with catalog status (service role only)
create or replace function public.admin_city_demand_stats(p_since timestamptz default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_rows', (
      select count(*)::bigint
      from public.city_demand cd
      where p_since is null or cd.last_requested_at >= p_since
    ),
    'topDemand', coalesce((
      select json_agg(row_to_json(t) order by t.total_demand desc)
      from (
        select
          cd.city_name,
          cd.state_code,
          cd.search_count,
          cd.save_count,
          (cd.search_count + cd.save_count) as total_demand,
          cd.source as last_source,
          cd.last_requested_at,
          c.id as city_id,
          c.slug,
          coalesce(c.source, 'missing') as city_source,
          coalesce(c.has_static_page, false) as has_static_page,
          (c.id is not null) as in_catalog
        from public.city_demand cd
        left join public.cities c
          on lower(c.name) = lower(cd.city_name)
         and c.state_code = cd.state_code
        where p_since is null or cd.last_requested_at >= p_since
        order by (cd.search_count + cd.save_count) desc, cd.last_requested_at desc
        limit 25
      ) t
    ), '[]'::json)
  );
$$;

grant execute on function public.record_city_demand(text, text, text) to anon, authenticated;
grant execute on function public.ensure_user_generated_city(text, text, numeric, numeric, text) to anon, authenticated;
grant execute on function public.admin_city_demand_stats(timestamptz) to service_role;

alter table public.city_demand enable row level security;

drop policy if exists "city_demand_insert_public" on public.city_demand;
create policy "city_demand_insert_public"
  on public.city_demand for insert
  to anon, authenticated
  with check (true);

drop policy if exists "city_demand_update_public" on public.city_demand;
create policy "city_demand_update_public"
  on public.city_demand for update
  to anon, authenticated
  using (true)
  with check (true);
