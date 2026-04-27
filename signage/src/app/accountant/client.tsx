'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '@/lib/format';

interface Row {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  proof_url: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reject_reason: string | null;
  booking: any | null;
  campaign: any | null;
}

export default function Client({ payments }: { payments: Row[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const rows = filter === 'all' ? payments : payments.filter(p => p.status === filter);

  async function approve(id: string) {
    setActionErr(null);
    setSuccessMsg(`Approve clicked for ${id}`);
    setBusy(id);
    console.log('[approve] calling', `/api/payments/${id}/approve`);
    try {
      const res = await fetch(`/api/payments/${id}/approve`, { method: 'POST' });
      const text = await res.text();
      console.log('[approve] status:', res.status, 'body:', text);
      let json: any = {};
      try { json = JSON.parse(text); } catch {}
      if (!res.ok) { setActionErr(json.error ?? `HTTP ${res.status}: ${text}`); return; }
      setSuccessMsg('Payment approved successfully.');
      setTimeout(() => { router.refresh(); setSuccessMsg(null); }, 800);
    } catch (e: any) {
      console.error('[approve] fetch error:', e);
      setActionErr(e.message ?? 'Network error');
    } finally {
      setBusy(null);
    }
  }
  async function reject(id: string) {
    const reason = window.prompt('Reason for rejection?');
    if (!reason) return;
    setActionErr(null);
    setBusy(id);
    console.log('[reject] calling', `/api/payments/${id}/reject`);
    try {
      const res = await fetch(`/api/payments/${id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const text = await res.text();
      console.log('[reject] status:', res.status, 'body:', text);
      let json: any = {};
      try { json = JSON.parse(text); } catch {}
      if (!res.ok) { setActionErr(json.error ?? `HTTP ${res.status}: ${text}`); return; }
      setSuccessMsg('Payment rejected.');
      setTimeout(() => { router.refresh(); setSuccessMsg(null); }, 800);
    } catch (e: any) {
      console.error('[reject] fetch error:', e);
      setActionErr(e.message ?? 'Network error');
    } finally {
      setBusy(null);
    }
  }

  const counts = {
    pending:  payments.filter(p => p.status === 'pending').length,
    approved: payments.filter(p => p.status === 'approved').length,
    rejected: payments.filter(p => p.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="text-sm text-ink-900/50 font-medium mb-1">Finance Portal</p>
          <h1 className="display text-4xl text-ink-900">Payments Queue</h1>
        </div>
        <div className="flex items-center gap-2">
          {counts.pending > 0 && (
            <span className="badge badge-amber">{counts.pending} pending</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Review', value: counts.pending,  color: 'text-amber-600' },
          { label: 'Approved',       value: counts.approved, color: 'text-brand'     },
          { label: 'Rejected',       value: counts.rejected, color: 'text-red-600'   },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="text-sm text-ink-900/50 font-medium">{s.label}</p>
            <p className={`display text-4xl font-extrabold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {successMsg}
        </div>
      )}

      {/* Action error banner */}
      {actionErr && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div className="flex-1">
            <p className="font-semibold">Action failed</p>
            <p className="font-mono text-xs mt-0.5">{actionErr}</p>
          </div>
          <button onClick={() => setActionErr(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-ink-100 pb-0">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              filter === f
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-900/50 hover:text-ink-900'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && <span className="ml-1.5 text-xs text-ink-900/30">{counts[f as keyof typeof counts] ?? ''}</span>}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center text-ink-900/50">
          <p className="display text-xl">No {filter === 'all' ? '' : filter} payments to show.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(p => {
            // Resolve whether this is a campaign payment or a single-booking payment
            const isCampaign = !!p.campaign;
            const customer   = isCampaign ? p.campaign?.customer : p.booking?.customer;
            const adTitle    = isCampaign ? p.campaign?.ad?.title : p.booking?.ad?.title;
            const duration   = isCampaign ? p.campaign?.duration  : p.booking?.duration;
            const slotsPerDay= isCampaign ? p.campaign?.slots_per_day : p.booking?.slots_per_day;
            const startDate  = isCampaign ? p.campaign?.start_date : p.booking?.start_date;
            const endDate    = isCampaign ? p.campaign?.end_date   : p.booking?.end_date;
            const locations: string[] = isCampaign
              ? (p.campaign?.bookings ?? []).map((b: any) => b.location?.name).filter(Boolean)
              : [p.booking?.location?.name].filter(Boolean);

            return (
              <div key={p.id} className="card overflow-hidden">
                {/* Info row */}
                <div className="p-6 grid grid-cols-3 gap-6">

                  {/* Customer */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-ink-900/40 uppercase tracking-wider">Customer</p>
                      {isCampaign && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-brand text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                          {locations.length} screens
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-ink-900">{customer?.full_name ?? '—'}</p>
                    <p className="text-sm text-ink-900/55">{customer?.email}</p>
                    {customer?.phone && <p className="text-sm text-ink-900/55">{customer.phone}</p>}
                  </div>

                  {/* Campaign details */}
                  <div>
                    <p className="text-xs font-semibold text-ink-900/40 uppercase tracking-wider mb-1">Campaign</p>
                    <p className="font-semibold text-ink-900">{isCampaign ? p.campaign?.title : adTitle}</p>
                    {isCampaign && adTitle && <p className="text-xs text-ink-900/40 mb-1">{adTitle}</p>}
                    <p className="text-sm text-ink-900/55">{duration}s · {slotsPerDay}/day · {startDate} → {endDate}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {locations.map((loc: string) => (
                        <span key={loc} className="text-[11px] bg-ink-50 border border-ink-100 rounded-full px-2 py-0.5 text-ink-900/60">
                          {loc}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <p className="text-xs font-semibold text-ink-900/40 uppercase tracking-wider mb-1">Amount</p>
                    <p className="text-2xl font-extrabold text-ink-900">{money(Number(p.amount))}</p>
                    <p className="text-sm text-ink-900/55 mt-0.5 capitalize">{p.method.replace(/_/g, ' ')}</p>
                    {p.reference && <p className="text-xs text-ink-900/40 font-mono mt-0.5">{p.reference}</p>}
                    <p className="text-xs text-ink-900/30 mt-1">{new Date(p.submitted_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Action bar — separate row, always full-width, never overlapped */}
                <div className="border-t border-ink-100 bg-ink-50/40 px-6 py-3 flex items-center justify-between gap-4">
                  <a href={p.proof_url} target="_blank" rel="noreferrer"
                    className="btn btn-ghost h-9 px-4 text-sm">
                    View proof ↗
                  </a>

                  <div className="flex items-center gap-3">
                    {p.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy === p.id}
                          onClick={() => reject(p.id)}
                          className="btn btn-danger h-9 px-5 text-sm">
                          {busy === p.id ? '…' : 'Reject'}
                        </button>
                        <button
                          type="button"
                          disabled={busy === p.id}
                          onClick={() => approve(p.id)}
                          className="btn btn-primary h-9 px-5 text-sm flex items-center gap-2">
                          {busy === p.id
                            ? 'Processing…'
                            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Approve</>}
                        </button>
                      </>
                    ) : (
                      <span className={`badge flex items-center gap-1.5 ${p.status === 'approved' ? 'badge-green' : 'badge-red'}`}>
                        {p.status === 'approved'
                          ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Approved</>
                          : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Rejected</>}
                      </span>
                    )}
                  </div>
                </div>

                {p.reject_reason && (
                  <div className="flex gap-2 items-start bg-red-50 border-t border-red-200 px-6 py-3 text-sm text-red-700">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span><strong>Rejection reason:</strong> {p.reject_reason}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
