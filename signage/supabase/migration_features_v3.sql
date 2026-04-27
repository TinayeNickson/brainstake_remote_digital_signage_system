-- ============================================================================
-- MIGRATION v3: Multi-slot devices, display transitions, emergency broadcast,
--               and billing identity hardening.
-- Run in Supabase SQL Editor (idempotent).
-- ============================================================================


-- ============================================================================
-- 1. PROFILES — add contact_person_name + make phone NOT NULL logic
-- ============================================================================
alter table public.profiles
  add column if not exists contact_person_name text;

-- phone was TEXT (nullable). We keep nullable at DB level but enforce in app.
-- Rename existing `phone` to `phone_number` via alias column for new code.
-- We add phone_number as a generated/alias; old `phone` column stays for compat.
alter table public.profiles
  add column if not exists phone_number text;

-- Back-fill phone_number from phone where missing
update public.profiles
  set phone_number = phone
  where phone_number is null and phone is not null;

-- Update the handle_new_user trigger to populate new columns
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


-- ============================================================================
-- 2. DEVICES — add max_slots_per_day + display_mode
-- ============================================================================
do $$ begin
  create type display_mode_enum as enum ('fade', 'slide', 'none', 'zoom');
exception when duplicate_object then null;
end $$;

alter table public.devices
  add column if not exists max_slots_per_day integer not null default 100
    check (max_slots_per_day > 0),
  add column if not exists display_mode display_mode_enum not null default 'fade';


-- ============================================================================
-- 3. SYSTEM_OVERRIDES — emergency broadcast table
-- ============================================================================
create table if not exists public.system_overrides (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  content_url  text not null,
  content_type text not null default 'image',   -- 'image' | 'video'
  message      text,                              -- optional text overlay
  is_active    boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  activated_at timestamptz,
  deactivated_at timestamptz
);

-- Only one override can be active at a time — enforced by partial unique index
create unique index if not exists system_overrides_single_active_idx
  on public.system_overrides (is_active)
  where is_active = true;

-- RLS
alter table public.system_overrides enable row level security;

drop policy if exists overrides_public_read  on public.system_overrides;
drop policy if exists overrides_admin_write  on public.system_overrides;

-- Player (anon/public) needs to read to check if override is active
create policy overrides_public_read on public.system_overrides
  for select using (true);

create policy overrides_admin_write on public.system_overrides
  for all using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- Storage bucket for override media
insert into storage.buckets (id, name, public)
  values ('override-media', 'override-media', true)
  on conflict (id) do nothing;

drop policy if exists "override-media public read"  on storage.objects;
drop policy if exists "override-media admin write"  on storage.objects;
drop policy if exists "override-media admin delete" on storage.objects;

create policy "override-media public read" on storage.objects
  for select using (bucket_id = 'override-media');

create policy "override-media admin write" on storage.objects
  for insert with check (
    bucket_id = 'override-media'
    and public.current_role_v() = 'admin'
  );

create policy "override-media admin delete" on storage.objects
  for delete using (
    bucket_id = 'override-media'
    and public.current_role_v() = 'admin'
  );


-- ============================================================================
-- 4. UPDATED player_feed — now returns display_mode + checks device capacity
-- ============================================================================
-- Must drop first: CREATE OR REPLACE cannot change the return type signature.
drop function if exists public.player_feed(uuid) cascade;

create or replace function public.player_feed(p_device_id uuid)
returns table (
  booking_id    uuid,
  ad_id         uuid,
  title         text,
  format        ad_format,
  duration      ad_duration,
  media_url     text,
  slots_per_day int,
  display_mode  text
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
    b.slots_per_day,
    d.display_mode::text
  from public.bookings b
  join public.ads     a on a.id = b.ad_id
  join public.devices d on d.location_id = b.location_id
  where d.id      = p_device_id
    and d.active  = true
    and b.status  = 'active'
    and current_date between b.start_date and b.end_date
    and extract(dow from current_date)::int = any(b.days_of_week)
    and (b.device_id is null or b.device_id = d.id)
  order by b.created_at;
$$;

-- Revoke & re-grant (signature unchanged)
grant execute on function public.player_feed(uuid) to authenticated, anon;


-- ============================================================================
-- 5. DEVICE SLOT AVAILABILITY helper
-- ============================================================================
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
    from public.devices d
    where d.id = p_device_id and d.active = true
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
  select
    used.total,
    dev.max_slots_per_day,
    (dev.max_slots_per_day - used.total)::int
  from used cross join dev;
$$;

grant execute on function public.device_slot_usage(uuid, date) to authenticated, anon;


-- ============================================================================
-- 6. PERMISSIONS for system_overrides
-- ============================================================================
grant select on public.system_overrides to anon, authenticated;
grant insert, update, delete on public.system_overrides to authenticated;
