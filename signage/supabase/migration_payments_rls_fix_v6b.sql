-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration v6b — Fix payments RLS for campaign payments
--
-- The original schema.sql payments policies only allow inserts where
-- booking_id is owned by the caller.  Campaign payments have booking_id = NULL
-- and campaign_id set instead, so the original policy blocks them.
--
-- Run this in the Supabase SQL editor.  Safe to re-run (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Make booking_id nullable (was NOT NULL in original schema)
alter table public.payments
  alter column booking_id drop not null;

-- 2. Add campaign_id column if it doesn't exist yet
alter table public.payments
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade;

-- 3. Drop and recreate SELECT policy so customers can see campaign payments too
drop policy if exists payments_owner_select on public.payments;
create policy payments_owner_select on public.payments for select using (
  public.current_role_v() in ('admin', 'accountant')
  or (
    -- single-booking payment
    booking_id is not null and exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.customer_id = auth.uid()
    )
  )
  or (
    -- campaign payment
    campaign_id is not null and exists (
      select 1 from public.campaigns c
      where c.id = payments.campaign_id and c.customer_id = auth.uid()
    )
  )
);

-- 4. Drop and recreate INSERT policy to allow both paths
drop policy if exists payments_owner_insert on public.payments;
create policy payments_owner_insert on public.payments for insert with check (
  -- single-booking payment (legacy)
  (
    booking_id is not null
    and campaign_id is null
    and exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id
        and b.customer_id = auth.uid()
        and b.status in ('awaiting_payment', 'rejected')
    )
  )
  or
  -- campaign payment (multi-location)
  (
    campaign_id is not null
    and booking_id is null
    and exists (
      select 1 from public.campaigns c
      where c.id = payments.campaign_id
        and c.customer_id = auth.uid()
    )
  )
);

-- 5. Allow DELETE on payments so the delete-before-insert resubmission works
drop policy if exists payments_owner_delete on public.payments;
create policy payments_owner_delete on public.payments for delete using (
  (
    booking_id is not null and exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.customer_id = auth.uid()
    )
  )
  or (
    campaign_id is not null and exists (
      select 1 from public.campaigns c
      where c.id = payments.campaign_id and c.customer_id = auth.uid()
    )
  )
  or public.current_role_v() in ('admin', 'accountant')
);
