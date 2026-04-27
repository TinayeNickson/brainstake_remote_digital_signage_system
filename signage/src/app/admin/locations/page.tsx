import { supabaseServer } from '@/lib/supabase-server';
import LocationsClient from './client';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('locations')
    .select('*')
    .order('created_at', { ascending: false });
  return <LocationsClient initial={data ?? []} />;
}
