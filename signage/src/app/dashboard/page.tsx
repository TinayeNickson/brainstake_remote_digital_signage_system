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

// Derive a single representative status for a campaign from its bookings
function campaignStatus(statuses: string[]): string {
  if (statuses.every(s => s === 'active'))            return 'active';
  if (statuses.every(s => s === 'completed'))         return 'completed';
  if (statuses.every(s => s === 'cancelled'))         return 'cancelled';
  if (statuses.some(s => s === 'suspended'))          return 'suspended';
  if (statuses.some(s => s === 'payment_submitted'))  return 'payment_submitted';
  if (statuses.some(s => s === 'rejected'))           return 'rejected';
  return 'awaiting_payment';
}

export default async function CustomerDashboard() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, account_type, created_at')
    .eq('id', user!.id)
    .single();

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

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id, title, total_price, start_date, end_date, slots_per_day, duration, created_at,
      bookings(status, location:locations(name)),
      ad:ads(title, media_url, format)
    `)
    .eq('customer_id', user!.id)
    .order('created_at', { ascending: false });

  const all = (campaigns ?? []).map((c: any) => ({
    ...c,
    status: campaignStatus((c.bookings ?? []).map((b: any) => b.status)),
    locations: (c.bookings ?? []).map((b: any) => b.location?.name).filter(Boolean),
  }));

  const active    = all.filter(c => resolveDisplayStatus(c.status, c.end_date) === 'active').length;
  const pending   = all.filter(c => ['awaiting_payment','payment_submitted'].includes(c.status)).length;
  const completed = all.filter(c => c.status === 'completed').length;
  const totalSpent = all
    .filter(c => ['active','completed'].includes(c.status))
    .reduce((s, c) => s + Number(c.total_price), 0);

  const recent      = all.slice(0, 4);
  const needsAction = all.filter(c => ['awaiting_payment','rejected'].includes(c.status));
  const suspended   = all.filter(c => c.status === 'suspended');
  const firstName   = profile?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">

      {/* ── Welcome banner ───────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2d2a6e] to-[#3d3a7e] p-7 text-white flex items-center justify-between gap-6">
        <div>
          <p className="text-white/60 text-sm font-medium mb-1 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-70"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
              {greeting}
            </p>
          <h1 className="font-extrabold text-3xl tracking-tight">{firstName}</h1>
          <p className="text-white/55 text-sm mt-1">
            {active > 0
              ? `You have ${active} campaign${active > 1 ? 's' : ''} running live right now.`
              : 'Ready to launch your next campaign?'}
          </p>
        </div>
        <Link href="/dashboard/new"
          className="shrink-0 bg-white text-[#2d2a6e] font-bold text-sm px-5 h-11 rounded-xl flex items-center gap-2 hover:bg-[#e8e6f0] transition-colors shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Campaign
        </Link>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          {
            label: 'Total Campaigns', value: all.length, color: 'text-ink-900',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
            bg: 'bg-ink-100',
          },
          {
            label: 'Live Now', value: active, color: 'text-brand',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>,
            bg: 'bg-brand-soft',
          },
          {
            label: 'Awaiting Action', value: pending, color: 'text-amber-600',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
            bg: 'bg-amber-50',
          },
          {
            label: 'Total Spent', value: money(totalSpent), color: 'text-ink-900', big: true,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
            bg: 'bg-ink-100',
          },
        ] as const).map((s: any) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-ink-900/50">{s.label}</p>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} ${s.color}`}>{s.icon}</span>
            </div>
            <p className={`font-bold ${s.big ? 'text-2xl' : 'text-3xl'} ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Needs attention ──────────────────────────────────────── */}
      {needsAction.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="font-semibold text-amber-800 text-sm">{needsAction.length} campaign{needsAction.length > 1 ? 's' : ''} need your attention</p>
          </div>
          <div className="space-y-2">
            {needsAction.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-amber-100">
                <div>
                  <p className="font-semibold text-sm text-ink-900">{c.title}</p>
                  <p className="text-xs text-ink-900/50">
                    {c.locations?.length > 0 ? c.locations.join(', ') : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={STATUS_BADGE[resolveDisplayStatus(c.status, c.end_date)]}>{STATUS_LABEL[resolveDisplayStatus(c.status, c.end_date)]}</span>
                  <Link href={`/dashboard/payment/campaign/${c.id}`} className="btn btn-primary h-8 px-4 text-xs">
                    Pay Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Suspended campaigns ───────────────────────────── */}
      {suspended.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <p className="font-semibold text-red-800 text-sm">{suspended.length} campaign{suspended.length > 1 ? 's' : ''} suspended by admin</p>
          </div>
          <div className="space-y-2">
            {suspended.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-red-100">
                <div>
                  <p className="font-semibold text-sm text-ink-900">{c.title}</p>
                  <p className="text-xs text-ink-900/50">{money(Number(c.total_price))} · {suspendedMsg}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={STATUS_BADGE['suspended']}>{STATUS_LABEL['suspended']}</span>
                  <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="btn btn-ghost h-8 px-4 text-xs">
                    Call Support
                  </a>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-700/80 mt-3">
            Suspended ads are not being displayed. Please contact admin to resolve this issue. <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="font-semibold underline">{supportPhone}</a>
          </p>
        </div>
      )}

      {/* ── Payment review info banner ───────────────────────────── */}
      {all.some((c: any) => c.status === 'payment_submitted') && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-blue-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-blue-800 text-sm">Payment under review</p>
              <p className="text-blue-700/80 text-sm mt-1">
                One or more of your campaigns have payments being reviewed. {reviewMsg}
              </p>
              <p className="text-sm text-blue-900/70 mt-2 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Contact: <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="font-bold text-brand hover:underline">{supportPhone}</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Two-column: recent campaigns + quick actions ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent campaigns table */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
            <h2 className="font-bold text-ink-900">Recent Campaigns</h2>
            <Link href="/dashboard/my-campaigns" className="text-sm text-brand font-medium hover:underline">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="px-6 py-12 text-center text-ink-900/40">
              <p className="font-medium">No campaigns yet</p>
              <p className="text-sm mt-1">Your campaigns will appear here once created.</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {recent.map((c: any) => (
                <div key={c.id} className="px-6 py-4 flex items-center gap-4">
                  {/* Thumb */}
                  <div className="shrink-0 w-14 h-10 rounded-lg overflow-hidden bg-ink-100">
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
                    <p className="font-semibold text-sm text-ink-900 truncate">{c.title}</p>
                    <p className="text-xs text-ink-900/50 mt-0.5">
                      {c.locations?.length > 1
                        ? `${c.locations.length} locations`
                        : (c.locations?.[0] ?? '—')}
                      {' · '}{c.start_date} → {c.end_date}
                    </p>
                  </div>
                  {/* Status + price */}
                  <div className="text-right shrink-0">
                    <span className={STATUS_BADGE[resolveDisplayStatus(c.status, c.end_date)] ?? 'badge badge-gray'}>{STATUS_LABEL[resolveDisplayStatus(c.status, c.end_date)] ?? c.status}</span>
                    <p className="text-sm font-bold text-ink-900 mt-1">{money(Number(c.total_price))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-bold text-ink-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {([
                {
                  href: '/dashboard/new', label: 'Create New Campaign', desc: 'Upload ad & book a screen',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
                  bg: 'bg-brand-soft text-brand',
                },
                {
                  href: '/dashboard/my-campaigns', label: 'My Campaigns', desc: 'View all your bookings',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
                  bg: 'bg-ink-100 text-ink-900',
                },
                {
                  href: '/dashboard/receipts', label: 'Receipts', desc: 'View payment history',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
                  bg: 'bg-ink-100 text-ink-900',
                },
              ] as const).map((a: any) => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-50 transition-colors group">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>{a.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900 group-hover:text-brand transition-colors">{a.label}</p>
                    <p className="text-xs text-ink-900/45">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Account summary */}
          <div className="card p-5">
            <h2 className="font-bold text-ink-900 mb-3">Account</h2>
            <div className="space-y-2 text-sm">
              {[
                { k: 'Name',         v: profile?.full_name ?? '—'         },
                { k: 'Account type', v: profile?.account_type === 'company' ? 'Company' : 'Individual' },
                { k: 'Completed',    v: `${completed} campaign${completed !== 1 ? 's' : ''}` },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between">
                  <span className="text-ink-900/50">{k}</span>
                  <span className="font-medium text-ink-900 capitalize">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
