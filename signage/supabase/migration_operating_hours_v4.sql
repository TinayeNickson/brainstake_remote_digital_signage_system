-- ============================================================================
-- MIGRATION v4: Screen Operating Hours, Fallback Content, Outside-Hours Ads
-- Run in Supabase SQL Editor (idempotent).
-- ============================================================================


-- ============================================================================
-- 1. DEVICES — add operating hours
-- ============================================================================
alter table public.devices
  add column if not exists start_time time not null default '08:00',
  add column if not exists end_time   time not null default '22:00';


-- ============================================================================
-- 2. FALLBACK CONTENT — shown when screen is outside operating hours
-- ============================================================================
create table if not exists public.fallback_content (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  content_url  text        not null,
  content_type text        not null default 'image',   -- 'image' | 'video'
  is_active    boolean     not null default true,
  sort_order   int         not null default 0,
  created_by   uuid        references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.fallback_content enable row level security;

drop policy if exists fallback_public_read  on public.fallback_content;
drop policy if exists fallback_admin_write  on public.fallback_content;

-- Player (anon) needs to read fallback items
create policy fallback_public_read on public.fallback_content
  for select using (true);

create policy fallback_admin_write on public.fallback_content
  for all using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

grant select on public.fallback_content to anon, authenticated;
grant insert, update, delete on public.fallback_content to authenticated;

-- Storage bucket for fallback media
insert into storage.buckets (id, name, public)
  values ('fallback-media', 'fallback-media', true)
  on conflict (id) do nothing;

drop policy if exists "fallback-media public read"   on storage.objects;
drop policy if exists "fallback-media admin write"   on storage.objects;
drop policy if exists "fallback-media admin delete"  on storage.objects;

create policy "fallback-media public read" on storage.objects
  for select using (bucket_id = 'fallback-media');

create policy "fallback-media admin write" on storage.objects
  for insert with check (
    bucket_id = 'fallback-media'
    and public.current_role_v() = 'admin'
  );

create policy "fallback-media admin delete" on storage.objects
  for delete using (
    bucket_id = 'fallback-media'
    and public.current_role_v() = 'admin'
  );


-- ============================================================================
-- 3. BOOKINGS — optional outside-hours flag
-- ============================================================================
alter table public.bookings
  add column if not exists run_outside_hours boolean not null default false;


-- ============================================================================
-- 4. UPDATED player_feed RPC
--    Now returns run_outside_hours so the API can filter by operating hours.
--    Must drop first because return type changes.
-- ============================================================================
drop function if exists public.player_feed(uuid) cascade;

create function public.player_feed(p_device_id uuid)
returns table (
  booking_id         uuid,
  ad_id              uuid,
  title              text,
  format             ad_format,
  duration           ad_duration,
  media_url          text,
  slots_per_day      int,
  display_mode       text,
  run_outside_hours  boolean
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
    d.display_mode::text,
    b.run_outside_hours
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

grant execute on function public.player_feed(uuid) to authenticated, anon;
