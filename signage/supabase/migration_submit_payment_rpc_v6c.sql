-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v6c — submit_campaign_payment RPC
--
-- The bookings UPDATE RLS only allows admins to update booking status.
-- Calling UPDATE from the customer-side API is silently blocked.
-- This RPC runs as SECURITY DEFINER (superuser context) so it bypasses RLS
-- and can safely set status = 'payment_submitted' after inserting the payment.
--
-- Run in Supabase SQL editor. Safe to re-run (idempotent via CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════════

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
  v_campaign  public.campaigns;
  v_payment   public.payments;
begin
  -- Verify campaign belongs to the calling user
  select * into v_campaign
  from public.campaigns
  where id = p_campaign_id
    and customer_id = auth.uid();

  if not found then
    raise exception 'Campaign not found or access denied';
  end if;

  -- Remove any prior pending payment (re-submission after rejection)
  delete from public.payments
  where campaign_id = p_campaign_id;

  -- Insert the new payment
  insert into public.payments (
    campaign_id, booking_id, amount, method, reference,
    proof_path, proof_url, status, submitted_at
  ) values (
    p_campaign_id, null, p_amount, p_method::payment_method, p_reference,
    p_proof_path, p_proof_url, 'pending', now()
  )
  returning * into v_payment;

  -- Mark ALL bookings in the campaign as payment_submitted
  update public.bookings
     set status = 'payment_submitted'
   where campaign_id = p_campaign_id;

  return v_payment;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.submit_campaign_payment(uuid, numeric, text, text, text, text)
  to authenticated;


-- ── Single-booking payment RPC (legacy path) ─────────────────────────────────
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
  v_booking  public.bookings;
  v_payment  public.payments;
begin
  -- Verify booking belongs to calling user and is in a payable state
  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and customer_id = auth.uid()
    and status in ('awaiting_payment', 'rejected');

  if not found then
    raise exception 'Booking not found, not yours, or not in a payable state';
  end if;

  -- Remove any prior payment (re-submission after rejection)
  delete from public.payments
  where booking_id = p_booking_id;

  -- Insert payment
  insert into public.payments (
    booking_id, campaign_id, amount, method, reference,
    proof_path, proof_url, status, submitted_at
  ) values (
    p_booking_id, null, p_amount, p_method::payment_method, p_reference,
    p_proof_path, p_proof_url, 'pending', now()
  )
  returning * into v_payment;

  -- Update booking status
  update public.bookings
     set status = 'payment_submitted'
   where id = p_booking_id;

  return v_payment;
end;
$$;

grant execute on function public.submit_booking_payment(uuid, numeric, text, text, text, text)
  to authenticated;
