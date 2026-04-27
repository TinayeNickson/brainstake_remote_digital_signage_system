import { supabaseServer } from '@/lib/supabase-server';
import OverrideClient from './client';

export const dynamic = 'force-dynamic';

export default async function OverridePage() {
  const supabase = supabaseServer();
  const { data: overrides } = await supabase
    .from('system_overrides')
    .select('*')
    .order('created_at', { ascending: false });

  return <OverrideClient initial={overrides ?? []} />;
}
