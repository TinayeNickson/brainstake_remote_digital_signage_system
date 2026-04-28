-- Migration v16: Fix approve_payment to handle campaign payments correctly
-- Issue: UPDATE ... RETURNING fails when updating multiple bookings in a campaign

-- ============================================================================
-- Fix approve_payment: remove RETURNING from multi-row campaign UPDATE
-- ============================================================================
create or replace function public.approve_payment(p_payment_id uuid)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_role     user_role;
  v_payment  public.payments;
  v_booking  public.bookings;
  v_campaign public.campaigns;
  v_receipt  public.receipts;
  v_num      text;
  v_cust     uuid;
  v_amount   numeric;
begin
  select role into v_role from public.profiles where id = v_user;
  if v_role not in ('accountant', 'admin') then
    raise exception 'Only accountants or admins can approve payments';
  end if;

  update public.payments
     set status      = 'approved',
         reviewed_at = now(),
         reviewed_by = v_user
   where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Payment not found or not pending';
  end if;

  if v_payment.campaign_id is not null then
    -- campaign payment: activate ALL bookings in the campaign (no RETURNING - could be multiple rows)
    update public.bookings
       set status      = 'active',
           approved_at = now(),
           approved_by = v_user
     where campaign_id = v_payment.campaign_id;

    -- Get campaign details separately
    select customer_id, total_price into v_cust, v_amount
    from public.campaigns where id = v_payment.campaign_id;

    v_num := public.generate_receipt_number();
    insert into public.receipts (
      receipt_number, booking_id, payment_id, customer_id, amount
    ) values (
      v_num,
      -- point receipt at the first booking in the campaign
      (select id from public.bookings where campaign_id = v_payment.campaign_id order by created_at limit 1),
      v_payment.id, v_cust, v_payment.amount
    )
    returning * into v_receipt;

  else
    -- single-booking payment (legacy path)
    update public.bookings
       set status      = 'active',
           approved_at = now(),
           approved_by = v_user
     where id = v_payment.booking_id
    returning * into v_booking;

    v_num := public.generate_receipt_number();
    insert into public.receipts (
      receipt_number, booking_id, payment_id, customer_id, amount
    ) values (
      v_num, v_booking.id, v_payment.id, v_booking.customer_id, v_payment.amount
    )
    returning * into v_receipt;
  end if;

  return v_receipt;
end;
$$;

grant execute on function public.approve_payment(uuid) to authenticated;
