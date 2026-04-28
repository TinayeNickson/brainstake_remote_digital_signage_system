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

  // Fetch contact settings
  const { data: contactSettings } = await supabase
    .from('contact_settings')
    .select('key, value')
    .eq('is_public', true);

  const contactMap = Object.fromEntries(
    (contactSettings || []).map(s => [s.key, s.value])
  );
  const supportPhone = contactMap['support_phone'] || '+263 772 123 456';
  const reviewMsg = contactMap['review_message'] || 'Reviews typically take 24-48 hours. If not approved within 48 hours, please call our support line.';

  const [{ data: campaign }, { data: bookings }, { data: settings }, { data: payment }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, customer_id, title, total_price, duration, slots_per_day, start_date, end_date, scheduled_days_count, status')
      .eq('id', params.campaignId)
      .single(),
    supabase
      .from('bookings')
      .select('id, total_price, price_per_slot, status, location:locations(name)')
      .eq('campaign_id', params.campaignId),
    supabase
      .from('payment_settings')
      .select('method, label, instructions, is_enabled, sort_order')
      .eq('is_enabled', true)
      .order('sort_order'),
    supabase
      .from('payments')
      .select('id, amount, method, reference, status, submitted_at')
      .eq('campaign_id', params.campaignId)
      .order('submitted_at', { ascending: false })
      .limit(1),
  ]);

  if (!campaign || campaign.customer_id !== user.id) {
    console.log('[Payment Page] Redirecting to dashboard:', {
      campaignId: params.campaignId,
      campaignFound: !!campaign,
      campaignCustomerId: campaign?.customer_id,
      currentUserId: user.id,
      match: campaign?.customer_id === user.id
    });
    redirect('/dashboard');
  }

  const bookingStatuses = (bookings ?? []).map((b: any) => b.status);
  const campaignStatus = derivedStatus(bookingStatuses);
  console.log('[Payment Page] Status check:', {
    campaignId: params.campaignId,
    bookingsCount: bookings?.length ?? 0,
    bookingStatuses,
    campaignStatus,
    canPay: ['awaiting_payment', 'rejected'].includes(campaignStatus)
  });

  return (
    <CampaignPaymentForm
      campaign={campaign as any}
      bookings={(bookings ?? []) as any}
      paymentSettings={settings ?? []}
      campaignStatus={campaignStatus}
      existingPayment={payment as any}
      supportPhone={supportPhone}
      reviewMessage={reviewMsg}
    />
  );
}
