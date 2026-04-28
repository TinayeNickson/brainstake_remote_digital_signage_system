-- ============================================================================
-- Digital Signage Platform — COMPLETE SCHEMA
-- Single-file, run-once setup for a fresh Supabase project.
--
-- Combines: schema.sql + all migrations v3 → v14 in correct order,
-- deduplicated, with later versions overriding earlier ones.
--
-- HOW TO USE:
--   1. Create a new Supabase project.
--   2. Paste this entire file into the SQL Editor and run it.
--   3. After running, set your first admin account:
--        update public.profiles set role = 'admin' where email = 'you@example.com';
--   4. Update .env.local with the new project URL + anon key + service-role key.
-- ============================================================================


-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto";


-- ============================================================================
-- ENUMS
-- ============================================================================
do $$ begin
  create type public.user_role as enum ('customer', 'accountant', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ad_format as enum ('image', 'video', 'audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ad_duration as enum ('15', '30', '60');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum (
    'awaiting_payment',
    'payment_submitted',
    'active',
    'rejected',
    'cancelled',
    'completed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('ecocash', 'bank_transfer', 'onemoney', 'cash', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.display_mode_enum as enum ('fade', 'slide', 'none', 'zoom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.device_type_enum as enum ('web', 'android');
exception when duplicate_object then null; end $$;


-- ============================================================================
-- TABLES
-- ============================================================================

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                   uuid        primary key references auth.users(id) on delete cascade,
  email                text        not null,
  full_name            text,
  phone                text,
  phone_number         text,
  role                 public.user_role not null default 'customer',
  account_type         text        not null default 'individual',
  company_name         text,
  company_reg          text,
  contact_person_name  text,
  billing_address      text,
  created_at           timestamptz not null default now()
);

-- ── locations ─────────────────────────────────────────────────────────────────
create table if not exists public.locations (
  id                 uuid        primary key default gen_random_uuid(),
  name               text        not null,
  description        text,
  price_15s          numeric(12,2) not null check (price_15s  >= 0),
  price_30s          numeric(12,2) not null check (price_30s  >= 0),
  price_60s          numeric(12,2) not null default 0 check (price_60s >= 0),
  max_slots_per_day  int         not null check (max_slots_per_day > 0),
  active             boolean     not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists locations_active_idx on public.locations (active);

-- ── packages ──────────────────────────────────────────────────────────────────
create table if not exists public.packages (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  description         text,
  base_slots_per_day  int         not null check (base_slots_per_day > 0),
  allows_15s          boolean     not null default true,
  allows_30s          boolean     not null default true,
  allows_60s          boolean     not null default false,
  active              boolean     not null default true,
  sort_order          int         not null default 0,
  created_at          timestamptz not null default now()
);

-- ── security_guards ───────────────────────────────────────────────────────────
create table if not exists public.security_guards (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  phone       text        not null,
  id_number   text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ── devices ───────────────────────────────────────────────────────────────────
create table if not exists public.devices (
  id                 uuid        primary key default gen_random_uuid(),
  code               text        not null unique,
  name               text        not null,
  location_id        uuid        not null references public.locations(id)       on delete restrict,
  guard_id           uuid        not null unique references public.security_guards(id) on delete restrict,
  last_seen_at       timestamptz,
  active             boolean     not null default true,
  max_slots_per_day  int         not null default 100 check (max_slots_per_day > 0),
  display_mode       public.display_mode_enum not null default 'fade',
  start_time         time        not null default '08:00',
  end_time           time        not null default '22:00',
  api_token          text        not null default encode(gen_random_bytes(32), 'hex'),
  pairing_code       text        unique,
  device_type        public.device_type_enum not null default 'web',
  paired_at          timestamptz,
  pair_attempts      int         not null default 0,
  pair_locked_until  timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists devices_location_idx    on public.devices (location_id);
create index if not exists idx_devices_api_token   on public.devices (api_token);

-- ── ads ───────────────────────────────────────────────────────────────────────
create table if not exists public.ads (
  id              uuid        primary key default gen_random_uuid(),
  customer_id     uuid        not null references public.profiles(id) on delete cascade,
  title           text        not null,
  format          public.ad_format    not null,
  duration        public.ad_duration  not null,
  media_url       text        not null,
  media_path      text        not null,
  mime_type       text,
  file_size_bytes bigint,
  created_at      timestamptz not null default now()
);
create index if not exists ads_customer_idx on public.ads (customer_id);

-- ── campaigns ─────────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id                   uuid        primary key default gen_random_uuid(),
  customer_id          uuid        not null references public.profiles(id)  on delete restrict,
  ad_id                uuid        not null references public.ads(id)       on delete restrict,
  package_id           uuid        references public.packages(id)           on delete set null,
  title                text        not null,
  duration             public.ad_duration not null,
  slots_per_day        int         not null check (slots_per_day > 0),
  start_date           date        not null,
  end_date             date        not null,
  days_of_week         int[]       not null,
  scheduled_days_count int         not null,
  total_price          numeric(12,2) not null default 0,
  created_at           timestamptz not null default now()
);
create index if not exists campaigns_customer_idx on public.campaigns (customer_id);

-- ── bookings ──────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id                    uuid        primary key default gen_random_uuid(),
  customer_id           uuid        not null references public.profiles(id)  on delete restrict,
  ad_id                 uuid        not null references public.ads(id)       on delete restrict,
  location_id           uuid        not null references public.locations(id) on delete restrict,
  campaign_id           uuid        references public.campaigns(id)          on delete set null,
  package_id            uuid        references public.packages(id)           on delete set null,
  duration              public.ad_duration  not null,
  slots_per_day         int         not null check (slots_per_day > 0),
  start_date            date        not null,
  end_date              date        not null,
  days_of_week          int[]       not null,
  scheduled_days_count  int         not null check (scheduled_days_count > 0),
  price_per_slot        numeric(12,2) not null,
  total_price           numeric(12,2) not null check (total_price >= 0),
  status                public.booking_status not null default 'awaiting_payment',
  device_id             uuid        references public.devices(id)            on delete set null,
  run_outside_hours     boolean     not null default false,
  created_at            timestamptz not null default now(),
  approved_at           timestamptz,
  approved_by           uuid        references public.profiles(id),
  constraint bookings_dates_chk check (end_date >= start_date),
  constraint bookings_dow_chk   check (
    array_length(days_of_week, 1) between 1 and 7
    and days_of_week <@ array[0,1,2,3,4,5,6]
  )
);
create index if not exists bookings_customer_idx  on public.bookings (customer_id);
create index if not exists bookings_status_idx    on public.bookings (status);
create index if not exists bookings_location_idx  on public.bookings (location_id, start_date, end_date);
create index if not exists bookings_campaign_idx  on public.bookings (campaign_id);

-- ── booking_dates ─────────────────────────────────────────────────────────────
create table if not exists public.booking_dates (
  booking_id  uuid not null references public.bookings(id)  on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  play_date   date not null,
  slots       int  not null check (slots > 0),
  primary key (booking_id, play_date)
);
create index if not exists booking_dates_lookup_idx on public.booking_dates (location_id, play_date);

-- ── payments ──────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id             uuid        primary key default gen_random_uuid(),
  booking_id     uuid        references public.bookings(id)  on delete cascade,
  campaign_id    uuid        references public.campaigns(id) on delete cascade,
  amount         numeric(12,2) not null check (amount >= 0),
  method         public.payment_method not null,
  reference      text,
  proof_url      text        not null,
  proof_path     text        not null,
  status         public.payment_status not null default 'pending',
  submitted_at   timestamptz not null default now(),
  reviewed_at    timestamptz,
  reviewed_by    uuid        references public.profiles(id),
  reject_reason  text,
  constraint payments_target_chk check (
    (booking_id is not null and campaign_id is null) or
    (booking_id is null     and campaign_id is not null)
  )
);
create unique index if not exists payments_booking_id_unique
  on public.payments (booking_id) where booking_id is not null;
create unique index if not exists payments_campaign_id_unique
  on public.payments (campaign_id) where campaign_id is not null;
create index if not exists payments_status_idx on public.payments (status);

-- ── receipts ──────────────────────────────────────────────────────────────────
create sequence if not exists public.receipt_seq start 1000;

create table if not exists public.receipts (
  id              uuid        primary key default gen_random_uuid(),
  receipt_number  text        not null unique,
  booking_id      uuid        not null references public.bookings(id) on delete cascade,
  payment_id      uuid        not null unique references public.payments(id) on delete cascade,
  customer_id     uuid        not null references public.profiles(id) on delete restrict,
  amount          numeric(12,2) not null,
  issued_at       timestamptz not null default now()
);

-- ── system_overrides ──────────────────────────────────────────────────────────
create table if not exists public.system_overrides (
  id             uuid        primary key default gen_random_uuid(),
  title          text        not null,
  content_url    text        not null,
  content_type   text        not null default 'image',
  message        text,
  is_active      boolean     not null default false,
  created_by     uuid        references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  activated_at   timestamptz,
  deactivated_at timestamptz
);

create unique index if not exists system_overrides_single_active_idx
  on public.system_overrides (is_active)
  where is_active = true;

-- ── fallback_content ──────────────────────────────────────────────────────────
create table if not exists public.fallback_content (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  content_url  text        not null,
  content_type text        not null default 'image',
  is_active    boolean     not null default true,
  sort_order   int         not null default 0,
  created_by   uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ── ad_slot_assignments ───────────────────────────────────────────────────────
create table if not exists public.ad_slot_assignments (
  id             uuid        primary key default gen_random_uuid(),
  booking_id     uuid        not null references public.bookings(id) on delete cascade,
  device_id      uuid        not null references public.devices(id)  on delete cascade,
  slot_index     int         not null check (slot_index >= 0),
  scheduled_date date        not null,
  created_at     timestamptz not null default now(),
  unique (device_id, slot_index, scheduled_date)
);
create index if not exists asa_device_date_idx on public.ad_slot_assignments (device_id, scheduled_date);
create index if not exists asa_booking_idx     on public.ad_slot_assignments (booking_id);

-- ── payment_settings ──────────────────────────────────────────────────────────
create table if not exists public.payment_settings (
  method       text        primary key,
  label        text        not null,
  instructions text        not null default '',
  is_enabled   boolean     not null default true,
  sort_order   int         not null default 0,
  updated_at   timestamptz not null default now(),
  updated_by   uuid        references public.profiles(id) on delete set null
);

-- ── contact_settings ───────────────────────────────────────────────────────────
create table if not exists public.contact_settings (
  id              uuid        primary key default gen_random_uuid(),
  key             text        not null unique,
  label           text        not null,
  value           text        not null,
  description     text,
  is_public       boolean     not null default true,
  sort_order      int         not null default 0,
  updated_at      timestamptz not null default now(),
  updated_by      uuid        references public.profiles(id) on delete set null
);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

create or replace function public.current_role_v()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.generate_receipt_number()
returns text
language sql
as $$
  select 'RCT-' || to_char(now(),'YYYYMM') || '-' ||
         lpad(nextval('public.receipt_seq')::text, 6, '0');
$$;

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


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- handle_new_user: populate profiles on auth sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, phone, phone_number, account_type,
    company_name, company_reg, contact_person_name, billing_address
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'phone_number', null),
    coalesce(new.raw_user_meta_data->>'phone_number', new.raw_user_meta_data->>'phone', null),
    coalesce(new.raw_user_meta_data->>'account_type', 'individual'),
    coalesce(new.raw_user_meta_data->>'company_name', null),
    coalesce(new.raw_user_meta_data->>'company_reg', null),
    coalesce(new.raw_user_meta_data->>'contact_person_name', null),
    coalesce(new.raw_user_meta_data->>'billing_address', new.raw_user_meta_data->>'address', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- generate_pairing_code helper
create or replace function public.generate_pairing_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code  text;
  v_chars text  := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i     int;
  v_len   int   := 6;
  v_exists bool;
begin
  loop
    v_code := '';
    for v_i in 1 .. v_len loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    end loop;
    select exists(select 1 from public.devices where pairing_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;

-- device_before_insert: auto-set pairing_code + unique api_token
create or replace function public.device_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pairing_code is null or new.pairing_code = '' then
    new.pairing_code := public.generate_pairing_code();
  end if;
  if new.api_token is null or new.api_token = '' then
    new.api_token := encode(gen_random_bytes(32), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_device_before_insert on public.devices;
create trigger trg_device_before_insert
  before insert on public.devices
  for each row execute function public.device_before_insert();

-- Back-fill pairing_code for existing devices (safe on fresh DB)
do $$
declare
  v_row record;
begin
  for v_row in select id from public.devices where pairing_code is null loop
    update public.devices set pairing_code = public.generate_pairing_code() where id = v_row.id;
  end loop;
end $$;

alter table public.devices alter column pairing_code set not null;
alter table public.devices
  add constraint devices_api_token_key unique (api_token);


-- ============================================================================
-- RPCs — PRICING
-- ============================================================================

create or replace function public.quote_price(
  p_location_id   uuid,
  p_duration      public.ad_duration,
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

  if v_price is null then raise exception 'Location not found or inactive'; end if;
  if p_slots_per_day <= 0 or p_slots_per_day > v_max then
    raise exception 'slots_per_day must be between 1 and %', v_max;
  end if;

  v_days := public.count_scheduled_days(p_start, p_end, p_dow);
  if v_days <= 0 then raise exception 'No valid scheduled days in the selected range'; end if;

  return query
    select v_price, v_days, (v_price * p_slots_per_day * v_days)::numeric(12,2), v_max;
end;
$$;

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
    select id, max_slots_per_day from public.locations where id = p_location_id and active = true
  ),
  dates as (
    select d::date as play_date from generate_series(p_start, p_end, interval '1 day') d
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
  from dates d cross join loc
  left join bookings_on_date bod on bod.play_date = d.play_date;
$$;


-- ============================================================================
-- RPCs — BOOKING CREATION
-- ============================================================================

-- Single-location legacy booking
create or replace function public.create_booking_atomic(
  p_ad_id          uuid,
  p_location_id    uuid,
  p_duration       public.ad_duration,
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
  v_customer  uuid := auth.uid();
  v_price     numeric;
  v_max_slots int;
  v_days      int;
  v_booking   public.bookings;
  v_date      date;
  v_existing  int;
begin
  if v_customer is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.ads where id = p_ad_id and customer_id = v_customer
  ) then raise exception 'Ad not found or not owned by caller'; end if;

  select case
      when p_duration = '15' then price_15s
      when p_duration = '30' then price_30s
      else price_60s
    end, max_slots_per_day
  into v_price, v_max_slots
  from public.locations where id = p_location_id and active = true for update;

  if v_price is null then raise exception 'Location not available'; end if;
  if p_slots_per_day <= 0 or p_slots_per_day > v_max_slots then
    raise exception 'slots_per_day must be between 1 and %', v_max_slots;
  end if;
  if p_end < p_start then raise exception 'end_date must be on or after start_date'; end if;

  v_days := public.count_scheduled_days(p_start, p_end, p_dow);
  if v_days <= 0 then raise exception 'No valid scheduled days in the selected range'; end if;

  for v_date in
    select d::date from generate_series(p_start, p_end, interval '1 day') d
    where extract(dow from d)::int = any(p_dow)
  loop
    select coalesce(sum(bd.slots), 0) into v_existing
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
  ) values (
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

-- Multi-location campaign (uniform schedule per location)
drop function if exists public.create_campaign_atomic(uuid, uuid[], public.ad_duration, int, date, date, int[], uuid) cascade;

create or replace function public.create_campaign_atomic(
  p_ad_id         uuid,
  p_location_ids  uuid[],
  p_duration      public.ad_duration,
  p_slots_per_day int,
  p_start         date,
  p_end           date,
  p_dow           int[],
  p_package_id    uuid default null
) returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer  uuid := auth.uid();
  v_days      int;
  v_campaign  public.campaigns;
  v_loc_id    uuid;
  v_price     numeric;
  v_max_slots int;
  v_date      date;
  v_existing  int;
  v_total     numeric := 0;
  v_ad_title  text;
begin
  if v_customer is null then raise exception 'Not authenticated'; end if;

  select title into v_ad_title from public.ads where id = p_ad_id and customer_id = v_customer;
  if v_ad_title is null then raise exception 'Ad not found or not owned by caller'; end if;

  if array_length(p_location_ids, 1) is null or array_length(p_location_ids, 1) < 1 then
    raise exception 'At least one location must be selected';
  end if;
  if p_end < p_start then raise exception 'end_date must be on or after start_date'; end if;

  v_days := public.count_scheduled_days(p_start, p_end, p_dow);
  if v_days <= 0 then raise exception 'No valid scheduled days in the selected range'; end if;

  insert into public.campaigns (
    customer_id, ad_id, package_id, title, duration, slots_per_day,
    start_date, end_date, days_of_week, scheduled_days_count, total_price
  ) values (
    v_customer, p_ad_id, p_package_id, v_ad_title, p_duration, p_slots_per_day,
    p_start, p_end, p_dow, v_days, 0
  ) returning * into v_campaign;

  foreach v_loc_id in array p_location_ids loop
    select case
        when p_duration = '15' then price_15s
        when p_duration = '30' then price_30s
        else price_60s
      end, max_slots_per_day
    into v_price, v_max_slots
    from public.locations where id = v_loc_id and active = true for update;

    if v_price is null then raise exception 'Location % not found or inactive', v_loc_id; end if;
    if p_slots_per_day > v_max_slots then
      raise exception 'slots_per_day (%) exceeds max (%) for location %',
        p_slots_per_day, v_max_slots, v_loc_id;
    end if;

    for v_date in
      select d::date from generate_series(p_start, p_end, interval '1 day') d
      where extract(dow from d)::int = any(p_dow)
    loop
      select coalesce(sum(bd.slots), 0) into v_existing
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

    insert into public.booking_dates (booking_id, location_id, play_date, slots)
    select
      (select id from public.bookings
       where campaign_id = v_campaign.id and location_id = v_loc_id
       order by created_at desc limit 1),
      v_loc_id, d::date, p_slots_per_day
    from generate_series(p_start, p_end, interval '1 day') d
    where extract(dow from d)::int = any(p_dow);

    v_total := v_total + (v_price * p_slots_per_day * v_days);
  end loop;

  update public.campaigns set total_price = v_total::numeric(12,2)
  where id = v_campaign.id
  returning * into v_campaign;

  return v_campaign;
end;
$$;

-- Multi-location with per-location slot counts (v2)
drop function if exists public.create_campaign_atomic_v2(uuid, jsonb, public.ad_duration, date, date, int[], uuid) cascade;

create or replace function public.create_campaign_atomic_v2(
  p_ad_id          uuid,
  p_location_slots  jsonb,
  p_duration        public.ad_duration,
  p_start           date,
  p_end             date,
  p_dow             int[],
  p_package_id      uuid default null
) returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer  uuid := auth.uid();
  v_days      int;
  v_campaign  public.campaigns;
  v_loc_id    uuid;
  v_slots     int;
  v_price     numeric;
  v_max_slots int;
  v_date      date;
  v_existing  int;
  v_total     numeric := 0;
  v_ad_title  text;
  v_max_spd   int := 0;
  v_loc_key   text;
begin
  if v_customer is null then raise exception 'Not authenticated'; end if;

  select title into v_ad_title from public.ads where id = p_ad_id and customer_id = v_customer;
  if v_ad_title is null then raise exception 'Ad not found or not owned by caller'; end if;

  if p_location_slots is null or jsonb_typeof(p_location_slots) <> 'object' then
    raise exception 'p_location_slots must be a non-empty JSON object';
  end if;
  if p_end < p_start then raise exception 'end_date must be on or after start_date'; end if;

  v_days := public.count_scheduled_days(p_start, p_end, p_dow);
  if v_days <= 0 then raise exception 'No valid scheduled days in the selected range'; end if;

  for v_loc_key in select jsonb_object_keys(p_location_slots) loop
    v_slots := (p_location_slots ->> v_loc_key)::int;
    if v_slots > v_max_spd then v_max_spd := v_slots; end if;
  end loop;

  insert into public.campaigns (
    customer_id, ad_id, package_id, title, duration, slots_per_day,
    start_date, end_date, days_of_week, scheduled_days_count, total_price
  ) values (
    v_customer, p_ad_id, p_package_id, v_ad_title, p_duration, v_max_spd,
    p_start, p_end, p_dow, v_days, 0
  ) returning * into v_campaign;

  for v_loc_key in select jsonb_object_keys(p_location_slots) loop
    v_loc_id := v_loc_key::uuid;
    v_slots  := (p_location_slots ->> v_loc_key)::int;
    if v_slots < 1 then raise exception 'slots_per_day must be >= 1 for location %', v_loc_id; end if;

    select case
        when p_duration = '15' then price_15s
        when p_duration = '30' then price_30s
        else price_60s
      end, max_slots_per_day
    into v_price, v_max_slots
    from public.locations where id = v_loc_id and active = true for update;

    if v_price is null then raise exception 'Location % not found or inactive', v_loc_id; end if;
    if v_slots > v_max_slots then
      raise exception 'slots_per_day (%) exceeds max (%) for location %', v_slots, v_max_slots, v_loc_id;
    end if;

    for v_date in
      select d::date from generate_series(p_start, p_end, interval '1 day') d
      where extract(dow from d)::int = any(p_dow)
    loop
      select coalesce(sum(bd.slots), 0) into v_existing
      from public.booking_dates bd
      join public.bookings b on b.id = bd.booking_id
      where bd.location_id = v_loc_id
        and bd.play_date   = v_date
        and b.status in ('awaiting_payment','payment_submitted','active');

      if v_existing + v_slots > v_max_slots then
        raise exception 'No availability on % at location %: % of % slots taken',
          v_date, v_loc_id, v_existing, v_max_slots;
      end if;
    end loop;

    insert into public.bookings (
      customer_id, ad_id, location_id, duration, slots_per_day,
      start_date, end_date, days_of_week, scheduled_days_count,
      price_per_slot, total_price, status, package_id, campaign_id
    ) values (
      v_customer, p_ad_id, v_loc_id, p_duration, v_slots,
      p_start, p_end, p_dow, v_days,
      v_price, (v_price * v_slots * v_days)::numeric(12,2),
      'awaiting_payment', p_package_id, v_campaign.id
    );

    insert into public.booking_dates (booking_id, location_id, play_date, slots)
    select
      (select id from public.bookings
       where campaign_id = v_campaign.id and location_id = v_loc_id
       order by created_at desc limit 1),
      v_loc_id, d::date, v_slots
    from generate_series(p_start, p_end, interval '1 day') d
    where extract(dow from d)::int = any(p_dow);

    v_total := v_total + (v_price * v_slots * v_days);
  end loop;

  update public.campaigns set total_price = v_total::numeric(12,2)
  where id = v_campaign.id returning * into v_campaign;

  return v_campaign;
end;
$$;

-- Multi-location with full per-location schedules (v3 — most recent, recommended)
drop function if exists public.create_campaign_atomic_v3(uuid, jsonb, public.ad_duration, uuid) cascade;

create or replace function public.create_campaign_atomic_v3(
  p_ad_id             uuid,
  p_location_configs  jsonb,
  p_duration          public.ad_duration,
  p_package_id        uuid default null
) returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer   uuid := auth.uid();
  v_ad_title   text;
  v_campaign   public.campaigns;
  v_cfg        jsonb;
  v_loc_id     uuid;
  v_slots      int;
  v_start      date;
  v_end        date;
  v_dow        int[];
  v_days       int;
  v_price      numeric;
  v_max_slots  int;
  v_check_date date;
  v_existing   int;
  v_total      numeric := 0;
  v_hdr_start  date;
  v_hdr_end    date;
  v_hdr_dow    int[];
  v_hdr_slots  int := 0;
  v_hdr_days   int := 0;
begin
  if v_customer is null then raise exception 'Not authenticated'; end if;

  select title into v_ad_title from public.ads where id = p_ad_id and customer_id = v_customer;
  if v_ad_title is null then raise exception 'Ad not found or not owned by caller'; end if;

  if p_location_configs is null or jsonb_typeof(p_location_configs) <> 'array'
     or jsonb_array_length(p_location_configs) = 0 then
    raise exception 'p_location_configs must be a non-empty JSON array';
  end if;

  -- Pass 1: validate + compute campaign header
  for v_cfg in select jsonb_array_elements(p_location_configs) loop
    v_loc_id := (v_cfg->>'location_id')::uuid;
    v_slots  := (v_cfg->>'slots_per_day')::int;
    v_start  := (v_cfg->>'start_date')::date;
    v_end    := (v_cfg->>'end_date')::date;
    select array_agg(el::int) into v_dow from jsonb_array_elements_text(v_cfg->'days_of_week') el;

    if v_loc_id is null then raise exception 'location_id is required in each config'; end if;
    if v_slots < 1 then raise exception 'slots_per_day must be >= 1 for location %', v_loc_id; end if;
    if v_end < v_start then raise exception 'end_date must be >= start_date for location %', v_loc_id; end if;
    if v_dow is null or array_length(v_dow,1) = 0 then
      raise exception 'days_of_week must not be empty for location %', v_loc_id;
    end if;

    v_days := public.count_scheduled_days(v_start, v_end, v_dow);
    if v_days <= 0 then raise exception 'No valid scheduled days for location %', v_loc_id; end if;

    if v_hdr_start is null or v_start < v_hdr_start then v_hdr_start := v_start; end if;
    if v_hdr_end   is null or v_end   > v_hdr_end   then v_hdr_end   := v_end;   end if;
    if v_slots > v_hdr_slots then v_hdr_slots := v_slots; end if;
    if v_days  > v_hdr_days  then v_hdr_days  := v_days;  end if;
    if v_hdr_dow is null then v_hdr_dow := v_dow;
    else select array_agg(distinct d order by d) into v_hdr_dow from unnest(v_hdr_dow || v_dow) d;
    end if;
  end loop;

  insert into public.campaigns (
    customer_id, ad_id, package_id, title, duration, slots_per_day,
    start_date, end_date, days_of_week, scheduled_days_count, total_price
  ) values (
    v_customer, p_ad_id, p_package_id, v_ad_title, p_duration, v_hdr_slots,
    v_hdr_start, v_hdr_end, v_hdr_dow, v_hdr_days, 0
  ) returning * into v_campaign;

  -- Pass 2: capacity checks + insert bookings
  for v_cfg in select jsonb_array_elements(p_location_configs) loop
    v_loc_id := (v_cfg->>'location_id')::uuid;
    v_slots  := (v_cfg->>'slots_per_day')::int;
    v_start  := (v_cfg->>'start_date')::date;
    v_end    := (v_cfg->>'end_date')::date;
    select array_agg(el::int) into v_dow from jsonb_array_elements_text(v_cfg->'days_of_week') el;
    v_days := public.count_scheduled_days(v_start, v_end, v_dow);

    select case
        when p_duration = '15' then price_15s
        when p_duration = '30' then price_30s
        else price_60s
      end, max_slots_per_day
    into v_price, v_max_slots
    from public.locations where id = v_loc_id and active = true for update;

    if v_price is null then raise exception 'Location % not found or inactive', v_loc_id; end if;
    if v_slots > v_max_slots then
      raise exception 'slots_per_day (%) exceeds max (%) for location %', v_slots, v_max_slots, v_loc_id;
    end if;

    for v_check_date in
      select d::date from generate_series(v_start, v_end, interval '1 day') d
      where extract(dow from d)::int = any(v_dow)
    loop
      select coalesce(sum(bd.slots), 0) into v_existing
      from public.booking_dates bd
      join public.bookings b on b.id = bd.booking_id
      where bd.location_id = v_loc_id
        and bd.play_date   = v_check_date
        and b.status in ('awaiting_payment','payment_submitted','active');

      if v_existing + v_slots > v_max_slots then
        raise exception 'No availability on % at location %: % of % slots taken',
          v_check_date, v_loc_id, v_existing, v_max_slots;
      end if;
    end loop;

    insert into public.bookings (
      customer_id, ad_id, location_id, duration, slots_per_day,
      start_date, end_date, days_of_week, scheduled_days_count,
      price_per_slot, total_price, status, package_id, campaign_id
    ) values (
      v_customer, p_ad_id, v_loc_id, p_duration, v_slots,
      v_start, v_end, v_dow, v_days,
      v_price, (v_price * v_slots * v_days)::numeric(12,2),
      'awaiting_payment', p_package_id, v_campaign.id
    );

    insert into public.booking_dates (booking_id, location_id, play_date, slots)
    select
      (select id from public.bookings
       where campaign_id = v_campaign.id and location_id = v_loc_id
       order by created_at desc limit 1),
      v_loc_id, d::date, v_slots
    from generate_series(v_start, v_end, interval '1 day') d
    where extract(dow from d)::int = any(v_dow);

    v_total := v_total + (v_price * v_slots * v_days);
  end loop;

  update public.campaigns set total_price = v_total::numeric(12,2)
  where id = v_campaign.id returning * into v_campaign;

  return v_campaign;
end;
$$;


-- ============================================================================
-- RPCs — PAYMENT
-- ============================================================================

create or replace function public.submit_campaign_payment(
  p_campaign_id  uuid,
  p_amount       numeric,
  p_method       text,
  p_reference    text,
  p_proof_path   text,
  p_proof_url    text
) returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns;
  v_payment  public.payments;
begin
  select * into v_campaign from public.campaigns
  where id = p_campaign_id and customer_id = auth.uid();
  if not found then raise exception 'Campaign not found or access denied'; end if;

  delete from public.payments where campaign_id = p_campaign_id;

  insert into public.payments (
    campaign_id, booking_id, amount, method, reference,
    proof_path, proof_url, status, submitted_at
  ) values (
    p_campaign_id, null, p_amount, p_method::public.payment_method, p_reference,
    p_proof_path, p_proof_url, 'pending', now()
  ) returning * into v_payment;

  update public.bookings set status = 'payment_submitted' where campaign_id = p_campaign_id;

  return v_payment;
end;
$$;

create or replace function public.submit_booking_payment(
  p_booking_id  uuid,
  p_amount      numeric,
  p_method      text,
  p_reference   text,
  p_proof_path  text,
  p_proof_url   text
) returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_payment public.payments;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and customer_id = auth.uid()
    and status in ('awaiting_payment', 'rejected');
  if not found then raise exception 'Booking not found, not yours, or not in a payable state'; end if;

  delete from public.payments where booking_id = p_booking_id;

  insert into public.payments (
    booking_id, campaign_id, amount, method, reference,
    proof_path, proof_url, status, submitted_at
  ) values (
    p_booking_id, null, p_amount, p_method::public.payment_method, p_reference,
    p_proof_path, p_proof_url, 'pending', now()
  ) returning * into v_payment;

  update public.bookings set status = 'payment_submitted' where id = p_booking_id;

  return v_payment;
end;
$$;

create or replace function public.approve_payment(p_payment_id uuid)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_role    public.user_role;
  v_payment public.payments;
  v_booking public.bookings;
  v_receipt public.receipts;
  v_num     text;
  v_cust    uuid;
  v_amount  numeric;
begin
  select role into v_role from public.profiles where id = v_user;
  if v_role not in ('accountant', 'admin') then
    raise exception 'Only accountants or admins can approve payments';
  end if;

  update public.payments
     set status = 'approved', reviewed_at = now(), reviewed_by = v_user
   where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then raise exception 'Payment not found or not pending'; end if;

  if v_payment.campaign_id is not null then
    update public.bookings
       set status = 'active', approved_at = now(), approved_by = v_user
     where campaign_id = v_payment.campaign_id;

    select customer_id, total_price into v_cust, v_amount
    from public.campaigns where id = v_payment.campaign_id;

    v_num := public.generate_receipt_number();
    insert into public.receipts (receipt_number, booking_id, payment_id, customer_id, amount)
    values (
      v_num,
      (select id from public.bookings where campaign_id = v_payment.campaign_id order by created_at limit 1),
      v_payment.id, v_cust, v_payment.amount
    ) returning * into v_receipt;
  else
    update public.bookings
       set status = 'active', approved_at = now(), approved_by = v_user
     where id = v_payment.booking_id
    returning * into v_booking;

    v_num := public.generate_receipt_number();
    insert into public.receipts (receipt_number, booking_id, payment_id, customer_id, amount)
    values (v_num, v_booking.id, v_payment.id, v_booking.customer_id, v_payment.amount)
    returning * into v_receipt;
  end if;

  return v_receipt;
end;
$$;

create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_role    public.user_role;
  v_payment public.payments;
begin
  select role into v_role from public.profiles where id = v_user;
  if v_role not in ('accountant', 'admin') then
    raise exception 'Only accountants or admins can reject payments';
  end if;

  update public.payments
     set status = 'rejected', reviewed_at = now(), reviewed_by = v_user, reject_reason = p_reason
   where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then raise exception 'Payment not found or not pending'; end if;

  if v_payment.campaign_id is not null then
    update public.bookings set status = 'rejected' where campaign_id = v_payment.campaign_id;
  else
    update public.bookings set status = 'rejected' where id = v_payment.booking_id;
  end if;

  return v_payment;
end;
$$;


-- ============================================================================
-- RPCs — PLAYER
-- ============================================================================

-- player_feed: returns ads eligible to play on a device today
drop function if exists public.player_feed(uuid) cascade;

create function public.player_feed(p_device_id uuid)
returns table (
  booking_id        uuid,
  ad_id             uuid,
  title             text,
  format            public.ad_format,
  duration          public.ad_duration,
  media_url         text,
  slots_per_day     int,
  display_mode      text,
  run_outside_hours boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    a.id,
    a.title,
    a.format,
    a.duration,
    a.media_url,
    bd.slots,
    d.display_mode::text,
    b.run_outside_hours
  from public.booking_dates bd
  join public.bookings b on b.id  = bd.booking_id
  join public.ads      a on a.id  = b.ad_id
  join public.devices  d on d.id  = p_device_id
  where bd.location_id = d.location_id
    and bd.play_date   = current_date
    and b.status       = 'active'
    and (b.device_id is null or b.device_id = p_device_id)
    and b.start_date  <= current_date
    and b.end_date    >= current_date
  order by b.created_at;
$$;

-- device_slot_usage helper
create or replace function public.device_slot_usage(
  p_device_id uuid,
  p_date      date default current_date
) returns table (
  booked_slots    int,
  max_slots       int,
  available_slots int
)
language sql
stable
security definer
set search_path = public
as $$
  with dev as (
    select d.max_slots_per_day, d.location_id
    from public.devices d where d.id = p_device_id and d.active = true
  ),
  used as (
    select coalesce(sum(bd.slots), 0)::int as total
    from public.booking_dates bd
    join public.bookings b on b.id = bd.booking_id
    cross join dev
    where bd.location_id = dev.location_id
      and bd.play_date   = p_date
      and b.status in ('awaiting_payment','payment_submitted','active')
  )
  select used.total, dev.max_slots_per_day, (dev.max_slots_per_day - used.total)::int
  from used cross join dev;
$$;


-- ============================================================================
-- RPCs — SLOT ENGINE
-- ============================================================================

create or replace function public.generate_slot_assignments(
  p_device_id uuid,
  p_date      date default current_date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_slots   int;
  v_location_id uuid;
  v_occupied    boolean[];
  v_booking     record;
  v_interval    int;
  v_pos         int;
  v_placed      int;
  v_total       int := 0;
  v_i           int;
begin
  select max_slots_per_day, location_id into v_max_slots, v_location_id
  from public.devices where id = p_device_id;

  if v_max_slots is null or v_max_slots < 1 then
    raise exception 'Device not found or has no capacity';
  end if;

  v_occupied := array_fill(false, array[v_max_slots]);

  delete from public.ad_slot_assignments
  where device_id = p_device_id and scheduled_date = p_date;

  for v_booking in
    select b.id as booking_id, bd.slots as slots_per_day
    from public.booking_dates bd
    join public.bookings b on b.id = bd.booking_id
    where bd.location_id = v_location_id
      and bd.play_date   = p_date
      and b.status       = 'active'
      and (b.device_id is null or b.device_id = p_device_id)
      and b.start_date  <= p_date
      and b.end_date    >= p_date
    order by b.created_at
  loop
    v_placed   := least(v_booking.slots_per_day, v_max_slots);
    v_interval := greatest(1, v_max_slots / v_placed);

    for v_i in 0 .. v_placed - 1 loop
      v_pos := least((v_i * v_interval), v_max_slots - 1);
      declare v_attempts int := 0; begin
        while v_occupied[v_pos + 1] and v_attempts < v_max_slots loop
          v_pos      := (v_pos + 1) % v_max_slots;
          v_attempts := v_attempts + 1;
        end loop;
        if not v_occupied[v_pos + 1] then
          v_occupied[v_pos + 1] := true;
          insert into public.ad_slot_assignments (booking_id, device_id, slot_index, scheduled_date)
          values (v_booking.booking_id, p_device_id, v_pos, p_date)
          on conflict (device_id, slot_index, scheduled_date) do nothing;
          v_total := v_total + 1;
        end if;
      end;
    end loop;
  end loop;

  return v_total;
end;
$$;

create or replace function public.player_slots(
  p_device_id uuid,
  p_date      date default current_date
)
returns table (
  slot_index        int,
  booking_id        uuid,
  ad_id             uuid,
  title             text,
  format            public.ad_format,
  duration          public.ad_duration,
  media_url         text,
  display_mode      text,
  run_outside_hours boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    asa.slot_index, b.id, a.id, a.title, a.format, a.duration,
    a.media_url, d.display_mode::text, b.run_outside_hours
  from public.ad_slot_assignments asa
  join public.bookings b on b.id = asa.booking_id
  join public.ads      a on a.id = b.ad_id
  join public.devices  d on d.id = asa.device_id
  where asa.device_id    = p_device_id
    and asa.scheduled_date = p_date
  order by asa.slot_index;
$$;


-- ============================================================================
-- RPCs — DEVICES
-- ============================================================================

create or replace function public.regenerate_device_token(p_device_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  new_token text;
begin
  new_token := encode(gen_random_bytes(32), 'hex');
  update public.devices set api_token = new_token where id = p_device_id;
  return new_token;
end;
$$;

create or replace function public.regenerate_pairing_code(p_device_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_code text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role <> 'admin' then raise exception 'Admin only'; end if;

  v_code := public.generate_pairing_code();
  update public.devices set pairing_code = v_code, paired_at = null where id = p_device_id;
  return v_code;
end;
$$;

create or replace function public.pair_device(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device record;
begin
  p_code := upper(trim(p_code));

  select id, api_token, name, device_type, pair_attempts, pair_locked_until
  into v_device
  from public.devices where pairing_code = p_code;

  if v_device.id is null then raise exception 'Invalid pairing code'; end if;

  if v_device.pair_locked_until is not null and v_device.pair_locked_until > now() then
    raise exception 'Too many failed attempts. Try again after %',
      to_char(v_device.pair_locked_until at time zone 'UTC', 'HH24:MI UTC');
  end if;

  update public.devices
     set paired_at = now(), device_type = 'android', pair_attempts = 0, pair_locked_until = null
   where id = v_device.id;

  return json_build_object(
    'device_id',   v_device.id,
    'device_name', v_device.name,
    'api_token',   v_device.api_token
  );
end;
$$;

create or replace function public.record_failed_pair_attempt(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
begin
  p_code := upper(trim(p_code));
  select pair_attempts + 1 into v_attempts
  from public.devices where pairing_code = p_code;
  if v_attempts is null then return; end if;

  update public.devices
     set pair_attempts     = v_attempts,
         pair_locked_until = case when v_attempts >= 10
                                  then now() + interval '15 minutes'
                                  else pair_locked_until end
   where pairing_code = p_code;
end;
$$;


-- ============================================================================
-- RPCs — ADMIN BOOKING MANAGEMENT
-- ============================================================================

create or replace function public.admin_suspend_booking(
  p_booking_id    uuid,
  p_reason        text
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id  uuid := auth.uid();
  v_customer_id uuid;
  v_booking   public.bookings;
begin
  if public.current_role_v() != 'admin' then
    raise exception 'Only admins can suspend bookings';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  v_customer_id := v_booking.customer_id;

  update public.bookings
  set status = 'suspended',
      suspended_at = now(),
      suspended_by = v_admin_id,
      suspend_reason = p_reason
  where id = p_booking_id
  returning * into v_booking;

  insert into public.notifications (
    customer_id, type, title, message, booking_id, created_by
  ) values (
    v_customer_id,
    'booking_suspended',
    'Your ad has been suspended',
    p_reason,
    p_booking_id,
    v_admin_id
  );

  return v_booking;
end;
$$;

create or replace function public.admin_reactivate_booking(
  p_booking_id    uuid
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id  uuid := auth.uid();
  v_customer_id uuid;
  v_booking   public.bookings;
begin
  if public.current_role_v() != 'admin' then
    raise exception 'Only admins can reactivate bookings';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  v_customer_id := v_booking.customer_id;

  update public.bookings
  set status = 'active',
      suspended_at = null,
      suspended_by = null,
      suspend_reason = null
  where id = p_booking_id
  returning * into v_booking;

  insert into public.notifications (
    customer_id, type, title, message, booking_id, created_by
  ) values (
    v_customer_id,
    'booking_approved',
    'Your ad has been reactivated',
    'Your previously suspended ad is now active again and will resume playing on screens.',
    p_booking_id,
    v_admin_id
  );

  return v_booking;
end;
$$;

create or replace function public.admin_update_booking_dates(
  p_params jsonb
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id    uuid := auth.uid();
  v_customer_id uuid;
  v_old_start   date;
  v_old_end     date;
  v_location_id uuid;
  v_slots_per_day int;
  v_booking     public.bookings;
  v_message     text;
  v_booking_id  uuid;
  v_start_date  date;
  v_end_date    date;
  v_reason      text;
begin
  -- Extract params from JSON
  v_booking_id := (p_params->>'booking_id')::uuid;
  v_start_date := (p_params->>'start_date')::date;
  v_end_date := (p_params->>'end_date')::date;
  v_reason := p_params->>'reason';

  -- Verify admin with detailed error
  declare
    v_detected_role public.user_role;
  begin
    v_detected_role := public.current_role_v();
    if v_detected_role is null then
      raise exception 'Auth failed: current_role_v() returned null. User may not be authenticated.';
    end if;
    if v_detected_role != 'admin' then
      raise exception 'Auth failed: role is %, expected admin', v_detected_role;
    end if;
  end;

  if v_start_date is null or v_end_date is null then
    raise exception 'Start date and end date are required';
  end if;

  if v_end_date < v_start_date then
    raise exception 'End date must be after start date';
  end if;

  select id, customer_id, location_id, slots_per_day, start_date, end_date
  into v_booking
  from public.bookings
  where id = v_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  v_customer_id := v_booking.customer_id;
  v_old_start := v_booking.start_date;
  v_old_end := v_booking.end_date;
  v_location_id := v_booking.location_id;
  v_slots_per_day := v_booking.slots_per_day;

  update public.bookings
  set original_start_date = coalesce(original_start_date, start_date),
      original_end_date = coalesce(original_end_date, end_date),
      start_date = v_start_date,
      end_date = v_end_date
  where id = v_booking_id
  returning * into v_booking;

  delete from public.booking_dates
  where booking_id = v_booking_id
    and (play_date < v_start_date or play_date > v_end_date);

  insert into public.booking_dates (booking_id, location_id, play_date, slots)
  select v_booking_id, v_location_id, d::date, v_slots_per_day
  from generate_series(v_start_date, v_end_date, interval '1 day') d
  where d::date not in (
    select play_date from public.booking_dates where booking_id = v_booking_id
  );

  v_message := format('Your ad schedule has been changed from %s–%s to %s–%s.',
    v_old_start, v_old_end, v_start_date, v_end_date);
  if v_reason is not null then
    v_message := v_message || ' Reason: ' || v_reason;
  end if;

  insert into public.notifications (
    customer_id, type, title, message, booking_id, created_by, metadata
  ) values (
    v_customer_id,
    'booking_date_changed',
    'Your ad schedule has been updated',
    v_message,
    v_booking_id,
    v_admin_id,
    jsonb_build_object(
      'old_start', v_old_start,
      'old_end', v_old_end,
      'new_start', v_start_date,
      'new_end', v_end_date,
      'reason', v_reason
    )
  );

  return v_booking;
end;
$$;

-- Alternative function name for admin date changes (avoids PostgREST caching issues)
create or replace function public.admin_change_booking_dates(p_params jsonb)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id    uuid := coalesce((p_params->>'admin_id')::uuid, auth.uid());
  v_customer_id uuid;
  v_old_start   date;
  v_old_end     date;
  v_location_id uuid;
  v_slots_per_day int;
  v_booking     public.bookings;
  v_message     text;
  v_booking_id  uuid;
  v_start_date  date;
  v_end_date    date;
  v_reason      text;
begin
  -- Extract params from JSON
  v_booking_id := (p_params->>'booking_id')::uuid;
  v_start_date := (p_params->>'start_date')::date;
  v_end_date := (p_params->>'end_date')::date;
  v_reason := p_params->>'reason';

  -- Auth check
  if public.current_role_v() != 'admin' then
    raise exception 'Only admins can update booking dates';
  end if;

  -- Validation
  if v_start_date is null or v_end_date is null then
    raise exception 'Start date and end date are required';
  end if;
  
  if v_end_date < v_start_date then
    raise exception 'End date must be after start date';
  end if;

  -- Get current booking
  select id, customer_id, location_id, slots_per_day, start_date, end_date
  into v_booking from public.bookings where id = v_booking_id;
  
  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  -- Save old values
  v_customer_id := v_booking.customer_id;
  v_old_start := v_booking.start_date;
  v_old_end := v_booking.end_date;
  v_location_id := v_booking.location_id;
  v_slots_per_day := v_booking.slots_per_day;

  -- Update booking
  update public.bookings
  set original_start_date = coalesce(original_start_date, start_date),
      original_end_date = coalesce(original_end_date, end_date),
      start_date = v_start_date,
      end_date = v_end_date
  where id = v_booking_id
  returning * into v_booking;

  -- Sync booking_dates - delete outside range
  delete from public.booking_dates
  where booking_id = v_booking_id
    and (play_date < v_start_date or play_date > v_end_date);

  -- Insert new dates
  insert into public.booking_dates (booking_id, location_id, play_date, slots)
  select v_booking_id, v_location_id, d::date, v_slots_per_day
  from generate_series(v_start_date, v_end_date, interval '1 day') d
  where d::date not in (
    select play_date from public.booking_dates where booking_id = v_booking_id
  );

  -- Build notification
  v_message := format('Your ad schedule has been changed from %s–%s to %s–%s.',
    v_old_start, v_old_end, v_start_date, v_end_date);
  if v_reason is not null then
    v_message := v_message || ' Reason: ' || v_reason;
  end if;

  -- Send notification
  insert into public.notifications (
    customer_id, type, title, message, booking_id, created_by, metadata
  ) values (
    v_customer_id,
    'booking_date_changed',
    'Your ad schedule has been updated',
    v_message,
    v_booking_id,
    v_admin_id,
    jsonb_build_object(
      'old_start', v_old_start,
      'old_end', v_old_end,
      'new_start', v_start_date,
      'new_end', v_end_date,
      'reason', v_reason
    )
  );

  return v_booking;
end;
$$;

create or replace function public.mark_notification_read(
  p_notification_id uuid
) returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notif public.notifications;
begin
  update public.notifications
  set is_read = true
  where id = p_notification_id
    and customer_id = auth.uid()
  returning * into v_notif;

  return v_notif;
end;
$$;

create or replace function public.get_customer_notifications(
  p_limit int default 20,
  p_offset int default 0
) returns table (
  id uuid,
  type text,
  title text,
  message text,
  booking_id uuid,
  campaign_id uuid,
  metadata jsonb,
  is_read boolean,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select id, type, title, message, booking_id, campaign_id, metadata, is_read, created_at
  from public.notifications
  where customer_id = auth.uid()
  order by created_at desc
  limit p_limit offset p_offset;
$$;


-- ============================================================================
-- RPCs — MAINTENANCE
-- ============================================================================

create or replace function public.mark_completed_bookings()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  public.user_role;
  v_count int;
begin
  if auth.uid() is not null then
    select role into v_role from public.profiles where id = auth.uid();
    if v_role not in ('admin') then raise exception 'Admin only'; end if;
  end if;

  update public.bookings set status = 'completed'
  where status = 'active' and end_date < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles           enable row level security;
alter table public.locations          enable row level security;
alter table public.security_guards    enable row level security;
alter table public.devices            enable row level security;
alter table public.ads                enable row level security;
alter table public.campaigns          enable row level security;
alter table public.bookings           enable row level security;
alter table public.booking_dates      enable row level security;
alter table public.payments           enable row level security;
alter table public.receipts           enable row level security;
alter table public.system_overrides   enable row level security;
alter table public.fallback_content   enable row level security;
alter table public.ad_slot_assignments enable row level security;
alter table public.packages           enable row level security;
alter table public.payment_settings   enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────────
drop policy if exists profiles_self_read   on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_admin_all   on public.profiles;

create policy profiles_self_read on public.profiles for select using (
  id = auth.uid()
  or public.current_role_v() = 'admin'
  or (
    public.current_role_v() = 'accountant'
    and exists (
      select 1 from public.payments py
      join public.bookings b on (
        (py.booking_id = b.id) or
        (py.campaign_id is not null and b.campaign_id = py.campaign_id)
      )
      where b.customer_id = profiles.id
    )
  )
);

create policy profiles_self_update on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

create policy profiles_admin_all on public.profiles for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── locations ─────────────────────────────────────────────────────────────────
drop policy if exists locations_public_read on public.locations;
drop policy if exists locations_admin_write on public.locations;
create policy locations_public_read on public.locations for select using (true);
create policy locations_admin_write on public.locations for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── packages ─────────────────────────────────────────────────────────────────
drop policy if exists packages_public_read on public.packages;
drop policy if exists packages_admin_write on public.packages;
create policy packages_public_read on public.packages for select
  using (active = true or public.current_role_v() in ('admin','accountant'));
create policy packages_admin_write on public.packages for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── security_guards ───────────────────────────────────────────────────────────
drop policy if exists guards_staff_read  on public.security_guards;
drop policy if exists guards_admin_write on public.security_guards;
create policy guards_staff_read on public.security_guards for select
  using (public.current_role_v() in ('admin','accountant'));
create policy guards_admin_write on public.security_guards for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── devices — admin only (player uses service-role API) ───────────────────────
drop policy if exists devices_public_read on public.devices;
drop policy if exists devices_admin_write on public.devices;
drop policy if exists devices_admin_all   on public.devices;
create policy devices_admin_all on public.devices for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── ads ───────────────────────────────────────────────────────────────────────
drop policy if exists ads_owner_select on public.ads;
drop policy if exists ads_owner_write  on public.ads;
create policy ads_owner_select on public.ads for select
  using (customer_id = auth.uid() or public.current_role_v() in ('admin','accountant'));
create policy ads_owner_write on public.ads for all
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- ── campaigns ─────────────────────────────────────────────────────────────────
drop policy if exists campaigns_owner_select on public.campaigns;
drop policy if exists campaigns_admin_all    on public.campaigns;
create policy campaigns_owner_select on public.campaigns for select
  using (customer_id = auth.uid() or public.current_role_v() in ('admin','accountant'));
create policy campaigns_admin_all on public.campaigns for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── bookings ──────────────────────────────────────────────────────────────────
drop policy if exists bookings_owner_select on public.bookings;
drop policy if exists bookings_staff_update on public.bookings;
drop policy if exists bookings_admin_update on public.bookings;
create policy bookings_owner_select on public.bookings for select
  using (customer_id = auth.uid() or public.current_role_v() in ('admin','accountant'));
create policy bookings_staff_update on public.bookings for update
  using (public.current_role_v() in ('admin','accountant'));

-- ── booking_dates ─────────────────────────────────────────────────────────────
drop policy if exists booking_dates_read on public.booking_dates;
create policy booking_dates_read on public.booking_dates for select using (
  public.current_role_v() in ('admin','accountant')
  or exists (
    select 1 from public.bookings b
    where b.id = booking_dates.booking_id and b.customer_id = auth.uid()
  )
);

-- ── payments ──────────────────────────────────────────────────────────────────
drop policy if exists payments_owner_select on public.payments;
drop policy if exists payments_owner_insert on public.payments;
drop policy if exists payments_owner_delete on public.payments;

create policy payments_owner_select on public.payments for select using (
  public.current_role_v() in ('admin','accountant')
  or (booking_id is not null and exists (
    select 1 from public.bookings b where b.id = payments.booking_id and b.customer_id = auth.uid()
  ))
  or (campaign_id is not null and exists (
    select 1 from public.campaigns c where c.id = payments.campaign_id and c.customer_id = auth.uid()
  ))
);

create policy payments_owner_insert on public.payments for insert with check (
  (booking_id is not null and campaign_id is null and exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id and b.customer_id = auth.uid()
      and b.status in ('awaiting_payment','rejected')
  ))
  or
  (campaign_id is not null and booking_id is null and exists (
    select 1 from public.campaigns c where c.id = payments.campaign_id and c.customer_id = auth.uid()
  ))
);

create policy payments_owner_delete on public.payments for delete using (
  (booking_id is not null and exists (
    select 1 from public.bookings b where b.id = payments.booking_id and b.customer_id = auth.uid()
  ))
  or (campaign_id is not null and exists (
    select 1 from public.campaigns c where c.id = payments.campaign_id and c.customer_id = auth.uid()
  ))
  or public.current_role_v() in ('admin','accountant')
);

-- ── receipts ──────────────────────────────────────────────────────────────────
drop policy if exists receipts_owner_select on public.receipts;
create policy receipts_owner_select on public.receipts for select using (
  customer_id = auth.uid() or public.current_role_v() in ('admin','accountant')
);

-- ── system_overrides ──────────────────────────────────────────────────────────
drop policy if exists overrides_public_read on public.system_overrides;
drop policy if exists overrides_admin_write on public.system_overrides;
create policy overrides_public_read on public.system_overrides for select using (true);
create policy overrides_admin_write on public.system_overrides for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── fallback_content ──────────────────────────────────────────────────────────
drop policy if exists fallback_public_read on public.fallback_content;
drop policy if exists fallback_admin_write on public.fallback_content;
create policy fallback_public_read on public.fallback_content for select using (true);
create policy fallback_admin_write on public.fallback_content for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── ad_slot_assignments ───────────────────────────────────────────────────────
drop policy if exists slot_assignments_admin on public.ad_slot_assignments;
drop policy if exists asa_admin_all          on public.ad_slot_assignments;
drop policy if exists asa_read               on public.ad_slot_assignments;
create policy slot_assignments_admin on public.ad_slot_assignments for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── payment_settings ──────────────────────────────────────────────────────────
drop policy if exists payment_settings_public_read on public.payment_settings;
drop policy if exists payment_settings_staff_write on public.payment_settings;
create policy payment_settings_public_read on public.payment_settings for select using (true);
create policy payment_settings_staff_write on public.payment_settings for all
  using  (public.current_role_v() in ('accountant','admin'))
  with check (public.current_role_v() in ('accountant','admin'));

-- ── contact_settings ───────────────────────────────────────────────────────────
alter table public.contact_settings enable row level security;
drop policy if exists contact_settings_public_read on public.contact_settings;
drop policy if exists contact_settings_admin_write on public.contact_settings;
create policy contact_settings_public_read on public.contact_settings for select using (is_public = true);
create policy contact_settings_admin_write on public.contact_settings for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');


-- ============================================================================
-- REVOKE DANGEROUS DIRECT TABLE ACCESS FROM ANON
-- ============================================================================
revoke select on public.devices             from anon;
revoke select on public.ad_slot_assignments from anon;
revoke select on public.security_guards     from anon;
revoke all     on public.booking_dates      from anon;
grant  select  on public.booking_dates      to authenticated;

revoke all     on public.notifications       from anon;
grant  select, insert, update, delete on public.notifications to authenticated;


-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('ad-media', 'ad-media', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('payment-proofs', 'payment-proofs', false) on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('override-media', 'override-media', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('fallback-media', 'fallback-media', true) on conflict (id) do nothing;

-- ad-media
drop policy if exists "ad-media public read"   on storage.objects;
drop policy if exists "ad-media owner write"   on storage.objects;
drop policy if exists "ad-media owner update"  on storage.objects;
drop policy if exists "ad-media owner delete"  on storage.objects;

create policy "ad-media public read"  on storage.objects for select using (bucket_id = 'ad-media');
create policy "ad-media owner write"  on storage.objects for insert with check (
  bucket_id = 'ad-media' and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "ad-media owner update" on storage.objects for update using (
  bucket_id = 'ad-media' and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "ad-media owner delete" on storage.objects for delete using (
  bucket_id = 'ad-media' and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- payment-proofs
drop policy if exists "payment-proofs owner read"   on storage.objects;
drop policy if exists "payment-proofs staff read"   on storage.objects;
drop policy if exists "payment-proofs owner write"  on storage.objects;
drop policy if exists "payment-proofs owner update" on storage.objects;

create policy "payment-proofs owner read" on storage.objects for select using (
  bucket_id = 'payment-proofs' and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "payment-proofs staff read" on storage.objects for select using (
  bucket_id = 'payment-proofs' and public.current_role_v() in ('admin','accountant')
);
create policy "payment-proofs owner write" on storage.objects for insert with check (
  bucket_id = 'payment-proofs' and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "payment-proofs owner update" on storage.objects for update using (
  bucket_id = 'payment-proofs' and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- override-media
drop policy if exists "override-media public read"  on storage.objects;
drop policy if exists "override-media admin write"  on storage.objects;
drop policy if exists "override-media admin delete" on storage.objects;

create policy "override-media public read"  on storage.objects for select using (bucket_id = 'override-media');
create policy "override-media admin write"  on storage.objects for insert with check (
  bucket_id = 'override-media' and public.current_role_v() = 'admin'
);
create policy "override-media admin delete" on storage.objects for delete using (
  bucket_id = 'override-media' and public.current_role_v() = 'admin'
);

-- fallback-media
drop policy if exists "fallback-media public read"  on storage.objects;
drop policy if exists "fallback-media admin write"  on storage.objects;
drop policy if exists "fallback-media admin update" on storage.objects;
drop policy if exists "fallback-media admin delete" on storage.objects;

create policy "fallback-media public read" on storage.objects for select using (bucket_id = 'fallback-media');
create policy "fallback-media admin write" on storage.objects for insert with check (
  bucket_id = 'fallback-media' and auth.role() = 'authenticated'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "fallback-media admin update" on storage.objects for update using (
  bucket_id = 'fallback-media' and auth.role() = 'authenticated'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "fallback-media admin delete" on storage.objects for delete using (
  bucket_id = 'fallback-media' and auth.role() = 'authenticated'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);


-- ============================================================================
-- GRANT EXECUTE ON RPCs
-- ============================================================================
grant execute on function public.quote_price(uuid, public.ad_duration, int, date, date, int[])                      to authenticated;
grant execute on function public.count_scheduled_days(date, date, int[])                                             to authenticated, anon;
grant execute on function public.location_daily_availability(uuid, date, date)                                       to authenticated, anon;
grant execute on function public.create_booking_atomic(uuid, uuid, public.ad_duration, int, date, date, int[], uuid) to authenticated;
grant execute on function public.create_campaign_atomic(uuid, uuid[], public.ad_duration, int, date, date, int[], uuid) to authenticated;
grant execute on function public.create_campaign_atomic_v2(uuid, jsonb, public.ad_duration, date, date, int[], uuid) to authenticated;
grant execute on function public.create_campaign_atomic_v3(uuid, jsonb, public.ad_duration, uuid)                    to authenticated;
grant execute on function public.submit_campaign_payment(uuid, numeric, text, text, text, text)                      to authenticated;
grant execute on function public.submit_booking_payment(uuid, numeric, text, text, text, text)                       to authenticated;
grant execute on function public.approve_payment(uuid)                                                               to authenticated;
grant execute on function public.reject_payment(uuid, text)                                                          to authenticated;
grant execute on function public.player_feed(uuid)                                                                   to authenticated, anon;
grant execute on function public.device_slot_usage(uuid, date)                                                       to authenticated, anon;
grant execute on function public.generate_slot_assignments(uuid, date)                                               to authenticated, anon;
grant execute on function public.player_slots(uuid, date)                                                            to authenticated, anon;
grant execute on function public.regenerate_device_token(uuid)                                                       to authenticated;
grant execute on function public.regenerate_pairing_code(uuid)                                                       to authenticated;
grant execute on function public.pair_device(text)                                                                   to anon, authenticated;
grant execute on function public.record_failed_pair_attempt(text)                                                    to anon, authenticated;
grant execute on function public.admin_suspend_booking(uuid, text)                                                   to authenticated;
grant execute on function public.admin_reactivate_booking(uuid)                                                       to authenticated;
grant execute on function public.admin_update_booking_dates(jsonb)                                                   to authenticated;
grant execute on function public.admin_change_booking_dates(jsonb)                                                  to authenticated;
grant execute on function public.mark_notification_read(uuid)                                                          to authenticated;
grant execute on function public.get_customer_notifications(int, int)                                              to authenticated;
grant execute on function public.mark_completed_bookings()                                                           to authenticated;

-- Table grants
grant select on public.packages         to authenticated, anon;
grant select on public.locations        to authenticated, anon;
grant select on public.payment_settings to anon, authenticated;
grant insert, update, delete on public.payment_settings to authenticated;
grant select on public.contact_settings to anon, authenticated;
grant insert, update, delete on public.contact_settings to authenticated;
grant select on public.system_overrides to anon, authenticated;
grant insert, update, delete on public.system_overrides to authenticated;
grant select on public.fallback_content to anon, authenticated;
grant insert, update, delete on public.fallback_content to authenticated;
grant select on public.campaigns        to authenticated;
grant insert, update on public.campaigns to authenticated;


-- ============================================================================
-- DEFAULT SEED DATA
-- ============================================================================

-- Packages
insert into public.packages (name, description, base_slots_per_day, allows_15s, allows_30s, allows_60s, sort_order)
values
  ('Basic',       'Entry-level exposure. 15s or 30s slots.',        2,  true, true, false, 1),
  ('Standard',    'More daily plays. 15s or 30s slots.',            4,  true, true, false, 2),
  ('Premium',     'High-frequency daily coverage. 15s or 30s.',     8,  true, true, false, 3),
  ('Pro Premium', 'Maximum impact — includes 60-second slots.',    12,  true, true, true,  4)
on conflict do nothing;

-- Payment settings
insert into public.payment_settings (method, label, instructions, is_enabled, sort_order)
values
  ('ecocash',       'EcoCash',       'Merchant code 12345 — send to +263 77 200 0000',                                   true, 1),
  ('onemoney',      'OneMoney',      'Merchant code 54321 — send to +263 71 300 0000',                                   true, 2),
  ('bank_transfer', 'Bank Transfer', 'Acc. 01234567 · Stanbic · Branch: Harare CBD · Ref: your booking ID',              true, 3),
  ('cash',          'Cash Deposit',  'Visit our CBD office with your booking ID. Open Mon–Fri 08:00–17:00.',              true, 4),
  ('other',         'Other',         'Attach your reference or proof in the notes field below.',                          true, 5)
on conflict (method) do nothing;

-- Contact settings
insert into public.contact_settings (key, label, value, description, is_public, sort_order)
values
  ('support_phone',     'Support Phone Number',     '+263 772 123 456', 'Main support phone shown to customers when payment is under review or ads are suspended', true, 1),
  ('support_whatsapp',  'Support WhatsApp',       '+263 772 123 456', 'WhatsApp number for customer support',                                                  true, 2),
  ('support_email',     'Support Email',            'support@brainstake.signage.tech', 'Support email address shown to customers',                                              true, 3),
  ('review_message',    'Payment Review Message',   'Reviews typically take 24-48 hours. If not approved within 48 hours, please call our support line.', 'Message shown when payment is under review', true, 4),
  ('suspended_message', 'Suspended Ad Message',   'Your ad has been suspended. Please contact support for assistance.', 'Message shown when ad is suspended by admin', true, 5)
on conflict (key) do nothing;


-- ============================================================================
-- DONE
-- ============================================================================
-- Set your first admin account:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
