-- Fix: Add status column to campaigns table (missing in production)
-- This is needed for the payment page to work correctly

-- Add status column with default 'awaiting_payment'
alter table public.campaigns 
  add column if not exists status text not null default 'awaiting_payment' 
  check (status in ('awaiting_payment', 'payment_submitted', 'active', 'rejected', 'completed', 'cancelled'));

-- Also update the schema_complete.sql to include this column
-- (already done in code, this migration is for existing databases)
