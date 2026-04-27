import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import CampaignPaymentForm from './form';

export const dynamic = 'force-dynamic';

function derivedStatus(statuses: string[]): string {
  if (statuses.length === 0)                            return 'awaiting_payment';
  if (statuses.every(s => s === 'active'))              return 'active';
  if (statuses.every(s => s === 'completed'))           return 'completed';
  if (statuses.some(s => s === 'payment_submitted'))    return 'payment_submitted';
  if (statuses.some(s => s === 'rejected'))             return 'rejected';
  return 'awaiting_payment';
}

export default async function CampaignPaymentPage({ params }: { params: { campaignId: string } }) {
  const supabase = supabaseServer();

  // Ownership check — RLS on campaigns already enforces this at DB level, but
  // we also redirect immediately so no data is ever passed to the component.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: campaign }, { data: bookings }, { data: settings }, { data: payment }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, title, total_price, duration, slots_per_day, start_date, end_date, scheduled_days_count, customer_id')
      .eq('id', params.campaignId)
      .single(),
    supabase
      .from('bookings')
      .select('id, status, total_price, price_per_slot, location:locations(name)')
      .eq('campaign_id', params.campaignId)
      .order('created_at'),
    supabase
      .from('payment_settings')
      .select('method, label, instructions, is_enabled, sort_order')
      .eq('is_enabled', true)
      .order('sort_order'),
    supabase
      .from('payments')
      .select('id, status, amount, method, submitted_at')
      .eq('campaign_id', params.campaignId)
      .maybeSingle(),
  ]);

  if (!campaign || campaign.customer_id !== user.id) redirect('/dashboard');

  const campaignStatus = derivedStatus((bookings ?? []).map((b: any) => b.status));

  return (
    <CampaignPaymentForm
      campaign={campaign as any}
      bookings={(bookings ?? []) as any}
      paymentSettings={settings ?? []}
      campaignStatus={campaignStatus}
      existingPayment={payment as any}
    />
  );
}
