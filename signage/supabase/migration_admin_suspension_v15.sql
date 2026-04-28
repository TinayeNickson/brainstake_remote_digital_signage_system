-- Migration v15: Admin suspension, preview, and notifications system
-- 1. Add 'suspended' to booking_status enum
-- 2. Create notifications table for customer communications
-- 3. Add suspend_reason and suspended_at fields to bookings
-- 4. Add admin update_booking_dates RPC

-- ============================================================================
-- 1. Extend booking_status enum
-- ============================================================================
alter type public.booking_status add value if not exists 'suspended';

-- ============================================================================
-- 2. Notifications table for customer communications
-- ============================================================================
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  type            text not null check (type in ('booking_suspended', 'booking_date_changed', 'booking_approved', 'booking_rejected', 'payment_received', 'general')),
  title           text not null,
  message         text not null,
  booking_id      uuid references public.bookings(id) on delete set null,
  campaign_id     uuid references public.campaigns(id) on delete set null,
  metadata        jsonb default '{}',
  is_read         boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);

-- RLS on notifications
alter table public.notifications enable row level security;

drop policy if exists notif_customer_read on public.notifications;
drop policy if exists notif_admin_all on public.notifications;

create policy notif_customer_read on public.notifications
  for select using (customer_id = auth.uid());

create policy notif_admin_all on public.notifications
  for all using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- Index for customer inbox
create index if not exists idx_notifications_customer_unread
  on public.notifications (customer_id, is_read, created_at desc);

-- ============================================================================
-- 3. Add suspension fields to bookings
-- ============================================================================
alter table public.bookings
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspend_reason text,
  add column if not exists original_start_date date,
  add column if not exists original_end_date date;

-- ============================================================================
-- 4. Admin suspend booking RPC
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
  -- Verify admin
  if public.current_role_v() != 'admin' then
    raise exception 'Only admins can suspend bookings';
  end if;

  -- Get booking and customer
  select * into v_booking
  from public.bookings
  where id = p_booking_id;
  
  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  
  v_customer_id := v_booking.customer_id;

  -- Update booking status
  update public.bookings
  set status = 'suspended',
      suspended_at = now(),
      suspended_by = v_admin_id,
      suspend_reason = p_reason
  where id = p_booking_id
  returning * into v_booking;

  -- Create notification
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

-- ============================================================================
-- 5. Admin reactivate suspended booking RPC
-- ============================================================================
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
  -- Verify admin
  if public.current_role_v() != 'admin' then
    raise exception 'Only admins can reactivate bookings';
  end if;

  -- Get booking
  select * into v_booking
  from public.bookings
  where id = p_booking_id;
  
  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  
  v_customer_id := v_booking.customer_id;

  -- Update booking status back to active
  update public.bookings
  set status = 'active',
      suspended_at = null,
      suspended_by = null,
      suspend_reason = null
  where id = p_booking_id
  returning * into v_booking;

  -- Create notification
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

-- ============================================================================
-- 6. Admin update booking dates RPC (JSON params version to avoid ordering issues)
-- ============================================================================
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

  -- Validate dates
  if v_start_date is null or v_end_date is null then
    raise exception 'Start date and end date are required';
  end if;

  if v_end_date < v_start_date then
    raise exception 'End date must be after start date';
  end if;

  -- Get current booking
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

  -- Update bookings table
  update public.bookings
  set original_start_date = coalesce(original_start_date, start_date),
      original_end_date = coalesce(original_end_date, end_date),
      start_date = v_start_date,
      end_date = v_end_date
  where id = v_booking_id
  returning * into v_booking;

  -- Sync booking_dates table: delete old dates outside new range
  delete from public.booking_dates
  where booking_id = v_booking_id
    and (play_date < v_start_date or play_date > v_end_date);

  -- Sync booking_dates table: insert new dates not already present
  insert into public.booking_dates (booking_id, location_id, play_date, slots)
  select v_booking_id, v_location_id, d::date, v_slots_per_day
  from generate_series(v_start_date, v_end_date, interval '1 day') d
  where d::date not in (
    select play_date from public.booking_dates where booking_id = v_booking_id
  );

  -- Build notification message
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

-- ============================================================================
-- 7. Mark notification as read RPC
-- ============================================================================
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

-- ============================================================================
-- 8. Get customer notifications RPC
-- ============================================================================
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
as $$
  select id, type, title, message, booking_id, campaign_id, metadata, is_read, created_at
  from public.notifications
  where customer_id = auth.uid()
  order by created_at desc
  limit p_limit offset p_offset;
$$;

-- ============================================================================
-- Grants
-- ============================================================================
grant execute on function public.admin_suspend_booking(uuid, text) to authenticated;
grant execute on function public.admin_reactivate_booking(uuid) to authenticated;
grant execute on function public.admin_update_booking_dates(jsonb) to authenticated;
-- Note: signature is (jsonb params) with keys: booking_id, start_date, end_date, reason
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.get_customer_notifications(int, int) to authenticated;
