import { supabaseServer } from '@/lib/supabase-server';
import { money, fmtDate } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AccountantDashboard() {
  const supabase = supabaseServer();

  /* ── All approved payments with full booking + customer context ── */
  const { data: approved } = await supabase
    .from('payments')
    .select(`
      id, amount, method, submitted_at, reviewed_at,
      booking:bookings(
        id, start_date, end_date, duration, slots_per_day, total_price,
        customer:profiles!bookings_customer_id_fkey(id, full_name, email, account_type, company_name),
        location:locations(name)
      )
    `)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false });

  /* ── Pending count ── */
  const { count: pendingCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  /* ── Rejected count ── */
  const { count: rejectedCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'rejected');

  const rows = approved ?? [];

  /* ── KPI calculations ── */
  const totalRevenue  = rows.reduce((s, p) => s + Number(p.amount), 0);

  const now           = new Date();
  const thisMonthStr  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr  = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const thisMonthRev = rows
    .filter(p => (p.reviewed_at ?? p.submitted_at)?.slice(0, 7) === thisMonthStr)
    .reduce((s, p) => s + Number(p.amount), 0);

  const lastMonthRev = rows
    .filter(p => (p.reviewed_at ?? p.submitted_at)?.slice(0, 7) === lastMonthStr)
    .reduce((s, p) => s + Number(p.amount), 0);

  const momChange = lastMonthRev > 0
    ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100
    : null;

  /* ── Monthly trend — last 6 months ── */
  const monthLabels: string[] = [];
  const monthMap: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lbl = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    monthLabels.push(lbl);
    monthMap[key] = 0;
  }
  rows.forEach(p => {
    const key = (p.reviewed_at ?? p.submitted_at)?.slice(0, 7) ?? '';
    if (key in monthMap) monthMap[key] += Number(p.amount);
  });
  const monthValues = Object.values(monthMap);
  const maxMonth    = Math.max(...monthValues, 1);

  /* ── Per-location revenue ── */
  const locationMap: Record<string, { name: string; revenue: number; count: number }> = {};
  rows.forEach(p => {
    const loc = (p.booking as any)?.location?.name ?? 'Unknown';
    if (!locationMap[loc]) locationMap[loc] = { name: loc, revenue: 0, count: 0 };
    locationMap[loc].revenue += Number(p.amount);
    locationMap[loc].count   += 1;
  });
  const locationStats = Object.values(locationMap).sort((a, b) => b.revenue - a.revenue);

  /* ── Per-customer revenue ── */
  const customerMap: Record<string, {
    id: string; name: string; email: string; type: string;
    revenue: number; count: number; latest: string;
  }> = {};
  rows.forEach(p => {
    const c = (p.booking as any)?.customer;
    if (!c) return;
    const key = c.id;
    const displayName = c.account_type === 'company' && c.company_name
      ? c.company_name
      : (c.full_name ?? c.email);
    if (!customerMap[key]) {
      customerMap[key] = { id: c.id, name: displayName, email: c.email,
        type: c.account_type ?? 'individual', revenue: 0, count: 0, latest: '' };
    }
    customerMap[key].revenue += Number(p.amount);
    customerMap[key].count   += 1;
    const ts = p.reviewed_at ?? p.submitted_at ?? '';
    if (ts > customerMap[key].latest) customerMap[key].latest = ts;
  });
  const customerStats = Object.values(customerMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  /* ── Per-method breakdown ── */
  const methodMap: Record<string, number> = {};
  rows.forEach(p => {
    const m = p.method ?? 'other';
    methodMap[m] = (methodMap[m] ?? 0) + Number(p.amount);
  });
  const methodStats = Object.entries(methodMap).sort((a, b) => b[1] - a[1]);

  /* ── Recent 5 approved payments ── */
  const recent = rows.slice(0, 5);

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <p className="text-sm text-ink-900/50 font-medium mb-1">Finance Portal</p>
          <h1 className="display text-4xl text-ink-900">Revenue Dashboard</h1>
          <p className="text-sm text-ink-900/55 mt-1">
            Advertising revenue collected across all locations and customers.
          </p>
        </div>
        <Link href="/accountant/payments"
          className="btn btn-primary h-10 px-5 text-sm font-semibold flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Payments Queue
          {(pendingCount ?? 0) > 0 && (
            <span className="ml-1 bg-white/25 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-soft flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-brand"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <p className="text-sm text-ink-900/50 font-medium">Total Revenue</p>
          </div>
          <p className="display text-3xl font-extrabold text-ink-900">{money(totalRevenue)}</p>
          <p className="text-xs text-ink-900/40 mt-1">{rows.length} approved payments</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-blue-600"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <p className="text-sm text-ink-900/50 font-medium">This Month</p>
          </div>
          <p className="display text-3xl font-extrabold text-ink-900">{money(thisMonthRev)}</p>
          {momChange !== null && (
            <p className={`text-xs mt-1 font-semibold ${momChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {momChange >= 0 ? '+' : ''}{momChange.toFixed(1)}% vs last month
            </p>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-amber-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <p className="text-sm text-ink-900/50 font-medium">Pending Review</p>
          </div>
          <p className="display text-3xl font-extrabold text-amber-600">{pendingCount ?? 0}</p>
          <Link href="/accountant/payments" className="text-xs text-brand font-semibold mt-1 inline-block hover:underline">
            Review now
          </Link>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <p className="text-sm text-ink-900/50 font-medium">Rejected</p>
          </div>
          <p className="display text-3xl font-extrabold text-red-500">{rejectedCount ?? 0}</p>
          <p className="text-xs text-ink-900/40 mt-1">Total rejected payments</p>
        </div>
      </div>

      {/* ── Monthly trend bar chart ── */}
      <div className="card p-6">
        <h2 className="font-bold text-[15px] text-ink-900 mb-5">Revenue — Last 6 Months</h2>
        <div className="flex items-end gap-3 h-36">
          {monthLabels.map((lbl, i) => {
            const val = monthValues[i];
            const pct = maxMonth > 0 ? (val / maxMonth) * 100 : 0;
            const isCurrentMonth = i === monthLabels.length - 1;
            return (
              <div key={lbl} className="flex-1 flex flex-col items-center gap-2">
                <p className="text-[11px] font-semibold text-ink-900/60">{val > 0 ? money(val) : ''}</p>
                <div className="w-full flex items-end" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t-md transition-all ${isCurrentMonth ? 'bg-brand' : 'bg-brand/30'}`}
                    style={{ height: `${Math.max(pct, val > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <p className="mono text-[10px] text-ink-900/50 uppercase">{lbl}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom grid: locations + methods ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Per-location */}
        <div className="card p-6">
          <h2 className="font-bold text-[15px] text-ink-900 mb-4">Revenue by Location</h2>
          {locationStats.length === 0 ? (
            <p className="text-sm text-ink-900/40 py-4 text-center">No data yet</p>
          ) : (
            <div className="space-y-3">
              {locationStats.map(loc => {
                const pct = totalRevenue > 0 ? (loc.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={loc.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-ink-900/40"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span className="text-sm font-medium text-ink-900">{loc.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-ink-900">{money(loc.revenue)}</span>
                        <span className="text-xs text-ink-900/40 ml-2">{loc.count} paid</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="card p-6">
          <h2 className="font-bold text-[15px] text-ink-900 mb-4">Revenue by Payment Method</h2>
          {methodStats.length === 0 ? (
            <p className="text-sm text-ink-900/40 py-4 text-center">No data yet</p>
          ) : (
            <div className="space-y-3">
              {methodStats.map(([method, rev]) => {
                const pct = totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0;
                const label = method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink-900">{label}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-ink-900">{money(rev)}</span>
                        <span className="text-xs text-ink-900/40 ml-2">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-soft border border-brand/20 rounded-full"
                           style={{ width: `${pct}%`, background: 'var(--brand)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Top customers ── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[15px] text-ink-900">Top Customers by Revenue</h2>
          <span className="mono text-[11px] text-ink-900/40 uppercase tracking-widest">Top 10</span>
        </div>
        {customerStats.length === 0 ? (
          <p className="text-sm text-ink-900/40 py-4 text-center">No data yet</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 pb-2 mono text-[10px] uppercase tracking-widest text-ink-900/40">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Customer</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2 text-right">Campaigns</div>
              <div className="col-span-3 text-right">Total Paid</div>
            </div>
            {customerStats.map((c, i) => (
              <div key={c.id} className="grid grid-cols-12 gap-4 py-3 items-center">
                <div className="col-span-1">
                  <span className={`mono text-[13px] font-bold ${
                    i === 0 ? 'text-brand' : i === 1 ? 'text-ink-900/60' : 'text-ink-900/35'
                  }`}>{i + 1}</span>
                </div>
                <div className="col-span-4">
                  <p className="font-semibold text-sm text-ink-900 truncate">{c.name}</p>
                  <p className="text-[11px] text-ink-900/50 truncate">{c.email}</p>
                </div>
                <div className="col-span-2">
                  <span className={`pill text-[11px] ${
                    c.type === 'company'
                      ? 'text-blue-700 border-blue-200 bg-blue-50'
                      : 'text-ink-900/60'
                  }`}>
                    {c.type === 'company' ? 'Company' : 'Individual'}
                  </span>
                </div>
                <div className="col-span-2 text-right mono text-sm font-medium text-ink-900/70">
                  {c.count}
                </div>
                <div className="col-span-3 text-right">
                  <span className="font-bold text-sm text-ink-900">{money(c.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent approved payments ── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[15px] text-ink-900">Recent Approved Payments</h2>
          <Link href="/accountant/payments?filter=approved" className="text-sm text-brand font-semibold hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-900/40 py-4 text-center">No approved payments yet.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {recent.map((p: any) => {
              const c = p.booking?.customer;
              const name = c?.account_type === 'company' && c?.company_name
                ? c.company_name : (c?.full_name ?? c?.email ?? '—');
              return (
                <div key={p.id} className="py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{name}</p>
                    <p className="text-xs text-ink-900/50 truncate">
                      {p.booking?.ad?.title ?? '—'} · {p.booking?.location?.name ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-ink-900">{money(Number(p.amount))}</p>
                    <p className="mono text-[11px] text-ink-900/40">
                      {p.reviewed_at ? fmtDate(p.reviewed_at) : fmtDate(p.submitted_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
