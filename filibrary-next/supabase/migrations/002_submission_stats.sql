-- Filibrary migration 002 — add stats + stats_source to community_submissions
-- Run this in Supabase → SQL Editor once.

alter table public.community_submissions
  add column if not exists stats        jsonb,
  add column if not exists stats_source text;

-- Optional: index to speed up the admin "pending" query.
create index if not exists community_submissions_pending_idx
  on public.community_submissions (created_at desc)
  where status = 'pending';
