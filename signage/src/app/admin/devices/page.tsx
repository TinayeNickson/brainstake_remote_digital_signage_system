import { supabaseServer } from '@/lib/supabase-server';
import DevicesClient from './client';

export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
  const supabase = supabaseServer();
  const [{ data: devices }, { data: locations }, { data: guards }] = await Promise.all([
    supabase
      .from('devices')
      .select(`*, api_token, pairing_code, device_type, paired_at, location:locations(name), guard:security_guards(name, phone)`)
      .order('created_at', { ascending: false }),
    supabase.from('locations').select('id, name, active').eq('active', true).order('name'),
    supabase.from('security_guards').select('id, name, phone, active').eq('active', true).order('name'),
  ]);

  const assignedGuardIds = new Set((devices ?? []).map(d => d.guard_id));
  const availableGuards = (guards ?? []).filter(g => !assignedGuardIds.has(g.id));

  return (
    <DevicesClient
      initial={devices ?? []}
      locations={locations ?? []}
      availableGuards={availableGuards}
    />
  );
}
