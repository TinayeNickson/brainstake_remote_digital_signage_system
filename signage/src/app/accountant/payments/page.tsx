import { supabaseServer } from '@/lib/supabase-server';
import Client from '../client';

export const dynamic = 'force-dynamic';

export default async function PaymentsQueuePage() {
  const supabase = supabaseServer();
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      id, amount, method, reference, proof_url, status, submitted_at, reject_reason,
      booking:bookings(
        id, start_date, end_date, duration, slots_per_day, total_price,
        customer:profiles!bookings_customer_id_fkey(email, full_name, phone),
        location:locations(name),
        ad:ads(title, media_url, format)
      ),
      campaign:campaigns(
        id, title, total_price, start_date, end_date, duration, slots_per_day,
        customer:profiles!campaigns_customer_id_fkey(email, full_name, phone),
        bookings(total_price, location:locations(name)),
        ad:ads(title, media_url, format)
      )
    `)
    .order('submitted_at', { ascending: false });

  if (error) {
    return (
      <div className="space-y-4">
        <div className="page-header">
          <div>
            <p className="text-sm text-ink-900/50 font-medium mb-1">Finance Portal</p>
            <h1 className="display text-4xl text-ink-900">Payments Queue</h1>
          </div>
        </div>
        <div className="card p-6 border border-red-200 bg-red-50">
          <p className="font-semibold text-red-700 mb-1">Database error</p>
          <p className="text-sm text-red-600 font-mono">{error.message}</p>
          <p className="text-sm text-red-600/70 mt-3">
            Make sure you have run <strong>migration_multi_location_v6.sql</strong> and <strong>migration_payments_rls_fix_v6b.sql</strong> in your Supabase SQL editor.
          </p>
        </div>
      </div>
    );
  }

  return <Client payments={payments ?? []} />;
}
