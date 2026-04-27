import { supabaseServer } from '@/lib/supabase-server';
import PackagesClient from './client';

export const dynamic = 'force-dynamic';

export default async function PackagesPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('packages')
    .select('*')
    .order('sort_order', { ascending: true });
  return <PackagesClient initial={data ?? []} />;
}
