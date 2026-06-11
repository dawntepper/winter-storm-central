-- ============================================================
-- City catalog flags: static SEO pages vs major state-page picks
-- ============================================================

alter table public.cities
  add column if not exists has_static_page boolean not null default false,
  add column if not exists is_major boolean not null default false;

create index if not exists cities_is_major_state_idx
  on public.cities (state_code, is_major)
  where is_major = true;

create index if not exists cities_has_static_page_idx
  on public.cities (has_static_page)
  where has_static_page = true;
