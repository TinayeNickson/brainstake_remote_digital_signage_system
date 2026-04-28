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

  const [campaignRes, bookingsRes, settingsRes, paymentRes] = await Promise.all([
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

  const campaign = campaignRes.data;
  const bookings = bookingsRes.data;
  const settings = settingsRes.data;
  const payment = paymentRes.data;
  const campaignError = campaignRes.error;

  // DEBUG: Show error instead of redirecting to diagnose the issue
  if (!campaign || campaign.customer_id !== user.id) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h1 className="text-xl font-bold text-red-800 mb-4">Payment Page Error</h1>
          <pre className="bg-white p-4 rounded-lg text-xs font-mono overflow-auto">
{JSON.stringify({
  campaignId: params.campaignId,
  campaignFound: !!campaign,
  campaignCustomerId: campaign?.customer_id,
  currentUserId: user.id,
  match: campaign?.customer_id === user.id,
  reason: !campaign ? 'Campaign not found' : 'User ID mismatch',
  campaignError: campaignError?.message,
  campaignErrorCode: campaignError?.code
}, null, 2)}
          </pre>
          <a href="/dashboard" className="btn btn-primary mt-4 inline-block">Go to Dashboard</a>
        </div>
      </div>
    );
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
