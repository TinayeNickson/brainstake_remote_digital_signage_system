-- ============================================================================
-- Migration v11 — Slot Engine: per-location schedule awareness
--
-- Updates generate_slot_assignments and player_slots to use booking_dates
-- as the canonical source of truth for which bookings are active on a given
-- date at a given device/location. This makes both functions automatically
-- correct for v1/v2/v3 bookings regardless of how their schedules were set.
--
-- player_feed is already correct: it checks
--   current_date between b.start_date and b.end_date
--   AND extract(dow from current_date) = any(b.days_of_week)
-- which maps directly to what create_campaign_atomic_v3 writes into each
-- booking row. No change needed there.
-- ============================================================================


-- ── Updated generate_slot_assignments ─────────────────────────────────────────
-- Change: booking eligibility for a date is determined by booking_dates
-- (play_date = p_date AND location_id = device's location_id) instead of
-- manually re-evaluating start_date / end_date / days_of_week.
-- This is authoritative and covers all three RPC versions.

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
  -- Get device capacity and location
  select max_slots_per_day, location_id
  into v_max_slots, v_location_id
  from public.devices
  where id = p_device_id;

  if v_max_slots is null or v_max_slots < 1 then
    raise exception 'Device not found or has no capacity';
  end if;

  -- Initialise occupied array (0-indexed)
  v_occupied := array_fill(false, array[v_max_slots]);

  -- Clear existing assignments for this device/date
  delete from public.ad_slot_assignments
  where device_id      = p_device_id
    and scheduled_date = p_date;

  -- Iterate over active bookings that have a booking_dates row for this date
  -- at this device's location. booking_dates.slots carries the per-booking
  -- slot count written by create_campaign_atomic (all versions).
  -- Order by created_at so first-come gets best (most evenly spread) slots.
  for v_booking in
    select
      b.id            as booking_id,
      bd.slots        as slots_per_day
    from public.booking_dates bd
    join public.bookings b on b.id = bd.booking_id
    where
      bd.location_id   = v_location_id
      and bd.play_date = p_date
      and b.status     = 'active'
      -- also honour explicit device_id assignment when present
      and (b.device_id is null or b.device_id = p_device_id)
    order by b.created_at
  loop
    v_placed   := least(v_booking.slots_per_day, v_max_slots);
    v_interval := greatest(1, v_max_slots / v_placed);

    for v_i in 0 .. v_placed - 1 loop
      v_pos := least((v_i * v_interval), v_max_slots - 1);

      declare
        v_attempts int := 0;
      begin
        while v_occupied[v_pos + 1] and v_attempts < v_max_slots loop
          v_pos      := (v_pos + 1) % v_max_slots;
          v_attempts := v_attempts + 1;
        end loop;

        if not v_occupied[v_pos + 1] then
          v_occupied[v_pos + 1] := true;

          insert into public.ad_slot_assignments
            (booking_id, device_id, slot_index, scheduled_date)
          values
            (v_booking.booking_id, p_device_id, v_pos, p_date)
          on conflict (device_id, slot_index, scheduled_date) do nothing;

          v_total := v_total + 1;
        end if;
      end;
    end loop;
  end loop;

  return v_total;
end;
$$;

grant execute on function public.generate_slot_assignments(uuid, date)
  to authenticated, anon;


-- ── Updated player_slots ───────────────────────────────────────────────────────
-- No logic change — just re-stated clearly with the same join structure.
-- Kept identical to v8 except the function is replaced (idempotent).

create or replace function public.player_slots(
  p_device_id uuid,
  p_date      date default current_date
)
returns table (
  slot_index        int,
  booking_id        uuid,
  ad_id             uuid,
  title             text,
  format            ad_format,
  duration          ad_duration,
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
    asa.slot_index,
    b.id,
    a.id,
    a.title,
    a.format,
    a.duration,
    a.media_url,
    d.display_mode::text,
    b.run_outside_hours
  from public.ad_slot_assignments asa
  join public.bookings b on b.id = asa.booking_id
  join public.ads      a on a.id = b.ad_id
  join public.devices  d on d.id = asa.device_id
  where asa.device_id     = p_device_id
    and asa.scheduled_date = p_date
  order by asa.slot_index;
$$;

grant execute on function public.player_slots(uuid, date)
  to authenticated, anon;


-- ── Updated player_feed ────────────────────────────────────────────────────────
-- Switch to booking_dates join so the query is consistent with the slot engine
-- and correctly handles per-location schedules from all RPC versions.

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
    bd.slots,          -- per-booking slots for this specific date
    d.display_mode::text,
    b.run_outside_hours
  from public.booking_dates bd
  join public.bookings b  on b.id  = bd.booking_id
  join public.ads      a  on a.id  = b.ad_id
  join public.devices  d  on d.id  = p_device_id
  where
    bd.location_id = d.location_id
    and bd.play_date = current_date
    and b.status     = 'active'
    and (b.device_id is null or b.device_id = p_device_id)
  order by b.created_at;
$$;

grant execute on function public.player_feed(uuid) to authenticated, anon;
