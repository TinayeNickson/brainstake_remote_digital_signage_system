-- ============================================================================
-- Migration v12 — Unified Player Architecture
--
-- Adds to devices table:
--   pairing_code  TEXT UNIQUE — 6-char uppercase code shown in admin UI.
--                               Android app enters this to pair.
--   device_type   device_type_enum — 'web' or 'android'. Cosmetic only;
--                                     both use identical scheduling logic.
--   paired_at     TIMESTAMPTZ — set when Android app successfully pairs.
--
-- Adds:
--   pair_device(p_code, p_token_hint) RPC — called by Android app.
--     Returns the api_token so app can store it for future requests.
--
--   generate_pairing_code() helper — produces unique 6-char uppercase code.
--
-- Existing devices get auto-generated pairing_codes on migration.
-- ============================================================================


-- ── Device type enum ────────────────────────────────────────────────────────
do $$ begin
  create type public.device_type_enum as enum ('web', 'android');
exception when duplicate_object then null;
end $$;


-- ── Add columns to devices ──────────────────────────────────────────────────
alter table public.devices
  add column if not exists pairing_code text unique,
  add column if not exists device_type  public.device_type_enum not null default 'web',
  add column if not exists paired_at    timestamptz;


-- ── Pairing code generator ───────────────────────────────────────────────────
-- Generates a random 6-character uppercase alphanumeric code,
-- retrying until it finds one that is not already in use.
create or replace function public.generate_pairing_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no O/0, I/1 (ambiguous)
  v_i    int;
  v_len  int   := 6;
  v_exists bool;
begin
  loop
    v_code := '';
    for v_i in 1 .. v_len loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    end loop;

    select exists(select 1 from public.devices where pairing_code = v_code)
    into v_exists;

    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;


-- ── Back-fill pairing codes for existing devices ────────────────────────────
do $$
declare
  v_row record;
begin
  for v_row in select id from public.devices where pairing_code is null loop
    update public.devices
       set pairing_code = public.generate_pairing_code()
     where id = v_row.id;
  end loop;
end $$;


-- ── Make pairing_code NOT NULL + auto-generate on insert ────────────────────
alter table public.devices
  alter column pairing_code set not null;

-- Trigger: auto-set pairing_code when inserting a device without one
create or replace function public.device_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pairing_code is null or new.pairing_code = '' then
    new.pairing_code := public.generate_pairing_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_device_before_insert on public.devices;
create trigger trg_device_before_insert
  before insert on public.devices
  for each row execute function public.device_before_insert();


-- ── regenerate_pairing_code(device_id) ─────────────────────────────────────
-- Admin can call this to reset a device's pairing code (e.g. after Android
-- app is uninstalled and needs to re-pair).
create or replace function public.regenerate_pairing_code(p_device_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_code text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role <> 'admin' then
    raise exception 'Admin only';
  end if;

  v_code := public.generate_pairing_code();

  update public.devices
     set pairing_code = v_code,
         paired_at    = null   -- reset: device must re-pair
   where id = p_device_id;

  return v_code;
end;
$$;

grant execute on function public.regenerate_pairing_code(uuid) to authenticated;


-- ── pair_device(p_code) RPC ─────────────────────────────────────────────────
-- Called by the Android app with the pairing_code displayed in the admin UI.
-- Returns device_id + api_token so the app can authenticate all future
-- requests using:  Authorization: Bearer <api_token>
--
-- Security: pairing_code is short-lived (admin can regenerate it).
--           After pairing, paired_at is set; the code remains valid
--           (admin can regenerate to force re-pairing).
--           Anyone who has the code can pair — treat it like a one-time
--           setup code that admin controls.
create or replace function public.pair_device(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device record;
begin
  -- Upper-case and strip spaces for forgiving input
  p_code := upper(trim(p_code));

  select id, api_token, name, device_type
  into v_device
  from public.devices
  where pairing_code = p_code;

  if v_device.id is null then
    raise exception 'Invalid pairing code';
  end if;

  -- Mark as paired with a timestamp
  update public.devices
     set paired_at   = now(),
         device_type = 'android'   -- pairing always implies Android
   where id = v_device.id;

  return json_build_object(
    'device_id',   v_device.id,
    'device_name', v_device.name,
    'api_token',   v_device.api_token
  );
end;
$$;

-- pair_device is intentionally accessible to anon (Android app calls it
-- without a logged-in user — it authenticates via the pairing code itself).
grant execute on function public.pair_device(text) to anon, authenticated;
