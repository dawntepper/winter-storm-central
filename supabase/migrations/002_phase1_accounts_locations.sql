-- ============================================================
-- Phase 1: Accounts + Saved Locations (Supabase revival)
-- ============================================================
-- Fresh schema for the user-persistence foundation. SUPERSEDES the
-- abandoned supabase/schema.sql (subscriptions/Stripe/denormalized
-- user_locations) — do NOT run that file. Paid-tier tables are
-- intentionally deferred.
--
-- Creates: profiles, locations (canonical, deduped), user_locations,
-- alert_subscriptions. Plus a get_or_create_location() RPC (the only
-- writer of the locations catalog) and a handle_new_user() trigger that
-- auto-creates a profile on signup. RLS is enabled on every table.
--
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE and drops
-- policies before recreating them.
-- ============================================================

-- ----------------------------------------------------------------
-- Shared updated_at trigger function
-- ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- ----------------------------------------------------------------
-- profiles — extends auth.users (1:1), auto-created on signup
-- ----------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);
-- No client INSERT/DELETE: the handle_new_user() trigger owns inserts;
-- deletes cascade from auth.users.


-- ----------------------------------------------------------------
-- locations — canonical, deduped weather places (shared catalog)
-- ----------------------------------------------------------------
create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  state      text,                          -- 2-letter, nullable
  latitude   numeric(9,6) not null,         -- full precision for map centering
  longitude  numeric(9,6) not null,
  zip        text,                          -- nullable; future SMS / alert fanout
  -- dedup key: round to 2 decimals (~0.7 mi) so near-identical pins collapse
  geo_key    text generated always as (
               round(latitude::numeric, 2)::text || ',' || round(longitude::numeric, 2)::text
             ) stored,
  created_at timestamptz not null default now(),
  constraint locations_geo_key_unique unique (geo_key)
);

alter table public.locations enable row level security;

-- Read-only catalog for signed-in users. Writes happen only through
-- get_or_create_location() (SECURITY DEFINER), so there are no
-- INSERT/UPDATE/DELETE policies for the client.
drop policy if exists "locations_select_authenticated" on public.locations;
create policy "locations_select_authenticated"
  on public.locations for select
  to authenticated
  using (true);


-- ----------------------------------------------------------------
-- user_locations — a user's saved pins (join row)
-- ----------------------------------------------------------------
create table if not exists public.user_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  nickname    text,
  is_primary  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint user_locations_unique unique (user_id, location_id)
);

create index if not exists idx_user_locations_user on public.user_locations(user_id);

-- At most one primary location per user.
create unique index if not exists one_primary_per_user
  on public.user_locations(user_id) where is_primary;

alter table public.user_locations enable row level security;

drop policy if exists "user_locations_select_own" on public.user_locations;
create policy "user_locations_select_own"
  on public.user_locations for select
  using (auth.uid() = user_id);

drop policy if exists "user_locations_insert_own" on public.user_locations;
create policy "user_locations_insert_own"
  on public.user_locations for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_locations_update_own" on public.user_locations;
create policy "user_locations_update_own"
  on public.user_locations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_locations_delete_own" on public.user_locations;
create policy "user_locations_delete_own"
  on public.user_locations for delete
  using (auth.uid() = user_id);


-- ----------------------------------------------------------------
-- alert_subscriptions — per-user email alert prefs (v1 = email only)
-- ----------------------------------------------------------------
create table if not exists public.alert_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  location_id  uuid references public.locations(id) on delete cascade,  -- null = all saved
  channel      text not null default 'email' check (channel in ('email','sms')),
  categories   text[],            -- null = all hazard categories; else subset of CATEGORY_ORDER
  min_severity text,              -- nullable threshold, future use
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint alert_subscriptions_unique unique (user_id, location_id, channel)
);

create index if not exists idx_alert_subscriptions_user on public.alert_subscriptions(user_id);

drop trigger if exists trg_alert_subscriptions_updated_at on public.alert_subscriptions;
create trigger trg_alert_subscriptions_updated_at
  before update on public.alert_subscriptions
  for each row execute function public.set_updated_at();

alter table public.alert_subscriptions enable row level security;

drop policy if exists "alert_subscriptions_select_own" on public.alert_subscriptions;
create policy "alert_subscriptions_select_own"
  on public.alert_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "alert_subscriptions_insert_own" on public.alert_subscriptions;
create policy "alert_subscriptions_insert_own"
  on public.alert_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "alert_subscriptions_update_own" on public.alert_subscriptions;
create policy "alert_subscriptions_update_own"
  on public.alert_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "alert_subscriptions_delete_own" on public.alert_subscriptions;
create policy "alert_subscriptions_delete_own"
  on public.alert_subscriptions for delete
  using (auth.uid() = user_id);


-- ----------------------------------------------------------------
-- get_or_create_location() — sole writer of the locations catalog
-- ----------------------------------------------------------------
-- SECURITY DEFINER so authenticated users can resolve/insert a canonical
-- location without holding direct INSERT rights on the table. Dedup is by
-- geo_key (rounded lat/lon); an existing near-identical location returns
-- its id (and refreshes the display name).
create or replace function public.get_or_create_location(
  p_name text,
  p_state text,
  p_lat numeric,
  p_lon numeric,
  p_zip text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.locations (name, state, latitude, longitude, zip)
  values (p_name, p_state, p_lat, p_lon, p_zip)
  on conflict (geo_key) do update
    set name = excluded.name
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.get_or_create_location(text, text, numeric, numeric, text) from public;
grant execute on function public.get_or_create_location(text, text, numeric, numeric, text) to authenticated;


-- ----------------------------------------------------------------
-- handle_new_user() — auto-create a profile row on signup
-- ----------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
