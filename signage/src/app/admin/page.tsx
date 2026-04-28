import { supabaseServer } from '@/lib/supabase-server';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const supabase = supabaseServer();

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, start_date, end_date, duration, slots_per_day,
      status, device_id, created_at, approved_at,
      ad:ads(title, format, duration, media_url),
      location:locations(name),
      customer:profiles!bookings_customer_id_fkey(full_name, email),
      device:devices(code, name)
    `)
    .eq('status', 'active')
    .order('approved_at', { ascending: false });

  const rows = bookings ?? [];
  const unassigned = rows.filter((b: any) => !b.device_id).length;

  return (
    <div className="space-y-7">

      {/* Page header */}
      <div className="page-header">
        <div>
          <span className="section-label">Admin Portal</span>
          <h1 className="display text-4xl text-ink-900">Approved Ads</h1>
          <p className="text-sm text-ink-900/50 mt-1 max-w-lg">
            All bookings below have verified payments and are actively playing on screens.
            Use <span className="font-semibold text-ink-900">Ad&thinsp;&rarr;&thinsp;Screen</span> to assign unplaced ads.
          </p>
        </div>
        {unassigned > 0 && (
          <span className="badge badge-amber shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {unassigned} unassigned
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Live Ads</p>
          <p className="display text-4xl font-extrabold text-brand leading-none">{rows.length}</p>
          <p className="text-xs text-ink-900/40 mt-2">Currently broadcasting</p>
        </div>
        <div className="stat-card stat-card-amber">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Awaiting Placement</p>
          <p className="display text-4xl font-extrabold text-amber-600 leading-none">{unassigned}</p>
          <p className="text-xs text-ink-900/40 mt-2">No screen assigned yet</p>
        </div>
      </div>

      {/* Ads list */}
      {rows.length === 0 ? (
        <div className="paper p-14 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-brand">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <p className="display text-xl text-ink-900/60 mb-1">No approved ads yet</p>
          <p className="text-sm text-ink-900/40 max-w-xs">
            Once a customer&rsquo;s payment is verified by the accountant, their ad will appear here.
          </p>
        </div>
      ) : (
        <div className="paper overflow-hidden">
          {/* Table header */}
          <div className="data-header grid-cols-12 hidden sm:grid">
            <div className="col-span-5">Ad · Customer</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-2">Schedule</div>
            <div className="col-span-2">Screen</div>
          </div>

          <div className="divide-y divide-ink-100">
            {rows.map((b: any) => (
              <div key={b.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover transition-colors">

                {/* Thumbnail + Ad info */}
                <div className="col-span-12 sm:col-span-5 flex items-center gap-4 min-w-0">
                  <div className="shrink-0 w-[72px] h-[48px] rounded-lg overflow-hidden bg-ink-100 border border-ink-100">
                    {b.ad?.format === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.ad.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-ink-900/5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-ink-900/30">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[13.5px] text-ink-900 truncate">{b.ad?.title}</span>
                      <span className="badge badge-green shrink-0">Live</span>
                    </div>
                    <p className="text-[12px] text-ink-900/50 truncate mt-0.5">{b.customer?.full_name ?? b.customer?.email ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-900/45 mono">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {b.duration}s
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-900/45 mono">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        {b.slots_per_day}/day
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="col-span-4 sm:col-span-2">
                  <p className="text-[13px] text-ink-900 font-medium truncate">{b.location?.name ?? '—'}</p>
                </div>

                {/* Schedule */}
                <div className="col-span-4 sm:col-span-2">
                  <p className="text-[12px] text-ink-900/70 mono">{fmtDate(b.start_date)}</p>
                  <p className="text-[11px] text-ink-900/40 mono">→ {fmtDate(b.end_date)}</p>
                </div>

                {/* Screen */}
                <div className="col-span-4 sm:col-span-2">
                  {b.device ? (
                    <>
                      <p className="text-[13px] text-ink-900 font-medium truncate">{b.device.name}</p>
                      <p className="text-[11px] text-ink-900/40 mono">{b.device.code}</p>
                    </>
                  ) : (
                    <span className="badge badge-amber">Unassigned</span>
                  )}
                </div>


              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
