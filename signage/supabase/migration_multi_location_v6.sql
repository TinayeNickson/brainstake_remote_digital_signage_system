-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v6 — Multi-location campaigns
--
-- A customer can select MORE THAN ONE location in a single booking wizard run.
-- Each location gets its own independent booking row (own price, own status,
-- own device assignment), all grouped under one `campaigns` record.
--
-- Payment is submitted once for the campaign total (sum of all booking
-- total_prices), and approving/rejecting the campaign payment activates or
-- rejects ALL its bookings atomically.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. CAMPAIGNS table ───────────────────────────────────────────────────────
-- One row per wizard submission.  Holds the shared ad, schedule, and package.
-- The per-location pricing lives on the individual bookings.

create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.profiles(id) on delete restrict,
  ad_id        uuid not null references public.ads(id)      on delete restrict,
  package_id   uuid references public.packages(id)          on delete set null,
  title        text not null,              -- copied from ads.title for display
  duration     ad_duration not null,
  slots_per_day int not null check (slots_per_day > 0),
  start_date   date not null,
  end_date     date not null,
  days_of_week int[] not null,
  scheduled_days_count int not null,
  total_price  numeric(12,2) not null generated always as (0) stored, -- recomputed below
  created_at   timestamptz not null default now()
);

-- total_price can't be GENERATED from child rows in Postgres without a trigger.
-- Use a plain column instead and update it after child bookings are inserted.
-- Drop and recreate without GENERATED:
alter table public.campaigns drop column if exists total_price;
alter table public.campaigns add column total_price numeric(12,2) not null default 0;

-- RLS
alter table public.campaigns enable row level security;

drop policy if exists campaigns_owner_select on public.campaigns;
drop policy if exists campaigns_admin_select  on public.campaigns;

create policy campaigns_owner_select on public.campaigns for select
  using (customer_id = auth.uid() or public.current_role_v() in ('admin','accountant'));

-- Inserts go through the security-definer RPC, no insert policy needed for customers.
create policy campaigns_admin_all on public.campaigns for all
  using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');


-- ── 2. Add campaign_id to bookings ───────────────────────────────────────────
alter table public.bookings
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

create index if not exists bookings_campaign_idx on public.bookings (campaign_id);


-- ── 3. Add campaign_id to payments ───────────────────────────────────────────
-- A payment can cover a whole campaign (multi-location) OR a single legacy booking.
-- We allow campaign_id to be set and booking_id to be null for the campaign-level payment.
alter table public.payments
  drop constraint if exists payments_booking_id_key; -- drop unique so we can have null

alter table public.payments
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade;

-- Enforce: every payment must reference EITHER a booking OR a campaign, not both, not neither.
alter table public.payments
  drop constraint if exists payments_target_chk;
alter table public.payments
  add constraint payments_target_chk check (
    (booking_id is not null and campaign_id is null) or
    (booking_id is null     and campaign_id is not null)
  );

-- Make booking_id nullable (was NOT NULL originally, now optional when campaign_id set)
alter table public.payments alter column booking_id drop not null;

-- Re-add unique on booking_id where not null (partial unique index)
drop index if exists payments_booking_id_unique;
create unique index if not exists payments_booking_id_unique
  on public.payments (booking_id) where booking_id is not null;

-- Unique index on campaign_id where not null
drop index if exists payments_campaign_id_unique;
create unique index if not exists payments_campaign_id_unique
  on public.payments (campaign_id) where campaign_id is not null;


-- ── 4. Update RLS on payments to allow campaign-level insert ─────────────────
drop policy if exists payments_owner_insert on public.payments;
create policy payments_owner_insert on public.payments for insert with check (
  -- single-booking payment (legacy path)
  (booking_id is not null and campaign_id is null and exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id
      and b.customer_id = auth.uid()
      and b.status in ('awaiting_payment','rejected')
  ))
  or
  -- campaign payment
  (campaign_id is not null and booking_id is null and exists (
    select 1 from public.campaigns c
    where c.id = payments.campaign_id
      and c.customer_id = auth.uid()
  ))
);


-- ── 5. create_campaign_atomic RPC ────────────────────────────────────────────
-- Creates one campaign + one booking per location atomically.
-- p_location_ids: array of location UUIDs (1 or more)
-- Returns the new campaign row.

drop function if exists public.create_campaign_atomic(uuid, uuid[], ad_duration, int, date, date, int[], uuid) cascade;

create or replace function public.create_campaign_atomic(
  p_ad_id          uuid,
  p_location_ids   uuid[],           -- one or more locations
  p_duration       ad_duration,
  p_slots_per_day  int,
  p_start          date,
  p_end            date,
  p_dow            int[],
  p_package_id     uuid default null
) returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer   uuid := auth.uid();
  v_days       int;
  v_campaign   public.campaigns;
  v_loc_id     uuid;
  v_price      numeric;
  v_max_slots  int;
  v_date       date;
  v_existing   int;
  v_total      numeric := 0;
  v_ad_title   text;
begin
  if v_customer is null then
    raise exception 'Not authenticated';
  end if;

  -- must own the ad
  select title into v_ad_title
  from public.ads
  where id = p_ad_id and customer_id = v_customer;
  if v_ad_title is null then
    raise exception 'Ad not found or not owned by caller';
  end if;

  if array_length(p_location_ids, 1) is null or array_length(p_location_ids, 1) < 1 then
    raise exception 'At least one location must be selected';
  end if;

  if p_end < p_start then
    raise exception 'end_date must be on or after start_date';
  end if;

  v_days := public.count_scheduled_days(p_start, p_end, p_dow);
  if v_days <= 0 then
    raise exception 'No valid scheduled days in the selected range';
  end if;

  -- create the parent campaign (total_price updated at end)
  insert into public.campaigns (
    customer_id, ad_id, package_id, title, duration, slots_per_day,
    start_date, end_date, days_of_week, scheduled_days_count, total_price
  ) values (
    v_customer, p_ad_id, p_package_id, v_ad_title, p_duration, p_slots_per_day,
    p_start, p_end, p_dow, v_days, 0
  )
  returning * into v_campaign;

  -- for each location: validate, check capacity, create booking + booking_dates
  foreach v_loc_id in array p_location_ids loop

    -- lock the location row for this transaction
    select
      case
        when p_duration = '15' then price_15s
        when p_duration = '30' then price_30s
        else price_60s
      end,
      max_slots_per_day
    into v_price, v_max_slots
    from public.locations
    where id = v_loc_id and active = true
    for update;

    if v_price is null then
      raise exception 'Location % not found or inactive', v_loc_id;
    end if;

    if p_slots_per_day > v_max_slots then
      raise exception 'slots_per_day (%) exceeds max (%) for location %',
        p_slots_per_day, v_max_slots, v_loc_id;
    end if;

    -- per-date availability check for this location
    for v_date in
      select d::date
      from generate_series(p_start, p_end, interval '1 day') d
      where extract(dow from d)::int = any(p_dow)
    loop
      select coalesce(sum(bd.slots), 0)
      into v_existing
      from public.booking_dates bd
      join public.bookings b on b.id = bd.booking_id
      where bd.location_id = v_loc_id
        and bd.play_date   = v_date
        and b.status in ('awaiting_payment','payment_submitted','active');

      if v_existing + p_slots_per_day > v_max_slots then
        raise exception 'No availability on % at location %: % of % slots taken',
          v_date, v_loc_id, v_existing, v_max_slots;
      end if;
    end loop;

    -- insert booking for this location
    insert into public.bookings (
      customer_id, ad_id, location_id, duration, slots_per_day,
      start_date, end_date, days_of_week, scheduled_days_count,
      price_per_slot, total_price, status, package_id, campaign_id
    ) values (
      v_customer, p_ad_id, v_loc_id, p_duration, p_slots_per_day,
      p_start, p_end, p_dow, v_days,
      v_price, (v_price * p_slots_per_day * v_days)::numeric(12,2),
      'awaiting_payment', p_package_id, v_campaign.id
    );

    -- expand booking_dates
    insert into public.booking_dates (booking_id, location_id, play_date, slots)
    select
      (select id from public.bookings
       where campaign_id = v_campaign.id and location_id = v_loc_id
       order by created_at desc limit 1),
      v_loc_id,
      d::date,
      p_slots_per_day
    from generate_series(p_start, p_end, interval '1 day') d
    where extract(dow from d)::int = any(p_dow);

    v_total := v_total + (v_price * p_slots_per_day * v_days);

  end loop;

  -- update campaign total_price to sum of all its bookings
  update public.campaigns set total_price = v_total::numeric(12,2)
  where id = v_campaign.id
  returning * into v_campaign;

  return v_campaign;
end;
$$;

grant execute on function public.create_campaign_atomic(uuid, uuid[], ad_duration, int, date, date, int[], uuid)
  to authenticated;


-- ── 6. approve_payment: extend to handle campaign payments ───────────────────
create or replace function public.approve_payment(p_payment_id uuid)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_role     user_role;
  v_payment  public.payments;
  v_booking  public.bookings;
  v_campaign public.campaigns;
  v_receipt  public.receipts;
  v_num      text;
  v_cust     uuid;
  v_amount   numeric;
begin
  select role into v_role from public.profiles where id = v_user;
  if v_role not in ('accountant', 'admin') then
    raise exception 'Only accountants or admins can approve payments';
  end if;

  update public.payments
     set status      = 'approved',
         reviewed_at = now(),
         reviewed_by = v_user
   where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Payment not found or not pending';
  end if;

  if v_payment.campaign_id is not null then
    -- campaign payment: activate ALL bookings in the campaign
    update public.bookings
       set status      = 'active',
           approved_at = now(),
           approved_by = v_user
     where campaign_id = v_payment.campaign_id
    returning customer_id into v_cust;

    select customer_id, total_price into v_cust, v_amount
    from public.campaigns where id = v_payment.campaign_id;

    v_num := public.generate_receipt_number();
    insert into public.receipts (
      receipt_number, booking_id, payment_id, customer_id, amount
    ) values (
      v_num,
      -- point receipt at the first booking in the campaign
      (select id from public.bookings where campaign_id = v_payment.campaign_id order by created_at limit 1),
      v_payment.id, v_cust, v_payment.amount
    )
    returning * into v_receipt;

  else
    -- single-booking payment (legacy path)
    update public.bookings
       set status      = 'active',
           approved_at = now(),
           approved_by = v_user
     where id = v_payment.booking_id
    returning * into v_booking;

    v_num := public.generate_receipt_number();
    insert into public.receipts (
      receipt_number, booking_id, payment_id, customer_id, amount
    ) values (
      v_num, v_booking.id, v_payment.id, v_booking.customer_id, v_payment.amount
    )
    returning * into v_receipt;
  end if;

  return v_receipt;
end;
$$;

grant execute on function public.approve_payment(uuid) to authenticated;


-- ── 7. reject_payment: extend to handle campaign payments ────────────────────
create or replace function public.reject_payment(
  p_payment_id uuid,
  p_reason     text
) returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_role    user_role;
  v_payment public.payments;
begin
  select role into v_role from public.profiles where id = v_user;
  if v_role not in ('accountant', 'admin') then
    raise exception 'Only accountants or admins can reject payments';
  end if;

  update public.payments
     set status        = 'rejected',
         reviewed_at   = now(),
         reviewed_by   = v_user,
         reject_reason = p_reason
   where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Payment not found or not pending';
  end if;

  if v_payment.campaign_id is not null then
    update public.bookings set status = 'rejected'
    where campaign_id = v_payment.campaign_id;
  else
    update public.bookings set status = 'rejected'
    where id = v_payment.booking_id;
  end if;

  return v_payment;
end;
$$;

grant execute on function public.reject_payment(uuid, text) to authenticated;


-- ── 8. Permissions ───────────────────────────────────────────────────────────
grant select on public.campaigns to authenticated;
grant insert, update on public.campaigns to authenticated;
