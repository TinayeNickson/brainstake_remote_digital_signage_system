-- ============================================================================
-- Migration v8: Smart Slot Distribution Engine
--
-- Creates:
--   1. ad_slot_assignments table
--   2. generate_slot_assignments(p_device_id, p_date) function
--      - Distributes each booking's slots_per_day evenly across
--        the device's max_slots_per_day using interval spacing.
--      - Resolves collisions by shifting to the next free slot.
--      - Maintains fairness across multiple customers/bookings.
--   3. player_slots(p_device_id, p_date) function
--      - Returns today's ordered slot list for the player.
-- ============================================================================

-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.ad_slot_assignments (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  device_id      uuid not null references public.devices(id)  on delete cascade,
  slot_index     int  not null check (slot_index >= 0),
  scheduled_date date not null,
  created_at     timestamptz not null default now(),
  unique (device_id, slot_index, scheduled_date)
);

create index if not exists asa_device_date_idx
  on public.ad_slot_assignments (device_id, scheduled_date);
create index if not exists asa_booking_idx
  on public.ad_slot_assignments (booking_id);

-- RLS: admin full access; anon/authenticated can read (for player)
alter table public.ad_slot_assignments enable row level security;

drop policy if exists asa_admin_all  on public.ad_slot_assignments;
drop policy if exists asa_read       on public.ad_slot_assignments;

create policy asa_admin_all on public.ad_slot_assignments
  for all using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

create policy asa_read on public.ad_slot_assignments
  for select using (true);


-- ── 2. Generator function ────────────────────────────────────────────────────
create or replace function public.generate_slot_assignments(
  p_device_id uuid,
  p_date      date default current_date
)
returns int        -- returns number of slots assigned
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_slots   int;
  v_occupied    boolean[];
  v_booking     record;
  v_interval    int;
  v_pos         int;
  v_placed      int;
  v_total       int := 0;
  v_i           int;
begin
  -- Get device capacity
  select max_slots_per_day into v_max_slots
  from public.devices
  where id = p_device_id;

  if v_max_slots is null or v_max_slots < 1 then
    raise exception 'Device not found or has no capacity';
  end if;

  -- Initialise occupied array (0-indexed, length = max_slots)
  v_occupied := array_fill(false, array[v_max_slots]);

  -- Clear existing assignments for this device/date
  delete from public.ad_slot_assignments
  where device_id = p_device_id
    and scheduled_date = p_date;

  -- Iterate over active bookings for this device on this date,
  -- sorted by created_at so first-come gets best slots
  for v_booking in
    select
      b.id           as booking_id,
      b.slots_per_day,
      b.days_of_week
    from public.bookings b
    where
      (b.device_id = p_device_id
        or (b.device_id is null
            and b.location_id = (select location_id from devices where id = p_device_id)))
      and b.status = 'active'
      and p_date between b.start_date and b.end_date
      and extract(dow from p_date)::int = any(b.days_of_week)
    order by b.created_at
  loop
    -- Clamp slots to remaining capacity
    v_placed   := least(v_booking.slots_per_day, v_max_slots);
    v_interval := greatest(1, v_max_slots / v_placed);

    for v_i in 0 .. v_placed - 1 loop
      -- Ideal position
      v_pos := least((v_i * v_interval), v_max_slots - 1);

      -- Shift forward to next free slot (wrap-around aware)
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


-- ── 3. Player slots reader ───────────────────────────────────────────────────
create or replace function public.player_slots(
  p_device_id uuid,
  p_date      date default current_date
)
returns table (
  slot_index     int,
  booking_id     uuid,
  ad_id          uuid,
  title          text,
  format         ad_format,
  duration       ad_duration,
  media_url      text,
  display_mode   text,
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
