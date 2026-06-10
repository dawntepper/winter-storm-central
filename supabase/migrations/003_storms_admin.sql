-- ============================================================
-- Storm admin: DB-backed storm events + emergency info
-- ============================================================
-- Public read: live storms only (anon). Admin writes via service
-- role (Netlify storm-admin-api) or authenticated storm_admins email.
-- JSON files in src/content/storms/ remain the SEO prerender source
-- until a storm is published from admin (build hook regenerates pages).
-- ============================================================

-- ----------------------------------------------------------------
-- storm_admins — email allowlist for authenticated admin reads/writes
-- ----------------------------------------------------------------
create table if not exists public.storm_admins (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.storm_admins enable row level security;

drop policy if exists "storm_admins_select_self" on public.storm_admins;
create policy "storm_admins_select_self"
  on public.storm_admins for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ----------------------------------------------------------------
-- storms — core storm record (extended fields in content jsonb)
-- ----------------------------------------------------------------
create table if not exists public.storms (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  storm_type      text not null,
  status          text not null default 'draft'
                    check (status in ('draft', 'preview', 'live', 'archived')),
  summary         text not null default '',
  location_label  text,
  start_date      date not null,
  end_date        date not null,
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  preview_token   text not null unique default encode(gen_random_bytes(16), 'hex'),
  -- impacts, map_center, affected_states, public_status, seo extras, etc.
  content         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists storms_status_idx on public.storms (status);
create index if not exists storms_slug_idx on public.storms (slug);

drop trigger if exists storms_set_updated_at on public.storms;
create trigger storms_set_updated_at
  before update on public.storms
  for each row execute function public.set_updated_at();

alter table public.storms enable row level security;

-- Public: live storms only
drop policy if exists "storms_select_live" on public.storms;
create policy "storms_select_live"
  on public.storms for select
  to anon, authenticated
  using (status = 'live');

-- Admins: all storms when signed in with allowlisted email
drop policy if exists "storms_select_admin" on public.storms;
create policy "storms_select_admin"
  on public.storms for select
  to authenticated
  using (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "storms_write_admin" on public.storms;
create policy "storms_write_admin"
  on public.storms for all
  to authenticated
  using (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ----------------------------------------------------------------
-- storm_emergency_summary — one summary block per storm
-- ----------------------------------------------------------------
create table if not exists public.storm_emergency_summary (
  id         uuid primary key default gen_random_uuid(),
  storm_id   uuid not null unique references public.storms(id) on delete cascade,
  title      text not null default 'Emergency Status',
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists storm_emergency_summary_set_updated_at on public.storm_emergency_summary;
create trigger storm_emergency_summary_set_updated_at
  before update on public.storm_emergency_summary
  for each row execute function public.set_updated_at();

alter table public.storm_emergency_summary enable row level security;

drop policy if exists "storm_emergency_summary_select_live" on public.storm_emergency_summary;
create policy "storm_emergency_summary_select_live"
  on public.storm_emergency_summary for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.storms s
      where s.id = storm_id and s.status = 'live'
    )
  );

drop policy if exists "storm_emergency_summary_select_admin" on public.storm_emergency_summary;
create policy "storm_emergency_summary_select_admin"
  on public.storm_emergency_summary for select
  to authenticated
  using (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "storm_emergency_summary_write_admin" on public.storm_emergency_summary;
create policy "storm_emergency_summary_write_admin"
  on public.storm_emergency_summary for all
  to authenticated
  using (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ----------------------------------------------------------------
-- storm_emergency_info — curated emergency entries per storm
-- ----------------------------------------------------------------
create table if not exists public.storm_emergency_info (
  id           uuid primary key default gen_random_uuid(),
  storm_id     uuid not null references public.storms(id) on delete cascade,
  title        text not null default '',
  category     text not null default 'Other',
  location     text,
  description  text,
  source_name  text,
  source_url   text,
  social_url   text,
  is_official  boolean not null default false,
  status       text not null default 'active'
                 check (status in ('active', 'resolved', 'archived')),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz
);

create index if not exists storm_emergency_info_storm_id_idx
  on public.storm_emergency_info (storm_id, sort_order);

drop trigger if exists storm_emergency_info_set_updated_at on public.storm_emergency_info;
create trigger storm_emergency_info_set_updated_at
  before update on public.storm_emergency_info
  for each row execute function public.set_updated_at();

alter table public.storm_emergency_info enable row level security;

drop policy if exists "storm_emergency_info_select_live" on public.storm_emergency_info;
create policy "storm_emergency_info_select_live"
  on public.storm_emergency_info for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.storms s
      where s.id = storm_id and s.status = 'live'
    )
  );

drop policy if exists "storm_emergency_info_select_admin" on public.storm_emergency_info;
create policy "storm_emergency_info_select_admin"
  on public.storm_emergency_info for select
  to authenticated
  using (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "storm_emergency_info_write_admin" on public.storm_emergency_info;
create policy "storm_emergency_info_write_admin"
  on public.storm_emergency_info for all
  to authenticated
  using (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1 from public.storm_admins sa
      where lower(sa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ----------------------------------------------------------------
-- Helper: preview access by token (used by client after RPC call)
-- ----------------------------------------------------------------
create or replace function public.get_storm_preview_by_token(p_slug text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_slug is null or p_token is null or length(trim(p_token)) = 0 then
    return null;
  end if;

  select jsonb_build_object(
    'storm', to_jsonb(s.*),
    'emergency_summary', (
      select to_jsonb(es.*) from storm_emergency_summary es where es.storm_id = s.id
    ),
    'emergency_info', coalesce(
      (
        select jsonb_agg(to_jsonb(ei.*) order by ei.sort_order, ei.created_at)
        from storm_emergency_info ei
        where ei.storm_id = s.id
      ),
      '[]'::jsonb
    )
  )
  into result
  from storms s
  where s.slug = p_slug
    and s.preview_token = p_token
    and s.status in ('draft', 'preview');

  return result;
end;
$$;

revoke all on function public.get_storm_preview_by_token(text, text) from public;
grant execute on function public.get_storm_preview_by_token(text, text) to anon, authenticated;
