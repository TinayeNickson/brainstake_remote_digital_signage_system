-- ============================================================================
-- Migration v9 — Per-Location Slot Allocation
--
-- Replaces the single p_slots_per_day parameter in create_campaign_atomic
-- with a JSONB map: { "location_uuid": slots_per_day, ... }
--
-- Backward-compatible: old single-value path kept as create_campaign_atomic
-- (with p_slots_per_day still works for legacy callers).
-- New path: create_campaign_atomic_v2 (used by the updated UI).
--
-- campaigns.slots_per_day becomes the MAX of all location slot values
-- (kept for display / slot-engine reference).
-- ============================================================================

-- Drop old v2 if exists (idempotent)
drop function if exists public.create_campaign_atomic_v2(uuid, jsonb, ad_duration, date, date, int[], uuid) cascade;

create or replace function public.create_campaign_atomic_v2(
  p_ad_id          uuid,
  -- Map of location_id (uuid text key) -> slots_per_day (int value)
  -- e.g. '{"abc-123": 3, "def-456": 5}'
  p_location_slots  jsonb,
  p_duration        ad_duration,
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
  v_customer    uuid := auth.uid();
  v_days        int;
  v_campaign    public.campaigns;
  v_loc_id      uuid;
  v_slots       int;
  v_price       numeric;
  v_max_slots   int;
  v_date        date;
  v_existing    int;
  v_total       numeric := 0;
  v_ad_title    text;
  v_max_spd     int := 0;   -- max slots across all locations (for campaign row)
  v_loc_key     text;
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

  if p_location_slots is null or jsonb_typeof(p_location_slots) <> 'object'
     or jsonb_object_keys(p_location_slots) is null then
    raise exception 'p_location_slots must be a non-empty JSON object';
  end if;

  if p_end < p_start then
    raise exception 'end_date must be on or after start_date';
  end if;

  v_days := public.count_scheduled_days(p_start, p_end, p_dow);
  if v_days <= 0 then
    raise exception 'No valid scheduled days in the selected range';
  end if;

  -- Determine max slots_per_day across locations (for campaign header)
  for v_loc_key in select jsonb_object_keys(p_location_slots) loop
    v_slots := (p_location_slots ->> v_loc_key)::int;
    if v_slots > v_max_spd then v_max_spd := v_slots; end if;
  end loop;

  -- Create parent campaign
  insert into public.campaigns (
    customer_id, ad_id, package_id, title, duration, slots_per_day,
    start_date, end_date, days_of_week, scheduled_days_count, total_price
  ) values (
    v_customer, p_ad_id, p_package_id, v_ad_title, p_duration, v_max_spd,
    p_start, p_end, p_dow, v_days, 0
  )
  returning * into v_campaign;

  -- For each location entry in the JSON map
  for v_loc_key in select jsonb_object_keys(p_location_slots) loop
    v_loc_id := v_loc_key::uuid;
    v_slots  := (p_location_slots ->> v_loc_key)::int;

    if v_slots < 1 then
      raise exception 'slots_per_day must be >= 1 for location %', v_loc_id;
    end if;

    -- Lock location row; get price and max capacity
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

    if v_slots > v_max_slots then
      raise exception 'slots_per_day (%) exceeds max (%) for location %',
        v_slots, v_max_slots, v_loc_id;
    end if;

    -- Per-date availability check
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

      if v_existing + v_slots > v_max_slots then
        raise exception 'No availability on % at location %: % of % slots taken',
          v_date, v_loc_id, v_existing, v_max_slots;
      end if;
    end loop;

    -- Insert booking for this location with its own slots_per_day
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

    -- Expand booking_dates with per-location slot count
    insert into public.booking_dates (booking_id, location_id, play_date, slots)
    select
      (select id from public.bookings
       where campaign_id = v_campaign.id and location_id = v_loc_id
       order by created_at desc limit 1),
      v_loc_id,
      d::date,
      v_slots
    from generate_series(p_start, p_end, interval '1 day') d
    where extract(dow from d)::int = any(p_dow);

    v_total := v_total + (v_price * v_slots * v_days);

  end loop;

  -- Update campaign total_price
  update public.campaigns
     set total_price = v_total::numeric(12,2)
   where id = v_campaign.id
  returning * into v_campaign;

  return v_campaign;
end;
$$;

grant execute on function public.create_campaign_atomic_v2(uuid, jsonb, ad_duration, date, date, int[], uuid)
  to authenticated;
