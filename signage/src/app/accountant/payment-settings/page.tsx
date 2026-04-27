import { supabaseServer } from '@/lib/supabase-server';
import PaymentSettingsClient from './client';

export const dynamic = 'force-dynamic';

export default async function PaymentSettingsPage() {
  const supabase = supabaseServer();
  const { data: settings } = await supabase
    .from('payment_settings')
    .select('method, label, instructions, is_enabled, sort_order')
    .order('sort_order');

  return <PaymentSettingsClient initial={settings ?? []} />;
}
