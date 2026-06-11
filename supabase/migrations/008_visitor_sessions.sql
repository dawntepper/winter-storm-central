-- ============================================================
-- Visitor sessions (new vs returning visitors)
-- ============================================================

create table if not exists public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  landing_page text,
  referrer text,
  source text,
  device_type text,
  is_returning boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists visitor_sessions_visitor_idx
  on public.visitor_sessions (visitor_id);

create index if not exists visitor_sessions_session_idx
  on public.visitor_sessions (session_id);

create index if not exists visitor_sessions_created_idx
  on public.visitor_sessions (created_at desc);

alter table public.visitor_sessions enable row level security;

drop policy if exists "Public can insert visitor sessions" on public.visitor_sessions;
create policy "Public can insert visitor sessions"
  on public.visitor_sessions for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update visitor session last seen" on public.visitor_sessions;
create policy "Public can update visitor session last seen"
  on public.visitor_sessions for update
  to anon, authenticated
  using (true)
  with check (true);

-- Boolean returning check without exposing session rows to anon SELECT.
create or replace function public.is_returning_visitor(p_visitor_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.visitor_sessions
    where visitor_id = p_visitor_id
    limit 1
  );
$$;

revoke all on function public.is_returning_visitor(text) from public;
grant execute on function public.is_returning_visitor(text) to anon, authenticated;
