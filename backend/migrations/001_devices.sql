-- Device binding for per-seat licensing.
-- Each row is one activated install (one Chrome profile). A license (account)
-- may hold up to DEVICE_LIMIT rows; the (DEVICE_LIMIT + 1)th activation is blocked.
--
-- Run this once against your Supabase project (SQL editor or `psql`).

create table if not exists public.devices (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.profiles(id) on delete cascade,
  device_id   text not null,
  label       text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  unique (account_id, device_id)
);

create index if not exists devices_account_id_idx on public.devices (account_id);

-- Throttles device swaps so a single seat can't be ping-ponged between people.
-- Updated whenever a device is removed via the self-service endpoint.
alter table public.profiles
  add column if not exists last_device_change_at timestamptz;

-- The Worker talks to PostgREST with the service key, which bypasses RLS.
-- Enable RLS anyway so the table is never exposed through the anon key.
alter table public.devices enable row level security;
