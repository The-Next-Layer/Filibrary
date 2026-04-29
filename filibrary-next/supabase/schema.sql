create extension if not exists pgcrypto;

create table if not exists public.filaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  short_name text not null,
  full_name text not null,
  summary text not null,
  hero_image_url text,
  hero_image_credit_label text,
  hero_image_credit_url text,
  stats_source text,
  stats jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.filament_tags (
  filament_id uuid not null references public.filaments(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (filament_id, tag_id)
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  homepage_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  filament_id uuid not null references public.filaments(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.video_references (
  id uuid primary key default gen_random_uuid(),
  filament_id uuid not null references public.filaments(id) on delete cascade,
  title text not null,
  url text not null,
  thumbnail_url text,
  creator_name text,
  timestamp_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  filament_id uuid not null references public.filaments(id) on delete cascade,
  image_url text not null,
  credit_label text,
  credit_url text,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- These tables are written exclusively by the admin Edge Function via the
-- service role (which bypasses RLS) and read at build time by lib/seed.ts.
-- RLS is enabled with no policies so anon and authenticated roles cannot
-- access them through PostgREST.
alter table public.filaments enable row level security;
alter table public.tags enable row level security;
alter table public.filament_tags enable row level security;
alter table public.brands enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.video_references enable row level security;
alter table public.gallery_images enable row level security;

create table if not exists public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  short_name text not null,
  full_name text,
  summary text not null,
  source_links jsonb,
  tags jsonb,
  purchase_link text,
  stats jsonb,
  stats_source text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_notes text,
  created_at timestamptz not null default now()
);

alter table public.community_submissions enable row level security;

drop policy if exists "allow anonymous inserts for community submissions" on public.community_submissions;
create policy "allow anonymous inserts for community submissions"
on public.community_submissions
for insert
to anon, authenticated
with check (true);

drop policy if exists "allow admin read community submissions" on public.community_submissions;
create policy "allow admin read community submissions"
on public.community_submissions
for select
to authenticated
using (true);

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

alter table public.filament_reports enable row level security;

drop policy if exists "allow anonymous report inserts" on public.filament_reports;
create policy "allow anonymous report inserts"
  on public.filament_reports
  for insert
  to anon, authenticated
  with check (true);

create table if not exists public.filament_contributions (
  id uuid primary key default gen_random_uuid(),
  filament_slug text not null,
  type text not null check (type in ('vendor','video','stats','tags','note')),
  payload jsonb not null,
  contributor_fingerprint text,
  status text not null default 'pending' check (status in ('pending','applied','dismissed')),
  applied_notes text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

alter table public.filament_contributions enable row level security;

drop policy if exists "allow anonymous contribution inserts" on public.filament_contributions;
create policy "allow anonymous contribution inserts"
  on public.filament_contributions
  for insert
  to anon, authenticated
  with check (true);
