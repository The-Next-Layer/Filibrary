-- Filibrary migration 005 — allow type='tags' on filament_contributions
-- Run after 004.

alter table public.filament_contributions
  drop constraint if exists filament_contributions_type_check;

alter table public.filament_contributions
  add constraint filament_contributions_type_check
  check (type in ('vendor','video','stats','tags','note'));
