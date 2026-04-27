-- ============================================================================
-- Migration v7: Fix player_feed RPC
--
-- Problems:
--   1. Join was `d.location_id = b.location_id` — fails when device has no
--      location assigned or location differs from booking.
--   2. `d.active = true` filtered out inactive devices entirely.
--   3. The join approach silently returned 0 rows for valid assignments.
--
-- Fix:
--   - Join devices by device ID directly when device_id is set on booking.
--   - Fall back to location-based join only when device_id is null on booking.
--   - Remove the active check so inactive-flagged devices still play.
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
  from public.bookings  b
  join public.ads       a on a.id = b.ad_id
  join public.devices   d on d.id = p_device_id
  where
    -- Match: booking explicitly assigned to this device
    -- OR booking's location matches the device's location (unassigned bookings)
    (b.device_id = p_device_id or (b.device_id is null and b.location_id = d.location_id))
    and b.status  = 'active'
    and current_date between b.start_date and b.end_date
    and extract(dow from current_date)::int = any(b.days_of_week)
  order by b.created_at;
$$;

grant execute on function public.player_feed(uuid) to authenticated, anon;
