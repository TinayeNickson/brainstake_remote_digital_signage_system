-- ============================================================================
-- MIGRATION: Package-Based Pricing System v2
-- Run in Supabase SQL editor after the base schema.
-- Safe to re-run (idempotent).
-- ============================================================================


-- ── 1. Extend enums ──────────────────────────────────────────────────────────

-- Add '60' to ad_duration
do $$ begin
  alter type public.ad_duration add value if not exists '60';
exception when others then null; end $$;

-- Add 'audio' to ad_format
do $$ begin
  alter type public.ad_format add value if not exists 'audio';
exception when others then null; end $$;


-- ── 2. Add price_60s to locations ────────────────────────────────────────────

alter table public.locations
  add column if not exists price_60s numeric(12,2) not null default 0
    check (price_60s >= 0);


-- ── 3. Drop old packages table and recreate with new shape ───────────────────
-- The old table had: location_id, duration, period_days, price (flat).
-- New shape: per-package slot config, no flat price, allows_Xs booleans.

drop table if exists public.packages cascade;

create table public.packages (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,                         -- Basic | Standard | Premium | Pro Premium
  description         text,
  base_slots_per_day  int  not null check (base_slots_per_day > 0),
  allows_15s          boolean not null default true,
  allows_30s          boolean not null default true,
  allows_60s          boolean not null default false,        -- ONLY Pro Premium
  active              boolean not null default true,
  sort_order          int  not null default 0,
  created_at          timestamptz not null default now()
);

-- RLS
alter table public.packages enable row level security;
drop policy if exists packages_public_read  on public.packages;
drop policy if exists packages_admin_write  on public.packages;
create policy packages_public_read on public.packages for select using (true);
create policy packages_admin_write on public.packages for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- Default packages seed
insert into public.packages (name, description, base_slots_per_day, allows_15s, allows_30s, allows_60s, sort_order)
values
  ('Basic',       'Entry-level exposure. 15s or 30s slots.',          2,  true,  true,  false, 1),
  ('Standard',    'More daily plays. 15s or 30s slots.',              4,  true,  true,  false, 2),
  ('Premium',     'High-frequency daily coverage. 15s or 30s.',       8,  true,  true,  false, 3),
  ('Pro Premium', 'Maximum impact — includes 60-second slots.',       12, true,  true,  true,  4)
on conflict do nothing;


-- ── 4. Add package_id to bookings ────────────────────────────────────────────

alter table public.bookings
  add column if not exists package_id uuid references public.packages(id) on delete set null;


-- ── 5. Update quote_price to handle 60s ─────────────────────────────────────

create or replace function public.quote_price(
  p_location_id   uuid,
  p_duration      ad_duration,
  p_slots_per_day int,
  p_start         date,
  p_end           date,
  p_dow           int[]
) returns table (
  price_per_slot    numeric,
  scheduled_days    int,
  total_price       numeric,
  max_slots_per_day int
)
language plpgsql
as $$
declare
  v_price numeric;
  v_max   int;
  v_days  int;
begin
  select
    case
      when p_duration = '15' then price_15s
      when p_duration = '30' then price_30s
      else price_60s
    end,
    max_slots_per_day
  into v_price, v_max
  from public.locations
  where id = p_location_id and active = true;

  if v_price is null then
    raise exception 'Location not found or inactive';
  end if;
  if p_slots_per_day <= 0 or p_slots_per_day > v_max then
    raise exception 'slots_per_day must be between 1 and %', v_max;
  end if;

  v_days := public.count_scheduled_days(p_start, p_end, p_dow);
  if v_days <= 0 then
    raise exception 'No valid scheduled days in the selected range';
  end if;

  return query
    select v_price,
           v_days,
           (v_price * p_slots_per_day * v_days)::numeric(12,2),
           v_max;
end;
$$;


-- ── 6. Update create_booking_atomic to handle 60s + package_id ───────────────

create or replace function public.create_booking_atomic(
  p_ad_id          uuid,
  p_location_id    uuid,
  p_duration       ad_duration,
  p_slots_per_day  int,
  p_start          date,
  p_end            date,
  p_dow            int[],
  p_package_id     uuid default null
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer   uuid := auth.uid();
  v_price      numeric;
  v_max_slots  int;
  v_days       int;
  v_booking    public.bookings;
  v_date       date;
  v_existing   int;
begin
  if v_customer is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.ads
    where id = p_ad_id and customer_id = v_customer
  ) then
    raise exception 'Ad not found or not owned by caller';
  end if;

  select
    case
      when p_duration = '15' then price_15s
      when p_duration = '30' then price_30s
      else price_60s
    end,
    max_slots_per_day
  into v_price, v_max_slots
  from public.locations
  where id = p_location_id and active = true
  for update;

  if v_price is null then
    raise exception 'Location not available';
  end if;

  if p_slots_per_day <= 0 or p_slots_per_day > v_max_slots then
    raise exception 'slots_per_day must be between 1 and %', v_max_slots;
  end if;

  if p_end < p_start then
    raise exception 'end_date must be on or after start_date';
  end if;

  v_days := public.count_scheduled_days(p_start, p_end, p_dow);
  if v_days <= 0 then
    raise exception 'No valid scheduled days in the selected range';
  end if;

  for v_date in
    select d::date
    from generate_series(p_start, p_end, interval '1 day') d
    where extract(dow from d)::int = any(p_dow)
  loop
    select coalesce(sum(bd.slots), 0)
    into v_existing
    from public.booking_dates bd
    join public.bookings b on b.id = bd.booking_id
    where bd.location_id = p_location_id
      and bd.play_date   = v_date
      and b.status in ('awaiting_payment','payment_submitted','active');

    if v_existing + p_slots_per_day > v_max_slots then
      raise exception 'No availability on %: % of % slots already taken',
        v_date, v_existing, v_max_slots;
    end if;
  end loop;

  insert into public.bookings (
    customer_id, ad_id, location_id, duration, slots_per_day,
    start_date, end_date, days_of_week, scheduled_days_count,
    price_per_slot, total_price, status, package_id
  )
  values (
    v_customer, p_ad_id, p_location_id, p_duration, p_slots_per_day,
    p_start, p_end, p_dow, v_days,
    v_price, (v_price * p_slots_per_day * v_days)::numeric(12,2),
    'awaiting_payment', p_package_id
  )
  returning * into v_booking;

  insert into public.booking_dates (booking_id, location_id, play_date, slots)
  select v_booking.id, p_location_id, d::date, p_slots_per_day
  from generate_series(p_start, p_end, interval '1 day') d
  where extract(dow from d)::int = any(p_dow);

  return v_booking;
end;
$$;

-- Re-grant with the new signature (extra optional arg)
grant execute on function public.create_booking_atomic(uuid, uuid, ad_duration, int, date, date, int[], uuid)
  to authenticated;

grant execute on function public.quote_price(uuid, ad_duration, int, date, date, int[])
  to authenticated;

-- Also grant packages read to anon (used in public package listing)
grant select on public.packages to authenticated, anon;
grant select on public.locations to authenticated, anon;
