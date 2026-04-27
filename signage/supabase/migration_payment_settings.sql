-- ============================================================================
-- MIGRATION: payment_settings table
-- Stores live banking/payment instructions per method, editable by accountant.
-- Run in Supabase SQL Editor (idempotent).
-- ============================================================================

create table if not exists public.payment_settings (
  method       text primary key,          -- 'ecocash' | 'onemoney' | 'bank_transfer' | 'cash' | 'other'
  label        text not null,             -- display name shown on button
  instructions text not null default '',  -- full instructions shown to customer
  is_enabled   boolean not null default true,
  sort_order   int  not null default 0,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null
);

-- Seed defaults (matches old hardcoded hints)
insert into public.payment_settings (method, label, instructions, is_enabled, sort_order)
values
  ('ecocash',       'EcoCash',        'Merchant code 12345 — send to +263 77 200 0000', true,  1),
  ('onemoney',      'OneMoney',       'Merchant code 54321 — send to +263 71 300 0000', true,  2),
  ('bank_transfer', 'Bank Transfer',  'Acc. 01234567 · Stanbic · Branch: Harare CBD · Ref: your booking ID', true, 3),
  ('cash',          'Cash Deposit',   'Visit our CBD office with your booking ID. Open Mon–Fri 08:00–17:00.', true, 4),
  ('other',         'Other',          'Attach your reference or proof in the notes field below.', true, 5)
on conflict (method) do nothing;

-- RLS
alter table public.payment_settings enable row level security;

-- Anyone (including unauthenticated customers) can read enabled settings
drop policy if exists payment_settings_public_read on public.payment_settings;
create policy payment_settings_public_read on public.payment_settings
  for select using (true);

-- Only accountant or admin can write
drop policy if exists payment_settings_staff_write on public.payment_settings;
create policy payment_settings_staff_write on public.payment_settings
  for all using (public.current_role_v() in ('accountant', 'admin'))
  with check (public.current_role_v() in ('accountant', 'admin'));

grant select on public.payment_settings to anon, authenticated;
grant insert, update, delete on public.payment_settings to authenticated;
