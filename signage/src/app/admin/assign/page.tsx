import { supabaseServer } from '@/lib/supabase-server';
import AssignClient from './client';

export const dynamic = 'force-dynamic';

export default async function AssignPage() {
  const supabase = supabaseServer();

  const [{ data: bookings }, { data: devices }] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id, duration, slots_per_day, start_date, end_date, location_id, device_id,
        ad:ads(title, format),
        location:locations(name),
        customer:profiles!bookings_customer_id_fkey(full_name, email)
      `)
      .eq('status', 'active')
      .order('approved_at', { ascending: false }),
    supabase
      .from('devices')
      .select('id, code, name, location_id, active, location:locations(name)')
      .order('code'),
  ]);

  return <AssignClient bookings={(bookings as any) ?? []} devices={(devices as any) ?? []} />;
}
