-- เส้นทางโฆษณา (Ad Route) — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)
-- after creating the project and BEFORE first sign-in.

-- ────────────────────────────────────────────────────────────────
-- 1. Tables
-- ────────────────────────────────────────────────────────────────

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  uploader_email text not null,
  uploader_name text not null,
  created_at timestamptz not null default now(),
  note text,
  rows jsonb not null default '[]'::jsonb,
  asset_paths text[] not null default '{}'
);

create index if not exists uploads_created_at_idx on public.uploads (created_at desc);

-- Generic key/value store for admin-editable app settings:
--   key = 'admins' -> {"emails": ["a@bananaandco.org", ...]}
--   key = 'rules'  -> the Rules object from src/lib/rules.ts
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────
-- 2. Seed the first admin — EDIT THIS EMAIL if needed, then run once.
--    Without this row nobody can see the "ผู้ดูแลระบบ" tab or edit rules.
-- ────────────────────────────────────────────────────────────────

insert into public.app_settings (key, value)
values ('admins', '{"emails": ["got.data@bananaandco.org"]}'::jsonb)
on conflict (key) do nothing;

insert into public.app_settings (key, value)
values ('rules', '{
  "cpmMin": 300, "cpmMax": 600, "cpmDayCutoff": 1,
  "ctrMin": 0.8, "ctrMax": 1.25,
  "cpcSkipRounds": 3, "signupCaptureRate": 0.8, "targetCostPerResult": null,
  "freqMin": 1.08, "freqMax": 9,
  "resultRateWarnAgeDays": 3, "resultRateWarnPct": 30
}'::jsonb)
on conflict (key) do nothing;

-- ────────────────────────────────────────────────────────────────
-- 3. Row Level Security
--    Every reader/writer must be signed in AND have an @bananaandco.org
--    email (checked from the JWT the Google sign-in produces). Change
--    the domain here if it's ever different from the app's middleware.
-- ────────────────────────────────────────────────────────────────

create or replace function public.is_org_member()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'email') ilike '%@bananaandco.org',
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_settings, jsonb_array_elements_text(value -> 'emails') as admin_email
    where key = 'admins'
      and lower(admin_email) = lower(auth.jwt() ->> 'email')
  );
$$;

alter table public.uploads enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "org members can read uploads" on public.uploads;
create policy "org members can read uploads"
  on public.uploads for select
  using (public.is_org_member());

drop policy if exists "org members can insert uploads" on public.uploads;
create policy "org members can insert uploads"
  on public.uploads for insert
  with check (public.is_org_member());

drop policy if exists "admins can delete uploads" on public.uploads;
create policy "admins can delete uploads"
  on public.uploads for delete
  using (public.is_org_member() and public.is_admin());

drop policy if exists "org members can read settings" on public.app_settings;
create policy "org members can read settings"
  on public.app_settings for select
  using (public.is_org_member());

drop policy if exists "admins can upsert settings" on public.app_settings;
create policy "admins can upsert settings"
  on public.app_settings for insert
  with check (public.is_org_member() and public.is_admin());

drop policy if exists "admins can update settings" on public.app_settings;
create policy "admins can update settings"
  on public.app_settings for update
  using (public.is_org_member() and public.is_admin());

-- ────────────────────────────────────────────────────────────────
-- 4. Realtime — lets everyone's screen update live when a teammate
--    saves a batch or an admin changes the rules.
-- ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.uploads;
alter publication supabase_realtime add table public.app_settings;
