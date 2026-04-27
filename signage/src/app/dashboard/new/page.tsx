import { supabaseServer } from '@/lib/supabase-server';
import NewBookingForm from './form';

export default async function NewBookingPage() {
  const supabase = supabaseServer();

  const [{ data: locations }, { data: packages }] = await Promise.all([
    supabase
      .from('locations')
      .select('id, name, description, price_15s, price_30s, price_60s, max_slots_per_day')
      .eq('active', true)
      .order('name'),
    supabase
      .from('packages')
      .select('id, name, description, base_slots_per_day, allows_15s, allows_30s, allows_60s, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);

  return (
    <NewBookingForm
      locations={(locations as any) ?? []}
      packages={(packages as any) ?? []}
    />
  );
}
