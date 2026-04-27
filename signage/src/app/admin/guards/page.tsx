import { supabaseServer } from '@/lib/supabase-server';
import GuardsClient from './client';

export const dynamic = 'force-dynamic';

export default async function GuardsPage() {
  const supabase = supabaseServer();
  const [{ data: guards }, { data: devices }] = await Promise.all([
    supabase.from('security_guards').select('*').order('created_at', { ascending: false }),
    supabase.from('devices').select('id, code, name, guard_id'),
  ]);
  // compute guard → device (1:1) map so we can show assignment
  const byGuard: Record<string, { id: string; code: string; name: string }> = {};
  (devices ?? []).forEach(d => { if (d.guard_id) byGuard[d.guard_id] = d; });
  return <GuardsClient initial={guards ?? []} deviceByGuard={byGuard} />;
}
