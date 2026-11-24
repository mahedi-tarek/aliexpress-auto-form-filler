-- 002: lock down billing fields + one-trial-per-device.
-- Run once in the Supabase SQL editor (after 001_devices.sql).

-- 1) Users must never be able to write their own subscription state through
--    the public anon key. Only the Worker (service key, bypasses RLS) writes.
alter table public.profiles enable row level security;
revoke insert, update, delete on public.profiles from anon, authenticated;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'profiles' and cmd in ('INSERT','UPDATE','DELETE','ALL')
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end $$;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

-- 2) Devices table must not be reachable with the anon key either.
revoke all on public.devices from anon, authenticated;

-- 3) One free trial per install.
create table if not exists public.trial_devices (
  device_id   text primary key,
  account_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.trial_devices enable row level security;
revoke all on public.trial_devices from anon, authenticated;

-- 4) Needed columns (no-ops if they already exist).
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists subscription_id text;
alter table public.profiles add column if not exists grace_period_end timestamptz;
create index if not exists profiles_stripe_customer_idx on public.profiles (stripe_customer_id);

notify pgrst, 'reload schema';
