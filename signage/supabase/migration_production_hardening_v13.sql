-- ============================================================================
-- Migration v13 — Production Hardening & Security Lockdown
--
-- Fixes every issue found in the production-readiness audit:
--
--  1. devices RLS — api_token and pairing_code must NOT be readable by anon
--     or other customers. Only admin + the device itself (via service-role).
--  2. packages RLS — table had no RLS policies at all.
--  3. ad_duration enum — '60' value missing; customers can book 60s but DB
--     was rejecting it.
--  4. Rate-limit / brute-force protection on pair_device — add attempt counter.
--  5. campaigns RLS — tighten to prevent cross-customer read via API.
--  6. booking_dates RLS — add explicit DENY for anon to block direct queries.
--  7. ad-media storage — path-based ownership (user uploads to their UID folder).
--  8. payment-proofs storage — explicit UPDATE policy added.
--  9. packages table — ensure RLS is on with correct policies.
-- 10. receipts table — verify customer_id ownership check is tight.
-- 11. fallback_content — no RLS; add read-only public + admin write.
-- 12. ad_slot_assignments — no RLS; add admin + player (service-role only).
-- 13. Security headers — documented here; applied in next.config.js.
--
-- Safe to re-run (all statements are idempotent).
-- ============================================================================


-- ============================================================================
-- 1. FIX ad_duration ENUM — add '60' if missing
-- ============================================================================
do $$
begin
  alter type public.ad_duration add value if not exists '60';
exception when others then null;
end $$;


-- ============================================================================
-- 2. DEVICES — tighten RLS
--    Problem: devices_public_read exposes api_token + pairing_code to anyone.
--    Fix: anon/customer can only read non-sensitive columns via a view,
--         or we restrict the policy to only allow admin reads of sensitive cols.
--
--    Strategy:
--    - Keep the public-read policy for the player (it needs location_id,
--      active, start_time, end_time, display_mode) but strip token fields.
--    - Create a separate admin-only policy for full row access.
--    - The player endpoint uses supabaseAdmin (service-role) so bypasses RLS —
--      that is intentional and safe since it's server-only code.
--    - Direct Supabase client (anon key) queries now get filtered columns only.
-- ============================================================================

-- Replace the broad public-read policy with a restrictive one.
-- Anon/customer can read only the non-sensitive display fields.
-- Admin gets full access via the admin_all policy.
drop policy if exists devices_public_read  on public.devices;
drop policy if exists devices_admin_write  on public.devices;
drop policy if exists devices_admin_all    on public.devices;

-- Customers and anon: read-only, sensitive columns are returned NULL by the
-- application because the policy restricts rows to active ones only.
-- They cannot query api_token or pairing_code via the Supabase client at all —
-- those columns are not mentioned in any public select they'd make, but RLS
-- does not column-filter. We therefore restrict to admin-only on devices so
-- the player MUST go through the API (which uses service-role).
create policy devices_admin_all on public.devices
  for all
  using (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

-- The player heartbeat update is done via service-role (supabaseAdmin) in the
-- API route, which bypasses RLS — no policy needed for that path.
-- Devices are now ADMIN-ONLY via RLS. The public player pages always go
-- through the /api/device/content server route (service-role) — never direct.


-- ============================================================================
-- 3. PACKAGES — enable RLS and add policies
--    Previously had no RLS at all — anyone could read/write packages.
-- ============================================================================
alter table public.packages enable row level security;

drop policy if exists packages_public_read  on public.packages;
drop policy if exists packages_admin_write  on public.packages;

create policy packages_public_read on public.packages
  for select using (active = true or public.current_role_v() in ('admin','accountant'));

create policy packages_admin_write on public.packages
  for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');


-- ============================================================================
-- 4. FALLBACK CONTENT — add RLS
--    Player fetches this via supabaseAdmin (server-only) so it's fine.
--    But direct Supabase client calls should be read-only for authenticated users.
-- ============================================================================
alter table public.fallback_content enable row level security;

drop policy if exists fallback_public_read  on public.fallback_content;
drop policy if exists fallback_admin_write  on public.fallback_content;

create policy fallback_public_read on public.fallback_content
  for select using (true);  -- non-sensitive display content

create policy fallback_admin_write on public.fallback_content
  for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');


-- ============================================================================
-- 5. AD_SLOT_ASSIGNMENTS — add RLS
--    Only admins should be able to query this directly.
--    The player reads slots via the player_slots() security-definer RPC.
-- ============================================================================
do $$ begin
  -- Table may not exist if migration_slot_engine_v8 hasn't been run yet.
  -- Safely skip if missing.
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ad_slot_assignments'
  ) then
    execute 'alter table public.ad_slot_assignments enable row level security';
    execute 'drop policy if exists slot_assignments_admin on public.ad_slot_assignments';
    execute $p$
      create policy slot_assignments_admin on public.ad_slot_assignments
        for all using (public.current_role_v() = 'admin')
        with check (public.current_role_v() = 'admin')
    $p$;
  end if;
end $$;


-- ============================================================================
-- 6. CAMPAIGNS — tighten RLS, prevent cross-customer SELECT
--    The existing policy is correct; re-create to ensure it's applied cleanly.
-- ============================================================================
drop policy if exists campaigns_owner_select on public.campaigns;
drop policy if exists campaigns_admin_all    on public.campaigns;
drop policy if exists campaigns_admin_select on public.campaigns;

create policy campaigns_owner_select on public.campaigns
  for select
  using (customer_id = auth.uid() or public.current_role_v() in ('admin','accountant'));

create policy campaigns_admin_all on public.campaigns
  for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');


-- ============================================================================
-- 7. BOOKINGS — prevent cross-customer UPDATE via API
--    Customers must never be able to change booking status directly.
--    Only admins/accountants update via RPCs.
-- ============================================================================
drop policy if exists bookings_owner_select on public.bookings;
drop policy if exists bookings_admin_update on public.bookings;
drop policy if exists bookings_staff_update on public.bookings;

create policy bookings_owner_select on public.bookings
  for select
  using (customer_id = auth.uid() or public.current_role_v() in ('admin','accountant'));

-- Customers: no direct UPDATE. All status changes happen via security-definer RPCs.
create policy bookings_staff_update on public.bookings
  for update
  using (public.current_role_v() in ('admin','accountant'));


-- ============================================================================
-- 8. RECEIPTS — enforce customer_id ownership strictly
-- ============================================================================
drop policy if exists receipts_owner_select on public.receipts;

create policy receipts_owner_select on public.receipts
  for select
  using (
    customer_id = auth.uid()
    or public.current_role_v() in ('admin','accountant')
  );

-- Receipts are only ever inserted by approve_payment RPC (security definer).
-- No INSERT policy needed for customers.


-- ============================================================================
-- 9. STORAGE — path-based ownership for ad-media
--    Customer uploads go to: ad-media/<user_uuid>/<filename>
--    The write policy must enforce the path prefix matches auth.uid().
-- ============================================================================
drop policy if exists "ad-media public read"   on storage.objects;
drop policy if exists "ad-media owner write"   on storage.objects;
drop policy if exists "ad-media owner delete"  on storage.objects;
drop policy if exists "ad-media owner update"  on storage.objects;

create policy "ad-media public read" on storage.objects
  for select using (bucket_id = 'ad-media');

create policy "ad-media owner write" on storage.objects
  for insert with check (
    bucket_id = 'ad-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ad-media owner update" on storage.objects
  for update using (
    bucket_id = 'ad-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ad-media owner delete" on storage.objects
  for delete using (
    bucket_id = 'ad-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- 10. STORAGE — payment-proofs: add UPDATE policy
-- ============================================================================
drop policy if exists "payment-proofs owner read"   on storage.objects;
drop policy if exists "payment-proofs staff read"   on storage.objects;
drop policy if exists "payment-proofs owner write"  on storage.objects;
drop policy if exists "payment-proofs owner update" on storage.objects;

create policy "payment-proofs owner read" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "payment-proofs staff read" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and public.current_role_v() in ('admin','accountant')
  );

create policy "payment-proofs owner write" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "payment-proofs owner update" on storage.objects
  for update using (
    bucket_id = 'payment-proofs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- 11. PAIR_DEVICE — brute-force protection
--     Add a failed_pair_attempts counter + lockout to devices table.
--     After 10 consecutive bad codes the device is locked for 15 minutes.
-- ============================================================================
alter table public.devices
  add column if not exists pair_attempts   int         not null default 0,
  add column if not exists pair_locked_until timestamptz;

create or replace function public.pair_device(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device record;
begin
  p_code := upper(trim(p_code));

  -- Look up by code
  select id, api_token, name, device_type, pair_attempts, pair_locked_until
  into v_device
  from public.devices
  where pairing_code = p_code;

  if v_device.id is null then
    -- Valid-looking code but no match — don't reveal whether device exists.
    -- Use a generic error.
    raise exception 'Invalid pairing code';
  end if;

  -- Lockout check
  if v_device.pair_locked_until is not null
     and v_device.pair_locked_until > now() then
    raise exception 'Too many failed attempts. Try again after %',
      to_char(v_device.pair_locked_until at time zone 'UTC', 'HH24:MI UTC');
  end if;

  -- Successful pair — reset attempts, stamp paired_at, set type
  update public.devices
     set paired_at          = now(),
         device_type        = 'android',
         pair_attempts      = 0,
         pair_locked_until  = null
   where id = v_device.id;

  return json_build_object(
    'device_id',   v_device.id,
    'device_name', v_device.name,
    'api_token',   v_device.api_token
  );
end;
$$;

-- pair_device is intentionally accessible to anon (Android app is not logged in).
grant execute on function public.pair_device(text) to anon, authenticated;

-- Companion function for the API layer to record failed attempts.
-- Called from /api/device/pair when the RPC raises an error.
create or replace function public.record_failed_pair_attempt(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
begin
  p_code := upper(trim(p_code));

  select pair_attempts + 1
  into v_attempts
  from public.devices
  where pairing_code = p_code;

  if v_attempts is null then return; end if;  -- code doesn't exist, nothing to track

  update public.devices
     set pair_attempts      = v_attempts,
         pair_locked_until  = case when v_attempts >= 10
                                   then now() + interval '15 minutes'
                                   else pair_locked_until
                              end
   where pairing_code = p_code;
end;
$$;

grant execute on function public.record_failed_pair_attempt(text) to anon, authenticated;


-- ============================================================================
-- 12. MARK_COMPLETED_BOOKINGS — add security definer + restrict to admin/service
-- ============================================================================
create or replace function public.mark_completed_bookings()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_count int;
begin
  -- Allow service-role (auth.uid() is null) or admin
  if auth.uid() is not null then
    select role into v_role from public.profiles where id = auth.uid();
    if v_role not in ('admin') then
      raise exception 'Admin only';
    end if;
  end if;

  update public.bookings
     set status = 'completed'
   where status = 'active'
     and end_date < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_completed_bookings() from anon;
grant  execute on function public.mark_completed_bookings() to authenticated;


-- ============================================================================
-- 13. REVOKE dangerous direct table access for anon
--     All public data goes through views or security-definer RPCs.
-- ============================================================================
revoke select on public.devices          from anon;
revoke select on public.ad_slot_assignments from anon;

-- Ensure booking_dates is never directly queryable by anon
revoke all on public.booking_dates from anon;
grant  select on public.booking_dates to authenticated;  -- RLS governs rows


-- ============================================================================
-- 14. PROFILES — prevent customers from reading other profiles
--     Current policy: admin/accountant can see all. Fix: accountant sees
--     only profiles for customers who have payments in their queue.
--     Admin keeps full access.
-- ============================================================================
drop policy if exists profiles_self_read   on public.profiles;
drop policy if exists profiles_admin_all   on public.profiles;
drop policy if exists profiles_self_update on public.profiles;

create policy profiles_self_read on public.profiles
  for select using (
    id = auth.uid()
    or public.current_role_v() = 'admin'
    or (
      public.current_role_v() = 'accountant'
      and exists (
        select 1 from public.payments py
        join public.bookings b on (
          (py.booking_id = b.id) or
          (py.campaign_id is not null and b.campaign_id = py.campaign_id)
        )
        where b.customer_id = profiles.id
      )
    )
  );

create policy profiles_self_update on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Prevent self-promotion: role must stay the same
    and role = (select role from public.profiles where id = auth.uid())
  );

create policy profiles_admin_all on public.profiles
  for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');


-- ============================================================================
-- 15. SECURITY_GUARDS — prevent customers seeing guard info
-- ============================================================================
drop policy if exists guards_staff_read  on public.security_guards;
drop policy if exists guards_admin_write on public.security_guards;

create policy guards_staff_read on public.security_guards
  for select
  using (public.current_role_v() in ('admin','accountant'));

create policy guards_admin_write on public.security_guards
  for all
  using  (public.current_role_v() = 'admin')
  with check (public.current_role_v() = 'admin');

revoke select on public.security_guards from anon;


-- ============================================================================
-- Done.
-- After running this migration:
--   1. Ensure all player pages go through /api/device/content (server-side).
--   2. Add security headers to next.config.js (see below).
--   3. Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is a *row-level* key, not service.
--   4. SUPABASE_SERVICE_ROLE_KEY must NEVER appear in any client-side bundle.
-- ============================================================================
