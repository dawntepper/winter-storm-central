-- ============================================================
-- Location search + county alert view analytics tables
-- ============================================================

create table if not exists public.location_search_events (
  id           uuid primary key default gen_random_uuid(),
  query        text not null,
  match_type   text,
  state_code   text,
  city_id      uuid references public.cities(id) on delete set null,
  county_id    uuid references public.counties(id) on delete set null,
  zip_code     text,
  page_context text,
  created_at   timestamptz not null default now()
);

create index if not exists location_search_events_created_at_idx
  on public.location_search_events (created_at desc);

create table if not exists public.county_alert_views (
  id           uuid primary key default gen_random_uuid(),
  county_id    uuid not null references public.counties(id) on delete cascade,
  state_code   text,
  alert_count  integer,
  source       text,
  created_at   timestamptz not null default now()
);

create index if not exists county_alert_views_county_id_idx
  on public.county_alert_views (county_id);

alter table public.location_search_events enable row level security;
alter table public.county_alert_views enable row level security;

drop policy if exists "location_search_events_insert_public" on public.location_search_events;
create policy "location_search_events_insert_public"
  on public.location_search_events for insert
  to anon, authenticated
  with check (true);

drop policy if exists "county_alert_views_insert_public" on public.county_alert_views;
create policy "county_alert_views_insert_public"
  on public.county_alert_views for insert
  to anon, authenticated
  with check (true);
