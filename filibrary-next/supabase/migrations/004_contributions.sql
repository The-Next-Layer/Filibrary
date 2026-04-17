-- Filibrary migration 004 — filament_contributions table
-- Run this in Supabase → SQL Editor after 003.
--
-- Captures *additions* to existing filaments (new vendor links, new video
-- references, suggested stats, or free-text notes) — distinct from
-- community_submissions, which is for brand-new filaments.

create table if not exists public.filament_contributions (
  id uuid primary key default gen_random_uuid(),
  filament_slug text not null,
  type text not null check (type in ('vendor','video','stats','note')),
  payload jsonb not null,
  contributor_fingerprint text,
  status text not null default 'pending' check (status in ('pending','applied','dismissed')),
  applied_notes text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists filament_contributions_pending_idx
  on public.filament_contributions (created_at desc)
  where status = 'pending';

alter table public.filament_contributions enable row level security;

drop policy if exists "allow anonymous contribution inserts" on public.filament_contributions;
create policy "allow anonymous contribution inserts"
  on public.filament_contributions
  for insert
  to anon, authenticated
  with check (true);

-- Admin reads use service_role (RLS bypass), so no SELECT policy needed.
