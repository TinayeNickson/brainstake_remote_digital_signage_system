'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { money } from '@/lib/format';

interface CampaignShape {
  id: string;
  title: string;
  total_price: number;
  duration: string;
  slots_per_day: number;
  start_date: string;
  end_date: string;
  scheduled_days_count: number;
}

interface ExistingPayment {
  id: string;
  status: string;
  amount: number;
  method: string;
  submitted_at: string;
}

interface BookingLine {
  id: string;
  total_price: number;
  price_per_slot: number;
  location: { name: string } | null;
}

interface PaymentSetting {
  method: string;
  label: string;
  instructions: string;
  is_enabled: boolean;
  sort_order: number;
}

export default function CampaignPaymentForm({
  campaign,
  bookings,
  paymentSettings,
  campaignStatus,
  existingPayment,
}: {
  campaign: CampaignShape;
  bookings: BookingLine[];
  paymentSettings: PaymentSetting[];
  campaignStatus: string;
  existingPayment: ExistingPayment | null;
}) {
  const router = useRouter();
  const supa = supabaseBrowser();

  const canPay = ['awaiting_payment', 'rejected'].includes(campaignStatus);

  const methods = paymentSettings.length > 0 ? paymentSettings : [
    { method: 'ecocash', label: 'EcoCash', instructions: '', is_enabled: true, sort_order: 1 },
  ];
  const [method,    setMethod]    = useState<string>(methods[0]?.method ?? 'ecocash');
  const [reference, setReference] = useState('');
  const [proof,     setProof]     = useState<File | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  const chosen = methods.find(m => m.method === method) ?? methods[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!proof) { setErr('Please upload a proof of payment.'); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supa.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext  = proof.name.split('.').pop() || 'bin';
      const path = `${user.id}/campaign-${campaign.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supa.storage.from('payment-proofs').upload(path, proof, {
        contentType: proof.type, upsert: true,
      });
      if (upErr) throw new Error(upErr.message);

      const { data: signed } = await supa.storage
        .from('payment-proofs')
        .createSignedUrl(path, 60 * 60 * 24 * 30);

      const res = await fetch('/api/payments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.id,
          amount:      Number(campaign.total_price),
          method,
          reference:   reference || null,
          proof_path:  path,
          proof_url:   signed?.signedUrl ?? '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-7 py-8">

      {/* Header */}
      <div>
        <p className="text-sm text-ink-900/50 font-medium mb-0.5">Multi-Screen Campaign</p>
        <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
          {canPay ? 'Complete Payment' : campaignStatus === 'payment_submitted' ? 'Payment Received' : 'Campaign Details'}
        </h1>
        <p className="text-sm text-ink-900/50 mt-1">{campaign.title}</p>
      </div>

      {/* Status banner when not awaiting payment */}
      {campaignStatus === 'payment_submitted' && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-blue-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <p className="font-bold text-blue-800 text-lg">Proof of payment received</p>
            <p className="text-blue-700/80 text-sm mt-1">
              Your payment is being reviewed by our team. You will be notified once your campaign is activated.
            </p>
            {existingPayment && (
              <p className="text-blue-600/70 text-xs mt-2">
                Submitted {new Date(existingPayment.submitted_at).toLocaleString()} via {existingPayment.method}
              </p>
            )}
          </div>
        </div>
      )}

      {campaignStatus === 'active' && (
        <div className="rounded-2xl bg-brand-soft border border-brand/20 p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>
          </div>
          <div>
            <p className="font-bold text-brand-dark text-lg">Campaign is live</p>
            <p className="text-ink-900/60 text-sm mt-1">Your ads are running on the selected screens.</p>
          </div>
        </div>
      )}

      {campaignStatus === 'rejected' && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-600"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <p className="font-bold text-red-800 text-lg">Payment was rejected</p>
            <p className="text-red-700/80 text-sm mt-1">Please resubmit your proof of payment below.</p>
          </div>
        </div>
      )}

      {/* Campaign summary card */}
      <div className="card p-5 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-900/35">Campaign Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SumCard label="Duration" value={`${campaign.duration}s`} />
          <SumCard label="Plays/day" value={String(campaign.slots_per_day)} />
          <SumCard label="Scheduled days" value={String(campaign.scheduled_days_count)} />
          <SumCard label="Screens" value={String(bookings.length)} />
        </div>
        <div className="text-xs text-ink-900/45">
          {campaign.start_date} &rarr; {campaign.end_date}
        </div>
      </div>

      {/* Per-location breakdown */}
      <div className="card overflow-hidden">
        <div className="data-header">
          <span>Screen / Location</span>
          <span>Price/slot</span>
          <span className="text-right">Subtotal</span>
        </div>
        {bookings.map(b => (
          <div key={b.id} className="row-hover grid grid-cols-3 px-4 py-3 text-sm">
            <span className="flex items-center gap-2 text-ink-900 font-medium">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {b.location?.name ?? '—'}
            </span>
            <span className="text-ink-900/60">{money(b.price_per_slot)}</span>
            <span className="text-right font-semibold text-ink-900">{money(b.total_price)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-4 bg-ink-50 border-t border-ink-100">
          <p className="text-sm font-bold text-ink-900">Grand Total</p>
          <p className="text-2xl font-bold text-brand">{money(campaign.total_price)}</p>
        </div>
      </div>

      {/* Payment form — only shown when payment is needed */}
      {canPay && (
        <form onSubmit={submit} className="card p-6 space-y-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-900/35">Payment Details</p>

          {/* Method tabs */}
          <div>
            <label className="label">Payment method</label>
            <div className="flex flex-wrap gap-2">
              {methods.map(m => (
                <button key={m.method} type="button"
                  onClick={() => setMethod(m.method)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    method === m.method
                      ? 'border-brand bg-brand-soft/30 text-brand'
                      : 'border-ink-100 bg-white text-ink-900/60 hover:border-brand/30'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          {chosen?.instructions && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Payment instructions
              </p>
              <p className="text-amber-800/80 whitespace-pre-line">{chosen.instructions}</p>
            </div>
          )}

          {/* Amount display */}
          <div className="rounded-xl border-2 border-brand/20 bg-brand-soft/20 p-4 flex items-center justify-between">
            <p className="text-sm text-ink-900/60 font-medium">Amount to pay</p>
            <p className="text-3xl font-bold text-brand">{money(campaign.total_price)}</p>
          </div>

          {/* Reference */}
          <div>
            <label className="label">Transaction reference <span className="text-ink-900/30 font-normal normal-case">(optional)</span></label>
            <input className="input" value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. EcoCash transaction ID" />
          </div>

          {/* Proof upload */}
          <div>
            <label className="label">
              Proof of payment <span className="text-red-500">*</span>
              <span className="text-ink-900/35 font-normal normal-case text-xs ml-1">Screenshot or PDF — max 10 MB</span>
            </label>
            <label className="upload-zone block cursor-pointer">
              <input type="file" accept="image/*,application/pdf" className="sr-only"
                onChange={e => { setProof(e.target.files?.[0] ?? null); setErr(null); }} />
              {proof ? (
                <div className="flex flex-col items-center gap-2 py-2 text-brand">
                  <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p className="font-semibold text-sm text-ink-900">{proof.name}</p>
                  <span className="text-xs text-brand underline">Click to change</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2 text-ink-900/40">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p className="font-semibold text-sm text-ink-900/60">Click to upload proof</p>
                </div>
              )}
            </label>
          </div>

          {err && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {err}
            </div>
          )}

          <button type="submit" disabled={busy}
            className="btn btn-primary w-full h-12 font-semibold text-[15px]">
            {busy ? 'Submitting…' : `Submit Payment — ${money(campaign.total_price)}`}
          </button>
        </form>
      )}
    </div>
  );
}

function SumCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 border border-ink-100 px-3 py-2.5 text-center">
      <p className="text-[10px] text-ink-900/40 font-semibold uppercase tracking-widest mb-0.5">{label}</p>
      <p className="font-bold text-ink-900 text-lg">{value}</p>
    </div>
  );
}
