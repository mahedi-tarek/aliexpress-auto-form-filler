-- 003: per-account seat plans + network-level trial throttle.

alter table public.profiles add column if not exists plan text;
alter table public.profiles add column if not exists device_limit int not null default 1;

alter table public.trial_devices add column if not exists ip_hash text;
create index if not exists trial_devices_ip_idx on public.trial_devices (ip_hash, created_at);

-- Device limit is now per account (set by the Stripe webhook from the plan).
-- Trials and unpaid accounts are capped at 1.
create or replace function public.enforce_device_limit() returns trigger
language plpgsql as $$
declare
  max_devices int;
  n int;
begin
  select case when subscription_status in ('active','past_due') then greatest(coalesce(device_limit,1),1) else 1 end
    into max_devices
    from public.profiles where id = new.account_id for update;
  select count(*) into n from public.devices where account_id = new.account_id;
  if n >= coalesce(max_devices,1) then
    raise exception 'device_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
