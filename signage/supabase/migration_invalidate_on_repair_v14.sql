-- ============================================================================
-- migration_invalidate_on_repair_v14.sql
--
-- When an admin regenerates a pairing code, the old device's api_token must
-- be rotated simultaneously.  This forces any already-paired Android app using
-- the previous token to receive a 401 on its next content poll and show the
-- re-pairing screen.
-- ============================================================================

create or replace function public.regenerate_pairing_code(p_device_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_code text;
  v_new_token text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role <> 'admin' then
    raise exception 'Admin only';
  end if;

  v_code      := public.generate_pairing_code();
  v_new_token := encode(gen_random_bytes(32), 'hex');

  update public.devices
     set pairing_code = v_code,
         paired_at    = null,          -- must re-pair
         api_token    = v_new_token    -- old token is now invalid
   where id = p_device_id;

  return v_code;
end;
$$;

grant execute on function public.regenerate_pairing_code(uuid) to authenticated;
