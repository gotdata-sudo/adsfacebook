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
  brand text,
  rows jsonb not null default '[]'::jsonb,
  asset_paths text[] not null default '{}'
);

-- Existing installs: add the column that didn't exist before brand tracking.
alter table public.uploads add column if not exists brand text;

create index if not exists uploads_created_at_idx on public.uploads (created_at desc);

-- Generic key/value store for admin-editable app settings:
--   key = 'admins' -> {"emails": ["a@bananaandco.org", ...]}
--   key = 'rules'  -> the Rules object from src/lib/rules.ts
--   key = 'brands' -> {"names": ["Brand A", "Brand B", ...]}
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- One row per person who has ever signed in — populated by the
-- touch_profile() RPC below (called once per app load), never written to
-- directly by the client. Lets an admin see every user and block one
-- without needing a service-role key or the Supabase Admin API.
create table if not exists public.profiles (
  email text primary key,
  name text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  blocked boolean not null default false
);

-- ────────────────────────────────────────────────────────────────
-- 2. Seed the first admin — EDIT THIS EMAIL if needed, then run once.
--    Without this row nobody can see the "ผู้ดูแลระบบ" tab or edit rules.
-- ────────────────────────────────────────────────────────────────

insert into public.app_settings (key, value)
values ('admins', '{"emails": ["got.data@bananaandco.org"]}'::jsonb)
on conflict (key) do nothing;

insert into public.app_settings (key, value)
values ('brands', '{"names": []}'::jsonb)
on conflict (key) do nothing;

insert into public.app_settings (key, value)
values ('rules', '{
  "cpmTiers": [{"id": "tier-1", "minAgeDays": 0, "maxAgeDays": 1, "min": 300, "max": 600}],
  "ctrMin": 0.8, "ctrMax": 1.25,
  "cpcSkipRounds": 3, "signupCaptureRate": 0.8, "targetCostPerResult": null,
  "freqMin": 1.08, "freqMax": 9,
  "resultRateWarnAgeDays": 3, "resultRateWarnPct": 30,
  "engagementMin": null, "engagementMax": null,
  "weights": {
    "cpm": {"fail": 30, "warn": 12}, "ctr": {"fail": 30, "warn": 12},
    "freq": {"fail": 30, "warn": 12}, "cpc": {"fail": 30, "warn": 12},
    "rate": {"fail": 30, "warn": 12}, "eng": {"fail": 30, "warn": 12}
  },
  "resultTypeOverrides": {}
}'::jsonb)
on conflict (key) do nothing;

-- ────────────────────────────────────────────────────────────────
-- 3. Row Level Security
--    Every reader/writer must be signed in AND have an @bananaandco.org
--    email (checked from the JWT the Google sign-in produces). Change
--    the domain here if it's ever different from the app's middleware.
-- ────────────────────────────────────────────────────────────────

-- security definer so the blocked-status lookup below always reads the
-- real profiles row regardless of that table's own RLS policies.
create or replace function public.is_org_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'email') ilike '%@bananaandco.org'
    and not exists (
      select 1 from public.profiles p
      where lower(p.email) = lower(auth.jwt() ->> 'email') and p.blocked
    ),
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

alter table public.profiles enable row level security;

-- No direct insert policy: rows are only ever created via touch_profile()
-- below, which runs as security definer so it bypasses RLS on write.
drop policy if exists "self can read own profile" on public.profiles;
create policy "self can read own profile"
  on public.profiles for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "admins can read all profiles" on public.profiles;
create policy "admins can read all profiles"
  on public.profiles for select
  using (public.is_org_member() and public.is_admin());

drop policy if exists "admins can update profiles" on public.profiles;
create policy "admins can update profiles"
  on public.profiles for update
  using (public.is_org_member() and public.is_admin())
  with check (public.is_org_member() and public.is_admin());

-- Called once per app load (see src/app/page.tsx) to record/refresh the
-- caller's own profile row. Security definer so it can insert/update that
-- row even though regular users have no direct insert/update policy on
-- this table — it only ever touches name/last_seen, never `blocked`, so a
-- blocked user calling this cannot un-block themselves.
create or replace function public.touch_profile(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if v_email is null or v_email not ilike '%@bananaandco.org' then
    raise exception 'not authorized';
  end if;
  insert into public.profiles (email, name, first_seen, last_seen, blocked)
  values (v_email, coalesce(p_name, ''), now(), now(), false)
  on conflict (email) do update
    set name = excluded.name,
        last_seen = now();
end;
$$;

grant execute on function public.touch_profile(text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4. Realtime — lets everyone's screen update live when a teammate
--    saves a batch or an admin changes the rules.
-- ────────────────────────────────────────────────────────────────

-- Idempotent: ALTER PUBLICATION ... ADD TABLE errors if already a member,
-- which it will be on every re-run of this script after the first.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'uploads') then
    alter publication supabase_realtime add table public.uploads;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings') then
    alter publication supabase_realtime add table public.app_settings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
