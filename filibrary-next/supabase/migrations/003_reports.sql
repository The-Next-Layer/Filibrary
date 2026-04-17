-- Filibrary migration 003 — filament_reports table
-- Run this in Supabase → SQL Editor after 002.

create table if not exists public.filament_reports (
  id uuid primary key default gen_random_uuid(),
  filament_slug text not null,
  reason text not null check (reason in (
    'inaccurate_info','broken_link','wrong_tag','outdated','other'
  )),
  comment text,
  reporter_fingerprint text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists filament_reports_open_idx
  on public.filament_reports (created_at desc)
  where status = 'open';

alter table public.filament_reports enable row level security;

drop policy if exists "allow anonymous report inserts" on public.filament_reports;
create policy "allow anonymous report inserts"
  on public.filament_reports
  for insert
  to anon, authenticated
  with check (true);

-- Admin reads go through the service_role key in the edge function,
-- so no public SELECT policy is needed. (Row Level Security is bypassed
-- by service_role.)
