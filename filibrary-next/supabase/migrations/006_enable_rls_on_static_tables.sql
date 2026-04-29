-- Enable Row Level Security on static-content tables.
--
-- These tables are written exclusively by the admin Edge Function (service role,
-- which bypasses RLS) and are not read at runtime by the browser - public pages
-- consume the data from lib/seed.ts at build time. With RLS enabled and no
-- policies, anon and authenticated roles cannot read or write these tables.

alter table public.filaments enable row level security;
alter table public.tags enable row level security;
alter table public.filament_tags enable row level security;
alter table public.brands enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.video_references enable row level security;
alter table public.gallery_images enable row level security;
