'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { money } from '@/lib/format';

interface BookingShape {
  id: string; status: string; total_price: number;
  start_date: string; end_date: string; duration: string; slots_per_day: number;
  ad: { title: string } | null;
  location: { name: string } | null;
}

interface PaymentSetting {
  method: string;
  label: string;
  instructions: string;
  is_enabled: boolean;
  sort_order: number;
}

export default function PaymentForm({ booking, paymentSettings }: { booking: BookingShape; paymentSettings: PaymentSetting[] }) {
  const router = useRouter();
  const supa = supabaseBrowser();
  const methods = paymentSettings.length > 0 ? paymentSettings : [
    { method: 'ecocash', label: 'EcoCash', instructions: '', is_enabled: true, sort_order: 1 },
  ];
  const [method, setMethod] = useState<string>(methods[0]?.method ?? 'ecocash');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locked = !['awaiting_payment', 'rejected'].includes(booking.status);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!proof) { setErr('Please upload a proof of payment.'); return; }

    setBusy(true);
    try {
      const { data: { user } } = await supa.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = proof.name.split('.').pop() || 'bin';
      const path = `${user.id}/${booking.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supa.storage.from('payment-proofs').upload(path, proof, {
        contentType: proof.type, upsert: true,
      });
      if (upErr) throw new Error(upErr.message);

      // Signed URL used so staff can view the proof
      const { data: signed } = await supa.storage.from('payment-proofs').createSignedUrl(path, 60 * 60 * 24 * 30);

      const res = await fetch('/api/payments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          amount: Number(booking.total_price),
          method,
          reference: reference || null,
          proof_path: path,
          proof_url: signed?.signedUrl ?? '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const chosen = methods.find(m => m.method === method) ?? methods[0];

  return (
    <div className="grid grid-cols-12 gap-8">
      <section className="col-span-12 lg:col-span-8 space-y-6">
        <div className="page-header">
          <div>
            <p className="text-sm text-ink-900/50 font-medium mb-1">Step 3 of 3</p>
            <h1 className="display text-4xl text-ink-900">Complete Payment</h1>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* Method selector */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="step-num">1</span>
              <h2 className="display text-xl font-extrabold">Choose payment method</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {methods.map(m => (
                <button key={m.method} type="button" onClick={() => setMethod(m.method)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold text-left transition-all ${
                    method === m.method
                      ? 'border-brand bg-brand-soft text-brand-dark'
                      : 'border-ink-200 bg-white text-ink-900/70 hover:border-brand/40'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            {chosen?.instructions && (
              <div className="flex gap-3 items-start bg-brand-soft/60 border border-brand/20 rounded-xl p-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-brand"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <div>
                  <p className="font-semibold text-brand-dark text-sm">{chosen.label} instructions</p>
                  <p className="text-sm text-ink-900/70 mt-0.5 whitespace-pre-line">{chosen.instructions}</p>
                </div>
              </div>
            )}
          </div>

          {/* Reference + proof */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-3">
              <span className="step-num">2</span>
              <h2 className="display text-xl font-extrabold">Upload proof of payment</h2>
            </div>

            <div>
              <label className="label">Transaction reference <span className="normal-case font-normal text-ink-900/40">(optional)</span></label>
              <input className="input" value={reference} onChange={e => setReference(e.target.value)}
                placeholder="e.g. EC2409241812ZWJ" />
            </div>

            <div>
              <label className="label">Proof of payment <span className="normal-case font-normal text-ink-900/40">(screenshot or PDF)</span></label>
              <label className="upload-zone block">
                <input type="file" accept="image/*,.pdf" className="sr-only"
                  onChange={e => setProof(e.target.files?.[0] ?? null)} />
                {proof ? (
                  <div className="flex items-center justify-center gap-3 text-brand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    <span className="font-medium">{proof.name}</span>
                    <span className="text-ink-900/40 text-sm">{Math.round(proof.size/1024)} KB</span>
                  </div>
                ) : (
                  <div className="text-ink-900/50">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-2 text-ink-900/30"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p className="font-medium text-sm">Click to upload proof</p>
                    <p className="text-xs mt-1">PNG, JPG or PDF</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {locked && (
            <div className="flex gap-3 items-center bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              This booking is <strong className="ml-1">{booking.status.replace(/_/g, ' ')}</strong> — payment cannot be submitted.
            </div>
          )}
          {err && (
            <div className="flex gap-3 items-center bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {err}
            </div>
          )}

          <button disabled={busy || locked} className="btn btn-primary w-full h-12 text-[15px]">
            {busy ? 'Uploading proof…' : 'Submit payment proof →'}
          </button>
        </form>
      </section>

      {/* Order summary sidebar */}
      <aside className="col-span-12 lg:col-span-4">
        <div className="card p-6 sticky top-24 space-y-4">
          <h2 className="display text-xl font-extrabold">Order summary</h2>
          <div className="space-y-3">
            {[
              { k: 'Campaign', v: booking.ad?.title ?? '—' },
              { k: 'Location', v: booking.location?.name ?? '—' },
              { k: 'Duration', v: `${booking.duration} seconds` },
              { k: 'Slots / day', v: String(booking.slots_per_day) },
              { k: 'Campaign dates', v: `${booking.start_date} → ${booking.end_date}` },
            ].map(({ k, v }) => (
              <div key={k} className="flex justify-between text-sm gap-4">
                <span className="text-ink-900/55">{k}</span>
                <span className="font-semibold text-ink-900 text-right">{v}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-ink-100 pt-4">
            <p className="text-sm text-ink-900/55 mb-1">Amount due</p>
            <p className="display text-4xl font-extrabold text-ink-900">{money(Number(booking.total_price))}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink-900/60">{k}</span>
      <span>{v}</span>
    </div>
  );
}
