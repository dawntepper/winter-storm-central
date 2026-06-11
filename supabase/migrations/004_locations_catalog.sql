-- ============================================================
-- Location catalog: counties, cities, junctions, ZIP lookup
-- ============================================================
-- Reference migration matching the live Supabase tables used by
-- location seed scripts (scripts/db/seed-*.js). Safe to re-run.
-- ============================================================

create table if not exists public.counties (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  state_code  text not null,
  state_name  text,
  fips_code   text not null,
  lat         numeric(9,6),
  lon         numeric(9,6),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists counties_state_code_idx on public.counties (state_code);
create index if not exists counties_fips_code_idx on public.counties (fips_code);

create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  state_code  text not null,
  state_name  text,
  lat         numeric(9,6) not null,
  lon         numeric(9,6) not null,
  population  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cities_state_code_idx on public.cities (state_code);

create table if not exists public.city_counties (
  id          uuid primary key default gen_random_uuid(),
  city_id     uuid not null references public.cities(id) on delete cascade,
  county_id   uuid not null references public.counties(id) on delete cascade,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint city_counties_unique unique (city_id, county_id)
);

create index if not exists city_counties_city_id_idx on public.city_counties (city_id);
create index if not exists city_counties_county_id_idx on public.city_counties (county_id);

create table if not exists public.zip_locations (
  id          uuid primary key default gen_random_uuid(),
  zip_code    text not null,
  state_code  text not null,
  lat         numeric(9,6),
  lon         numeric(9,6),
  city_id     uuid references public.cities(id) on delete set null,
  county_id   uuid references public.counties(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint zip_locations_unique unique (zip_code, state_code)
);

create index if not exists zip_locations_zip_code_idx on public.zip_locations (zip_code);

drop trigger if exists trg_counties_updated_at on public.counties;
create trigger trg_counties_updated_at
  before update on public.counties
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cities_updated_at on public.cities;
create trigger trg_cities_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

alter table public.counties enable row level security;
alter table public.cities enable row level security;
alter table public.city_counties enable row level security;
alter table public.zip_locations enable row level security;

drop policy if exists "counties_select_public" on public.counties;
create policy "counties_select_public"
  on public.counties for select
  to anon, authenticated
  using (true);

drop policy if exists "cities_select_public" on public.cities;
create policy "cities_select_public"
  on public.cities for select
  to anon, authenticated
  using (true);

drop policy if exists "city_counties_select_public" on public.city_counties;
create policy "city_counties_select_public"
  on public.city_counties for select
  to anon, authenticated
  using (true);

drop policy if exists "zip_locations_select_public" on public.zip_locations;
create policy "zip_locations_select_public"
  on public.zip_locations for select
  to anon, authenticated
  using (true);
