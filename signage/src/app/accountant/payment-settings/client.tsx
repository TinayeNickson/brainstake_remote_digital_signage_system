'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SettingRow {
  method:       string;
  label:        string;
  instructions: string;
  is_enabled:   boolean;
  sort_order:   number;
}

const METHOD_KEYS = ['ecocash', 'onemoney', 'bank_transfer', 'cash', 'other'] as const;
const DEFAULT_LABELS: Record<string, string> = {
  ecocash:       'EcoCash',
  onemoney:      'OneMoney',
  bank_transfer: 'Bank Transfer',
  cash:          'Cash Deposit',
  other:         'Other',
};

export default function PaymentSettingsClient({ initial }: { initial: SettingRow[] }) {
  const router = useRouter();

  // Build a keyed state map so every method is always present
  const [rows, setRows] = useState<SettingRow[]>(() => {
    const map = Object.fromEntries(initial.map(r => [r.method, r]));
    return METHOD_KEYS.map((m, i) => map[m] ?? {
      method: m,
      label: DEFAULT_LABELS[m],
      instructions: '',
      is_enabled: true,
      sort_order: i + 1,
    });
  });

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function update(method: string, field: keyof SettingRow, value: string | boolean) {
    setSaved(false);
    setRows(prev => prev.map(r => r.method === method ? { ...r, [field]: value } : r));
  }

  async function save() {
    setBusy(true); setErr(null); setSaved(false);
    const res = await fetch('/api/accountant/payment-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed to save'); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div className="page-header">
        <div>
          <p className="text-sm text-ink-900/50 font-medium mb-1">Finance Portal · Configuration</p>
          <h1 className="display text-4xl text-ink-900">Payment Settings</h1>
          <p className="text-sm text-ink-900/55 mt-1 max-w-xl">
            These instructions are shown to customers on the payment page. Keep them current — any change is live immediately.
          </p>
        </div>
      </div>

      {/* Feedback */}
      {err   && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{err}</div>}
      {saved && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Payment settings saved — customers will see updated instructions immediately.
        </div>
      )}

      {/* Settings cards */}
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.method}
               className={`card p-5 transition-all ${row.is_enabled ? '' : 'opacity-50'}`}>

            {/* Row header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                  <MethodIcon method={row.method} />
                </div>
                <div>
                  <input
                    className="input h-8 text-[14px] font-semibold w-48 px-2"
                    value={row.label}
                    onChange={e => update(row.method, 'label', e.target.value)}
                    placeholder="Display name"
                  />
                  <p className="mono text-[10px] text-ink-900/35 uppercase tracking-widest mt-1">
                    {row.method}
                  </p>
                </div>
              </div>

              {/* Enable / Disable toggle */}
              <button
                type="button"
                onClick={() => update(row.method, 'is_enabled', !row.is_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  row.is_enabled ? 'bg-brand' : 'bg-ink-200'
                }`}
                aria-label={row.is_enabled ? 'Disable' : 'Enable'}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  row.is_enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Instructions textarea */}
            <div>
              <label className="label">Instructions shown to customer</label>
              <textarea
                className="textarea w-full resize-none text-sm leading-relaxed"
                rows={3}
                value={row.instructions}
                onChange={e => update(row.method, 'instructions', e.target.value)}
                placeholder={`e.g. Send to +263 77 … · Reference: your booking ID`}
                disabled={!row.is_enabled}
              />
              <p className="text-[11px] text-ink-900/40 mt-1">
                Shown inside the blue info box on the customer payment page.
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-4 pb-8">
        <button onClick={save} disabled={busy}
                className="btn btn-primary h-11 px-8 font-semibold text-[15px]">
          {busy ? 'Saving…' : 'Save All Settings'}
        </button>
        <p className="text-sm text-ink-900/40">
          Changes apply instantly — no restart required.
        </p>
      </div>
    </div>
  );
}

function MethodIcon({ method }: { method: string }) {
  if (method === 'ecocash' || method === 'onemoney') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-brand">
        <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
      </svg>
    );
  }
  if (method === 'bank_transfer') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-brand">
        <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    );
  }
  if (method === 'cash') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-brand">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-brand">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
