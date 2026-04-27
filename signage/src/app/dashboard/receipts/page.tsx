import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase-server';
import { money } from '@/lib/format';

export default async function ReceiptsPage() {
  const supabase = supabaseServer();
  const { data: receipts } = await supabase
    .from('receipts')
    .select(`
      id, receipt_number, amount, issued_at,
      booking:bookings(
        start_date, end_date, duration, slots_per_day,
        location:locations(name),
        ad:ads(title)
      )
    `)
    .order('issued_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <p className="text-sm text-ink-900/50 font-medium mb-1">Billing</p>
          <h1 className="display text-4xl text-ink-900">My Receipts</h1>
        </div>
      </div>

      {!receipts?.length ? (
        <div className="card p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <h2 className="display text-2xl mb-2">No receipts yet</h2>
          <p className="text-ink-900/60 max-w-xs mx-auto">Receipts are issued once your payment is approved. Check back here after paying.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {receipts.map((r: any) => (
            <div key={r.id} className="card card-hover p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Receipt icon + number */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="w-11 h-11 rounded-xl bg-brand-soft flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-ink-900/50 font-medium">Receipt</p>
                  <p className="font-bold text-ink-900 mono">{r.receipt_number}</p>
                </div>
              </div>

              {/* Campaign details */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-900 truncate">{r.booking?.ad?.title}</p>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-900/55 mt-0.5">
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {r.booking?.location?.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {r.booking?.duration}s
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    {r.booking?.slots_per_day}/day
                  </span>
                </div>
              </div>

              {/* Date */}
              <div className="text-sm text-ink-900/50 shrink-0">
                {new Date(r.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>

              {/* Amount + View */}
              <div className="text-right shrink-0 space-y-2">
                <p className="display text-2xl font-extrabold text-ink-900">{money(Number(r.amount))}</p>
                <div className="flex items-center gap-2 justify-end">
                  <span className="badge badge-green text-xs">Paid</span>
                  <Link href={`/dashboard/receipts/${r.id}`}
                    className="text-xs font-semibold text-brand hover:underline">
                    View →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
