-- 002: lock down billing fields + one-trial-per-device.
-- Run once in the Supabase SQL editor (after 001_devices.sql).

-- 1) Users must never be able to write their own subscription state through
--    the public anon key. Only the Worker (service key, bypasses RLS) writes.
alter table public.profiles enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.profiles from anon, authenticated;
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

-- 5) Enforce the per-account device limit atomically (closes the race where
--    two devices register at the same instant). Keep in sync with DEVICE_LIMIT
--    in wrangler.toml.
create or replace function public.enforce_device_limit() returns trigger
language plpgsql as $$
declare
  max_devices constant int := 1;
  n int;
begin
  perform 1 from public.profiles where id = new.account_id for update;
  select count(*) into n from public.devices where account_id = new.account_id;
  if n >= max_devices then
    raise exception 'device_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists devices_limit_trg on public.devices;
create trigger devices_limit_trg before insert on public.devices
  for each row execute function public.enforce_device_limit();

notify pgrst, 'reload schema';
