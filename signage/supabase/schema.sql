-- ============================================================================
-- Digital Signage Advertising Management System
-- PostgreSQL / Supabase schema
--
-- Run this entire file in the Supabase SQL editor for a fresh project.
-- It is idempotent where practical, but expects a clean `public` schema.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
do $$ begin
  create type user_role       as enum ('customer', 'accountant', 'admin');
  create type ad_format       as enum ('image', 'video');
  create type ad_duration     as enum ('15', '30');
  create type booking_status  as enum (
    'awaiting_payment',   -- booking created, waiting for proof of payment
    'payment_submitted',  -- proof uploaded, waiting for accountant review
    'active',             -- approved and live (or will be on start_date)
    'rejected',           -- payment rejected by accountant
    'cancelled',          -- customer cancelled
    'completed'           -- end_date has passed
  );
  create type payment_method  as enum ('ecocash', 'bank_transfer', 'onemoney', 'cash', 'other');
  create type payment_status  as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;


-- ============================================================================
-- PROFILES  (1:1 extension of auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text not null,
  full_name        text,
  phone            text,
  role             user_role not null default 'customer',
  -- Billing / account type fields (populated at sign-up, included on receipts)
  account_type     text not null default 'individual', -- 'individual' | 'company'
  company_name     text,          -- company/org billing name
  company_reg      text,          -- registration number (optional)
  billing_address  text,          -- street address for receipts
  created_at       timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, account_type, company_name, company_reg, billing_address)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', null),
    coalesce(new.raw_user_meta_data->>'account_type', 'individual'),
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'company_reg', null),
    coalesce(new.raw_user_meta_data->>'billing_address', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used by RLS policies
create or replace function public.current_role_v()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;


-- ============================================================================
-- LOCATIONS
-- ============================================================================
create table if not exists public.locations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text,
  price_15s          numeric(12,2) not null check (price_15s  >= 0),
  price_30s          numeric(12,2) not null check (price_30s  >= 0),
  max_slots_per_day  int           not null check (max_slots_per_day > 0),
  active             boolean       not null default true,
  created_at         timestamptz   not null default now()
);
create index if not exists locations_active_idx on public.locations (active);


-- ============================================================================
-- PACKAGES
-- A package bundles a fixed duration, period (days), and max slots/day for a
-- location at a fixed price. Customers pick a package first, then customise
-- only the slots (up to max_slots_per_day) and campaign dates.
-- ============================================================================
create table if not exists public.packages (
  id                 uuid primary key default gen_random_uuid(),
  location_id        uuid not null references public.locations(id) on delete cascade,
  name               text not null,                             -- e.g. "Starter", "Standard", "Premium"
  description        text,                                       -- one-line selling point
  duration           ad_duration  not null,                     -- '15' | '30'
  period_days        int          not null check (period_days > 0),  -- campaign length in days
  max_slots_per_day  int          not null check (max_slots_per_day > 0),
  price              numeric(12,2) not null check (price >= 0), -- flat package price
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists packages_location_idx on public.packages (location_id, active);


-- ============================================================================
-- SECURITY GUARDS
-- ============================================================================
create table if not exists public.security_guards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  id_number   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);


-- ============================================================================
-- DEVICES (screens)
-- Every device MUST belong to a location and MUST have exactly one guard.
-- UNIQUE(guard_id) enforces a 1:1 relationship — no guard staffs two devices.
-- ============================================================================
create table if not exists public.devices (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  location_id  uuid not null references public.locations(id)       on delete restrict,
  guard_id     uuid not null unique references public.security_guards(id) on delete restrict,
  last_seen_at timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists devices_location_idx on public.devices (location_id);


-- ============================================================================
-- ADS (creatives)
-- ============================================================================
create table if not exists public.ads (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  format          ad_format not null,
  duration        ad_duration not null,
  media_url       text not null,
  media_path      text not null,
  mime_type       text,
  file_size_bytes bigint,
  created_at      timestamptz not null default now()
);
create index if not exists ads_customer_idx on public.ads (customer_id);


-- ============================================================================
-- BOOKINGS
-- days_of_week is 0–6 where 0=Sunday..6=Saturday (matches PG extract(dow))
-- ============================================================================
create table if not exists public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.profiles(id)  on delete restrict,
  ad_id                 uuid not null references public.ads(id)       on delete restrict,
  location_id           uuid not null references public.locations(id) on delete restrict,
  duration              ad_duration  not null,
  slots_per_day         int          not null check (slots_per_day > 0),
  start_date            date         not null,
  end_date              date         not null,
  days_of_week          int[]        not null,
  scheduled_days_count  int          not null check (scheduled_days_count > 0),
  price_per_slot        numeric(12,2) not null,
  total_price           numeric(12,2) not null check (total_price >= 0),
  status                booking_status not null default 'awaiting_payment',
  device_id             uuid references public.devices(id) on delete set null,
  created_at            timestamptz not null default now(),
  approved_at           timestamptz,
  approved_by           uuid references public.profiles(id),
  constraint bookings_dates_chk check (end_date >= start_date),
  constraint bookings_dow_chk  check (
    array_length(days_of_week, 1) between 1 and 7
    and days_of_week <@ array[0,1,2,3,4,5,6]
  )
);
create index if not exists bookings_customer_idx  on public.bookings (customer_id);
create index if not exists bookings_status_idx    on public.bookings (status);
create index if not exists bookings_location_idx  on public.bookings (location_id, start_date, end_date);


-- ============================================================================
-- BOOKING_DATES — pre-expanded play-dates. This is the key table for fast
-- slot availability queries. Populated atomically by create_booking_atomic().
-- ============================================================================
create table if not exists public.booking_dates (
  booking_id  uuid not null references public.bookings(id)  on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  play_date   date not null,
  slots       int  not null check (slots > 0),
  primary key (booking_id, play_date)
);
create index if not exists booking_dates_lookup_idx
  on public.booking_dates (location_id, play_date);


-- ============================================================================
-- PAYMENTS
-- ============================================================================
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null unique references public.bookings(id) on delete cascade,
  amount         numeric(12,2) not null check (amount >= 0),
  method         payment_method not null,
  reference      text,
  proof_url      text not null,
  proof_path     text not null,
  status         payment_status not null default 'pending',
  submitted_at   timestamptz not null default now(),
  reviewed_at    timestamptz,
  reviewed_by    uuid references public.profiles(id),
  reject_reason  text
);
create index if not exists payments_status_idx on public.payments (status);


-- ============================================================================
-- RECEIPTS
-- ============================================================================
create sequence if not exists public.receipt_seq start 1000;

create table if not exists public.receipts (
  id              uuid primary key default gen_random_uuid(),
  receipt_number  text not null unique,
  booking_id      uuid not null unique references public.bookings(id)  on delete cascade,
  payment_id      uuid not null unique references public.payments(id)  on delete cascade,
  customer_id     uuid not null references public.profiles(id) on delete restrict,
  amount          numeric(12,2) not null,
  issued_at       timestamptz not null default now()
);

create or replace function public.generate_receipt_number()
returns text
language sql
as $$
  select 'RCT-' || to_char(now(),'YYYYMM') || '-' ||
         lpad(nextval('public.receipt_seq')::text, 6, '0');
$$;


-- ============================================================================
-- PRICING — quoting helper (readonly, safe to call from any authenticated role)
-- ============================================================================
create or replace function public.count_scheduled_days(
  p_start date, p_end date, p_dow int[]
) returns int
language sql
immutable
as $$
  select count(*)::int
  from generate_series(p_start, p_end, interval '1 day') d
  where extract(dow from d)::int = any(p_dow);
$$;

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
    case when p_duration = '15' then price_15s else price_30s end,
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


-- ============================================================================
-- LOCATION AVAILABILITY — daily breakdown for a location
-- ============================================================================
create or replace function public.location_daily_availability(
  p_location_id uuid,
  p_start       date,
  p_end         date
) returns table (
  play_date  date,
  booked     int,
  available  int,
  max_slots  int
)
language sql
stable
as $$
  with loc as (
    select id, max_slots_per_day
    from public.locations
    where id = p_location_id and active = true
  ),
  dates as (
    select d::date as play_date
    from generate_series(p_start, p_end, interval '1 day') d
  ),
  bookings_on_date as (
    select bd.play_date, sum(bd.slots)::int as slots
    from public.booking_dates bd
    join public.bookings b on b.id = bd.booking_id
    where bd.location_id = p_location_id
      and b.status in ('awaiting_payment','payment_submitted','active')
      and bd.play_date between p_start and p_end
    group by bd.play_date
  )
  select d.play_date,
         coalesce(bod.slots, 0),
         (loc.max_slots_per_day - coalesce(bod.slots, 0))::int,
         loc.max_slots_per_day
  from dates d
  cross join loc
  left join bookings_on_date bod on bod.play_date = d.play_date;
$$;


-- ============================================================================
-- ATOMIC BOOKING CREATION
-- Uses SELECT ... FOR UPDATE on the location row to serialise concurrent
-- bookings for the same location, preventing overbooking race conditions.
-- ============================================================================
create or replace function public.create_booking_atomic(
  p_ad_id          uuid,
  p_location_id    uuid,
  p_duration       ad_duration,
  p_slots_per_day  int,
  p_start          date,
  p_end            date,
  p_dow            int[]
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

  -- ad must belong to caller
  if not exists (
    select 1 from public.ads
    where id = p_ad_id and customer_id = v_customer
  ) then
    raise exception 'Ad not found or not owned by caller';
  end if;

  -- lock the location row for the duration of this transaction
  select case when p_duration = '15' then price_15s else price_30s end,
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

  -- check capacity on every individual play-date
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

  -- create the booking
  insert into public.bookings (
    customer_id, ad_id, location_id, duration, slots_per_day,
    start_date, end_date, days_of_week, scheduled_days_count,
    price_per_slot, total_price, status
  )
  values (
    v_customer, p_ad_id, p_location_id, p_duration, p_slots_per_day,
    p_start, p_end, p_dow, v_days,
    v_price, (v_price * p_slots_per_day * v_days)::numeric(12,2),
    'awaiting_payment'
  )
  returning * into v_booking;

  -- expand scheduled dates
  insert into public.booking_dates (booking_id, location_id, play_date, slots)
  select v_booking.id, p_location_id, d::date, p_slots_per_day
  from generate_series(p_start, p_end, interval '1 day') d
  where extract(dow from d)::int = any(p_dow);

  return v_booking;
end;
$$;


-- ============================================================================
-- APPROVE / REJECT PAYMENT (accountant or admin only)
-- Approval atomically: flips payment -> approved, booking -> active,
-- and issues a receipt with a generated receipt_number.
-- ============================================================================
create or replace function public.approve_payment(p_payment_id uuid)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_role    user_role;
  v_payment public.payments;
  v_booking public.bookings;
  v_receipt public.receipts;
  v_num     text;
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

  return v_receipt;
end;
$$;

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

  update public.bookings
     set status = 'rejected'
   where id = v_payment.booking_id;

  return v_payment;
end;
$$;


-- ============================================================================
-- PLAYER FEED — returns ads eligible to play on the device RIGHT NOW
-- ============================================================================
create or replace function public.player_feed(p_device_id uuid)
returns table (
  booking_id     uuid,
  ad_id          uuid,
  title          text,
  format         ad_format,
  duration       ad_duration,
  media_url      text,
  slots_per_day  int
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, a.id, a.title, a.format, a.duration, a.media_url, b.slots_per_day
  from public.bookings b
  join public.ads a      on a.id = b.ad_id
  join public.devices d  on d.location_id = b.location_id
  where d.id = p_device_id
    and d.active = true
    and b.status = 'active'
    and current_date between b.start_date and b.end_date
    and extract(dow from current_date)::int = any(b.days_of_week)
    and (b.device_id is null or b.device_id = d.id)
  order by b.created_at;
$$;


-- ============================================================================
-- MAINTENANCE — mark bookings whose end_date has passed as completed
-- Schedule with pg_cron if available, otherwise call from a nightly job.
-- ============================================================================
create or replace function public.mark_completed_bookings()
returns int
language sql
as $$
  with updated as (
    update public.bookings
       set status = 'completed'
     where status = 'active'
       and end_date < current_date
    returning 1
  )
  select count(*)::int from updated;
$$;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles         enable row level security;
alter table public.locations        enable row level security;
alter table public.security_guards  enable row level security;
alter table public.devices          enable row level security;
alter table public.ads              enable row level security;
alter table public.bookings         enable row level security;
alter table public.booking_dates    enable row level security;
alter table public.payments         enable row level security;
alter table public.receipts         enable row level security;

-- profiles
drop policy if exists profiles_self_read     on public.profiles;
drop policy if exists profiles_admin_all     on public.profiles;
drop policy if exists profiles_self_update   on public.profiles;
create policy profiles_self_read  on public.profiles for select
  using (id = auth.uid() or public.current_role_v() in ('admin','accountant'));
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy profiles_admin_all  on public.profiles for all
  using (public.current_role_v() = 'admin') with check (public.current_role_v() = 'admin');

-- locations: publicly readable (customer picks one), admin writes
drop policy if exists locations_public_read on public.locations;
drop policy if exists locations_admin_write on public.locations;
create policy locations_public_read on public.locations for select using (true);
create policy locations_admin_write on public.locations for all
  using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- guards: visible only to staff; admin writes
drop policy if exists guards_staff_read on public.security_guards;
drop policy if exists guards_admin_write on public.security_guards;
create policy guards_staff_read on public.security_guards for select
  using (public.current_role_v() in ('admin','accountant'));
create policy guards_admin_write on public.security_guards for all
  using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- devices: public read (player needs this), admin writes
drop policy if exists devices_public_read on public.devices;
drop policy if exists devices_admin_write on public.devices;
create policy devices_public_read on public.devices for select using (true);
create policy devices_admin_write on public.devices for all
  using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ads: customer owns; staff can read
drop policy if exists ads_owner_select on public.ads;
drop policy if exists ads_owner_write  on public.ads;
create policy ads_owner_select on public.ads for select
  using (customer_id = auth.uid() or public.current_role_v() in ('admin','accountant'));
create policy ads_owner_write on public.ads for all
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- bookings: customer sees own; staff sees all; inserts happen via the
-- security-definer RPC, so no INSERT policy is necessary for customers.
drop policy if exists bookings_owner_select on public.bookings;
drop policy if exists bookings_admin_update on public.bookings;
create policy bookings_owner_select on public.bookings for select
  using (customer_id = auth.uid() or public.current_role_v() in ('admin','accountant'));
create policy bookings_admin_update on public.bookings for update
  using (public.current_role_v() = 'admin');

-- booking_dates: readable to owner + staff
drop policy if exists booking_dates_read on public.booking_dates;
create policy booking_dates_read on public.booking_dates for select using (
  public.current_role_v() in ('admin','accountant')
  or exists (
    select 1 from public.bookings b
    where b.id = booking_dates.booking_id and b.customer_id = auth.uid()
  )
);

-- payments: owner + staff read; owner inserts (upload proof)
drop policy if exists payments_owner_select on public.payments;
drop policy if exists payments_owner_insert on public.payments;
create policy payments_owner_select on public.payments for select using (
  public.current_role_v() in ('admin','accountant')
  or exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id and b.customer_id = auth.uid()
  )
);
create policy payments_owner_insert on public.payments for insert with check (
  exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id
      and b.customer_id = auth.uid()
      and b.status in ('awaiting_payment','rejected')
  )
);

-- receipts: owner + staff read (inserted by the approve_payment RPC)
drop policy if exists receipts_owner_select on public.receipts;
create policy receipts_owner_select on public.receipts for select using (
  customer_id = auth.uid() or public.current_role_v() in ('admin','accountant')
);


-- ============================================================================
-- STORAGE BUCKETS
-- Create two buckets:
--   - ad-media    : public read (ads rendered on player)
--   - payment-proofs : private (only owner + staff)
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('ad-media', 'ad-media', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('payment-proofs', 'payment-proofs', false)
  on conflict (id) do nothing;

-- ad-media policies: owner can write, everyone can read
drop policy if exists "ad-media public read"   on storage.objects;
drop policy if exists "ad-media owner write"   on storage.objects;
drop policy if exists "ad-media owner delete"  on storage.objects;
create policy "ad-media public read" on storage.objects for select
  using (bucket_id = 'ad-media');
create policy "ad-media owner write" on storage.objects for insert
  with check (bucket_id = 'ad-media' and owner = auth.uid());
create policy "ad-media owner delete" on storage.objects for delete
  using (bucket_id = 'ad-media' and owner = auth.uid());

-- payment-proofs: owner read/write, staff read
drop policy if exists "payment-proofs owner read"  on storage.objects;
drop policy if exists "payment-proofs staff read"  on storage.objects;
drop policy if exists "payment-proofs owner write" on storage.objects;
create policy "payment-proofs owner read" on storage.objects for select
  using (bucket_id = 'payment-proofs' and owner = auth.uid());
create policy "payment-proofs staff read" on storage.objects for select
  using (bucket_id = 'payment-proofs' and public.current_role_v() in ('admin','accountant'));
create policy "payment-proofs owner write" on storage.objects for insert
  with check (bucket_id = 'payment-proofs' and owner = auth.uid());


-- ============================================================================
-- PERMISSIONS — grant execute on our RPC functions to authenticated users
-- ============================================================================
grant execute on function public.quote_price(uuid, ad_duration, int, date, date, int[])              to authenticated;
grant execute on function public.count_scheduled_days(date, date, int[])                             to authenticated, anon;
grant execute on function public.location_daily_availability(uuid, date, date)                       to authenticated, anon;
grant execute on function public.create_booking_atomic(uuid, uuid, ad_duration, int, date, date, int[]) to authenticated;
grant execute on function public.approve_payment(uuid)                                               to authenticated;
grant execute on function public.reject_payment(uuid, text)                                          to authenticated;
grant execute on function public.player_feed(uuid)                                                   to authenticated, anon;

-- ============================================================================
-- SEED: make the first account an admin — run this ONCE after you create
-- your first user via Supabase Auth, replacing the email.
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
