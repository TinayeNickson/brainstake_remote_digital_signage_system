-- Migration: Contact Settings for Admin-Editable Contact Details
-- This makes contact info (phone numbers, messages) editable from admin panel

-- ── Create table ──────────────────────────────────────────────────────────────
create table if not exists public.contact_settings (
  id              uuid        primary key default gen_random_uuid(),
  key             text        not null unique,
  label           text        not null,
  value           text        not null,
  description     text,
  is_public       boolean     not null default true,
  sort_order      int         not null default 0,
  updated_at      timestamptz not null default now(),
  updated_by      uuid        references public.profiles(id) on delete set null
);

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.contact_settings enable row level security;

-- ── RLS Policies ──────────────────────────────────────────────────────────────
drop policy if exists contact_settings_public_read on public.contact_settings;
drop policy if exists contact_settings_admin_write on public.contact_settings;

create policy contact_settings_public_read 
  on public.contact_settings 
  for select 
  using (is_public = true);

create policy contact_settings_admin_write 
  on public.contact_settings 
  for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- ── Grants ───────────────────────────────────────────────────────────────────
grant select on public.contact_settings to anon, authenticated;
grant insert, update, delete on public.contact_settings to authenticated;

-- ── Seed data ─────────────────────────────────────────────────────────────────
insert into public.contact_settings (key, label, value, description, is_public, sort_order)
values
  ('support_phone',     'Support Phone Number',     '+263 772 123 456', 'Main support phone shown to customers when payment is under review or ads are suspended', true, 1),
  ('support_whatsapp',  'Support WhatsApp',       '+263 772 123 456', 'WhatsApp number for customer support',                                                  true, 2),
  ('support_email',     'Support Email',            'support@brainstake.signage.tech', 'Support email address shown to customers',                                              true, 3),
  ('review_message',    'Payment Review Message',   'Reviews typically take 24-48 hours. If not approved within 48 hours, please call our support line.', 'Message shown when payment is under review', true, 4),
  ('suspended_message', 'Suspended Ad Message',   'Your ad has been suspended. Please contact support for assistance.', 'Message shown when ad is suspended by admin', true, 5)
on conflict (key) do nothing;
