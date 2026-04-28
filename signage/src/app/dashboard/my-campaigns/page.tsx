import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase-server';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  awaiting_payment:  'badge badge-amber',
  payment_submitted: 'badge badge-blue',
  active:            'badge badge-green',
  ended:             'badge badge-gray',
  rejected:          'badge badge-red',
  suspended:         'badge badge-red',
  cancelled:         'badge badge-gray',
  completed:         'badge badge-gray',
};
const STATUS_LABEL: Record<string, string> = {
  awaiting_payment:  'Awaiting Payment',
  payment_submitted: 'Under Review',
  active:            'Live',
  ended:             'Ended',
  rejected:          'Rejected',
  suspended:         'Suspended by Admin',
  cancelled:         'Cancelled',
  completed:         'Completed',
};

function resolveDisplayStatus(status: string, endDate?: string): string {
  if (status === 'active' && endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    if (end < today) return 'ended';
  }
  return status;
}

function campaignStatus(statuses: string[]): string {
  if (statuses.every(s => s === 'active'))            return 'active';
  if (statuses.every(s => s === 'completed'))         return 'completed';
  if (statuses.every(s => s === 'cancelled'))         return 'cancelled';
  if (statuses.some(s => s === 'suspended'))          return 'suspended';
  if (statuses.some(s => s === 'payment_submitted'))  return 'payment_submitted';
  if (statuses.some(s => s === 'rejected'))           return 'rejected';
  return 'awaiting_payment';
}

export default async function MyCampaignsPage() {
  const supabase = supabaseServer();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) return null;

  // Fetch contact settings
  const { data: contactSettings } = await supabase
    .from('contact_settings')
    .select('key, value')
    .eq('is_public', true);

  const contactMap = Object.fromEntries(
    (contactSettings || []).map(s => [s.key, s.value])
  );
  const supportPhone = contactMap['support_phone'] || '+263 772 123 456';
  const suspendedMsg = contactMap['suspended_message'] || 'Your ad has been suspended. Please contact support for assistance.';
  const reviewMsg = contactMap['review_message'] || 'Reviews typically take 24-48 hours. If not approved within 48 hours, please call our support line.';

  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select(`
      id, title, total_price, start_date, end_date, slots_per_day, duration, created_at,
      ad:ads(title, media_url, format),
      bookings(status, total_price, location:locations(name)),
      payments(id, status)
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  if (campErr) console.error('my-campaigns fetch error:', campErr.message);

  const all = (campaigns ?? []).map((c: any) => ({
    ...c,
    status:    campaignStatus((c.bookings ?? []).map((b: any) => b.status)),
    locations: (c.bookings ?? []).map((b: any) => b.location?.name).filter(Boolean),
    payment:   Array.isArray(c.payments) ? c.payments[0] : (c.payments ?? null),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="text-sm text-ink-900/50 font-medium mb-1">Customer Portal</p>
          <h1 className="display text-3xl font-extrabold text-ink-900">My Campaigns</h1>
          <p className="text-sm text-ink-900/50 mt-1">{all.length} campaign{all.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link href="/dashboard/new" className="btn btn-primary h-11 px-6 text-sm font-semibold">
          + New Campaign
        </Link>
      </div>

      {all.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-soft flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <h2 className="font-extrabold text-2xl mb-2">No campaigns yet</h2>
          <p className="text-ink-900/60 mb-6 max-w-sm mx-auto text-sm">
            Create your first campaign — upload a creative, pick a screen, and go live in minutes.
          </p>
          <Link href="/dashboard/new" className="btn btn-primary h-11 px-8">Start your first campaign</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {all.map((c: any) => {
            const displayStatus = resolveDisplayStatus(c.status, c.end_date);
            const needsPayment = ['awaiting_payment', 'rejected'].includes(c.status);
            const hasReceipt   = c.status === 'active' || c.status === 'completed' || displayStatus === 'ended';
            const isSuspended  = c.status === 'suspended';
            return (
              <div key={c.id} className="card card-hover p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Thumbnail */}
                <div className="shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-ink-100">
                  {c.ad?.media_url ? (
                    c.ad.format === 'video'
                      ? <video src={c.ad.media_url} className="w-full h-full object-cover" muted />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={c.ad.media_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-900/20 text-xs">Ad</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-900 truncate">{c.title}</span>
                    <span className={STATUS_BADGE[displayStatus] ?? 'badge badge-gray'}>
                      {STATUS_LABEL[displayStatus] ?? c.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[13px] text-ink-900/55">
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {c.locations?.length > 1 ? `${c.locations.length} locations` : (c.locations?.[0] ?? '—')}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {c.duration}s
                    </span>
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                      {c.slots_per_day} slots/day
                    </span>
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {c.start_date} → {c.end_date}
                    </span>
                  </div>
                  {/* Per-location breakdown for multi-location campaigns */}
                  {c.locations?.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.locations.map((loc: string) => (
                        <span key={loc} className="inline-flex items-center gap-1 text-[11px] bg-ink-50 border border-ink-100 rounded-full px-2 py-0.5 text-ink-900/60">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {loc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <div className="font-extrabold text-xl text-ink-900">{money(Number(c.total_price))}</div>
                  <div className="text-xs text-ink-900/40 mt-0.5">Total</div>
                </div>

                {/* Actions — ONE button per campaign, never per-booking */}
                <div className="flex gap-2 shrink-0">
                  {needsPayment && (
                    <Link href={`/dashboard/payment/campaign/${c.id}`} className="btn btn-primary h-9 px-4 text-sm">
                      Pay Now
                    </Link>
                  )}
                  {c.status === 'payment_submitted' && (
                    <div className="group relative">
                      <span className="inline-flex items-center gap-1.5 h-9 px-4 text-sm rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium cursor-help">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Under Review
                      </span>
                      {/* Tooltip */}
                      <div className="absolute bottom-full right-0 mb-2 w-72 p-3 bg-ink-900 text-white text-xs rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <p className="font-semibold mb-1">Review in progress</p>
                        <p className="text-white/80">{reviewMsg}</p>
                        <p className="mt-1.5 font-bold text-brand-light">{supportPhone}</p>
                        <div className="absolute bottom-[-4px] right-4 w-2 h-2 bg-ink-900 rotate-45"></div>
                      </div>
                    </div>
                  )}
                  {isSuspended && (
                    <div className="group relative">
                      <span className="inline-flex items-center gap-1.5 h-9 px-4 text-sm rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium cursor-help">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        Suspended
                      </span>
                      {/* Tooltip */}
                      <div className="absolute bottom-full right-0 mb-2 w-72 p-3 bg-ink-900 text-white text-xs rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <p className="font-semibold mb-1">Ad suspended by admin</p>
                        <p className="text-white/80">{suspendedMsg}</p>
                        <p className="mt-1.5 font-bold text-brand-light">{supportPhone}</p>
                        <div className="absolute bottom-[-4px] right-4 w-2 h-2 bg-ink-900 rotate-45"></div>
                      </div>
                    </div>
                  )}
                  {hasReceipt && (
                    <Link href="/dashboard/receipts" className="btn btn-ghost h-9 px-4 text-sm">
                      Receipt
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
