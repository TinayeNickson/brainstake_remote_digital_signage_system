-- ============================================================================
-- Migration v10 — Per-Location Scheduling
--
-- create_campaign_atomic_v3: each location can have its own
--   start_date, end_date, days_of_week, slots_per_day.
--
-- p_location_configs is a JSONB array of objects:
--   [
--     {
--       "location_id": "uuid",
--       "slots_per_day": 3,
--       "start_date": "2025-06-01",
--       "end_date": "2025-06-30",
--       "days_of_week": [1,2,3,4,5]
--     },
--     ...
--   ]
--
-- The campaign header stores:
--   start_date  = MIN of all location start dates
--   end_date    = MAX of all location end dates
--   days_of_week = union of all location dow arrays
--   slots_per_day = MAX of all location slot values
--   scheduled_days_count = MAX of individual counts (for display)
--
-- Each booking row stores its own independent schedule.
-- ============================================================================

drop function if exists public.create_campaign_atomic_v3(uuid, jsonb, ad_duration, uuid) cascade;

create or replace function public.create_campaign_atomic_v3(
  p_ad_id             uuid,
  p_location_configs  jsonb,   -- array of per-location config objects
  p_duration          ad_duration,
  p_package_id        uuid default null
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer    uuid := auth.uid();
  v_ad_title    text;
  v_campaign    public.campaigns;
  v_cfg         jsonb;
  v_loc_id      uuid;
  v_slots       int;
  v_start       date;
  v_end         date;
  v_dow         int[];
  v_days        int;
  v_price       numeric;
  v_max_slots   int;
  v_check_date  date;
  v_existing    int;
  v_total       numeric := 0;

  -- campaign header aggregates
  v_hdr_start   date;
  v_hdr_end     date;
  v_hdr_dow     int[];
  v_hdr_slots   int := 0;
  v_hdr_days    int := 0;
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

  if p_location_configs is null
     or jsonb_typeof(p_location_configs) <> 'array'
     or jsonb_array_length(p_location_configs) = 0 then
    raise exception 'p_location_configs must be a non-empty JSON array';
  end if;

  -- ── Pass 1: validate all configs and compute campaign header values ──
  for v_cfg in select jsonb_array_elements(p_location_configs) loop
    v_loc_id := (v_cfg->>'location_id')::uuid;
    v_slots  := (v_cfg->>'slots_per_day')::int;
    v_start  := (v_cfg->>'start_date')::date;
    v_end    := (v_cfg->>'end_date')::date;

    -- Parse days_of_week JSON array -> int[]
    select array_agg(el::int)
    into v_dow
    from jsonb_array_elements_text(v_cfg->'days_of_week') el;

    if v_loc_id is null then
      raise exception 'location_id is required in each config';
    end if;
    if v_slots < 1 then
      raise exception 'slots_per_day must be >= 1 for location %', v_loc_id;
    end if;
    if v_end < v_start then
      raise exception 'end_date must be >= start_date for location %', v_loc_id;
    end if;
    if v_dow is null or array_length(v_dow, 1) = 0 then
      raise exception 'days_of_week must not be empty for location %', v_loc_id;
    end if;

    v_days := public.count_scheduled_days(v_start, v_end, v_dow);
    if v_days <= 0 then
      raise exception 'No valid scheduled days for location %', v_loc_id;
    end if;

    -- Accumulate header aggregates
    if v_hdr_start is null or v_start < v_hdr_start then v_hdr_start := v_start; end if;
    if v_hdr_end   is null or v_end   > v_hdr_end   then v_hdr_end   := v_end;   end if;
    if v_slots > v_hdr_slots then v_hdr_slots := v_slots; end if;
    if v_days  > v_hdr_days  then v_hdr_days  := v_days;  end if;

    -- Merge days_of_week union
    if v_hdr_dow is null then
      v_hdr_dow := v_dow;
    else
      select array_agg(distinct d order by d)
      into v_hdr_dow
      from unnest(v_hdr_dow || v_dow) d;
    end if;
  end loop;

  -- ── Create parent campaign ────────────────────────────────────────────
  insert into public.campaigns (
    customer_id, ad_id, package_id, title, duration, slots_per_day,
    start_date, end_date, days_of_week, scheduled_days_count, total_price
  ) values (
    v_customer, p_ad_id, p_package_id, v_ad_title, p_duration, v_hdr_slots,
    v_hdr_start, v_hdr_end, v_hdr_dow, v_hdr_days, 0
  )
  returning * into v_campaign;

  -- ── Pass 2: capacity checks + insert one booking per location ────────
  for v_cfg in select jsonb_array_elements(p_location_configs) loop
    v_loc_id := (v_cfg->>'location_id')::uuid;
    v_slots  := (v_cfg->>'slots_per_day')::int;
    v_start  := (v_cfg->>'start_date')::date;
    v_end    := (v_cfg->>'end_date')::date;

    select array_agg(el::int)
    into v_dow
    from jsonb_array_elements_text(v_cfg->'days_of_week') el;

    v_days := public.count_scheduled_days(v_start, v_end, v_dow);

    -- Lock location row; fetch price + max capacity
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
    for v_check_date in
      select d::date
      from generate_series(v_start, v_end, interval '1 day') d
      where extract(dow from d)::int = any(v_dow)
    loop
      select coalesce(sum(bd.slots), 0)
      into v_existing
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

    -- Insert booking with its own per-location schedule
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

    -- Expand booking_dates
    insert into public.booking_dates (booking_id, location_id, play_date, slots)
    select
      (select id from public.bookings
       where campaign_id = v_campaign.id and location_id = v_loc_id
       order by created_at desc limit 1),
      v_loc_id,
      d::date,
      v_slots
    from generate_series(v_start, v_end, interval '1 day') d
    where extract(dow from d)::int = any(v_dow);

    v_total := v_total + (v_price * v_slots * v_days);
  end loop;

  -- Update campaign total
  update public.campaigns
     set total_price = v_total::numeric(12,2)
   where id = v_campaign.id
  returning * into v_campaign;

  return v_campaign;
end;
$$;

grant execute on function public.create_campaign_atomic_v3(uuid, jsonb, ad_duration, uuid)
  to authenticated;
